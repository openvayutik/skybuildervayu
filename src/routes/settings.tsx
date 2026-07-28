import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, ExternalLink, Check, Trash2, KeyRound } from "lucide-react";
import { PROVIDERS, type ProviderId } from "@/lib/models";
import { getApiKey, setApiKey } from "@/lib/settings";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [{ title: "Settings — Skybuilder" }],
  }),
});

const PROVIDER_LIST: ProviderId[] = ["openrouter", "gemini", "groq", "nim"];

function SettingsPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:bg-neutral-800 transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <section>
          <h2 className="text-2xl font-semibold">API Keys</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Bring your own keys to unlock additional models. Keys are stored locally in your browser and sent
            only to the selected provider.
          </p>

          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-emerald-400">
              <Check className="w-4 h-4" /> Lovable AI is enabled by default
            </div>
            <p className="mt-1 text-neutral-300">
              No setup needed. Free tier includes Gemini and GPT models via the Lovable AI Gateway.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {PROVIDER_LIST.map((p) => (
              <ProviderKeyRow key={p} providerId={p} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function ProviderKeyRow({ providerId }: { providerId: ProviderId }) {
  const info = PROVIDERS[providerId];
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState<"idle" | "ok" | "fail" | "loading">("idle");
  const [testMsg, setTestMsg] = useState("");

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const k = getApiKey(providerId);
    setValue(k);
    setConnected(!!k);
  }, [providerId]);

  function save() {
    const v = value.trim();
    setApiKey(providerId, v);
    setConnected(!!v);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function clear() {
    setValue("");
    setApiKey(providerId, "");
    setConnected(false);
    setTesting("idle");
    setTestMsg("");
  }


  async function test() {
    if (!value.trim()) return;
    setTesting("loading");
    setTestMsg("");
    try {
      const res = await fetch(`${info.baseURL}/models`, {
        headers: { Authorization: `Bearer ${value.trim()}` },
      });
      if (res.ok) {
        setTesting("ok");
        setTestMsg("Key works ✓ — saved and ready to use");
        setApiKey(providerId, value.trim());
        setConnected(true);
      } else {
        const body = await res.text().catch(() => "");
        setTesting("fail");
        setTestMsg(
          res.status === 401 || res.status === 403
            ? "Invalid or unauthorized key (HTTP " + res.status + ")"
            : `HTTP ${res.status} ${body.slice(0, 140)}`,
        );
      }
    } catch (e) {
      setTesting("fail");
      setTestMsg(
        (e instanceof Error ? e.message : "Network error") +
          " — the provider may block browser requests; the key can still work at build time.",
      );
    }
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <KeyRound className="w-4 h-4 opacity-70" />
            {info.name}
          </div>
          <a
            href={info.getKeyUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition"
          >
            Get an API key <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {connected && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-emerald-500/15 text-emerald-400">
            Connected
          </span>
        )}
      </div>


      <div className="mt-4 flex gap-2">
        <div className="flex-1 flex items-center rounded-lg bg-neutral-950 border border-neutral-800 focus-within:border-neutral-600">
          <input
            type={reveal ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste your API key…"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none font-mono"
          />
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="p-2 text-neutral-400 hover:text-white"
            aria-label={reveal ? "Hide" : "Reveal"}
          >
            {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={save}
          disabled={!value.trim()}
          className="px-4 py-2 rounded-lg bg-white text-neutral-900 text-sm font-medium hover:bg-neutral-200 disabled:opacity-40 transition"
        >
          {saved ? "Saved ✓" : "Save"}
        </button>
        <button
          onClick={test}
          disabled={!value.trim() || testing === "loading"}
          className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm disabled:opacity-40 transition"
        >
          {testing === "loading" ? "Testing…" : "Test"}
        </button>
        <button
          onClick={clear}
          className="p-2 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition"
          aria-label="Clear"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {testMsg && (
        <div
          className={
            "mt-2 text-xs " +
            (testing === "ok" ? "text-emerald-400" : testing === "fail" ? "text-red-400" : "text-neutral-400")
          }
        >
          {testMsg}
        </div>
      )}
    </div>
  );
}
