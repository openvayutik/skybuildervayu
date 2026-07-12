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

const HTML_RULES = `The HTML must be COMPLETE and self-contained: <!doctype html>, <html>, <head> (with <meta charset>, <meta viewport>, <title>, <style>, Google Fonts <link>, and <script src="https://cdn.tailwindcss.com"></script>), and <body> ending with <script>.
- Use Tailwind (CDN) plus a tasteful custom <style> block (gradients, shadows, animations).
- Beautiful and modern: strong typography, cohesive palette, generous spacing, smooth transitions, hover/focus states, mobile-first responsive.
- Real interactivity: state, events, keyboard shortcuts, localStorage where useful.
- For images use https://images.unsplash.com/photo-... or https://source.unsplash.com/1200x800/?<keyword> so they always render.
- Never truncate. On refinements, output the ENTIRE updated file — no diffs, no partial snippets.`;

const SINGLE_PROMPT = `You are Skybuilder, an elite AI web app engineer. You output complete, production-quality SINGLE-FILE vanilla web apps.

STRICT OUTPUT RULES:
1. Start with ONE short sentence (max 20 words) describing what you built or changed.
2. Then output the FULL app inside a single fenced code block: \`\`\`html ...\`\`\`
3. ${HTML_RULES}
4. Use only vanilla JavaScript in a <script> tag. NO imports, NO build steps, NO external JS frameworks.
5. No prose after the code block.`;

const REACT_PROMPT = `You are Skybuilder, an elite AI React engineer. You output complete, production-quality React apps as a SINGLE self-contained HTML file that runs directly in the browser via CDN.

STRICT OUTPUT RULES:
1. Start with ONE short sentence (max 20 words) describing what you built or changed.
2. Then output the FULL app inside a single fenced code block: \`\`\`html ...\`\`\`
3. Include these <script> tags in <head>, in this exact order:
   - https://unpkg.com/react@18/umd/react.production.min.js
   - https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
   - https://unpkg.com/@babel/standalone/babel.min.js
   - https://cdn.tailwindcss.com
4. Put your app code inside <script type="text/babel" data-presets="react">...</script>. Use hooks (useState, useEffect, useMemo). Mount with ReactDOM.createRoot(document.getElementById('root')).render(<App/>).
5. ${HTML_RULES}
6. No imports, no ES modules, no external component libraries — just React + Tailwind via CDN.
7. No prose after the code block.`;

const PLAN_SYSTEM_PROMPT = `You are Skybuilder in PLAN mode. The user described an app they want.
Respond with a concise implementation plan in Markdown:
- **Goal** — one line
- **Key features** — bullet list (5-10)
- **Sections / screens** — bullet list
- **Data & state** — bullet list
- **Visual style** — palette, typography, mood
Do NOT output any code in plan mode. Keep it under 250 words.`;

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
          framework?: "single" | "react";
        };
        try {
          body = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const { messages, provider = "lovable", model, apiKey, mode = "build", framework = "single" } = body;
        if (!Array.isArray(messages)) return new Response("messages required", { status: 400 });
        if (!model) return new Response("model required", { status: 400 });

        // Resolve key: user-supplied key for non-lovable providers, else LOVABLE_API_KEY
        let key = apiKey?.trim() || "";
        if (provider === "lovable") {
          key = process.env.LOVABLE_API_KEY || "";
          if (!key) return new Response("Missing LOVABLE_API_KEY on server", { status: 500 });
        }
        if (!key) {
          return new Response(
            `Missing API key for ${provider}. Add it in Settings.`,
            { status: 400 },
          );
        }

        const baseURL = PROVIDER_BASE[provider];
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

        const gateway = createOpenAICompatible({
          name: "sky",
          baseURL,
          headers,
        });

        try {
          const result = streamText({
            model: gateway(model),
            system: mode === "plan" ? PLAN_SYSTEM_PROMPT : BUILD_SYSTEM_PROMPT,
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
