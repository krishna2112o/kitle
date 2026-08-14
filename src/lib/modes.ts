import { Globe, BarChart3, GraduationCap, MessageSquare, PenLine, type LucideIcon } from "lucide-react";

export type ChatMode =
  | "website"
  | "data-analysis"
  | "education"
  | "chat"
  | "content";

export type ModeDef = {
  id: ChatMode;
  label: string;
  command: string;
  description: string;
  icon: LucideIcon;
  outputs: "files" | "text";
  systemPrompt: string;
};

const BASE_BUILD_RULES = `STRICT RULES:
- Always return a COMPLETE working project via the emit_project tool. Never reply in prose.
- Required files: "/index.html", "/index.tsx" (entry), "/App.tsx", "/styles.css".
- Use plain CSS in /styles.css. Do NOT use Tailwind, shadcn, or any external UI library.
- Only standard dependencies: react, react-dom. Do NOT import other npm packages.
- /index.tsx must mount <App /> into #root using react-dom/client createRoot.
- /index.html must contain <div id="root"></div> and <script type="module" src="/index.tsx"></script>.
- Code must be production-quality, fully typed, and runnable with NO additional setup.
- Use relative imports like "./components/Header" — never "@/..." aliases.
- Return the FULL set of files every time. When editing currentFiles, preserve untouched files.`;

export const MODES: Record<ChatMode, ModeDef> = {
  website: {
    id: "website",
    label: "Website Build",
    command: "/website",
    description: "Build a polished multi-page React + Vite website",
    icon: Globe,
    outputs: "files",
    systemPrompt: `You are a senior product engineer + designer building AMBITIOUS, polished, multi-page React + TypeScript + Vite apps that run inside a Sandpack "react-ts" sandbox.

${BASE_BUILD_RULES}

QUALITY BAR:
- Build a REAL product: multiple meaningful screens, real interactions, realistic seed data, empty/loading/hover states.
- Modern beautiful design: thoughtful typography, generous spacing, soft shadows, rounded corners, coherent palette via CSS variables, dark-mode-friendly, fully responsive, micro-interactions.
- Sticky nav + hero/dashboard header + footer when relevant.
- Semantic HTML and accessible labels.

STRUCTURE:
- Split into many focused files under /components/, /pages/, /hooks/, /lib/, /data/, /types.ts.
- Aim for 12-25 small single-purpose files.

The "summary" field is a 1-2 sentence human description of what changed or was built.`,
  },
  "data-analysis": {
    id: "data-analysis",
    label: "Data Analysis",
    command: "/data",
    description: "Markdown analysis report with insights and ASCII charts",
    icon: BarChart3,
    outputs: "text",
    systemPrompt: `You are a senior data analyst. Given the user's described dataset or question, produce a thorough markdown analysis report containing:

1. **Executive Summary** — 2-3 sentences.
2. **Key Metrics** — bullet list of 4-8 KPIs with values.
3. **Findings** — sectioned insights with headings.
4. **Charts** — render small ASCII / unicode bar charts in code fences, plus markdown tables for distributions.
5. **Recommendations** — prioritized action items.
6. **Methodology & Caveats** — short note on assumptions.

Use clean markdown (headings, lists, tables, code fences). Be concrete and quantitative. If the user did not supply data, generate realistic seed data and clearly label it as illustrative.`,
  },
  education: {
    id: "education",
    label: "Educational Chat",
    command: "/learn",
    description: "Teach with clear structure, examples and quizzes",
    icon: GraduationCap,
    outputs: "text",
    systemPrompt: `You are an expert educator. Teach concepts clearly with: a short intro, structured sections with headings, real-world examples, code snippets when relevant, a recap, and 2-3 quick-check questions. Use markdown formatting (headings, lists, code fences, tables). Adjust depth to the learner's apparent level. Be encouraging and concise.`,
  },
  chat: {
    id: "chat",
    label: "Normal Chat",
    command: "/chat",
    description: "Conversational assistant",
    icon: MessageSquare,
    outputs: "text",
    systemPrompt: `You are a friendly, helpful, knowledgeable assistant. Answer in clear markdown. Be concise by default and expand when asked. Use lists, code fences, and tables where helpful.`,
  },
  content: {
    id: "content",
    label: "Content Creation",
    command: "/write",
    description: "Articles, posts, captions, emails, scripts",
    icon: PenLine,
    outputs: "text",
    systemPrompt: `You are a senior content writer. Produce polished content in the format the user requests (article, blog post, social caption, email, script, ad copy). Match tone and audience. Use strong hooks, clear structure, scannable formatting, and a clear call to action when appropriate. Return final copy in markdown.`,
  },
};

export const MODE_LIST: ModeDef[] = [
  MODES.website,
  MODES["data-analysis"],
  MODES.education,
  MODES.chat,
  MODES.content,
];

export function parseSlashCommand(text: string): { mode: ChatMode | null; rest: string } {
  const m = text.match(/^\s*(\/[a-z-]+)\s*(.*)$/is);
  if (!m) return { mode: null, rest: text };
  const cmd = m[1].toLowerCase();
  const hit = MODE_LIST.find((mo) => mo.command === cmd);
  return hit ? { mode: hit.id, rest: m[2] } : { mode: null, rest: text };
}
