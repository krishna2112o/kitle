import { createServerFn } from "@tanstack/react-start";
import { MODES, type ChatMode } from "./modes";
import { PROVIDERS, type ProviderId } from "./providers";

type ChatMsg = { role: "user" | "assistant"; content: string };
type FileMap = Record<string, string>;

export type GenerateInput = {
  messages: ChatMsg[];
  currentFiles: FileMap;
  mode?: ChatMode;
  userApiKey?: string; // BYOK API key for the selected provider
  userModel?: string; // optional model id override
  userProvider?: ProviderId; // BYOK provider — gemini | openai | anthropic | mistral | xai
};

export type GenerateResult = {
  files: FileMap;
  summary: string;
  mode: ChatMode;
  outputs: "files" | "text";
};

const EMIT_TOOL = {
  type: "function" as const,
  function: {
    name: "emit_project",
    description: "Emit the complete set of project files plus a short summary.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "files"],
      additionalProperties: false,
    },
  },
};

export const generateProject = createServerFn({ method: "POST" })
  .inputValidator((input: GenerateInput) => {
    if (!input || !Array.isArray(input.messages)) {
      throw new Error("Invalid input: messages required");
    }
    return input;
  })
  .handler(async ({ data }): Promise<GenerateResult> => {
    const modeId: ChatMode = data.mode ?? "website";
    const mode = MODES[modeId];

    const usingByok = !!data.userApiKey?.trim();
    const apiKey = usingByok ? data.userApiKey!.trim() : process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const wantsFiles = mode.outputs === "files";
    const hasCurrent = wantsFiles && Object.keys(data.currentFiles).length > 0;
    const contextMsg: ChatMsg | null = hasCurrent
      ? {
          role: "user",
          content:
            "CURRENT PROJECT FILES (modify these — do not start over):\n\n" +
            Object.entries(data.currentFiles)
              .map(([p, c]) => `=== ${p} ===\n${c}`)
              .join("\n\n"),
        }
      : null;

    const messages = [
      { role: "system", content: mode.systemPrompt },
      ...(contextMsg ? [contextMsg] : []),
      ...data.messages,
    ];

    // Endpoint + model selection
    let endpoint: string;
    let headers: Record<string, string>;
    let modelId: string;
    let providerSupportsTools = true;

    if (usingByok) {
      const providerId: ProviderId =
        data.userProvider && PROVIDERS[data.userProvider] ? data.userProvider : "gemini";
      const p = PROVIDERS[providerId];
      endpoint = p.endpoint;
      modelId = data.userModel?.trim() || p.defaultModel;
      providerSupportsTools = p.supportsTools;
      headers = { "Content-Type": "application/json", ...(p.extraHeaders || {}) };
      if (p.authHeader === "x-api-key") {
        headers["x-api-key"] = apiKey;
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    } else {
      endpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
      headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      modelId = "google/gemini-3-flash-preview";
    }

    const body: Record<string, unknown> = {
      model: modelId,
      messages,
      max_tokens: wantsFiles ? 16000 : 4000,
    };
    if (wantsFiles && providerSupportsTools) {
      body.tools = [EMIT_TOOL];
      body.tool_choice = { type: "function", function: { name: "emit_project" } };
    }

    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      if (resp.status === 429) throw new Error("Rate limited. Please wait and try again.");
      if (resp.status === 402)
        throw new Error("AI credits exhausted. Add credits in Workspace Settings.");
      if (resp.status === 401 || resp.status === 403) {
        throw new Error(
          usingByok
            ? `Invalid ${PROVIDERS[(data.userProvider as ProviderId) || "gemini"]?.label ?? "provider"} API key.`
            : "AI gateway authentication failed.",
        );
      }
      console.error("AI error", resp.status, t);
      throw new Error(`AI error (${resp.status}): ${t.slice(0, 200)}`);
    }

    const json = await resp.json();
    const choice = json?.choices?.[0]?.message;

    if (wantsFiles) {
      const toolCall = choice?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        throw new Error("Model did not return a project. Try again.");
      }
      let args: { summary: string; files: { path: string; content: string }[] };
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        throw new Error("Failed to parse model output.");
      }
      const fileMap: FileMap = {};
      for (const f of args.files) {
        const path = f.path.startsWith("/") ? f.path : `/${f.path}`;
        fileMap[path] = f.content;
      }
      return {
        files: fileMap,
        summary: args.summary || "Project updated.",
        mode: modeId,
        outputs: "files",
      };
    }

    // Text mode
    const text = (choice?.content ?? "").toString().trim();
    if (!text) throw new Error("Model returned an empty response.");
    return { files: {}, summary: text, mode: modeId, outputs: "text" };
  });
