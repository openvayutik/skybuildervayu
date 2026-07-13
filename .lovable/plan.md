# Skybuilder v2 — Multi-file AI app builder

Fix the two real complaints: (1) the AI only outputs one HTML blob, so generations feel weak; (2) the "code panel" is read-only Monaco with no file tree, so you can't edit or navigate. Rebuild both.

## 1. Multi-file generation (like Lovable / v0 / arena)

New AI contract: the model returns a **project manifest as JSON** inside a single ```json fenced block, not a single HTML file.

```json
{
  "summary": "One-line what changed",
  "framework": "static" | "react-vite",
  "entry": "index.html",
  "files": [
    { "path": "index.html", "content": "..." },
    { "path": "src/App.tsx", "content": "..." },
    { "path": "src/styles.css", "content": "..." }
  ],
  "deleted": ["old/path.js"]
}
```

Rewrite `src/routes/api/chat.ts` system prompts:
- **static** framework — multi-file vanilla project (index.html + css/ + js/ modules + assets).
- **react-vite** framework — React + Tailwind + shadcn-style components as multiple `.tsx`/`.css` files, bundled in-browser (see §3).
- Both prompts require: strong design system (semantic color tokens, typography scale, spacing, motion), real content, Unsplash images by keyword, accessibility, responsive.
- Refinements: emit only changed/new files in `files[]`, list removed paths in `deleted[]` — server merges into project state. Full-file replacement per changed file (no diffs).

Parser lives in `src/lib/manifest.ts`: extracts the JSON block, validates with Zod, merges into project file map.

## 2. Real IDE panel

Rewrite the Code tab in `src/routes/build.$projectId.tsx` into a proper IDE layout:

```text
┌─ Files ──────┬─ Tabs: App.tsx × index.html × ─────────┐
│ ▸ src/       │                                         │
│   App.tsx    │        Monaco editor (editable)         │
│   styles.css │        - syntax per extension           │
│ index.html   │        - save on blur / Ctrl+S          │
│ package.json │        - dirty indicator on tab         │
└──────────────┴─────────────────────────────────────────┘
```

- File tree: collapsible folders, new file / new folder / rename / delete, right-click menu.
- Editor: Monaco with `onChange` writing back into project files, multi-tab open files, unsaved dot, Ctrl+S saves + rebuilds preview, Ctrl+P quick-open.
- Search: Ctrl+Shift+F across all files (simple substring, results list).
- Every edit creates a lightweight checkpoint (already have the system).

## 3. Preview that runs real projects

Two preview engines:

- **static**: assemble files into a Blob URL bundle — inline `<link>`/`<script src>` are rewritten to `blob:` URLs before injecting the HTML into the iframe. Handles CSS, JS modules, images (base64 or Unsplash).
- **react-vite**: in-browser bundler using **esbuild-wasm** (`esbuild.build` with a virtual FS resolver pointing at the project files, JSX loader, Tailwind via CDN). Output JS is injected into a minimal `index.html` template. No server build step.

Both engines re-run on Ctrl+S or the existing "Run" button; hot rebuild is debounced.

## 4. Design capability upgrades

- Ship a default design-system starter (tokens.css with HSL semantic colors, typography scale, motion, shadows) that every new React project inherits.
- Prompt teaches the model to use those tokens, not hardcoded Tailwind colors — matches how Lovable prompts work.
- Add a "Design style" chip on the home page (Minimal, Bold, Playful, Glass, Brutalist) that gets appended to the system prompt.

## 5. Extra IDE conveniences

- Download project as `.zip` (JSZip).
- Copy file / duplicate.
- Console tab already exists — keep, wire "Auto-fix" to send file map + errors back to model.
- Keyboard: Ctrl+S save+run, Ctrl+P quick-open, Ctrl+Enter send, Ctrl+B toggle sidebar.

## Technical notes (dev-facing)

- New deps: `esbuild-wasm`, `jszip`.
- Project storage extends: `Project.files: Record<string, string>`, `Project.entry: string`, `Project.framework: "static"|"react-vite"`. Migration: if old `code` string exists and no `files`, seed `{ "index.html": code }`.
- Manifest parser is tolerant: if model returns a raw HTML block (legacy), wrap it as `{ files: [{ path: "index.html", content }] }`.
- Preview iframe uses `srcdoc` for static, and a Blob URL for react-vite so relative imports resolve.
- Keep current providers/model picker/checkpoints/plan-mode intact.

## Out of scope this pass

- Server-side bundling, real npm install, backend/DB scaffolding, auth in generated apps, deployment beyond "download zip / open HTML".
