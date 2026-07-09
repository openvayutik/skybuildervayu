import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Grid3x3, Pencil, Rocket, Code2, Send, Plus, Loader2, Sparkles } from "lucide-react";
import { getProject, upsertProject, createProject, extractHtml } from "@/lib/projects";
import { z } from "zod";

const searchSchema = z.object({
  prompt: z.string().optional(),
});

export const Route = createFileRoute("/build/$projectId")({
  component: Builder,
  validateSearch: searchSchema,
});

function Builder() {
  const { projectId } = Route.useParams();
  const { prompt: initialPrompt } = Route.useSearch();
  const navigate = useNavigate();

  const [name, setName] = useState("Project Name");
  const [editingName, setEditingName] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [savedCode, setSavedCode] = useState<string>("");
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [input, setInput] = useState("");
  const autoSentRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load from localStorage
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
  }, [projectId]);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: projectId,
    transport,
    onError: (err) => console.error("chat error", err),
  });

  // Hydrate messages from storage once
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length, setMessages]);

  // Persist messages + code
  useEffect(() => {
    if (initialMessages === null) return;
    const latest = getProject(projectId);
    if (!latest) return;
    // Extract latest HTML from any assistant message
    let code = savedCode;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
      const html = extractHtml(text);
      if (html) {
        code = html;
        break;
      }
    }
    if (code !== savedCode) setSavedCode(code);
    upsertProject({
      ...latest,
      name,
      messages,
      code,
      updatedAt: Date.now(),
    });
  }, [messages, name, projectId, initialMessages, savedCode]);

  // Auto-send initial prompt from home
  useEffect(() => {
    if (autoSentRef.current) return;
    if (initialMessages === null) return; // wait for load
    if (initialPrompt && messages.length === 0) {
      autoSentRef.current = true;
      sendMessage({ text: initialPrompt });
      navigate({ to: "/build/$projectId", params: { projectId }, search: {}, replace: true });
    } else if (initialPrompt) {
      autoSentRef.current = true;
    }
  }, [initialPrompt, initialMessages, messages.length, sendMessage, navigate, projectId]);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const t = input.trim();
    if (!t || status === "streaming" || status === "submitted") return;
    sendMessage({ text: t });
    setInput("");
  }

  const isBusy = status === "submitted" || status === "streaming";

  function handleDeploy() {
    if (!savedCode) return alert("Nothing to deploy yet. Ask the AI to build something first!");
    const blob = new Blob([savedCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  return (
    <div className="h-screen w-screen bg-neutral-950 text-white p-3 flex flex-col gap-3 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-3">
        {/* Left cluster: apps + name */}
        <div className="flex items-center gap-2 bg-neutral-900 rounded-2xl p-2 pr-3 border border-neutral-800">
          <Link
            to="/"
            className="w-10 h-10 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition"
            aria-label="All projects"
          >
            <Grid3x3 className="w-4 h-4" />
          </Link>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: "linear-gradient(180deg, #f5f5f5, #cccccc)" }}
          >
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
            <button
              onClick={() => setEditingName((v) => !v)}
              className="text-neutral-700 hover:text-neutral-900"
              aria-label="Rename"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2 bg-neutral-900 rounded-2xl p-2 border border-neutral-800">
          <button
            onClick={() => setTab(tab === "code" ? "preview" : "code")}
            className="px-5 py-2 rounded-lg text-white font-medium text-sm gradient-code hover:opacity-90 transition flex items-center gap-2"
          >
            <Code2 className="w-4 h-4" />
            {tab === "code" ? "Preview" : "Code"}
          </button>
          <button
            onClick={handleDeploy}
            className="px-5 py-2 rounded-lg text-white font-medium text-sm gradient-deploy hover:opacity-90 transition flex items-center gap-2"
          >
            Deploy <Rocket className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main split */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Chat panel */}
        <section
          className="w-[380px] shrink-0 rounded-2xl p-3 flex flex-col bg-neutral-900 relative"
          style={{
            boxShadow:
              "inset 0 0 0 1px oklch(0.72 0.22 320 / 0.35), 0 0 30px oklch(0.72 0.22 320 / 0.15)",
          }}
        >
          {/* Neon right edge */}
          <div
            className="absolute top-2 bottom-2 -right-[1px] w-[2px] rounded-full pointer-events-none"
            style={{ background: "linear-gradient(180deg, oklch(0.72 0.28 340), oklch(0.62 0.25 260))" }}
          />
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
            {messages.map((m) => (
              <Message key={m.id} msg={m} />
            ))}
            {isBusy && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-center gap-2 text-sm text-neutral-400 px-3">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Building…
              </div>
            )}
          </div>

          {/* Composer */}
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
              placeholder="Ask for changes…"
              disabled={isBusy}
              className="w-full resize-none rounded-xl p-3 pl-9 pr-11 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none bg-transparent"
              style={{
                boxShadow:
                  "0 0 0 1.5px transparent, 0 0 0 2px oklch(0.72 0.28 340 / 0.5), 0 0 12px oklch(0.72 0.28 340 / 0.4)",
              }}
            />
            <button
              type="button"
              className="absolute bottom-2 left-2 w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-800"
              aria-label="More"
            >
              <Plus className="w-4 h-4" />
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

        {/* Preview panel */}
        <section
          className="flex-1 rounded-2xl bg-neutral-900 p-3 min-w-0 relative"
          style={{ boxShadow: "inset 0 0 0 1px oklch(0.3 0.02 275)" }}
        >
          <div className="w-full h-full rounded-xl overflow-hidden bg-white relative">
            {tab === "preview" ? (
              savedCode ? (
                <iframe
                  title="preview"
                  srcDoc={savedCode}
                  className="w-full h-full border-0 bg-white"
                  sandbox="allow-scripts allow-forms allow-popups allow-modals"
                />
              ) : (
                <EmptyPreview busy={isBusy} />
              )
            ) : (
              <pre className="w-full h-full overflow-auto p-4 text-xs text-neutral-800 font-mono whitespace-pre-wrap">
                {savedCode || "// Generated code will appear here"}
              </pre>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Message({ msg }: { msg: UIMessage }) {
  const text = msg.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const isUser = msg.role === "user";
  // Strip HTML code block for chat display
  const cleaned = isUser ? text : text.replace(/```html[\s\S]*?```/gi, "").replace(/```[\s\S]*?```/g, "").trim();
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-sm"
            : "max-w-[95%] text-sm text-neutral-200 whitespace-pre-wrap"
        }
      >
        {cleaned || (isUser ? text : "…")}
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
