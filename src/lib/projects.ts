export type Checkpoint = {
  id: string;
  createdAt: number;
  label: string;
  code: string;
};

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messages: unknown[]; // UIMessage[]
  code: string; // latest generated HTML
  modelKey?: string; // "provider:model"
  checkpoints?: Checkpoint[];
};

const KEY = "skybuilder.projects.v1";

export function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Project[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(projects));
  } catch {
    // localStorage quota — trim old projects
    const trimmed = projects.slice(0, 20).map((p) => ({
      ...p,
      checkpoints: (p.checkpoints ?? []).slice(-10),
    }));
    try {
      window.localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      /* ignore */
    }
  }
}

export function getProject(id: string): Project | undefined {
  return loadProjects().find((p) => p.id === id);
}

export function upsertProject(project: Project) {
  const all = loadProjects();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) all[idx] = project;
  else all.unshift(project);
  saveProjects(all);
}

export function deleteProject(id: string) {
  saveProjects(loadProjects().filter((p) => p.id !== id));
}

export function createProject(name = "Untitled Project"): Project {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    code: "",
    checkpoints: [],
  };
}

export function extractHtml(text: string): string | null {
  const htmlBlock = text.match(/```html\s*([\s\S]*?)```/i);
  if (htmlBlock) return htmlBlock[1].trim();
  const anyBlock = text.match(/```(?:\w+)?\s*(<!doctype[\s\S]*?)```/i);
  if (anyBlock) return anyBlock[1].trim();
  const idx = text.toLowerCase().indexOf("<!doctype");
  if (idx >= 0) return text.slice(idx).trim();
  return null;
}
