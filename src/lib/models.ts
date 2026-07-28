export type ProviderId = "lovable" | "openrouter" | "gemini" | "groq" | "nim";

export type ModelInfo = {
  id: string; // provider-native model id
  label: string;
  provider: ProviderId;
  tag?: string; // e.g. "Fast", "Best", "Free"
};

export type ProviderInfo = {
  id: ProviderId;
  name: string;
  baseURL: string;
  keyName: string; // localStorage key
  getKeyUrl: string;
  headerName?: string; // custom auth header, else Authorization Bearer
  requiresUserKey: boolean;
};

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  lovable: {
    id: "lovable",
    name: "Lovable AI (built-in)",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    keyName: "",
    getKeyUrl: "https://docs.lovable.dev/features/cloud",
    headerName: "Lovable-API-Key",
    requiresUserKey: false,
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    keyName: "sky.key.openrouter",
    getKeyUrl: "https://openrouter.ai/keys",
    requiresUserKey: true,
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyName: "sky.key.gemini",
    getKeyUrl: "https://aistudio.google.com/apikey",
    requiresUserKey: true,
  },
  groq: {
    id: "groq",
    name: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    keyName: "sky.key.groq",
    getKeyUrl: "https://console.groq.com/keys",
    requiresUserKey: true,
  },
  nim: {
    id: "nim",
    name: "NVIDIA NIM",
    baseURL: "https://integrate.api.nvidia.com/v1",
    keyName: "sky.key.nim",
    getKeyUrl: "https://build.nvidia.com/explore/discover",
    requiresUserKey: true,
  },
};

export const MODELS: ModelInfo[] = [
  // Lovable built-in (uses workspace AI credits)
  { id: "openai/gpt-5.6-sol", label: "GPT-5.6 Sol (built-in)", provider: "lovable", tag: "Best" },
  { id: "google/gemini-3.6-flash", label: "Gemini 3.6 Flash (built-in)", provider: "lovable", tag: "Fast" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 mini (built-in)", provider: "lovable", tag: "Cheap" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (built-in)", provider: "lovable" },

  // OpenRouter
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", provider: "openrouter", tag: "Coding" },
  { id: "openai/gpt-4.1", label: "GPT-4.1", provider: "openrouter" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "openrouter", tag: "Best" },
  { id: "x-ai/grok-4-fast", label: "Grok 4 Fast", provider: "openrouter", tag: "Fast" },
  { id: "deepseek/deepseek-chat-v3.1", label: "DeepSeek V3.1", provider: "openrouter" },
  { id: "qwen/qwen3-coder", label: "Qwen3 Coder", provider: "openrouter", tag: "Coding" },

  // Gemini direct
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", tag: "Fast" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini", tag: "Best" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "gemini" },

  // Groq
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", provider: "groq", tag: "Fast" },
  { id: "moonshotai/kimi-k2-instruct-0905", label: "Kimi K2 (0905)", provider: "groq", tag: "Coding" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", provider: "groq" },
  { id: "qwen/qwen3-32b", label: "Qwen 3 32B", provider: "groq" },

  // NVIDIA NIM
  { id: "qwen/qwen2.5-coder-32b-instruct", label: "Qwen 2.5 Coder 32B", provider: "nim", tag: "Coding" },
  { id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B (NIM)", provider: "nim" },
  { id: "deepseek-ai/deepseek-r1", label: "DeepSeek R1 (NIM)", provider: "nim" },
];


export const DEFAULT_MODEL_KEY = "sky.selected.model";

export function getDefaultModel(): ModelInfo {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(DEFAULT_MODEL_KEY);
    const found = MODELS.find((m) => `${m.provider}:${m.id}` === saved);
    if (found) return found;
  }
  return MODELS[0];
}

export function setDefaultModel(m: ModelInfo) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEFAULT_MODEL_KEY, `${m.provider}:${m.id}`);
}

export function modelKey(m: ModelInfo) {
  return `${m.provider}:${m.id}`;
}

export function findModel(key: string): ModelInfo | undefined {
  return MODELS.find((m) => modelKey(m) === key);
}
