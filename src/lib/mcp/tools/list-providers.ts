import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_providers",
  title: "List BYOK providers",
  description:
    "List the AI providers this app can connect to using a user-supplied API key (Gemini, OpenAI, Anthropic, Mistral, xAI).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const providers = [
      {
        id: "gemini",
        label: "Google Gemini",
        defaultModel: "gemini-2.5-flash",
        keyUrl: "https://aistudio.google.com/apikey",
      },
      {
        id: "openai",
        label: "OpenAI (ChatGPT)",
        defaultModel: "gpt-4o-mini",
        keyUrl: "https://platform.openai.com/api-keys",
      },
      {
        id: "anthropic",
        label: "Anthropic Claude",
        defaultModel: "claude-3-5-haiku-latest",
        keyUrl: "https://console.anthropic.com/settings/keys",
      },
      {
        id: "mistral",
        label: "Mistral AI",
        defaultModel: "mistral-small-latest",
        keyUrl: "https://console.mistral.ai/api-keys/",
      },
      {
        id: "xai",
        label: "xAI Grok",
        defaultModel: "grok-2-latest",
        keyUrl: "https://console.x.ai/",
      },
    ];
    return {
      content: [{ type: "text", text: JSON.stringify(providers, null, 2) }],
      structuredContent: { providers },
    };
  },
});
