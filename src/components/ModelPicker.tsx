import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, KeyRound, Cpu } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { MODELS, PROVIDERS, modelKey, type ModelInfo } from "@/lib/models";
import { useProviderReadiness } from "@/lib/settings";

export function ModelPicker({
  value,
  onChange,
  variant = "light",
}: {
  value: ModelInfo;
  onChange: (m: ModelInfo) => void;
  variant?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const readiness = useProviderReadiness();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const grouped = Object.values(PROVIDERS).map((p) => ({
    provider: p,
    models: MODELS.filter((m) => m.provider === p.id),
  }));

  const dark = variant === "dark";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          dark
            ? "flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-sm border border-neutral-700 transition"
            : "flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 hover:bg-white text-neutral-800 text-sm border border-neutral-300 shadow-sm transition"
        }
      >
        <Cpu className="w-4 h-4 opacity-70" />
        <span className="truncate max-w-[180px]">{value.label}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>

      {open && (
        <div
          className={
            "absolute right-0 mt-2 w-80 max-h-[420px] overflow-y-auto rounded-xl shadow-2xl z-50 border " +
            (dark ? "bg-neutral-900 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-800")
          }
        >
          {grouped.map(({ provider, models }) => {
            const ready = readiness[provider.id];
            return (
              <div key={provider.id} className="py-1">
                <div
                  className={
                    "px-3 py-1.5 text-[11px] uppercase tracking-wider flex items-center justify-between " +
                    (dark ? "text-neutral-400" : "text-neutral-500")
                  }
                >
                  <span>{provider.name}</span>
                  {!ready && (
                    <Link
                      to="/settings"
                      className="inline-flex items-center gap-1 text-[10px] normal-case px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500"
                      onClick={() => setOpen(false)}
                    >
                      <KeyRound className="w-3 h-3" /> Add key
                    </Link>
                  )}
                </div>
                {models.map((m) => {
                  const active = modelKey(m) === modelKey(value);
                  return (
                    <button
                      key={modelKey(m)}
                      onClick={() => {
                        onChange(m);
                        setOpen(false);
                      }}
                      disabled={!ready}
                      className={
                        "w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 " +
                        (dark ? "hover:bg-neutral-800" : "hover:bg-neutral-100") +
                        (!ready ? " opacity-40 cursor-not-allowed" : "")
                      }
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {active ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <span className="w-3.5" />}
                        <span className="truncate">{m.label}</span>
                      </span>
                      {m.tag && (
                        <span
                          className={
                            "text-[10px] px-1.5 py-0.5 rounded-full shrink-0 " +
                            (dark ? "bg-neutral-800 text-neutral-300" : "bg-neutral-100 text-neutral-600")
                          }
                        >
                          {m.tag}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
