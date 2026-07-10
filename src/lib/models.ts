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
  // Lovable built-in (free tier)
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (free)", provider: "lovable", tag: "Free · Fast" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (free)", provider: "lovable", tag: "Free · Best" },
  { id: "openai/gpt-5.5", label: "GPT-5.5 (built-in)", provider: "lovable", tag: "Built-in" },
  { id: "openai/gpt-5-mini", label: "GPT-5 mini (built-in)", provider: "lovable", tag: "Built-in" },

  // OpenRouter
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", provider: "openrouter", tag: "Coding" },
  { id: "openai/gpt-5", label: "GPT-5", provider: "openrouter", tag: "Best" },
  { id: "x-ai/grok-4-fast", label: "Grok 4 Fast", provider: "openrouter", tag: "Fast" },
  { id: "deepseek/deepseek-chat-v3.1", label: "DeepSeek V3.1", provider: "openrouter" },

  // Gemini direct
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", tag: "Fast" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini", tag: "Best" },

  // Groq
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", provider: "groq", tag: "Fast" },
  { id: "moonshotai/kimi-k2-instruct", label: "Kimi K2", provider: "groq", tag: "Coding" },
  { id: "qwen/qwen3-32b", label: "Qwen 3 32B", provider: "groq" },

  // NVIDIA NIM
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1", label: "Nemotron Super 49B", provider: "nim" },
  { id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B (NIM)", provider: "nim" },
  { id: "qwen/qwen2.5-coder-32b-instruct", label: "Qwen 2.5 Coder 32B", provider: "nim", tag: "Coding" },
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
