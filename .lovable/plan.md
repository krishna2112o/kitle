# AI Web App Builder with Live Preview

A nuvic/Lovable-style tool where developers describe an app in chat and an AI generates a multi-file React + Vite + TS project, rendered live in a Sandpack sandbox. Users iterate by chatting further; the AI returns updated files.

## User experience

Single page, dark theme, split layout:

```text
┌─────────────────────┬──────────────────────────────────┐
│  Chat               │  Preview / Code  (tab toggle)    │
│  ────────           │                                  │
│  • assistant msg    │   ┌────────────────────────────┐ │
│  • user msg         │   │                            │ │
│  • assistant msg    │   │   Sandpack live preview    │ │
│                     │   │                            │ │
│  [ generating... ]  │   └────────────────────────────┘ │
│                     │                                  │
│  ┌───────────────┐  │   File tree appears in Code tab  │
│  │ prompt input  │  │                                  │
│  └───────────────┘  │                                  │
└─────────────────────┴──────────────────────────────────┘
```

- **Left (≈35%)**: chat thread + prompt textarea + send button. First message kicks off project generation; subsequent messages refine it.
- **Right (≈65%)**: tab toggle "Preview | Code". Preview is a live Sandpack runtime. Code shows Sandpack's file explorer + Monaco-style editor (read-only on first pass, editable as a stretch goal).
- Status pill while AI is working ("Generating…", "Updating files…").
- Errors from the AI gateway (rate limit / credits) surface as toasts.

## How generation works

1. User sends prompt. Frontend posts `{ messages, currentFiles }` to a server function.
2. Server function calls Lovable AI (`google/gemini-3-flash-preview`) with a system prompt instructing it to return a JSON object of files via tool calling:
   ```json
   { "files": [
       { "path": "/App.tsx", "content": "..." },
       { "path": "/index.html", "content": "..." },
       { "path": "/main.tsx", "content": "..." },
       { "path": "/styles.css", "content": "..." }
   ], "summary": "short note shown in chat" }
   ```
3. On follow-up turns, the current file map is included so the model edits in place rather than starting over.
4. Frontend merges returned files into Sandpack state → preview hot-reloads automatically.

Sandpack template: `react-ts` (Vite-based, supports tsx/ts/html/css). The model is constrained to that template's conventions so generated code "just works".

## Scope (per your answers)

In: chat-driven multi-file generation, Sandpack preview + code view, iterative refinement, Lovable AI backend.
Out: example prompt chips, ZIP export, save/load projects, auth, database.

## Technical notes

- **Stack**: TanStack Start + Tailwind (existing). Add `@codesandbox/sandpack-react` for the sandbox.
- **AI call**: server function at `src/server/generate.functions.ts` using `createServerFn`, calling `https://ai.gateway.lovable.dev/v1/chat/completions` with `tool_choice` forcing the `emit_project` tool so output is structured JSON (no fragile prose parsing). Non-streaming for v1 — simpler, and Sandpack updates atomically anyway.
- **State**: chat messages and file map held in a single `useState` on the builder page.
- **Routes**: replace placeholder `src/routes/index.tsx` with the builder page; no extra routes needed.
- **Errors**: server function maps 429 → "Rate limited, try again", 402 → "Add credits in Workspace settings", surfaced via `sonner` toasts.
- **Lovable Cloud**: must be enabled so `LOVABLE_API_KEY` is available to the server function. No database/auth tables created.

## Build steps

1. Enable Lovable Cloud (for `LOVABLE_API_KEY`); install `@codesandbox/sandpack-react` and `sonner`.
2. Create `src/server/generate.functions.ts` — server function that calls Lovable AI with a forced `emit_project` tool and returns `{ files, summary }`.
3. Create `src/components/builder/ChatPanel.tsx` — message list + textarea + send.
4. Create `src/components/builder/PreviewPanel.tsx` — Sandpack provider with Preview/Code tab toggle, fed by the current file map.
5. Replace `src/routes/index.tsx` with the split-layout builder page wiring chat → server function → file map → Sandpack.
6. Update root `__root.tsx` meta (title "AI App Builder") and mount `<Toaster />`.
