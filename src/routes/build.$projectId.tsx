import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import {
  Grid3x3, Pencil, Rocket, Code2, Send, Loader2, Sparkles, History, Download,
  Smartphone, Tablet, Monitor, RefreshCw, Wand2, Play, ExternalLink, Terminal,
  Copy, Check, Mic, MicOff, GitFork, Share2, Wrench, Boxes, File as FileIcon,
  Folder, FolderOpen, Plus, Trash2, X,
} from "lucide-react";
import { getProject, upsertProject, createProject, type Checkpoint, type Project } from "@/lib/projects";
import { ModelPicker } from "@/components/ModelPicker";
import { getDefaultModel, findModel, modelKey, type ModelInfo, PROVIDERS } from "@/lib/models";
import { getApiKey } from "@/lib/settings";
import { useVoiceInput } from "@/lib/voice";
import { extractManifest, mergeManifest, buildPreviewHtml, languageFor, type FrameworkId } from "@/lib/manifest";
import { z } from "zod";

const searchSchema = z.object({ prompt: z.string().optional() });

export const Route = createFileRoute("/build/$projectId")({
  component: Builder,
  validateSearch: searchSchema,
});

type Tab = "preview" | "code" | "history" | "console";
type Device = "mobile" | "tablet" | "desktop";
type Mode = "plan" | "build";

const CONSOLE_INJECT = `<script>(function(){const p=window.parent;['log','info','warn','error'].forEach(l=>{const o=console[l];console[l]=function(...a){try{p.postMessage({__skyLog:1,level:l,text:a.map(x=>{try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ')},'*')}catch(e){}o.apply(console,a)}});window.addEventListener('error',e=>{try{p.postMessage({__skyLog:1,level:'error',text:e.message+' @ '+(e.filename||'')+':'+(e.lineno||'')},'*')}catch(_){}})})();</script>`;

