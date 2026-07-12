import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  Grid3x3, Pencil, Rocket, Code2, Send, Plus, Loader2, Sparkles,
  History, Download, Smartphone, Tablet, Monitor, RefreshCw, Wand2,
  Play, FileCode, ExternalLink, Terminal, Copy, Check, Mic, MicOff,
  GitFork, Share2, Wrench, Boxes,
} from "lucide-react";
import { getProject, upsertProject, createProject, extractHtml, type Checkpoint } from "@/lib/projects";
import { ModelPicker } from "@/components/ModelPicker";
import { getDefaultModel, findModel, modelKey, type ModelInfo, PROVIDERS } from "@/lib/models";
import { getApiKey } from "@/lib/settings";
import { useVoiceInput } from "@/lib/voice";
import { z } from "zod";

const searchSchema = z.object({ prompt: z.string().optional() });

export const Route = createFileRoute("/build/$projectId")({
  component: Builder,
  validateSearch: searchSchema,
});

type Tab = "preview" | "code" | "history" | "console";
type Device = "mobile" | "tablet" | "desktop";
type Mode = "plan" | "build";
type Framework = "single" | "react";

function Builder() {
  const { projectId } = Route.useParams();
  const { prompt: initialPrompt } = Route.useSearch();
  const navigate = useNavigate();

  const [name, setName] = useState("Project Name");
  const [editingName, setEditingName] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [savedCode, setSavedCode] = useState("");
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [tab, setTab] = useState<Tab>("preview");
  const [device, setDevice] = useState<Device>("desktop");
  const [mode, setMode] = useState<Mode>("build");
  const [framework, setFramework] = useState<Framework>("single");
  const [model, setModel] = useState<ModelInfo>(() => getDefaultModel());
  const [input, setInput] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState<{ level: string; text: string; ts: number }[]>([]);
  const [enhancing, setEnhancing] = useState(false);
  const [copied, setCopied] = useState(false);
  const autoSentRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load project
  useEffect(() => {
    let p = getProject(projectId);
    if (!p) {
      p = createProject("Untitled Project");
      p.id = projectId;
      upsertProject(p);
    }
    setName(p.name);
    setInitialMessages((p.messages as UIMessage[]) ?? []);
    setSavedCode(p.code ?? "");
    setCheckpoints(p.checkpoints ?? []);
    if (p.modelKey) {
      const m = findModel(p.modelKey);
      if (m) setModel(m);
    }
  }, [projectId]);

  // Listen for iframe console messages
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data && typeof e.data === "object" && e.data.__skyLog) {
        setConsoleLogs((l) => [...l.slice(-100), { level: e.data.level, text: e.data.text, ts: Date.now() }]);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages: msgs }) => {
          const apiKey = model.provider === "lovable" ? undefined : getApiKey(model.provider);
          return {
            body: {
              messages: msgs,
              provider: model.provider,
              model: model.id,
              apiKey,
              mode,
              framework,
            },
          };
        },
      }),
    [model, mode, framework],
  );

  const { messages, sendMessage, status, setMessages, stop, error } = useChat({
    id: projectId,
    transport,
    onError: (err) => console.error("chat error", err),
  });

  // Hydrate messages once
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length, setMessages]);

  // Persist + create checkpoints when new code arrives
  useEffect(() => {
    if (initialMessages === null) return;
    const latest = getProject(projectId);
    if (!latest) return;
    let code = savedCode;
    let latestAssistantText = "";
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      latestAssistantText = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
      const html = extractHtml(latestAssistantText);
      if (html) { code = html; break; }
    }
    let cps = checkpoints;
    if (code && code !== savedCode && status === "ready") {
      const label = latestAssistantText.split("\n")[0].slice(0, 60) || `Checkpoint ${cps.length + 1}`;
      cps = [...cps, { id: crypto.randomUUID(), createdAt: Date.now(), label, code }];
      setCheckpoints(cps);
      setSavedCode(code);
    } else if (code !== savedCode) {
      setSavedCode(code);
    }
    upsertProject({
      ...latest,
      name,
      messages,
      code,
      modelKey: modelKey(model),
      checkpoints: cps,
      updatedAt: Date.now(),
    });
  }, [messages, name, projectId, initialMessages, savedCode, status, model, checkpoints]);

  // Auto-send initial prompt
  useEffect(() => {
    if (autoSentRef.current) return;
    if (initialMessages === null) return;
    if (initialPrompt && messages.length === 0) {
      autoSentRef.current = true;
      sendMessage({ text: initialPrompt });
      navigate({ to: "/build/$projectId", params: { projectId }, search: {}, replace: true });
    } else if (initialPrompt) {
      autoSentRef.current = true;
    }
  }, [initialPrompt, initialMessages, messages.length, sendMessage, navigate, projectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const isBusy = status === "submitted" || status === "streaming";

  function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const t = input.trim();
    if (!t || isBusy) return;
    // Check API key
    if (model.provider !== "lovable" && !getApiKey(model.provider)) {
      alert(`Please add your ${PROVIDERS[model.provider].name} API key in Settings.`);
      return;
    }
    sendMessage({ text: t });
    setInput("");
  }

  async function enhancePrompt() {
    if (!input.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "lovable",
          model: "google/gemini-2.5-flash",
          mode: "plan",
          messages: [
            {
              id: "e",
              role: "user",
              parts: [{ type: "text", text: `Rewrite this app idea as a clearer, more detailed one-paragraph prompt. Only reply with the improved prompt, no preamble.\n\nIdea: ${input}` }],
            },
          ],
        }),
      });
      const text = await res.text();
      // parse basic ai-sdk stream text
      const cleaned = text.replace(/^data: /gm, "").replace(/^\d+:"/gm, "").replace(/"$/gm, "");
      if (res.ok && cleaned.trim()) {
        // Try to extract from the streamed chunks; fall back to raw
        const match = cleaned.match(/"([^"]{20,})"/);
        setInput((match?.[1] ?? cleaned).slice(0, 800).trim() || input);
      }
    } catch {
      /* ignore */
    } finally {
      setEnhancing(false);
    }
  }

  function restoreCheckpoint(cp: Checkpoint) {
    setSavedCode(cp.code);
    const latest = getProject(projectId);
    if (latest) upsertProject({ ...latest, code: cp.code, updatedAt: Date.now() });
    setPreviewKey((k) => k + 1);
    setTab("preview");
  }

  function pickModel(m: ModelInfo) {
    setModel(m);
    const latest = getProject(projectId);
    if (latest) upsertProject({ ...latest, modelKey: modelKey(m) });
  }

  function downloadHtml() {
    if (!savedCode) return;
    const blob = new Blob([savedCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\W+/g, "-").toLowerCase() || "app"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDeploy() {
    if (!savedCode) return alert("Nothing to deploy yet. Ask the AI to build something first!");
    const blob = new Blob([savedCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  function refreshPreview() {
    setPreviewKey((k) => k + 1);
    setConsoleLogs([]);
  }

  function copyCode() {
    if (!savedCode) return;
    navigator.clipboard.writeText(savedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const voice = useVoiceInput((t) => setInput((v) => (v ? v + " " : "") + t));

  function forkProject() {
    const src = getProject(projectId);
    if (!src) return;
    const copy = createProject(`${src.name} (fork)`);
    copy.messages = src.messages;
    copy.code = src.code;
    copy.modelKey = src.modelKey;
    copy.checkpoints = src.checkpoints ?? [];
    upsertProject(copy);
    navigate({ to: "/build/$projectId", params: { projectId: copy.id }, search: {} });
  }

  function shareLink() {
    if (!savedCode) return alert("Nothing to share yet.");
    // Create a shareable data URL (works offline, no server needed)
    const b64 = btoa(unescape(encodeURIComponent(savedCode)));
    const url = `data:text/html;base64,${b64}`;
    navigator.clipboard.writeText(url).then(
      () => alert("Share link copied! Paste into any browser to open your app."),
      () => window.prompt("Copy this share link:", url),
    );
  }

  function autoFix() {
    const errors = consoleLogs.filter((l) => l.level === "error").map((l) => l.text).join("\n");
    if (!errors) return alert("No errors detected in the preview console.");
    sendMessage({ text: `The preview is throwing these errors — please fix them and return the full corrected app:\n\n${errors}` });
    setTab("preview");
  }

  // Keyboard shortcuts: Cmd/Ctrl+S = deploy, Cmd/Ctrl+K = focus prompt
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "s") { e.preventDefault(); downloadHtml(); }
      if (e.key === "k") { e.preventDefault(); (document.querySelector("textarea") as HTMLTextAreaElement | null)?.focus(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCode, name]);

  // Inject console proxy into iframe HTML
  const previewSrc = useMemo(() => {
    if (!savedCode) return "";
    const inject = `<script>(function(){const p=window.parent;['log','info','warn','error'].forEach(l=>{const o=console[l];console[l]=function(...a){try{p.postMessage({__skyLog:1,level:l,text:a.map(x=>{try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ')},'*')}catch(e){}o.apply(console,a)}});window.addEventListener('error',e=>{try{p.postMessage({__skyLog:1,level:'error',text:e.message+' @ '+e.filename+':'+e.lineno},'*')}catch(_){}})})();</script>`;
    if (savedCode.includes("</head>")) return savedCode.replace("</head>", inject + "</head>");
    return inject + savedCode;
  }, [savedCode]);

  const deviceW = device === "mobile" ? 390 : device === "tablet" ? 768 : undefined;

  return (
    <div className="h-screen w-screen bg-neutral-950 text-white p-3 flex flex-col gap-3 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-neutral-900 rounded-2xl p-2 pr-3 border border-neutral-800">
          <Link to="/" className="w-10 h-10 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition" aria-label="All projects">
            <Grid3x3 className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "linear-gradient(180deg, #f5f5f5, #cccccc)" }}>
            {editingName ? (
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                className="bg-transparent outline-none text-neutral-900 font-medium text-sm w-40"
              />
            ) : (
              <span className="text-neutral-900 font-medium text-sm">{name}</span>
            )}
            <button onClick={() => setEditingName((v) => !v)} className="text-neutral-700 hover:text-neutral-900" aria-label="Rename">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-neutral-900 rounded-2xl p-1 border border-neutral-800">
          {(["preview", "code", "history", "console"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition " +
                (tab === t ? "bg-white text-neutral-900" : "text-neutral-300 hover:bg-neutral-800")
              }
            >
              {t}
              {t === "console" && consoleLogs.some((l) => l.level === "error") && (
                <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
            </button>
          ))}
        </div>

        {tab === "preview" && (
          <div className="flex items-center gap-1 bg-neutral-900 rounded-2xl p-1 border border-neutral-800">
            {([{ id: "mobile" as Device, icon: Smartphone }, { id: "tablet" as Device, icon: Tablet }, { id: "desktop" as Device, icon: Monitor }]).map(({ id, icon: I }) => (
              <button
                key={id}
                onClick={() => setDevice(id)}
                className={"p-2 rounded-lg transition " + (device === id ? "bg-white text-neutral-900" : "text-neutral-400 hover:bg-neutral-800")}
                aria-label={id}
              >
                <I className="w-4 h-4" />
              </button>
            ))}
            <button onClick={refreshPreview} className="p-2 rounded-lg text-neutral-400 hover:bg-neutral-800" aria-label="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 bg-neutral-900 rounded-2xl p-2 border border-neutral-800">
          <ModelPicker value={model} onChange={pickModel} variant="dark" />
          <button
            onClick={forkProject}
            className="p-2 rounded-lg text-neutral-300 hover:bg-neutral-800 transition"
            aria-label="Fork project"
            title="Fork project"
          >
            <GitFork className="w-4 h-4" />
          </button>
          <button
            onClick={shareLink}
            disabled={!savedCode}
            className="p-2 rounded-lg text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 transition"
            aria-label="Share link"
            title="Copy share link"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={downloadHtml}
            disabled={!savedCode}
            className="p-2 rounded-lg text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 transition"
            aria-label="Download HTML"
            title="Download (⌘S)"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleDeploy}
            className="px-4 py-2 rounded-lg text-white font-medium text-sm gradient-deploy hover:opacity-90 transition flex items-center gap-2"
          >
            Deploy <Rocket className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main split */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Chat panel */}
        <section
          className="w-[400px] shrink-0 rounded-2xl p-3 flex flex-col bg-neutral-900 relative"
          style={{ boxShadow: "inset 0 0 0 1px oklch(0.72 0.22 320 / 0.35), 0 0 30px oklch(0.72 0.22 320 / 0.15)" }}
        >
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-neutral-800">
            <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-0.5">
              {(["plan", "build"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={
                    "px-2.5 py-1 rounded-md text-xs font-medium capitalize transition " +
                    (mode === m ? (m === "plan" ? "bg-blue-500 text-white" : "bg-emerald-500 text-white") : "text-neutral-400")
                  }
                >
                  {m === "plan" ? "Plan" : "Build"}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-neutral-500 ml-auto">
              {mode === "plan" ? "AI drafts a plan first" : "AI writes the app"}
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 space-y-3">
            {messages.length === 0 && !isBusy && (
              <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 px-4">
                <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="text-white font-medium">Describe your app</div>
                <div className="text-xs mt-1">Skybuilder will generate a live, working web app.</div>
              </div>
            )}
            {messages.map((m, i) => (
              <Message key={m.id} msg={m} index={i} onRestore={restoreCheckpoint} checkpoints={checkpoints} />
            ))}
            {isBusy && (
              <div className="flex items-center gap-2 text-sm text-neutral-400 px-3">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{status === "submitted" ? "Thinking…" : mode === "plan" ? "Drafting plan…" : "Writing HTML…"}</span>
                <button onClick={stop} className="ml-auto text-xs text-neutral-500 hover:text-white">Stop</button>
              </div>
            )}
            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 border border-red-500/30">
                {error.message}
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="mt-3 relative bg-white rounded-xl">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={3}
              placeholder={mode === "plan" ? "Ask for a plan…" : "Ask for changes…"}
              disabled={isBusy}
              className="w-full resize-none rounded-xl p-3 pl-9 pr-11 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none bg-transparent"
              style={{ boxShadow: "0 0 0 2px oklch(0.72 0.28 340 / 0.5), 0 0 12px oklch(0.72 0.28 340 / 0.4)" }}
            />
            <button
              type="button"
              onClick={enhancePrompt}
              disabled={!input.trim() || enhancing}
              className="absolute bottom-2 left-2 w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-800 disabled:opacity-40"
              aria-label="Enhance prompt"
              title="Improve prompt with AI"
            >
              {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="submit"
              disabled={isBusy || !input.trim()}
              className="absolute bottom-2 right-2 w-8 h-8 rounded-md bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-700 disabled:opacity-40 transition"
              aria-label="Send"
            >
              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </section>

        {/* Right panel */}
        <section className="flex-1 rounded-2xl bg-neutral-900 p-3 min-w-0 relative" style={{ boxShadow: "inset 0 0 0 1px oklch(0.3 0.02 275)" }}>
          <div className="w-full h-full rounded-xl overflow-hidden bg-white relative">
            {tab === "preview" && (
              savedCode ? (
                <div className="w-full h-full flex items-center justify-center bg-neutral-100 p-4">
                  <iframe
                    key={previewKey}
                    ref={iframeRef}
                    title="preview"
                    srcDoc={previewSrc}
                    className="border-0 bg-white shadow-xl rounded-md"
                    style={{ width: deviceW ? `${deviceW}px` : "100%", height: "100%", maxWidth: "100%" }}
                    sandbox="allow-scripts allow-forms allow-popups allow-modals"
                  />
                </div>
              ) : <EmptyPreview busy={isBusy} />
            )}

            {tab === "code" && (
              <div className="w-full h-full flex flex-col bg-[#1e1e1e]">
                <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border-b border-neutral-800">
                  <FileCode className="w-4 h-4 text-neutral-400" />
                  <span className="text-xs text-neutral-300 font-mono">index.html</span>
                  <span className="ml-auto flex items-center gap-2">
                    <button onClick={copyCode} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1">
                      {copied ? <><Check className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                    <button onClick={downloadHtml} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1">
                      <Download className="w-3 h-3" /> Save
                    </button>
                    <button onClick={handleDeploy} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Open
                    </button>
                  </span>
                </div>
                <div className="flex-1 min-h-0">
                  <Editor
                    height="100%"
                    defaultLanguage="html"
                    theme="vs-dark"
                    value={savedCode || "<!-- Generated code will appear here -->"}
                    onChange={(v) => {
                      const val = v ?? "";
                      setSavedCode(val);
                      const latest = getProject(projectId);
                      if (latest) upsertProject({ ...latest, code: val, updatedAt: Date.now() });
                    }}
                    options={{
                      minimap: { enabled: true },
                      fontSize: 13,
                      wordWrap: "on",
                      formatOnPaste: true,
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
              </div>
            )}

            {tab === "history" && (
              <div className="w-full h-full overflow-y-auto p-6 bg-white text-neutral-800">
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">Checkpoints</h2>
                  <span className="text-xs text-neutral-500 ml-2">{checkpoints.length} snapshot{checkpoints.length === 1 ? "" : "s"}</span>
                </div>
                {checkpoints.length === 0 ? (
                  <div className="text-sm text-neutral-500">No checkpoints yet. Every AI response creates one automatically.</div>
                ) : (
                  <ol className="space-y-2">
                    {[...checkpoints].reverse().map((cp, i) => (
                      <li key={cp.id} className="border border-neutral-200 rounded-lg p-3 hover:border-neutral-400 transition">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">#{checkpoints.length - i} · {cp.label}</div>
                            <div className="text-xs text-neutral-500 mt-0.5">
                              {new Date(cp.createdAt).toLocaleString()} · {(cp.code.length / 1024).toFixed(1)} KB
                            </div>
                          </div>
                          <button
                            onClick={() => restoreCheckpoint(cp)}
                            className="text-xs px-3 py-1.5 rounded bg-neutral-900 text-white hover:bg-neutral-700 flex items-center gap-1 shrink-0"
                          >
                            <Play className="w-3 h-3" /> Restore
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {tab === "console" && (
              <div className="w-full h-full overflow-y-auto p-4 bg-neutral-950 text-neutral-100 font-mono text-xs">
                <div className="flex items-center gap-2 mb-3 text-neutral-400">
                  <Terminal className="w-4 h-4" />
                  <span>Preview console</span>
                  <button onClick={() => setConsoleLogs([])} className="ml-auto text-neutral-500 hover:text-white text-xs">Clear</button>
                </div>
                {consoleLogs.length === 0 ? (
                  <div className="text-neutral-500">No output. Interact with the preview to see logs.</div>
                ) : (
                  <div className="space-y-1">
                    {consoleLogs.map((l, i) => (
                      <div
                        key={i}
                        className={
                          "px-2 py-1 rounded " +
                          (l.level === "error" ? "text-red-400 bg-red-500/10"
                            : l.level === "warn" ? "text-amber-400 bg-amber-500/10"
                              : "text-neutral-300")
                        }
                      >
                        <span className="text-neutral-500 mr-2">[{l.level}]</span>
                        {l.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Message({
  msg, index, onRestore, checkpoints,
}: {
  msg: UIMessage; index: number; onRestore: (cp: Checkpoint) => void; checkpoints: Checkpoint[];
}) {
  const text = msg.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const isUser = msg.role === "user";
  const hasCode = /```/.test(text);
  const cleaned = isUser
    ? text
    : text.replace(/```html[\s\S]*?```/gi, "").replace(/```[\s\S]*?```/g, "").trim();

  // Find matching checkpoint (roughly by assistant index)
  const assistantIndex = index;
  const cp = !isUser && hasCode ? checkpoints[Math.min(assistantIndex, checkpoints.length - 1)] : undefined;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-sm"
            : "max-w-[95%] text-sm text-neutral-200 whitespace-pre-wrap w-full"
        }
      >
        {cleaned || (isUser ? text : "…")}
        {!isUser && hasCode && (
          <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 flex items-center gap-2 text-xs">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-emerald-300">App updated · checkpoint saved</span>
            {cp && (
              <button
                onClick={() => onRestore(cp)}
                className="ml-auto text-emerald-300 hover:text-white underline"
              >
                Restore
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyPreview({ busy }: { busy: boolean }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500 gap-3">
      {busy ? (
        <>
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
          <div className="text-sm">Skybuilder is generating your app…</div>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl gradient-brand flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="text-neutral-700 font-medium">Your app preview</div>
          <div className="text-xs text-neutral-500">Ask the AI on the left to build something.</div>
        </>
      )}
    </div>
  );
}
