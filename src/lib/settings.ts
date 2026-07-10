import { PROVIDERS, type ProviderId } from "./models";

export function getApiKey(provider: ProviderId): string {
  if (typeof window === "undefined") return "";
  const info = PROVIDERS[provider];
  if (!info.keyName) return "";
  return window.localStorage.getItem(info.keyName) ?? "";
}

export function setApiKey(provider: ProviderId, value: string) {
  if (typeof window === "undefined") return;
  const info = PROVIDERS[provider];
  if (!info.keyName) return;
  if (value) window.localStorage.setItem(info.keyName, value);
  else window.localStorage.removeItem(info.keyName);
}

export function hasProviderReady(provider: ProviderId): boolean {
  if (provider === "lovable") return true;
  return !!getApiKey(provider);
}