function Builder() {
  const { projectId } = Route.useParams();
  const { prompt: initialPrompt } = Route.useSearch();
  const navigate = useNavigate();

  const [name, setName] = useState("Project Name");
  const [editingName, setEditingName] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [entry, setEntry] = useState<string>("index.html");
  const [framework, setFramework] = useState<FrameworkId>("static");
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [tab, setTab] = useState<Tab>("preview");
  const [device, setDevice] = useState<Device>("desktop");
  const [mode, setMode] = useState<Mode>("build");
  const [model, setModel] = useState<ModelInfo>(() => getDefaultModel());
  const [input, setInput] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState<{ level: string; text: string; ts: number }[]>([]);
  const [enhancing, setEnhancing] = useState(false);
  const [copied, setCopied] = useState(false);

  // IDE state
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>("");

  const autoSentRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastManifestIdRef = useRef<string>("");

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
    setFiles(p.files ?? {});
    setEntry(p.entry ?? "index.html");
    setFramework(p.framework ?? "static");
    setCheckpoints(p.checkpoints ?? []);
    const first = Object.keys(p.files ?? {})[0];
    if (first) { setOpenFiles([first]); setActiveFile(first); }
    if (p.modelKey) {
      const m = findModel(p.modelKey);
      if (m) setModel(m);
    }
  }, [projectId]);

  // iframe console proxy
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
            body: { messages: msgs, provider: model.provider, model: model.id, apiKey, mode, framework },
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

  // Parse latest assistant message → merge manifest → checkpoint on stream complete
  useEffect(() => {
    if (initialMessages === null) return;
    const latest = getProject(projectId);
    if (!latest) return;

    let nextFiles = files;
    let nextEntry = entry;
    let nextFramework = framework;
    let cps = checkpoints;

    // Find latest assistant msg
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant && status === "ready" && lastManifestIdRef.current !== lastAssistant.id) {
      const text = lastAssistant.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
      const manifest = extractManifest(text);
      if (manifest) {
        const merged = mergeManifest({ files, entry, framework }, manifest);
        nextFiles = merged.files;
        nextEntry = merged.entry;
        nextFramework = merged.framework;
        setFiles(nextFiles);
        setEntry(nextEntry);
        setFramework(nextFramework);
        // open entry file if nothing open
        if (!activeFile && nextFiles[nextEntry]) {
          setOpenFiles([nextEntry]);
          setActiveFile(nextEntry);
        }
        const label = manifest.summary?.slice(0, 60) || `Checkpoint ${cps.length + 1}`;
        cps = [...cps, {
          id: crypto.randomUUID(), createdAt: Date.now(), label,
          files: nextFiles, entry: nextEntry, framework: nextFramework,
        }];
        setCheckpoints(cps);
        setPreviewKey((k) => k + 1);
        lastManifestIdRef.current = lastAssistant.id;
      }
    }

    upsertProject({
      ...latest,
      name,
      messages,
      files: nextFiles,
      entry: nextEntry,
      framework: nextFramework,
      modelKey: modelKey(model),
      checkpoints: cps,
      updatedAt: Date.now(),
    } as Project);
  }, [messages, status, name, projectId, initialMessages, files, entry, framework, model, checkpoints, activeFile]);

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
  const hasFiles = Object.keys(files).length > 0;

  function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const t = input.trim();
    if (!t || isBusy) return;
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
          provider: "lovable", model: "google/gemini-2.5-flash", mode: "plan",
          messages: [{ id: "e", role: "user", parts: [{ type: "text", text: `Rewrite this app idea as a clearer, more detailed one-paragraph prompt. Only reply with the improved prompt, no preamble.\n\nIdea: ${input}` }] }],
        }),
      });
      const text = await res.text();
      const cleaned = text.replace(/^data: /gm, "").replace(/^\d+:"/gm, "").replace(/"$/gm, "");
      if (res.ok && cleaned.trim()) {
        const match = cleaned.match(/"([^"]{20,})"/);
        setInput((match?.[1] ?? cleaned).slice(0, 800).trim() || input);
      }
    } catch { /* ignore */ } finally { setEnhancing(false); }
  }

  function restoreCheckpoint(cp: Checkpoint) {
    const f = cp.files ?? (cp.code ? { "index.html": cp.code } : {});
    setFiles(f);
    setEntry(cp.entry ?? "index.html");
    setFramework(cp.framework ?? "static");
    const latest = getProject(projectId);
    if (latest) upsertProject({ ...latest, files: f, entry: cp.entry ?? "index.html", framework: cp.framework ?? "static", updatedAt: Date.now() });
    setPreviewKey((k) => k + 1);
    setTab("preview");
  }

  function pickModel(m: ModelInfo) {
    setModel(m);
    const latest = getProject(projectId);
    if (latest) upsertProject({ ...latest, modelKey: modelKey(m) });
  }

  async function downloadZip() {
    if (!hasFiles) return;
    const zip = new JSZip();
    for (const [p, c] of Object.entries(files)) zip.file(p, c);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\W+/g, "-").toLowerCase() || "app"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDeploy() {
    if (!hasFiles) return alert("Nothing to deploy yet. Ask the AI to build something first!");
    const built = buildPreviewHtml(files, entry, framework);
    const blob = new Blob([built.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    // blob URLs referenced from `built.html` remain valid for the opened tab.
  }

  function refreshPreview() { setPreviewKey((k) => k + 1); setConsoleLogs([]); }

  function copyCode() {
    const c = files[activeFile] ?? "";
    if (!c) return;
    navigator.clipboard.writeText(c);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const voice = useVoiceInput((t) => setInput((v) => (v ? v + " " : "") + t));

  function forkProject() {
    const src = getProject(projectId);
    if (!src) return;
    const copy = createProject(`${src.name} (fork)`);
    copy.messages = src.messages;
    copy.files = src.files;
    copy.entry = src.entry;
    copy.framework = src.framework;
    copy.modelKey = src.modelKey;
    copy.checkpoints = src.checkpoints ?? [];
    upsertProject(copy);
    navigate({ to: "/build/$projectId", params: { projectId: copy.id }, search: {} });
  }

  function shareLink() {
    if (!hasFiles) return alert("Nothing to share yet.");
    const built = buildPreviewHtml(files, entry, framework);
    const b64 = btoa(unescape(encodeURIComponent(built.html)));
    const url = `data:text/html;base64,${b64}`;
    navigator.clipboard.writeText(url).then(
      () => alert("Share link copied! Paste into any browser to open your app."),
      () => window.prompt("Copy this share link:", url),
    );
  }

  function autoFix() {
    const errors = consoleLogs.filter((l) => l.level === "error").map((l) => l.text).join("\n");
    if (!errors) return alert("No errors detected in the preview console.");
    sendMessage({ text: `The preview is throwing these errors — please fix them and return the corrected files:\n\n${errors}` });
    setTab("preview");
  }

  // File ops
  function openFile(path: string) {
    setActiveFile(path);
    setOpenFiles((o) => (o.includes(path) ? o : [...o, path]));
  }
  function closeTab(path: string) {
    setOpenFiles((o) => {
      const next = o.filter((p) => p !== path);
      if (activeFile === path) setActiveFile(next[next.length - 1] ?? "");
      return next;
    });
  }
  function updateFile(path: string, content: string) {
    const nf = { ...files, [path]: content };
    setFiles(nf);
    const latest = getProject(projectId);
    if (latest) upsertProject({ ...latest, files: nf, updatedAt: Date.now() });
  }
  function newFile() {
    const path = window.prompt("New file path (e.g. src/components/Card.jsx):");
    if (!path) return;
    const clean = path.trim().replace(/^\/+/, "");
    if (files[clean] != null) return alert("File already exists.");
    const nf = { ...files, [clean]: "" };
    setFiles(nf);
    openFile(clean);
    const latest = getProject(projectId);
    if (latest) upsertProject({ ...latest, files: nf, updatedAt: Date.now() });
  }
  function deleteFile(path: string) {
    if (!confirm(`Delete ${path}?`)) return;
    const nf = { ...files };
    delete nf[path];
    setFiles(nf);
    closeTab(path);
    const latest = getProject(projectId);
    if (latest) upsertProject({ ...latest, files: nf, updatedAt: Date.now() });
  }

  // Keyboard: Cmd/Ctrl+S = download zip, Cmd/Ctrl+K = focus prompt
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "s") { e.preventDefault(); void downloadZip(); }
      if (e.key === "k") { e.preventDefault(); (document.querySelector("textarea") as HTMLTextAreaElement | null)?.focus(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const previewSrc = useMemo(() => {
    if (!hasFiles) return "";
    const built = buildPreviewHtml(files, entry, framework);
    let html = built.html;
    if (html.includes("</head>")) html = html.replace("</head>", CONSOLE_INJECT + "</head>");
    else html = CONSOLE_INJECT + html;
    return html;
  }, [files, entry, framework, previewKey, hasFiles]);

  const deviceW = device === "mobile" ? 390 : device === "tablet" ? 768 : undefined;

  return (
    <div className="h-screen w-screen bg-neutral-950 text-white p-3 flex flex-col gap-3 overflow-hidden">
      <header className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-neutral-900 rounded-2xl p-2 pr-3 border border-neutral-800">
          <Link to="/" className="w-10 h-10 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition" aria-label="All projects">
            <Grid3x3 className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "linear-gradient(180deg, #f5f5f5, #cccccc)" }}>
            {editingName ? (
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                className="bg-transparent outline-none text-neutral-900 font-medium text-sm w-40" />
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
            <button key={t} onClick={() => setTab(t)}
              className={"px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition " + (tab === t ? "bg-white text-neutral-900" : "text-neutral-300 hover:bg-neutral-800")}>
              {t === "code" ? <span className="inline-flex items-center gap-1"><Code2 className="w-3 h-3" /> Code</span> : t}
              {t === "console" && consoleLogs.some((l) => l.level === "error") && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500" />}
            </button>
          ))}
        </div>

        {tab === "preview" && (
          <div className="flex items-center gap-1 bg-neutral-900 rounded-2xl p-1 border border-neutral-800">
            {([{ id: "mobile" as Device, icon: Smartphone }, { id: "tablet" as Device, icon: Tablet }, { id: "desktop" as Device, icon: Monitor }]).map(({ id, icon: I }) => (
              <button key={id} onClick={() => setDevice(id)}
                className={"p-2 rounded-lg transition " + (device === id ? "bg-white text-neutral-900" : "text-neutral-400 hover:bg-neutral-800")} aria-label={id}>
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
          <button onClick={forkProject} className="p-2 rounded-lg text-neutral-300 hover:bg-neutral-800 transition" title="Fork project"><GitFork className="w-4 h-4" /></button>
          <button onClick={shareLink} disabled={!hasFiles} className="p-2 rounded-lg text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 transition" title="Copy share link"><Share2 className="w-4 h-4" /></button>
          <button onClick={downloadZip} disabled={!hasFiles} className="p-2 rounded-lg text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 transition" title="Download .zip (⌘S)"><Download className="w-4 h-4" /></button>
          <button onClick={handleDeploy} className="px-4 py-2 rounded-lg text-white font-medium text-sm gradient-deploy hover:opacity-90 transition flex items-center gap-2">
            Deploy <Rocket className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-3 min-h-0">
        {/* Chat */}
        <section className="w-[400px] shrink-0 rounded-2xl p-3 flex flex-col bg-neutral-900 relative" style={{ boxShadow: "inset 0 0 0 1px oklch(0.72 0.22 320 / 0.35), 0 0 30px oklch(0.72 0.22 320 / 0.15)" }}>
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-neutral-800 flex-wrap">
            <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-0.5">
              {(["plan", "build"] as Mode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={"px-2.5 py-1 rounded-md text-xs font-medium capitalize transition " + (mode === m ? (m === "plan" ? "bg-blue-500 text-white" : "bg-emerald-500 text-white") : "text-neutral-400")}>
                  {m === "plan" ? "Plan" : "Build"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-0.5">
              {(["static", "react"] as FrameworkId[]).map((f) => (
                <button key={f} onClick={() => setFramework(f)}
                  className={"px-2 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 " + (framework === f ? "bg-violet-500 text-white" : "text-neutral-400 hover:text-white")}
                  title={f === "static" ? "Multi-file vanilla HTML/CSS/JS" : "Multi-file React (CDN)"}>
                  <Boxes className="w-3 h-3" />{f === "static" ? "HTML" : "React"}
                </button>
              ))}
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 space-y-3">
            {messages.length === 0 && !isBusy && (
              <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 px-4">
                <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center mb-3"><Sparkles className="w-5 h-5 text-white" /></div>
                <div className="text-white font-medium">Describe your app</div>
                <div className="text-xs mt-1">Skybuilder generates a full multi-file project.</div>
              </div>
            )}
            {messages.map((m) => <Message key={m.id} msg={m} />)}
            {isBusy && (
              <div className="flex items-center gap-2 text-sm text-neutral-400 px-3">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{status === "submitted" ? "Thinking…" : mode === "plan" ? "Drafting plan…" : "Writing files…"}</span>
                <button onClick={stop} className="ml-auto text-xs text-neutral-500 hover:text-white">Stop</button>
              </div>
            )}
            {error && <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 border border-red-500/30">{error.message}</div>}
          </div>

          <form onSubmit={handleSend} className="mt-3 relative bg-white rounded-xl">
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              rows={3} placeholder={mode === "plan" ? "Ask for a plan…" : "Ask for changes…"} disabled={isBusy}
              className="w-full resize-none rounded-xl p-3 pl-9 pr-11 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none bg-transparent"
              style={{ boxShadow: "0 0 0 2px oklch(0.72 0.28 340 / 0.5), 0 0 12px oklch(0.72 0.28 340 / 0.4)" }} />
            <button type="button" onClick={enhancePrompt} disabled={!input.trim() || enhancing}
              className="absolute bottom-2 left-2 w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-800 disabled:opacity-40" title="Improve prompt">
              {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            </button>
            {voice.supported && (
              <button type="button" onClick={voice.toggle}
                className={"absolute bottom-2 left-9 w-6 h-6 rounded flex items-center justify-center " + (voice.listening ? "text-red-500 animate-pulse" : "text-neutral-500 hover:text-neutral-800")}
                title="Voice input">
                {voice.listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}
            <button type="submit" disabled={isBusy || !input.trim()}
              className="absolute bottom-2 right-2 w-8 h-8 rounded-md bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-700 disabled:opacity-40 transition" aria-label="Send">
              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </section>

        {/* Right */}
        <section className="flex-1 rounded-2xl bg-neutral-900 p-3 min-w-0 relative" style={{ boxShadow: "inset 0 0 0 1px oklch(0.3 0.02 275)" }}>
          <div className="w-full h-full rounded-xl overflow-hidden bg-white relative">
            {tab === "preview" && (
              hasFiles ? (
                <div className="w-full h-full flex items-center justify-center bg-neutral-100 p-4">
                  <iframe key={previewKey} title="preview" srcDoc={previewSrc}
                    className="border-0 bg-white shadow-xl rounded-md"
                    style={{ width: deviceW ? `${deviceW}px` : "100%", height: "100%", maxWidth: "100%" }}
                    sandbox="allow-scripts allow-forms allow-popups allow-modals" />
                </div>
              ) : <EmptyPreview busy={isBusy} />
            )}

            {tab === "code" && (
              <IdePanel
                files={files} activeFile={activeFile} openFiles={openFiles}
                onOpen={openFile} onClose={closeTab} onChange={updateFile}
                onNew={newFile} onDelete={deleteFile}
                onCopy={copyCode} copied={copied}
                onDownload={downloadZip} onOpenDeploy={handleDeploy}
              />
            )}

            {tab === "history" && (
              <div className="w-full h-full overflow-y-auto p-6 bg-white text-neutral-800">
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-5 h-5" /><h2 className="text-lg font-semibold">Checkpoints</h2>
                  <span className="text-xs text-neutral-500 ml-2">{checkpoints.length} snapshot{checkpoints.length === 1 ? "" : "s"}</span>
                </div>
                {checkpoints.length === 0 ? (
                  <div className="text-sm text-neutral-500">No checkpoints yet. Every AI response creates one automatically.</div>
                ) : (
                  <ol className="space-y-2">
                    {[...checkpoints].reverse().map((cp, i) => {
                      const size = cp.files ? Object.values(cp.files).reduce((s, c) => s + c.length, 0) : (cp.code?.length ?? 0);
                      const fileCount = cp.files ? Object.keys(cp.files).length : (cp.code ? 1 : 0);
                      return (
                        <li key={cp.id} className="border border-neutral-200 rounded-lg p-3 hover:border-neutral-400 transition">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">#{checkpoints.length - i} · {cp.label}</div>
                              <div className="text-xs text-neutral-500 mt-0.5">
                                {new Date(cp.createdAt).toLocaleString()} · {fileCount} file{fileCount === 1 ? "" : "s"} · {(size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <button onClick={() => restoreCheckpoint(cp)}
                              className="text-xs px-3 py-1.5 rounded bg-neutral-900 text-white hover:bg-neutral-700 flex items-center gap-1 shrink-0">
                              <Play className="w-3 h-3" /> Restore
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            )}

            {tab === "console" && (
              <div className="w-full h-full overflow-y-auto p-4 bg-neutral-950 text-neutral-100 font-mono text-xs">
                <div className="flex items-center gap-2 mb-3 text-neutral-400">
                  <Terminal className="w-4 h-4" /><span>Preview console</span>
                  <button onClick={autoFix} disabled={!consoleLogs.some((l) => l.level === "error") || isBusy}
                    className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-30" title="Send errors to AI">
                    <Wrench className="w-3 h-3" /> Auto-fix
                  </button>
                  <button onClick={() => setConsoleLogs([])} className="text-neutral-500 hover:text-white text-xs">Clear</button>
                </div>
                {consoleLogs.length === 0 ? (
                  <div className="text-neutral-500">No output. Interact with the preview to see logs.</div>
                ) : (
                  <div className="space-y-1">
                    {consoleLogs.map((l, i) => (
                      <div key={i} className={"px-2 py-1 rounded " + (l.level === "error" ? "text-red-400 bg-red-500/10" : l.level === "warn" ? "text-amber-400 bg-amber-500/10" : "text-neutral-300")}>
                        <span className="text-neutral-500 mr-2">[{l.level}]</span>{l.text}
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

/* ---------------- IDE panel ---------------- */

type TreeNode = { name: string; path: string; isDir: boolean; children: TreeNode[] };

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] };
  for (const p of paths.sort()) {
    const parts = p.split("/");
    let cur = root;
    parts.forEach((part, i) => {
      const isDir = i < parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");
      let existing = cur.children.find((c) => c.name === part && c.isDir === isDir);
      if (!existing) {
        existing = { name: part, path: fullPath, isDir, children: [] };
        cur.children.push(existing);
      }
      cur = existing;
    });
  }
  // dirs first, then files, alphabetical
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

function IdePanel({
  files, activeFile, openFiles, onOpen, onClose, onChange, onNew, onDelete, onCopy, copied, onDownload, onOpenDeploy,
}: {
  files: Record<string, string>; activeFile: string; openFiles: string[];
  onOpen: (p: string) => void; onClose: (p: string) => void; onChange: (p: string, v: string) => void;
  onNew: () => void; onDelete: (p: string) => void; onCopy: () => void; copied: boolean;
  onDownload: () => void; onOpenDeploy: () => void;
}) {
  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="w-full h-full flex bg-[#1e1e1e]">
      {/* File tree */}
      <aside className="w-56 shrink-0 bg-neutral-900 border-r border-neutral-800 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
          <span className="text-xs uppercase tracking-wider text-neutral-500">Files</span>
          <button onClick={onNew} className="text-neutral-400 hover:text-white" title="New file"><Plus className="w-3.5 h-3.5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 text-sm">
          {Object.keys(files).length === 0 ? (
            <div className="px-3 text-xs text-neutral-500">No files yet. Ask the AI to build something.</div>
          ) : (
            <TreeView node={tree} depth={0} activeFile={activeFile} onOpen={onOpen} onDelete={onDelete} collapsed={collapsed} setCollapsed={setCollapsed} />
          )}
        </div>
      </aside>

      {/* Editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tabs */}
        <div className="flex items-center bg-neutral-900 border-b border-neutral-800 overflow-x-auto">
          {openFiles.map((p) => (
            <div key={p}
              className={"group flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-r border-neutral-800 " + (p === activeFile ? "bg-[#1e1e1e] text-white" : "text-neutral-400 hover:text-white")}
              onClick={() => onOpen(p)}>
              <FileIcon className="w-3 h-3" />
              <span className="font-mono">{p.split("/").pop()}</span>
              <button onClick={(e) => { e.stopPropagation(); onClose(p); }} className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-3 px-3">
            <button onClick={onCopy} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1">
              {copied ? <><Check className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
            <button onClick={onDownload} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"><Download className="w-3 h-3" /> Zip</button>
            <button onClick={onOpenDeploy} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Open</button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {activeFile ? (
            <Editor
              key={activeFile}
              height="100%"
              path={activeFile}
              defaultLanguage={languageFor(activeFile)}
              language={languageFor(activeFile)}
              theme="vs-dark"
              value={files[activeFile] ?? ""}
              onChange={(v) => onChange(activeFile, v ?? "")}
              options={{ minimap: { enabled: true }, fontSize: 13, wordWrap: "on", formatOnPaste: true, scrollBeyondLastLine: false, tabSize: 2 }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-500 text-sm">Select a file from the tree</div>
          )}
        </div>
      </div>
    </div>
  );
}

function TreeView({
  node, depth, activeFile, onOpen, onDelete, collapsed, setCollapsed,
}: {
  node: TreeNode; depth: number; activeFile: string;
  onOpen: (p: string) => void; onDelete: (p: string) => void;
  collapsed: Record<string, boolean>; setCollapsed: (u: Record<string, boolean>) => void;
}) {
  return (
    <>
      {node.children.map((c) => {
        if (c.isDir) {
          const isCol = collapsed[c.path];
          return (
            <div key={c.path}>
              <button
                onClick={() => setCollapsed({ ...collapsed, [c.path]: !isCol })}
                className="w-full flex items-center gap-1 px-2 py-0.5 text-neutral-300 hover:bg-neutral-800 text-xs"
                style={{ paddingLeft: 8 + depth * 12 }}
              >
                {isCol ? <Folder className="w-3.5 h-3.5 text-blue-400" /> : <FolderOpen className="w-3.5 h-3.5 text-blue-400" />}
                <span className="truncate">{c.name}</span>
              </button>
              {!isCol && <TreeView node={c} depth={depth + 1} activeFile={activeFile} onOpen={onOpen} onDelete={onDelete} collapsed={collapsed} setCollapsed={setCollapsed} />}
            </div>
          );
        }
        const active = c.path === activeFile;
        return (
          <div key={c.path} className={"group flex items-center " + (active ? "bg-neutral-800" : "hover:bg-neutral-800/60")}>
            <button onClick={() => onOpen(c.path)}
              className={"flex-1 flex items-center gap-1 py-0.5 text-xs text-left " + (active ? "text-white" : "text-neutral-300")}
              style={{ paddingLeft: 8 + depth * 12 }}>
              <FileIcon className="w-3.5 h-3.5 text-neutral-400" />
              <span className="truncate">{c.name}</span>
            </button>
            <button onClick={() => onDelete(c.path)} className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 pr-2" title="Delete">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </>
  );
}

/* ---------------- Message ---------------- */

function Message({ msg }: { msg: UIMessage }) {
  const text = msg.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const isUser = msg.role === "user";
  const manifest = !isUser ? extractManifest(text) : null;
  // Strip code/json blocks for display
  const cleaned = isUser
    ? text
    : text.replace(/```(?:json|html)[\s\S]*?```/gi, "").replace(/```[\s\S]*?```/g, "").trim();

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={isUser
        ? "max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-sm"
        : "max-w-[95%] text-sm text-neutral-200 whitespace-pre-wrap w-full"}>
        {cleaned || (isUser ? text : (manifest ? manifest.summary ?? "Updated app." : "…"))}
        {!isUser && manifest && (
          <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-300">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium">{manifest.summary ?? "App updated"}</span>
              <span className="ml-auto text-emerald-400/70">{Object.keys(manifest.files).length} file{Object.keys(manifest.files).length === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-1.5 space-y-0.5 text-emerald-200/80 font-mono text-[10.5px]">
              {Object.keys(manifest.files).slice(0, 8).map((p) => <div key={p}>· {p}</div>)}
              {Object.keys(manifest.files).length > 8 && <div>· …</div>}
            </div>
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
          <div className="w-14 h-14 rounded-2xl gradient-brand flex items-center justify-center"><Sparkles className="w-6 h-6 text-white" /></div>
          <div className="text-neutral-700 font-medium">Your app preview</div>
          <div className="text-xs text-neutral-500">Ask the AI on the left to build something.</div>
        </>
      )}
    </div>
  );
}
