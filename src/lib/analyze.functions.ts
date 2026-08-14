import { createServerFn } from "@tanstack/react-start";

export type AnalyzeInput = {
  prompt: string;
  fileName?: string;
  fileContent?: string;
};

export type ChartSpec = {
  type: "bar" | "line" | "pie" | "area";
  title: string;
  description?: string;
  xKey: string;
  yKeys: string[];
  data: Record<string, string | number>[];
};

export type Insight = {
  title: string;
  detail: string;
};

export type Kpi = {
  label: string;
  value: string;
  delta?: string;
};

export type AnalyzeResult = {
  summary: string;
  kpis: Kpi[];
  insights: Insight[];
  charts: ChartSpec[];
  recommendations: string[];
};

const SYSTEM_PROMPT = `You are a senior data analyst. The user provides either raw data (CSV/JSON/TXT) and/or a prompt describing what they want analyzed. Your job:

1. Understand the dataset (or topic if no data is provided — then synthesize realistic illustrative data).
2. Compute useful aggregations and trends.
3. Return a MASSIVE, polished analysis via the emit_analysis tool with:
   - summary: 2-4 sentence executive summary.
   - kpis: 3-6 headline metrics (label + value, optional delta like "+12.4%").
   - insights: 4-8 specific findings with title + detail.
   - charts: 3-6 chart specs. Mix types (bar, line, pie, area). Each chart has type, title, description, xKey, yKeys (1-3 series), and data rows. Data rows use the keys from xKey + yKeys. Numeric series MUST be numbers, not strings. Keep each chart to 5-15 data points.
   - recommendations: 3-6 concrete next-step actions.

STRICT: Always call the tool. Never reply in prose. Numeric values in chart data must be JSON numbers.`;

export const analyzeData = createServerFn({ method: "POST" })
  .inputValidator((input: AnalyzeInput) => {
    if (!input || (typeof input.prompt !== "string" && typeof input.fileContent !== "string")) {
      throw new Error("Provide a prompt or file content.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const userParts: string[] = [];
    if (data.prompt?.trim()) userParts.push(`USER PROMPT:\n${data.prompt.trim()}`);
    if (data.fileContent?.trim()) {
      const truncated = data.fileContent.slice(0, 60000);
      userParts.push(
        `UPLOADED FILE${data.fileName ? ` (${data.fileName})` : ""}:\n\`\`\`\n${truncated}\n\`\`\``,
      );
    }
    if (!userParts.length) userParts.push("Generate an example analytics dashboard.");

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userParts.join("\n\n") },
      ],
      max_tokens: 8000,
      tools: [
        {
          type: "function",
          function: {
            name: "emit_analysis",
            description: "Emit a complete analytics report with KPIs, insights, charts, and recommendations.",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                kpis: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      value: { type: "string" },
                      delta: { type: "string" },
                    },
                    required: ["label", "value"],
                  },
                },
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      detail: { type: "string" },
                    },
                    required: ["title", "detail"],
                  },
                },
                charts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["bar", "line", "pie", "area"] },
                      title: { type: "string" },
                      description: { type: "string" },
                      xKey: { type: "string" },
                      yKeys: { type: "array", items: { type: "string" } },
                      data: {
                        type: "array",
                        items: { type: "object", additionalProperties: true },
                      },
                    },
                    required: ["type", "title", "xKey", "yKeys", "data"],
                  },
                },
                recommendations: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "kpis", "insights", "charts", "recommendations"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_analysis" } },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      if (resp.status === 429) throw new Error("Rate limited. Please wait a moment.");
      if (resp.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace Settings → Usage.");
      const t = await resp.text().catch(() => "");
      console.error("AI gateway error", resp.status, t);
      throw new Error(`AI gateway error (${resp.status})`);
    }

    const json = await resp.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("Model did not return analysis. Try again.");

    let parsed: AnalyzeResult;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Failed to parse analysis output.");
    }
    return parsed;
  });
