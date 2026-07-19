# AI App Builder

A Lovable-style AI web app builder where users describe an app in chat and an AI generates a live React + TypeScript + Vite project with instant preview.

## Stack

- **Frontend**: React 19, TanStack Router (file-based routing), TailwindCSS v4
- **Backend**: TanStack Start server functions (SSR)
- **Preview**: StackBlitz WebContainers (`@stackblitz/sdk`) — replaced Sandpack
- **Database**: Supabase (auth + project persistence)
- **UI**: Radix UI primitives + shadcn/ui components

## How to run

```bash
npm install
npm run dev        # starts dev server on port 5000
```

The workflow `Start application` runs `npm run dev` automatically.

## Key routes

| Route          | Purpose                                           |
| -------------- | ------------------------------------------------- |
| `/`            | Landing page — prompt input + template gallery    |
| `/builder`     | Main builder: chat left, StackBlitz preview right |
| `/projects`    | Saved projects (requires auth)                    |
| `/gallery`     | Public project gallery                            |
| `/p/$id`       | Public project viewer                             |
| `/u/$username` | User profile                                      |

## Environment variables

| Variable                        | Required          | Notes                                                 |
| ------------------------------- | ----------------- | ----------------------------------------------------- |
| `LOVABLE_API_KEY`               | Yes (server-side) | Used for AI code generation when user has no BYOK key |
| `SUPABASE_URL`                  | Yes               | Supabase project URL (already in `.env`)              |
| `SUPABASE_PUBLISHABLE_KEY`      | Yes               | Supabase anon key (already in `.env`)                 |
| `VITE_SUPABASE_URL`             | Yes               | Same URL, exposed to client via Vite                  |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes               | Same key, exposed to client via Vite                  |

Users can also supply their own API keys (BYOK) for Gemini, OpenAI, Anthropic, Mistral, or xAI via the Settings panel — these are stored in `localStorage` only.

## Preview system

The builder uses **StackBlitz WebContainers** (`@stackblitz/sdk`) for live preview:

- Initial load: `sdk.embedProject()` boots a `react-ts` WebContainer
- File updates: `vm.applyFsDiff()` patches files without reloading the iframe
- Code tab: custom file-tree sidebar + `<pre>` code viewer (no external dependency)

## Vite config

`vite.config.ts` uses individual plugins directly (bypasses `@lovable.dev/vite-tanstack-config` which hardcodes IPv6 port 8080 incompatible with Replit). The plugins used are:

- `@tailwindcss/vite`
- `vite-tsconfig-paths`
- `@tanstack/react-start/plugin/vite` → `tanstackStart()`
- `@vitejs/plugin-react`

## User preferences

- Keep the StackBlitz WebContainers preview system (not Sandpack/CodeSandbox)
- Port 5000, host 0.0.0.0 — required for Replit preview pane
