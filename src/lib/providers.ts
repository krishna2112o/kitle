// BYOK chat providers — user-supplied API keys, called directly from the server function.
// All providers below expose an OpenAI-compatible /chat/completions endpoint.

export type ProviderId = "gemini" | "openai" | "anthropic" | "mistral" | "xai";

export type ProviderDef = {
  id: ProviderId;
  label: string;
  short: string;
  endpoint: string;
  defaultModel: string;
  models: string[];
  keyPlaceholder: string;
  keyHint: string;
  keyUrl: string;
  // Some providers (Anthropic) prefer their own header, but they also accept Bearer.
  authHeader?: "bearer" | "x-api-key";
  // Optional extra headers required by the provider.
  extraHeaders?: Record<string, string>;
  // Whether this provider reliably supports OpenAI-style function tools.
  supportsTools: boolean;
};

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    short: "Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-1.5-pro"],
    keyPlaceholder: "AIza…",
    keyHint: "Free key from Google AI Studio.",
    keyUrl: "https://aistudio.google.com/apikey",
    authHeader: "bearer",
    supportsTools: true,
  },
  openai: {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    short: "ChatGPT",
    endpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1", "o4-mini"],
    keyPlaceholder: "sk-…",
    keyHint: "From platform.openai.com/api-keys.",
    keyUrl: "https://platform.openai.com/api-keys",
    authHeader: "bearer",
    supportsTools: true,
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic Claude",
    short: "Claude",
    endpoint: "https://api.anthropic.com/v1/chat/completions",
    defaultModel: "claude-3-5-haiku-latest",
    models: [
      "claude-3-5-haiku-latest",
      "claude-3-5-sonnet-latest",
      "claude-sonnet-4-5",
      "claude-opus-4-1",
    ],
    keyPlaceholder: "sk-ant-…",
    keyHint: "From console.anthropic.com.",
    keyUrl: "https://console.anthropic.com/settings/keys",
    authHeader: "x-api-key",
    extraHeaders: { "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    supportsTools: true,
  },
  mistral: {
    id: "mistral",
    label: "Mistral AI",
    short: "Mistral",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-small-latest",
    models: ["mistral-small-latest", "mistral-large-latest", "open-mistral-nemo", "codestral-latest"],
    keyPlaceholder: "…",
    keyHint: "From console.mistral.ai.",
    keyUrl: "https://console.mistral.ai/api-keys/",
    authHeader: "bearer",
    supportsTools: true,
  },
  xai: {
    id: "xai",
    label: "xAI Grok",
    short: "Grok",
    endpoint: "https://api.x.ai/v1/chat/completions",
    defaultModel: "grok-2-latest",
    models: ["grok-2-latest", "grok-2-mini", "grok-beta"],
    keyPlaceholder: "xai-…",
    keyHint: "From console.x.ai.",
    keyUrl: "https://console.x.ai/",
    authHeader: "bearer",
    supportsTools: true,
  },
};

export const PROVIDER_LIST: ProviderDef[] = [
  PROVIDERS.gemini,
  PROVIDERS.openai,
  PROVIDERS.anthropic,
  PROVIDERS.mistral,
  PROVIDERS.xai,
];

export const BYOK_STORAGE = "nuvic.byok.v1";

export type ByokSettings = {
  provider: ProviderId;
  keys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, string>>;
};

export function loadByok(): ByokSettings {
  try {
    const raw = localStorage.getItem(BYOK_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw) as ByokSettings;
      if (parsed && PROVIDERS[parsed.provider]) return parsed;
    }
    // Migrate legacy Gemini-only storage
    const legacyKey = localStorage.getItem("nuvic.gemini.apiKey");
    const legacyModel = localStorage.getItem("nuvic.gemini.model");
    if (legacyKey) {
      return {
        provider: "gemini",
        keys: { gemini: legacyKey },
        models: { gemini: legacyModel || PROVIDERS.gemini.defaultModel },
      };
    }
  } catch {}
  return { provider: "gemini", keys: {}, models: {} };
}

export function saveByok(s: ByokSettings) {
  try {
    localStorage.setItem(BYOK_STORAGE, JSON.stringify(s));
  } catch {}
}
