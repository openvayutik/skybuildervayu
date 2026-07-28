import { useEffect, useState } from "react";
import { PROVIDERS, type ProviderId } from "./models";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

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
  notify();
}

export function hasProviderReady(provider: ProviderId): boolean {
  if (provider === "lovable") return true;
  return !!getApiKey(provider);
}

/**
 * Client-only readiness map. Reading localStorage during render causes a
 * hydration mismatch (SSR sees no keys), which left model options permanently
 * disabled even after keys were saved. This resolves after mount instead.
 */
export function useProviderReadiness(): Record<ProviderId, boolean> {
  const [ready, setReady] = useState<Record<ProviderId, boolean>>(() => ({
    lovable: true,
    openrouter: false,
    gemini: false,
    groq: false,
    nim: false,
  }));

  useEffect(() => {
    const read = () =>
      setReady({
        lovable: true,
        openrouter: !!getApiKey("openrouter"),
        gemini: !!getApiKey("gemini"),
        groq: !!getApiKey("groq"),
        nim: !!getApiKey("nim"),
      });
    read();
    listeners.add(read);
    window.addEventListener("storage", read);
    return () => {
      listeners.delete(read);
      window.removeEventListener("storage", read);
    };
  }, []);

  return ready;
}
