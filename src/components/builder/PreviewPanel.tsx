import { useState } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
  SandpackFileExplorer,
} from "@codesandbox/sandpack-react";
import { Code2, Eye, Sparkles, Download, Github, ArrowLeft, Settings, Rocket, Triangle, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import JSZip from "jszip";
import { BentoLoader } from "./BentoLoader";
import { NetlifyDeployDialog } from "./NetlifyDeployDialog";
import { VercelDeployDialog } from "./VercelDeployDialog";
import { MODES, type ChatMode } from "@/lib/modes";

interface Props {
  files: Record<string, string>;
  isLoading?: boolean;
  /** Current chat mode — only "website" uses Sandpack; others render a "normal preview". */
  mode?: ChatMode;
  /** Latest assistant text — used for non-sandbox preview modes. */
  assistantText?: string;
  /** Mobile-only: show a back button that switches to chat view */
  onBack?: () => void;
  /** Optional GitHub URL — falls back to opening github.com */
  githubUrl?: string;
  /** Open the settings menu (handled by parent) */
  onSettings?: () => void;
}

type Tab = "preview" | "code";

async function downloadAsZip(files: Record<string, string>) {
  const zip = new JSZip();
  Object.entries(files).forEach(([path, content]) => {
    const clean = path.startsWith("/") ? path.slice(1) : path;
    zip.file(clean, content);
  });
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lovable-project-${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PreviewPanel({ files, isLoading = false, mode = "website", assistantText = "", onBack, githubUrl, onSettings }: Props) {
  const [tab, setTab] = useState<Tab>("preview");
  const [netlifyOpen, setNetlifyOpen] = useState(false);
  const [vercelOpen, setVercelOpen] = useState(false);

  const isSandbox = mode === "website";
  const modeDef = MODES[mode];
  const hasFiles = Object.keys(files).length > 0;
  const hasText = assistantText.trim().length > 0;
  const showLoader = isLoading && tab === "preview";

  const handleDownload = () => {
    if (!hasFiles) return;
    void downloadAsZip(files);
  };

  const handleGithub = () => {
    window.open(githubUrl ?? "https://github.com", "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: "var(--builder-surface-2)" }}
    >
      {/* Toolbar — redesigned to match reference: back, pill toggle, actions */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-2 py-2 sm:px-3">
        {/* Back (mobile only) */}
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back to chat"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/40 text-foreground/80 transition-colors hover:bg-background/70 md:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        {/* macOS-style traffic lights (desktop) */}
        <div className="hidden items-center gap-1.5 pl-1 pr-1 md:flex">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>

        {/* Centered pill toggle — Code tab only shown for the sandboxed website mode */}
        <div className="mx-auto inline-flex rounded-full border border-border/60 bg-background/40 p-0.5 md:mx-0">
          <button
            onClick={() => setTab("preview")}
            className={
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-medium transition-all " +
              (tab === "preview"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {tab === "preview" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            {isSandbox ? <Eye className="h-3 w-3 md:hidden" /> : <MessageSquare className="h-3 w-3 md:hidden" />}
            {isSandbox ? "Preview" : modeDef.label}
          </button>
          {isSandbox && (
            <button
              onClick={() => setTab("code")}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-medium transition-all " +
                (tab === "code"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <Code2 className="h-3 w-3 md:hidden" />
              Code
            </button>
          )}
        </div>

        {/* Right-side actions */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden rounded-md border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground lg:inline">
            {hasFiles ? `${Object.keys(files).length} files` : "Idle"}
          </span>
          <button
            onClick={handleGithub}
            aria-label="Open on GitHub"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/40 text-foreground/80 transition-colors hover:bg-background/70"
          >
            <Github className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDownload}
            disabled={!hasFiles}
            aria-label="Download project as ZIP"
            title="Download project as ZIP"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/40 text-foreground/80 transition-colors hover:bg-background/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setNetlifyOpen(true)}
            disabled={!hasFiles}
            aria-label="Deploy to Netlify"
            title="Deploy to Netlify"
            className="flex h-8 items-center justify-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2.5 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-background/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Rocket className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Netlify</span>
          </button>
          <button
            onClick={() => setVercelOpen(true)}
            disabled={!hasFiles}
            aria-label="Deploy to Vercel"
            title="Deploy to Vercel"
            className="flex h-8 items-center justify-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2.5 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-background/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Triangle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Vercel</span>
          </button>
          <button
            onClick={onSettings}
            aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/40 text-foreground/80 transition-colors hover:bg-background/70"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Surface */}
      <div className="relative flex-1 overflow-hidden p-2 sm:p-3">
        <div
          className="relative h-full w-full overflow-hidden rounded-xl border border-border/60"
          style={{ boxShadow: "var(--shadow-soft)", background: "var(--builder-surface)" }}
        >
          {showLoader ? (
            <div
              className="relative flex h-full w-full items-center justify-center"
              style={{ background: "var(--builder-surface)" }}
            >
              <BentoLoader label={isSandbox ? (hasFiles ? "Updating your app" : "Generating your app") : `Working on ${modeDef.label.toLowerCase()}…`} />
            </div>
          ) : !isSandbox ? (
            <div className="h-full w-full overflow-auto builder-scroll">
              {hasText ? (
                <div className="mx-auto max-w-3xl px-6 py-8 sm:px-10 sm:py-12">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/60 text-foreground/80">
                      <modeDef.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">{modeDef.label}</h2>
                      <p className="text-xs text-muted-foreground">{modeDef.description}</p>
                    </div>
                  </div>
                  <article className="prose prose-invert prose-sm max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none prose-pre:bg-background/60 prose-pre:border prose-pre:border-border/60 prose-a:text-primary prose-table:text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{assistantText}</ReactMarkdown>
                  </article>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-6 sm:p-10 text-center">
                  <div className="max-w-sm">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-background/60 text-foreground/80"><modeDef.icon className="h-6 w-6" /></div>
                    <h2 className="text-base font-semibold text-foreground">{modeDef.label}</h2>
                    <p className="mt-1.5 text-xs text-muted-foreground">{modeDef.description}</p>
                    <p className="mt-3 text-xs text-muted-foreground">Send a message on the left to start.</p>
                  </div>
                </div>
              )}
            </div>
          ) : !hasFiles ? (
            <div className="relative flex h-full items-center justify-center p-8">
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: "var(--gradient-glow)" }}
              />
              <div className="relative max-w-sm text-center">
                <div
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
                  style={{ background: "var(--gradient-builder)", boxShadow: "var(--shadow-glow)" }}
                >
                  <Sparkles className="h-6 w-6" strokeWidth={2} />
                </div>
                <h2 className="builder-gradient-text text-base font-semibold">
                  Your live preview will appear here
                </h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Send a prompt on the left to scaffold a React + Vite project in seconds.
                </p>
              </div>
            </div>
          ) : (
            <SandpackProvider
              key={Object.keys(files).sort().join("|")}
              template="react-ts"
              files={files}
              theme="dark"
              options={{
                recompileMode: "delayed",
                recompileDelay: 300,
              }}
              customSetup={{
                dependencies: {
                  react: "^18.2.0",
                  "react-dom": "^18.2.0",
                },
              }}
              style={{ height: "100%" }}
            >
              <SandpackLayout
                style={{
                  height: "100%",
                  width: "100%",
                  border: "none",
                  borderRadius: 0,
                  display: "flex",
                  background: "transparent",
                }}
              >
                {/* Preview pane — kept mounted */}
                <div
                  style={{
                    display: tab === "preview" ? "flex" : "none",
                    height: "100%",
                    width: "100%",
                    minWidth: 0,
                    overflow: "auto",
                  }}
                >
                  <SandpackPreview
                    style={{ height: "100%", flex: 1, minWidth: 0 }}
                    showOpenInCodeSandbox={false}
                    showRefreshButton
                  />
                </div>

                {/* Code pane — responsive: file explorer collapses on mobile, editor scrolls horizontally */}
                <div
                  style={{
                    display: tab === "code" ? "flex" : "none",
                    height: "100%",
                    width: "100%",
                    minWidth: 0,
                  }}
                  className="flex-col sm:!flex-row"
                >
                  <div className="hidden h-full sm:block" style={{ flexShrink: 0 }}>
                    <SandpackFileExplorer
                      style={{
                        height: "100%",
                        width: 220,
                        minWidth: 180,
                        borderRight: "1px solid var(--builder-elevated)",
                        overflowY: "auto",
                      }}
                      autoHiddenFiles
                    />
                  </div>
                  {/* Mobile-only condensed file explorer (top strip) */}
                  <div
                    className="block sm:hidden"
                    style={{
                      flexShrink: 0,
                      height: 140,
                      borderBottom: "1px solid var(--builder-elevated)",
                      overflow: "auto",
                    }}
                  >
                    <SandpackFileExplorer
                      style={{ height: "100%", width: "100%" }}
                      autoHiddenFiles
                    />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 0,
                      overflow: "auto",
                    }}
                    className="builder-scroll"
                  >
                    <SandpackCodeEditor
                      style={{ height: "100%", minWidth: 0 }}
                      showTabs
                      showLineNumbers
                      showInlineErrors
                      wrapContent={false}
                      closableTabs
                    />
                  </div>
                </div>
              </SandpackLayout>
            </SandpackProvider>
          )}
        </div>
      </div>

      <NetlifyDeployDialog
        open={netlifyOpen}
        onClose={() => setNetlifyOpen(false)}
        files={files}
      />
      <VercelDeployDialog
        open={vercelOpen}
        onClose={() => setVercelOpen(false)}
        files={files}
      />
    </div>
  );
}
