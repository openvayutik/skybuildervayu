# Skybuilder — Full Upgrade Plan

This is a large scope. To ship with a **100% working** result and no half-broken features, I'll split it into 3 phases. Each phase is independently shippable. Please confirm and I'll start with Phase 1 (or say "do all" and I'll execute all three back-to-back).

---

## Phase 1 — Providers, Models, Settings, Chat Upgrade (core)

**Settings page** (`/settings`)
- Configure API keys for: **OpenRouter, Google Gemini, Groq, NVIDIA NIM**, plus keep **Lovable AI** as the free default.
- Keys stored **encrypted in localStorage** (client-only, never sent to our server; requests go browser → provider directly when a user key exists, else through Lovable AI Gateway).
- Test-connection button per provider.

**Model picker**
- Dropdown on **home page** and **builder header**.
- Curated model list per provider (e.g. Gemini 2.5 Pro/Flash, GPT-5.5, Claude via OpenRouter, Llama 3.3 70B via Groq, Nemotron via NIM).
- Selected model persisted per project.

**Chat panel — Lovable-style**
- Streaming with **plan / build mode** toggle (plan = markdown reasoning first, build = code).
- **Checkpoints**: every assistant turn snapshots the generated code; user can click to restore.
- Inline **code block previews** with copy button and file badge.
- Status pills: "Thinking…", "Writing HTML…", "Done".
- Retry / edit-last-message.

**Wire the AI route** to route per-provider (Lovable Gateway, OpenRouter, direct Gemini, Groq, NIM) using the AI SDK's OpenAI-compatible adapter.

---

## Phase 2 — IDE Code Panel + History + Image Scraper

**Monaco-based IDE code panel** (replaces the current `<pre>`):
- Syntax highlight, minimap, line numbers, find/replace, format-on-save.
- **Multi-file support** — parse AI output into a virtual file tree (index.html, styles.css, app.js, etc.).
- File tabs + tree sidebar.
- Live edit → preview refresh.
- Download as ZIP.

**History panel** in builder:
- Full timeline of checkpoints with diff preview.
- Restore / branch from any point.

**Image scraper** (background enrichment):
- After generation, scan HTML for `<img>` placeholders / `data-needs-image="..."` attributes.
- Server route calls **Unsplash / Pexels API** (free, no key needed for demo tier) or Lovable AI image gen for missing images.
- Replaces `src` in the final HTML before saving.

---

## Phase 3 — Framework Modes + 10 Bonus Features

**Framework modes** — the AI can now output:
1. Single-file HTML app (current)
2. Multi-file **vanilla web app** (HTML/CSS/JS separated)
3. **React app** (Vite + Tailwind + shadcn, downloadable as ZIP)

System prompts + output parsers per mode; strict validation so previews never break.

**10+ extra features:**
1. **Share link** — publish generated app to a public URL (upload HTML to Lovable storage).
2. **Fork project** button.
3. **Templates gallery** on home (Landing page, SaaS, Dashboard, Portfolio, Game, etc.).
4. **Prompt enhancer** — one-click "Improve prompt" via AI.
5. **Voice input** on composer (Web Speech API).
6. **Screenshot-to-app** — upload a UI screenshot, AI rebuilds it.
7. **Mobile / tablet / desktop** preview toggles.
8. **Dark/light preview** switch.
9. **Console panel** — captures iframe `console.log` for debugging.
10. **Auto-fix** button — if iframe throws, AI reads the error and patches.
11. **Keyboard shortcuts** (⌘K command palette, ⌘S save, ⌘⏎ send).
12. **Export**: ZIP, single HTML, or direct-to-GitHub gist.

---

## Technical Notes

- **Provider routing:** one server function per provider (`/api/chat`) accepting `{ provider, model, apiKey? }`. If `apiKey` from user settings is present, we pass it to the gateway; otherwise use `LOVABLE_API_KEY`.
- **Security:** never log user API keys; keys stay in `localStorage` and are attached only to the outbound request.
- **Storage:** everything stays in `localStorage` (no DB) unless you want cloud sync — say the word and I'll add Lovable Cloud with auth + Postgres for projects/history/shared apps.
- **Model list** kept in `src/lib/models.ts` and rendered by the picker, so adding models later is a one-line change.

---

## What I need from you

1. **Approve phases** (all three, or one at a time?).
2. **Cloud sync?** yes/no — recommend yes so history & share links survive across devices.
3. **Templates** — want me to pre-seed 6 starter templates?

Reply "go" and I'll start Phase 1 immediately.
