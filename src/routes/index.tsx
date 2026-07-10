import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Send, Settings, PanelLeft, Sparkles, Trash2, Wand2 } from "lucide-react";
import skyBg from "@/assets/sky-bg.jpg.asset.json";
import { createProject, loadProjects, upsertProject, deleteProject, type Project } from "@/lib/projects";
import { ModelPicker } from "@/components/ModelPicker";
import { getDefaultModel, setDefaultModel, modelKey, type ModelInfo } from "@/lib/models";

export const Route = createFileRoute("/")({
  component: Home,
});

const SAMPLES = [
  "A todo app with dark mode",
  "Landing page for a coffee shop",
  "Pomodoro timer with sound",
  "Tic-tac-toe with AI opponent",
  "SaaS pricing page",
  "Weather dashboard",
];

function Home() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [model, setModel] = useState<ModelInfo>(() => getDefaultModel());

  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  function pickModel(m: ModelInfo) {
    setModel(m);
    setDefaultModel(m);
  }

  function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    const p = createProject(text.slice(0, 40));
    p.modelKey = modelKey(model);
    upsertProject(p);
    navigate({ to: "/build/$projectId", params: { projectId: p.id }, search: { prompt: text } });
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteProject(id);
    setProjects(loadProjects());
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <img src={skyBg.url} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ zIndex: -1 }} />
      <div className="absolute inset-0" style={{ zIndex: -1, background: "linear-gradient(180deg, transparent 40%, oklch(0 0 0 / 0.15))" }} />

      <div className="flex min-h-screen">
        {sidebarOpen && (
          <aside className="w-64 shrink-0 bg-white/70 backdrop-blur-md border-r border-white/40 flex flex-col p-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 text-white font-display text-2xl leading-none">
                App builder
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 transition"
                aria-label="Collapse sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-8 text-neutral-800 text-lg font-medium">Projects</div>

            <div className="mt-3 space-y-2 flex-1 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-neutral-400/70 bg-neutral-200/40 p-4 text-neutral-500 text-sm leading-snug">
                  No projects yet.<br />Type below to build one.
                </div>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate({ to: "/build/$projectId", params: { projectId: p.id }, search: {} })}
                    className="w-full text-left rounded-xl bg-white/80 hover:bg-white border border-neutral-300 p-3 group transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-neutral-900 truncate">{p.name}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">{new Date(p.updatedAt).toLocaleDateString()}</div>
                      </div>
                      <span
                        onClick={(e) => handleDelete(p.id, e)}
                        role="button"
                        tabIndex={0}
                        className="p-1 rounded hover:bg-neutral-200 text-neutral-500 opacity-0 group-hover:opacity-100 transition"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-300/60">
              <Link
                to="/settings"
                className="w-full flex items-center gap-2 rounded-lg bg-neutral-900 text-white text-sm px-3 py-2 hover:bg-neutral-700 transition"
              >
                <Settings className="w-4 h-4" /> Settings & API keys
              </Link>
            </div>
          </aside>
        )}

        <main className="flex-1 flex flex-col items-center justify-center px-6 relative">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute top-4 left-4 p-2 rounded-md bg-neutral-900/80 text-white hover:bg-neutral-900 backdrop-blur"
              aria-label="Open sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}

          <div className="absolute top-4 right-4">
            <ModelPicker value={model} onChange={pickModel} />
          </div>

          <h1 className="font-display text-6xl md:text-7xl lg:text-8xl text-neutral-900 text-center text-shadow-hero mb-12 leading-tight">
            What do you want to create?
          </h1>

          <form onSubmit={handleCreate} className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-6 relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="Describe your app in detail — e.g. 'a habit tracker with streak counter, dark mode, and confetti when I hit my goal'"
              rows={4}
              className="w-full resize-none outline-none text-lg text-neutral-800 placeholder:text-neutral-400 bg-transparent pr-12"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Wand2 className="w-3.5 h-3.5" /> Using <span className="font-medium text-neutral-700">{model.label}</span>
              </div>
              <button
                type="submit"
                className="w-11 h-11 rounded-lg bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-700 transition disabled:opacity-40"
                disabled={!prompt.trim()}
                aria-label="Create app"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
            {SAMPLES.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="px-3 py-1.5 rounded-full bg-white/70 hover:bg-white border border-white/60 text-neutral-700 backdrop-blur transition"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-8 inline-flex items-center gap-2 text-neutral-800/80 text-xs bg-white/60 backdrop-blur px-3 py-1.5 rounded-full">
            <Sparkles className="w-3 h-3" /> Powered by AI · Built with Lovable
          </div>
        </main>
      </div>
    </div>
  );
}
