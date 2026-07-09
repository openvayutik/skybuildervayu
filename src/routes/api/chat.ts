import { createFileRoute } from "@tanstack/react-router";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM_PROMPT = `You are Skybuilder, an elite AI that generates complete, production-quality single-file web apps.

CRITICAL OUTPUT RULES:
1. Reply with ONE short sentence explaining what you built (max 20 words).
2. Then output the ENTIRE app as a single HTML file inside a \`\`\`html code block.
3. The HTML must be COMPLETE: <!doctype html>, <html>, <head> with <meta charset>, <title>, <style>, and <body> with <script>.
4. Use Tailwind via <script src="https://cdn.tailwindcss.com"></script> for styling. You may also add custom <style>.
5. All JavaScript is vanilla JS in a <script> tag. No imports, no build steps, no external frameworks except CDN Tailwind.
6. Make it BEAUTIFUL: modern typography (use Google Fonts via <link>), thoughtful color palette, generous spacing, smooth transitions, proper hover states, mobile-responsive.
7. Add real interactivity — the app must actually work (state, events, localStorage where useful).
8. Never truncate. Always output the full HTML on every turn, incorporating the user's latest request.
9. Do not add explanations after the code block.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(messages)) {
          return new Response("messages required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-2.5-flash"),
          system: SYSTEM_PROMPT,
          messages: convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
