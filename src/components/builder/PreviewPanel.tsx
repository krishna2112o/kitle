import { useState, useEffect, useRef } from "react";
import type { WebContainer, FileSystemTree } from "@webcontainer/api";
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

/** Strip leading slash so paths are clean like "src/App.tsx" not "/src/App.tsx" */
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

// Convert a flat Record<string, string> of files into a nested FileSystemTree
function buildFileSystemTree(files: Record<string, string>): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const [path, content] of Object.entries(files)) {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    const parts = cleanPath.split("/");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current[part] = {
          file: {
            contents: content,
          },
        };
      } else {
        if (!current[part]) {
          current[part] = {
            directory: {},
          };
        }
        current = current[part].directory;
      }
    }
  }

  return tree;
}

const DEFAULT_PACKAGE_JSON = JSON.stringify(
  {
    name: "vite-react-typescript",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
    },
    dependencies: {
      react: "^19.2.0",
      "react-dom": "^19.2.0",
    },
    devDependencies: {
      "@types/react": "^19.2.0",
      "@types/react-dom": "^19.2.0",
      "@vitejs/plugin-react": "^5.0.4",
      typescript: "^5.8.3",
      vite: "^7.3.1",
    },
  },
  null,
  2,
);

const DEFAULT_VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});`;

let webcontainerInstancePromise: Promise<WebContainer> | null = null;

async function getWebContainer(): Promise<WebContainer | null> {
  if (typeof window === "undefined") return null;
  if (!webcontainerInstancePromise) {
    const { WebContainer } = await import("@webcontainer/api");
    webcontainerInstancePromise = WebContainer.boot();
  }
  return webcontainerInstancePromise;
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

  // WebContainer States
  const [wcStatus, setWcStatus] = useState<
    "idle" | "booting" | "installing" | "starting" | "ready" | "error"
  >("idle");
  const [statusText, setStatusText] = useState("");
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const webcontainerInstanceRef = useRef<WebContainer | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devProcessRef = useRef<any>(null);
  const mountedFilesRef = useRef<Record<string, string>>({});
  const lastInstalledPackageJsonRef = useRef<string>("");

  const isSandbox = mode === "website";
  const modeDef = MODES[mode];
  const hasFiles = Object.keys(files).length > 0;
  const hasText = assistantText.trim().length > 0;

  const normalizedFiles = normalizeFiles(files);
  const fileList = Object.keys(normalizedFiles).sort();

  // Show bento loader when loading from assistant or when WebContainer is booting/preparing
  const showLoader =
    (isLoading || (isSandbox && hasFiles && wcStatus !== "ready")) && tab === "preview";

  // Auto-select first file when file list changes
  useEffect(() => {
    if (fileList.length > 0 && (!selectedFile || !fileList.includes(selectedFile))) {
      setSelectedFile(fileList[0]);
    }
  }, [fileList.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manage WebContainer Lifecycle
  useEffect(() => {
    if (!isSandbox || !hasFiles) return;

    let active = true;

    async function initWebContainer() {
      try {
        // Ensure default package.json & vite.config.ts are added if missing
        const finalFiles = { ...normalizedFiles };
        if (!finalFiles["package.json"]) {
          finalFiles["package.json"] = DEFAULT_PACKAGE_JSON;
        }
        if (!finalFiles["vite.config.ts"] && !finalFiles["vite.config.js"]) {
          finalFiles["vite.config.ts"] = DEFAULT_VITE_CONFIG;
        }

        const webcontainer = await getWebContainer();
        if (!webcontainer || !active) return;

        // If WebContainer is already running the dev server, only push/hot-reload file changes (HMR)
        if (webcontainerInstanceRef.current === webcontainer) {
          const create: Record<string, string> = {};
          const destroy: string[] = [];

          for (const [path, content] of Object.entries(finalFiles)) {
            if (mountedFilesRef.current[path] !== content) {
              create[path] = content;
            }
          }
          for (const path of Object.keys(mountedFilesRef.current)) {
            if (!(path in finalFiles)) {
              destroy.push(path);
            }
          }

          if (Object.keys(create).length > 0 || destroy.length > 0) {
            for (const [path, content] of Object.entries(create)) {
              const cleanPath = path.startsWith("/") ? path.slice(1) : path;
              const lastSlash = cleanPath.lastIndexOf("/");
              if (lastSlash !== -1) {
                const dir = cleanPath.slice(0, lastSlash);
                await webcontainer.fs.mkdir(dir, { recursive: true }).catch((err) => {
                  console.warn(err);
                });
              }
              await webcontainer.fs.writeFile(cleanPath, content);
            }
            for (const path of destroy) {
              const cleanPath = path.startsWith("/") ? path.slice(1) : path;
              await webcontainer.fs.rm(cleanPath, { recursive: true }).catch((err) => {
                console.warn(err);
              });
            }
            mountedFilesRef.current = { ...finalFiles };
          }
          return;
        }

        // Fresh Boot/Start Setup
        webcontainerInstanceRef.current = webcontainer;
        setWcStatus("booting");
        setStatusText("Preparing WebContainer sandbox...");

        // 1. Clean workspace (keep node_modules if present to act as dependency cache)
        setStatusText("Cleaning workspace...");
        try {
          const existing = await webcontainer.fs.readdir(".");
          for (const file of existing) {
            if (file !== "node_modules") {
              await webcontainer.fs.rm(file, { recursive: true }).catch((err) => {
                console.warn(err);
              });
            }
          }
        } catch (err) {
          console.error("Error clearing workspace:", err);
        }

        if (!active) return;

        // 2. Mount workspace files
        setStatusText("Mounting project files...");
        const tree = buildFileSystemTree(finalFiles);
        await webcontainer.mount(tree);
        mountedFilesRef.current = { ...finalFiles };

        if (!active) return;

        // 3. Conditional npm install (check if package.json changed or if node_modules cache is missing)
        const packageJsonChanged =
          finalFiles["package.json"] !== lastInstalledPackageJsonRef.current;
        let nodeModulesExists = false;
        try {
          const rootFiles = await webcontainer.fs.readdir(".");
          nodeModulesExists = rootFiles.includes("node_modules");
        } catch (err) {
          console.warn(err);
        }

        if (packageJsonChanged || !nodeModulesExists) {
          setWcStatus("installing");
          setStatusText("Installing standard packages...");
          const installProcess = await webcontainer.spawn("npm", ["install"]);
          installProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                console.log("[WebContainer Install]", data);
              },
            }),
          );
          const installCode = await installProcess.exit;
          if (installCode !== 0) {
            if (active) {
              setWcStatus("error");
              setStatusText("Failed to install project packages.");
            }
            return;
          }
          lastInstalledPackageJsonRef.current = finalFiles["package.json"];
        }

        if (!active) return;

        // 4. Run Vite development server
        setWcStatus("starting");
        setStatusText("Starting local development server...");
        if (devProcessRef.current) {
          try {
            devProcessRef.current.kill();
          } catch (err) {
            console.warn(err);
          }
        }

        const devProcess = await webcontainer.spawn("npm", ["run", "dev"]);
        devProcessRef.current = devProcess;
        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              console.log("[WebContainer Dev]", data);
            },
          }),
        );

        // Listen for server-ready
        webcontainer.on("server-ready", (port, url) => {
          if (active) {
            setIframeUrl(url);
            setWcStatus("ready");
            setStatusText("Ready");
          }
        });
      } catch (err) {
        console.error("Error setting up WebContainer:", err);
        if (active) {
          setWcStatus("error");
          setStatusText("WebContainer initialization failed.");
        }
      }
    }

    void initWebContainer();

    return () => {
      active = false;
      // Note: we preserve the singleton instance in the module, but we reset instance refs for clean remount
      webcontainerInstanceRef.current = null;
    };
  }, [files, isSandbox, hasFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup active dev process when leaving sandbox mode or unmounting
  useEffect(() => {
    return () => {
      if (devProcessRef.current) {
        try {
          devProcessRef.current.kill();
        } catch (err) {
          console.warn(err);
        }
        devProcessRef.current = null;
      }
    };
  }, []);

  const handleDownload = () => {
    if (!hasFiles) return;
    void downloadAsZip(files);
  };

  const handleGithub = () => {
    window.open(githubUrl ?? "https://github.com", "_blank", "noopener,noreferrer");
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
              <BentoLoader
                label={
                  !isSandbox
                    ? `Working on ${modeDef.label.toLowerCase()}…`
                    : wcStatus !== "ready" && statusText
                      ? statusText
                      : isLoading
                        ? hasFiles
                          ? "Updating your app"
                          : "Generating your app"
                        : "Preparing your preview..."
                }
              />
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
            /* StackBlitz WebContainer direct preview + file-tree code viewer */
            <div className="flex h-full w-full flex-col">
              {/* Custom WebContainer iframe */}
              {tab === "preview" && iframeUrl && wcStatus === "ready" && (
                <iframe
                  title="WebContainer Live Preview"
                  src={iframeUrl}
                  className="h-full w-full border-0 bg-white"
                  allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb; vr; xr-spatial-tracking; clipboard-write; cross-origin-isolated"
                />
              )}

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
