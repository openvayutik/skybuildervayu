import { createFileRoute } from "@tanstack/react-router";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type ProviderId = "lovable" | "openrouter" | "gemini" | "groq" | "nim";

const PROVIDER_BASE: Record<ProviderId, string> = {
  lovable: "https://ai.gateway.lovable.dev/v1",
  openrouter: "https://openrouter.ai/api/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  groq: "https://api.groq.com/openai/v1",
  nim: "https://integrate.api.nvidia.com/v1",
};

const DESIGN_RULES = `DESIGN QUALITY (non-negotiable):
- Modern, distinctive visual direction. NEVER default generic (no white bg + purple/indigo gradients + Inter).
- Cohesive palette (define 4-6 semantic colors and reuse them). Strong typography scale, generous whitespace, real hierarchy.
- Interactive polish: hover/focus states, smooth transitions, thoughtful empty/loading states.
- Fully responsive (mobile-first). Accessible: semantic HTML, alt text, ARIA where needed.
- Rich, believable content — real names, real numbers, real copy. NO "lorem ipsum", NO "Card 1 / Card 2".
- Images: use https://images.unsplash.com/photo-... (real URLs) or https://source.unsplash.com/1200x800/?<keyword> for topical images.
- Icons: use inline SVG or lucide via CDN. Fonts: Google Fonts <link> in head.`;

const MANIFEST_RULES = `OUTPUT FORMAT — STRICT:
Reply with ONE fenced JSON block, nothing else. No prose before or after.

\`\`\`json
{
  "summary": "one short sentence about what you built or changed",
  "framework": "static" | "react",
  "entry": "index.html",
  "files": [
    { "path": "index.html", "content": "<!doctype html>..." },
    { "path": "styles/main.css", "content": "..." },
    { "path": "js/app.js", "content": "..." }
  ],
  "deleted": []
}
\`\`\`

RULES:
- files[].content is the ENTIRE file (never diffs, never truncated, never "...").
- On refinements, include only files that CHANGED or are NEW. List removed files in "deleted".
- index.html MUST reference every css/js file via <link>/<script src="..."> using project-relative paths that match files[].path.
- Escape backticks and newlines correctly inside JSON strings.`;

const STATIC_PROMPT = `You are Skybuilder, an elite AI web engineer. You build production-quality MULTI-FILE vanilla web apps.

FRAMEWORK: static (HTML + CSS + vanilla JS, split across real files)

FILE STRUCTURE:
- index.html — semantic HTML shell, <link>s the CSS, <script src>s the JS
- styles/*.css — split by concern (tokens.css for design tokens, layout.css, components.css)
- js/*.js — split by feature (state.js, ui.js, main.js). Use ES module <script type="module"> if convenient, else classic scripts.
- Load Tailwind CDN in index.html: <script src="https://cdn.tailwindcss.com"></script>. You may mix Tailwind classes with your own CSS.

${DESIGN_RULES}

${MANIFEST_RULES}`;

const REACT_PROMPT = `You are Skybuilder, an elite AI React engineer. You build production-quality MULTI-FILE React apps that run in the browser via CDN (React 18 + Babel Standalone + Tailwind CDN).

FRAMEWORK: react

FILE STRUCTURE:
- index.html — loads React, ReactDOM, Babel Standalone, Tailwind CDN, your CSS, then each component .jsx as <script type="text/babel" data-presets="react">
- src/App.jsx — root component; calls ReactDOM.createRoot(document.getElementById('root')).render(<App/>)
- src/components/*.jsx — one component per file. Components are global (no import/export) since Babel Standalone runs each script separately.
- src/styles/tokens.css and src/styles/app.css — design tokens + component styles

REQUIRED index.html HEAD (exact order):
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="src/styles/tokens.css">
<link rel="stylesheet" href="src/styles/app.css">

At the end of <body>, load components in dependency order (leaves first, App.jsx last):
<script type="text/babel" data-presets="react" src="src/components/Button.jsx"></script>
...
<script type="text/babel" data-presets="react" src="src/App.jsx"></script>

Use React.useState / React.useEffect / React.useMemo (globals). NO imports, NO ES modules, NO npm packages.

${DESIGN_RULES}

${MANIFEST_RULES}`;

const PLAN_PROMPT = `You are Skybuilder in PLAN mode. Respond with a concise implementation plan in Markdown:
- **Goal** — one line
- **Key features** — 5-10 bullets
- **Screens / sections**
- **File structure** — the exact files you will create
- **Visual style** — palette, typography, mood
Do NOT output any code or JSON in plan mode. Keep it under 300 words.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          messages?: UIMessage[];
          provider?: ProviderId;
          model?: string;
          apiKey?: string;
          mode?: "plan" | "build";
          framework?: "static" | "react";
        };
        try {
          body = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const { messages, provider = "lovable", model, apiKey, mode = "build", framework = "static" } = body;
        if (!Array.isArray(messages)) return new Response("messages required", { status: 400 });
        if (!model) return new Response("model required", { status: 400 });

        let key = apiKey?.trim() || "";
        if (provider === "lovable") {
          key = process.env.LOVABLE_API_KEY || "";
          if (!key) return new Response("Missing LOVABLE_API_KEY on server", { status: 500 });
        }
        if (!key) {
          return new Response(`Missing API key for ${provider}. Add it in Settings.`, { status: 400 });
        }

        const headers: Record<string, string> = {};
        if (provider === "lovable") {
          headers["Lovable-API-Key"] = key;
          headers["X-Lovable-AIG-SDK"] = "vercel-ai-sdk";
        } else {
          headers["Authorization"] = `Bearer ${key}`;
          if (provider === "openrouter") {
            headers["HTTP-Referer"] = "https://skybuilder.lovable.app";
            headers["X-Title"] = "Skybuilder";
          }
        }

        const gateway = createOpenAICompatible({ name: "sky", baseURL: PROVIDER_BASE[provider], headers });

        const system = mode === "plan" ? PLAN_PROMPT : framework === "react" ? REACT_PROMPT : STATIC_PROMPT;

        try {
          const result = streamText({
            model: gateway(model),
            system,
            messages: await convertToModelMessages(messages),
          });
          return result.toUIMessageStreamResponse({ originalMessages: messages });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return new Response(`AI error: ${msg}`, { status: 500 });
        }
      },
    },
  },
});
