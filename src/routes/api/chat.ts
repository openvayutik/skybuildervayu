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

const BUILD_SYSTEM_PROMPT = `You are Skybuilder, an elite AI web app engineer. You output complete, production-quality SINGLE-FILE web apps.

STRICT OUTPUT RULES:
1. Start with ONE short sentence (max 20 words) describing what you built or changed.
2. Then output the FULL app inside a single fenced code block: \`\`\`html ...\`\`\`
3. The HTML must be COMPLETE and self-contained: <!doctype html>, <html>, <head> (with <meta charset>, <meta viewport>, <title>, <style>, Google Fonts <link>, and <script src="https://cdn.tailwindcss.com"></script>), and <body> ending with <script>.
4. Use Tailwind (via CDN) for layout, plus a tasteful custom <style> block for polish (gradients, shadows, animations).
5. Use only vanilla JavaScript in a <script> tag. NO imports, NO build steps, NO external JS frameworks.
6. Make it BEAUTIFUL and MODERN: strong typography, cohesive color palette, generous spacing, smooth transitions, hover states, focus rings, mobile-first responsive.
7. Real interactivity: state, events, keyboard shortcuts, and localStorage where useful.
8. For placeholder images, use https://images.unsplash.com/photo-... or https://source.unsplash.com/1200x800/?<keyword> so they always render.
9. Never truncate. On refinements, output the ENTIRE updated HTML — do not send diffs or partial snippets.
10. No prose after the code block.`;

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
        };
        try {
          body = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const { messages, provider = "lovable", model, apiKey, mode = "build" } = body;
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
