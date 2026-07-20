import { useState, useEffect, useRef } from "react";
import {
  Code2,
  Eye,
  Sparkles,
  Download,
  Github,
  ArrowLeft,
  Settings,
  Rocket,
  Triangle,
  MessageSquare,
  FileCode,
  FolderOpen,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import JSZip from "jszip";
import { BentoLoader } from "./BentoLoader";
import { NetlifyDeployDialog } from "./NetlifyDeployDialog";
import { VercelDeployDialog } from "./VercelDeployDialog";
import { MODES, type ChatMode } from "@/lib/modes";
import { getWebContainer, ensureDirAndWriteFile, buildFileSystemTree } from "@/lib/webcontainer";

interface Props {
  files: Record<string, string>;
  isLoading?: boolean;
  /** Current chat mode — only "website" uses WebContainer preview; others render a "normal preview". */
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

/** Strip leading slash so paths are normalized */
function normalizeFiles(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    out[path.startsWith("/") ? path.slice(1) : path] = content;
  }
  return out;
}

/** Derive a simple file-extension language label for display. */
function langLabel(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    tsx: "tsx",
    ts: "ts",
    jsx: "jsx",
    js: "js",
    css: "css",
    html: "html",
    json: "json",
    md: "md",
  };
  return map[ext] ?? "text";
}

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
  a.download = `project-${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PreviewPanel({
  files,
  isLoading = false,
  mode = "website",
  assistantText = "",
  onBack,
  githubUrl,
  onSettings,
}: Props) {
  const [tab, setTab] = useState<Tab>("preview");
  const [netlifyOpen, setNetlifyOpen] = useState(false);
  const [vercelOpen, setVercelOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // WebContainer preview state
  const [wcState, setWcState] = useState<
    "idle" | "booting" | "mounting" | "installing" | "starting" | "ready" | "error"
  >("idle");
  const [wcError, setWcError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const isWcInitializedRef = useRef(false);
  const mountedFilesRef = useRef<Record<string, string>>({});

  const isSandbox = mode === "website";
  const modeDef = MODES[mode];
  const hasFiles = Object.keys(files).length > 0;
  const hasText = assistantText.trim().length > 0;

  const isWcLoading = isSandbox && hasFiles && wcState !== "ready" && wcState !== "error";
  const showLoader = (isLoading || isWcLoading) && tab === "preview";

  const normalizedFiles = normalizeFiles(files);
  const fileList = Object.keys(normalizedFiles).sort();

  // Auto-select first file when file list changes
  useEffect(() => {
    if (fileList.length > 0 && (!selectedFile || !fileList.includes(selectedFile))) {
      setSelectedFile(fileList[0]);
    }
  }, [fileList.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Boot or hot-update WebContainer when files change
  useEffect(() => {
    if (!isSandbox || !hasFiles) return;

    let active = true;

    async function initWebContainer() {
      if (isWcInitializedRef.current) {
        // Warm update: diff and patch via direct file system writes
        try {
          const wc = await getWebContainer();
          const lastFiles = mountedFilesRef.current;

          // Check if package.json has changed
          const prevPkg = lastFiles["package.json"];
          const nextPkg = normalizedFiles["package.json"];
          const packageJsonChanged =
            prevPkg !== undefined && nextPkg !== undefined && prevPkg !== nextPkg;

          // Write new/changed files
          for (const [path, content] of Object.entries(normalizedFiles)) {
            if (lastFiles[path] !== content) {
              await ensureDirAndWriteFile(wc, path, content);
            }
          }

          // Delete removed files
          for (const path of Object.keys(lastFiles)) {
            if (!(path in normalizedFiles)) {
              try {
                await wc.fs.rm(path);
              } catch (e) {
                // Ignore if already deleted
              }
            }
          }

          mountedFilesRef.current = { ...normalizedFiles };

          // Re-install if package.json changed
          if (packageJsonChanged && active) {
            setWcState("installing");
            const installProcess = await wc.spawn("npm", ["install"]);
            const exitCode = await installProcess.exit;
            if (exitCode === 0 && active) {
              setWcState("ready");
            }
          }
        } catch (err) {
          console.error("Incremental update failed", err);
        }
        return;
      }

      // First mount — boot, mount, npm install, and start dev server
      isWcInitializedRef.current = true;
      setWcState("booting");

      try {
        const wc = await getWebContainer();
        if (!active) return;

        setWcState("mounting");

        // Inject standard default configurations if missing
        const combined: Record<string, string> = { ...normalizedFiles };
        if (!combined["package.json"]) {
          combined["package.json"] = JSON.stringify(
            {
              name: "vite-react-app",
              private: true,
              version: "0.0.0",
              type: "module",
              scripts: {
                dev: "vite --host",
                build: "tsc && vite build",
                preview: "vite preview",
              },
              dependencies: {
                react: "^18.3.1",
                "react-dom": "^18.3.1",
                "lucide-react": "^0.395.0",
              },
              devDependencies: {
                "@types/react": "^18.3.3",
                "@types/react-dom": "^18.3.0",
                "@vitejs/plugin-react": "^4.3.1",
                typescript: "^5.2.2",
                vite: "^5.3.1",
              },
            },
            null,
            2,
          );
        }
        if (!combined["vite.config.ts"]) {
          combined["vite.config.ts"] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});`;
        }
        if (!combined["tsconfig.json"]) {
          combined["tsconfig.json"] = JSON.stringify(
            {
              compilerOptions: {
                target: "ES2020",
                useDefineForClassFields: true,
                lib: ["DOM", "DOM.Iterable", "ES2020"],
                module: "ESNext",
                skipLibCheck: true,
                moduleResolution: "bundler",
                allowImportingTsExtensions: true,
                resolveJsonModule: true,
                isolatedModules: true,
                noEmit: true,
                jsx: "react-jsx",
                strict: true,
                noUnusedLocals: false,
                noUnusedParameters: false,
                noFallthroughCasesInSwitch: true,
              },
              include: ["."],
            },
            null,
            2,
          );
        }

        const tree = buildFileSystemTree(combined);
        await wc.mount(tree);
        if (!active) return;

        setWcState("installing");
        const installProcess = await wc.spawn("npm", ["install"]);
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              console.log("[wc install]", data);
            },
          }),
        );
        const exitCode = await installProcess.exit;
        if (exitCode !== 0) {
          throw new Error(`npm install failed with exit code ${exitCode}`);
        }
        if (!active) return;

        setWcState("starting");
        const devProcess = await wc.spawn("npm", ["run", "dev"]);
        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              console.log("[wc dev]", data);
            },
          }),
        );

        wc.on("server-ready", (port, url) => {
          if (!active) return;
          setPreviewUrl(url);
          setWcState("ready");
        });

        mountedFilesRef.current = { ...normalizedFiles };
      } catch (err) {
        console.error("WebContainer setup failed:", err);
        if (active) {
          const errMsg = err instanceof Error ? err.message : String(err);
          setWcError(errMsg);
          setWcState("error");
        }
      }
    }

    void initWebContainer();

    return () => {
      active = false;
    };
  }, [files, isSandbox, hasFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = () => {
    if (!hasFiles) return;
    void downloadAsZip(files);
  };

  const handleGithub = () => {
    window.open(githubUrl ?? "https://github.com", "_blank", "noopener,noreferrer");
  };

  const getLoaderLabel = () => {
    if (!isSandbox) {
      return `Working on ${modeDef.label.toLowerCase()}…`;
    }
    if (wcState === "booting") return "Booting in-browser development server...";
    if (wcState === "mounting") return "Preparing project files...";
    if (wcState === "installing")
      return "Installing project dependencies (this may take a few seconds)...";
    if (wcState === "starting") return "Starting Vite development server...";
    return hasFiles ? "Updating your app..." : "Generating your app...";
  };

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--builder-surface-2)" }}>
      {/* Toolbar */}
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

        {/* Centered pill toggle */}
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
            {isSandbox ? (
              <Eye className="h-3 w-3 md:hidden" />
            ) : (
              <MessageSquare className="h-3 w-3 md:hidden" />
            )}
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
            /* Loading overlay */
            <div
              className="relative flex h-full w-full items-center justify-center"
              style={{ background: "var(--builder-surface)" }}
            >
              <BentoLoader label={getLoaderLabel()} />
            </div>
          ) : wcState === "error" ? (
            /* Error display */
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
                  <Triangle className="h-6 w-6" />
                </div>
                <h2 className="text-base font-semibold text-foreground">WebContainer Error</h2>
                <p className="mt-1.5 text-xs text-muted-foreground text-center">
                  Failed to start the preview environment. Your browser may not support
                  WebContainers, or third-party cookies / cross-origin isolation is restricted.
                </p>
                {wcError && (
                  <pre className="mt-3 max-h-32 overflow-auto rounded bg-background/50 p-2 text-left font-mono text-[10px] text-destructive-foreground">
                    {wcError}
                  </pre>
                )}
              </div>
            </div>
          ) : !isSandbox ? (
            /* Non-sandbox text modes */
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
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-background/60 text-foreground/80">
                      <modeDef.icon className="h-6 w-6" />
                    </div>
                    <h2 className="text-base font-semibold text-foreground">{modeDef.label}</h2>
                    <p className="mt-1.5 text-xs text-muted-foreground">{modeDef.description}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Send a message on the left to start.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : !hasFiles ? (
            /* Empty state — no files yet */
            <div className="relative flex h-full items-center justify-center p-8">
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: "var(--gradient-glow)" }}
              />
              <div className="relative max-w-sm text-center">
                <div
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
                  style={{
                    background: "var(--gradient-builder)",
                    boxShadow: "var(--shadow-glow)",
                  }}
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
            /* WebContainer preview + file-tree code viewer */
            <div className="flex h-full w-full flex-col">
              {/* WebContainer iframe — always in DOM so the WebContainer keeps running */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: tab === "preview" ? "flex" : "none",
                  flexDirection: "column",
                }}
              >
                {previewUrl ? (
                  <iframe
                    src={previewUrl}
                    className="h-full w-full border-0 bg-white"
                    allow="cross-origin-isolated; clipboard-read; clipboard-write;"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground bg-background">
                    Initializing preview URL...
                  </div>
                )}
              </div>

              {/* Code tab — custom file tree + viewer */}
              {tab === "code" && (
                <div className="flex h-full w-full min-h-0 overflow-hidden">
                  {/* File tree sidebar */}
                  <div
                    className="hidden sm:flex flex-col overflow-y-auto builder-scroll shrink-0"
                    style={{
                      width: 220,
                      borderRight: "1px solid var(--builder-elevated)",
                      background: "var(--builder-surface-2)",
                    }}
                  >
                    <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      <FolderOpen className="h-3 w-3" />
                      Files
                    </div>
                    {fileList.map((path) => (
                      <button
                        key={path}
                        onClick={() => setSelectedFile(path)}
                        className={
                          "flex w-full items-center gap-2 truncate px-3 py-1.5 text-left text-[11px] transition-colors " +
                          (selectedFile === path
                            ? "bg-primary/15 text-foreground"
                            : "text-muted-foreground hover:bg-background/40 hover:text-foreground")
                        }
                      >
                        <FileCode className="h-3 w-3 shrink-0 opacity-60" />
                        <span className="truncate">{path}</span>
                      </button>
                    ))}
                  </div>

                  {/* Mobile file picker — horizontal scroll strip */}
                  <div
                    className="flex sm:hidden shrink-0 overflow-x-auto builder-scroll gap-1 px-2 py-1.5"
                    style={{
                      borderBottom: "1px solid var(--builder-elevated)",
                      background: "var(--builder-surface-2)",
                    }}
                  >
                    {fileList.map((path) => (
                      <button
                        key={path}
                        onClick={() => setSelectedFile(path)}
                        className={
                          "shrink-0 rounded-md px-2.5 py-1 text-[10px] whitespace-nowrap transition-colors " +
                          (selectedFile === path
                            ? "bg-primary/20 text-foreground"
                            : "text-muted-foreground hover:text-foreground")
                        }
                      >
                        {path.split("/").pop()}
                      </button>
                    ))}
                  </div>

                  {/* Code content */}
                  <div className="flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden">
                    {selectedFile && normalizedFiles[selectedFile] !== undefined ? (
                      <>
                        {/* File header bar */}
                        <div
                          className="flex shrink-0 items-center gap-2 border-b border-border/40 px-4 py-1.5"
                          style={{ background: "var(--builder-surface)" }}
                        >
                          <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[11px] font-medium text-foreground">
                            {selectedFile}
                          </span>
                          <span className="ml-auto rounded bg-background/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                            {langLabel(selectedFile)}
                          </span>
                        </div>
                        {/* Code block */}
                        <div className="flex-1 min-h-0 overflow-auto builder-scroll">
                          <pre
                            className="min-h-full p-4 text-[11px] leading-relaxed text-foreground/90"
                            style={{
                              fontFamily:
                                '"Fira Code", "Cascadia Code", "JetBrains Mono", ui-monospace, monospace',
                              tabSize: 2,
                              background: "var(--builder-surface)",
                              margin: 0,
                              whiteSpace: "pre",
                            }}
                          >
                            {normalizedFiles[selectedFile]}
                          </pre>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                        Select a file to view its source
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <NetlifyDeployDialog open={netlifyOpen} onClose={() => setNetlifyOpen(false)} files={files} />
      <VercelDeployDialog open={vercelOpen} onClose={() => setVercelOpen(false)} files={files} />
    </div>
  );
}
