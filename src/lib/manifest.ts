// Multi-file project manifest parser.
// The AI is instructed to output a ```json manifest block. We also fall back to
// legacy ```html blobs so older sessions keep working.

export type FrameworkId = "static" | "react";

export type Manifest = {
  summary?: string;
  framework: FrameworkId;
  entry: string; // relative path, e.g. "index.html"
  files: Record<string, string>;
  deleted: string[];
};

const HTML_ENTRY = "index.html";

function guessLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return (
    {
      html: "html",
      htm: "html",
      css: "css",
      js: "javascript",
      mjs: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      json: "json",
      md: "markdown",
      svg: "xml",
    } as Record<string, string>
  )[ext] ?? "plaintext";
}

export function languageFor(path: string) {
  return guessLanguage(path);
}

function tryParseManifest(raw: string): Manifest | null {
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== "object") return null;
    const filesArr = Array.isArray(j.files) ? j.files : [];
    const files: Record<string, string> = {};
    for (const f of filesArr) {
      if (f && typeof f.path === "string" && typeof f.content === "string") {
        files[f.path.replace(/^\/+/, "")] = f.content;
      }
    }
    if (Object.keys(files).length === 0) return null;
    const framework: FrameworkId = j.framework === "react" ? "react" : "static";
    const entry: string =
      typeof j.entry === "string" && files[j.entry] ? j.entry : (files[HTML_ENTRY] ? HTML_ENTRY : Object.keys(files)[0]);
    return {
      summary: typeof j.summary === "string" ? j.summary : undefined,
      framework,
      entry,
      files,
      deleted: Array.isArray(j.deleted) ? j.deleted.filter((d: unknown) => typeof d === "string") : [],
    };
  } catch {
    return null;
  }
}

export function extractManifest(text: string): Manifest | null {
  // 1) ```json { ... } ``` block
  const jsonBlock = text.match(/```json\s*([\s\S]*?)```/i);
  if (jsonBlock) {
    const m = tryParseManifest(jsonBlock[1].trim());
    if (m) return m;
  }
  // 2) raw {"framework":...} object anywhere
  const rawObj = text.match(/\{[\s\S]*?"files"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);
  if (rawObj) {
    const m = tryParseManifest(rawObj[0]);
    if (m) return m;
  }
  // 3) legacy ```html blob → single-file project
  const html = text.match(/```html\s*([\s\S]*?)```/i);
  if (html) {
    return {
      framework: "static",
      entry: HTML_ENTRY,
      files: { [HTML_ENTRY]: html[1].trim() },
      deleted: [],
    };
  }
  // 4) raw <!doctype html>
  const idx = text.toLowerCase().indexOf("<!doctype");
  if (idx >= 0) {
    return {
      framework: "static",
      entry: HTML_ENTRY,
      files: { [HTML_ENTRY]: text.slice(idx).trim() },
      deleted: [],
    };
  }
  return null;
}

export function mergeManifest(
  prev: { files: Record<string, string>; entry?: string; framework?: FrameworkId },
  next: Manifest,
): { files: Record<string, string>; entry: string; framework: FrameworkId } {
  const files: Record<string, string> = { ...prev.files };
  for (const del of next.deleted) delete files[del];
  for (const [p, c] of Object.entries(next.files)) files[p] = c;
  return {
    files,
    entry: next.entry || prev.entry || HTML_ENTRY,
    framework: next.framework || prev.framework || "static",
  };
}

// Build a single self-contained HTML document from a multi-file project by
// rewriting <link>/<script src>/<img src> to blob: URLs for referenced files.
const MIME: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "application/javascript",
  mjs: "application/javascript",
  jsx: "text/babel",
  tsx: "text/babel",
  ts: "text/babel",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

function mimeFor(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "text/plain";
}

export type BuiltPreview = { html: string; cleanup: () => void };

export function buildPreviewHtml(files: Record<string, string>, entry: string, framework: FrameworkId): BuiltPreview {
  const urls: string[] = [];
  const blobFor = (path: string) => {
    const content = files[path];
    if (content == null) return "";
    const url = URL.createObjectURL(new Blob([content], { type: mimeFor(path) }));
    urls.push(url);
    return url;
  };

  let html = files[entry] ?? files[HTML_ENTRY] ?? "";
  if (!html) {
    // No HTML entry: synthesize one that loads every JS/CSS file.
    const cssLinks = Object.keys(files)
      .filter((p) => p.endsWith(".css"))
      .map((p) => `<link rel="stylesheet" href="${p}">`)
      .join("\n");
    const jsScripts = Object.keys(files)
      .filter((p) => /\.(jsx?|tsx?|mjs)$/.test(p))
      .map((p) => `<script ${framework === "react" ? 'type="text/babel" data-presets="react"' : ""} src="${p}"></script>`)
      .join("\n");
    html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script>${framework === "react" ? '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script><script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>' : ""}${cssLinks}</head><body><div id="root"></div>${jsScripts}</body></html>`;
  }

  // Rewrite href/src attributes that point at project files.
  html = html.replace(/\b(href|src)\s*=\s*(["'])([^"']+)\2/g, (m, attr, q, path) => {
    const clean = path.replace(/^\.\//, "").replace(/^\//, "");
    if (files[clean] != null) {
      return `${attr}=${q}${blobFor(clean)}${q}`;
    }
    return m;
  });

  return {
    html,
    cleanup: () => urls.forEach((u) => URL.revokeObjectURL(u)),
  };
}
