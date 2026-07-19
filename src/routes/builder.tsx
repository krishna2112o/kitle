import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChatPanel, type ChatMessage } from "@/components/builder/ChatPanel";
import { PreviewPanel } from "@/components/builder/PreviewPanel";
import { generateProject } from "@/lib/generate.functions";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";
import { saveProject as saveProjectCloud, getProject } from "@/lib/projects";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { parseSlashCommand, type ChatMode } from "@/lib/modes";

type BuilderSearch = { prompt?: string; saved?: string };
type MobileView = "chat" | "preview";

export const Route = createFileRoute("/builder")({
  validateSearch: (search: Record<string, unknown>): BuilderSearch => ({
    prompt: typeof search.prompt === "string" ? search.prompt : undefined,
    saved: typeof search.saved === "string" ? search.saved : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Builder — AI App Builder" },
      {
        name: "description",
        content: "Generate and iterate on a React + Vite app with live preview.",
      },
    ],
  }),
  component: BuilderPage,
});

function BuilderPage() {
  const { prompt, saved } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [draftMode, setDraftMode] = useState<ChatMode>("website");
  const [saveVisibility, setSaveVisibility] = useState<"private" | "public">("private");
  const [saving, setSaving] = useState(false);
  const initialFired = useRef(false);

  const handleSend = async (text: string, mode: ChatMode = "website") => {
    if (authLoading) return;
    if (!user) {
      toast.error("Please sign in to continue");
      setAuthOpen(true);
      return;
    }
    const userMsg: ChatMessage = { role: "user", content: text, mode };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsLoading(true);

    // BYOK: read provider + key + model from localStorage (managed via ChatPanel)
    let userApiKey: string | undefined;
    let userModel: string | undefined;
    let userProvider: import("@/lib/providers").ProviderId | undefined;
    try {
      const { loadByok } = await import("@/lib/providers");
      const s = loadByok();
      userProvider = s.provider;
      userApiKey = s.keys[s.provider] || undefined;
      userModel = s.models[s.provider] || undefined;
    } catch {}

    try {
      const result = await generateProject({
        data: {
          messages: nextMessages,
          currentFiles: files,
          mode,
          userApiKey,
          userModel,
          userProvider,
        },
      });
      if (result.outputs === "files") {
        setFiles(result.files);
        setMobileView("preview");
      }
      setMessages([
        ...nextMessages,
        { role: "assistant", content: result.summary, mode: result.mode, outputs: result.outputs },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(msg);
      setMessages([
        ...nextMessages,
        { role: "assistant", content: `⚠️ ${msg}`, mode, outputs: "text" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialFired.current) return;
    // Wait until the auth session has been restored from storage before deciding
    if (authLoading) return;
    if (saved) {
      initialFired.current = true;
      // Try cloud first
      getProject(saved)
        .then((p) => {
          if (p) {
            setMessages((p.messages as ChatMessage[]) || []);
            setFiles(p.files || {});
            setMobileView("preview");
            toast.success(`Loaded "${p.name}"`);
            return;
          }
          // Fallback to localStorage
          const raw = localStorage.getItem("nuvic.savedProjects");
          const list = raw ? JSON.parse(raw) : [];
          const found = list.find((x: { id: string }) => x.id === saved);
          if (found) {
            setMessages(found.messages || []);
            setFiles(found.files || {});
            setMobileView("preview");
            toast.success(`Loaded "${found.name}"`);
          } else {
            toast.error("Saved project not found");
          }
        })
        .catch(() => toast.error("Could not load project"));
      return;
    }
    if (prompt) {
      if (!user) {
        if (!authOpen) setAuthOpen(true);
        return;
      }
      initialFired.current = true;
      const { mode: parsedMode, rest } = parseSlashCommand(prompt);
      const finalMode: ChatMode = parsedMode ?? "website";
      const finalText = parsedMode ? rest.trim() || prompt : prompt;
      setDraftMode(finalMode);
      handleSend(finalText, finalMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, saved, user, authLoading]);

  const hasFiles = Object.keys(files).length > 0;

  // Determine current mode + latest assistant text for preview rendering.
  const currentMode: ChatMode = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.mode) return m.mode;
    }
    return draftMode;
  })();
  const lastAssistantText = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant") return m.content;
    }
    return "";
  })();

  const openSaveDialog = () => {
    if (!hasFiles) {
      toast.error("Nothing to save yet — generate something first.");
      return;
    }
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const defaultName =
      messages.find((m) => m.role === "user")?.content.slice(0, 60) ||
      `Project ${new Date().toLocaleString()}`;
    setSaveName(defaultName);
    setSaveOpen(true);
  };

  const doSave = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      const id = await saveProjectCloud({
        name: saveName.trim(),
        files,
        messages,
        visibility: saveVisibility,
      });
      if (saveVisibility === "public") {
        const url = `${window.location.origin}/p/${id}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.success("Saved as public — link copied");
      } else {
        toast.success("Project saved (private)");
      }
      setSaveOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="dark relative flex h-[100dvh] w-screen flex-col overflow-hidden bg-background text-foreground md:flex-row">
      {/* Mobile layout: simple show/hide */}
      <div
        className={"min-h-0 w-full md:hidden " + (mobileView === "chat" ? "flex flex-1" : "hidden")}
      >
        <div className="h-full w-full">
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSend={handleSend}
            onModeChange={setDraftMode}
          />
        </div>
      </div>
      <div
        className={
          "min-h-0 w-full md:hidden " + (mobileView === "preview" ? "flex flex-1" : "hidden")
        }
      >
        <div className="h-full w-full">
          <PreviewPanel
            files={files}
            isLoading={isLoading}
            mode={currentMode}
            assistantText={lastAssistantText}
            onBack={() => setMobileView("chat")}
            onSettings={() => setSettingsOpen((v) => !v)}
          />
        </div>
      </div>

      {/* Desktop layout: resizable split */}
      <div className="hidden h-full w-full min-h-0 md:flex md:flex-1">
        <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize="38%" minSize="22%" maxSize="60%" className="min-h-0">
            <div className="h-full w-full">
              <ChatPanel
                messages={messages}
                isLoading={isLoading}
                onSend={handleSend}
                onModeChange={setDraftMode}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="w-1.5 cursor-col-resize bg-border/40 transition-colors hover:bg-foreground/30 data-[resize-handle-state=drag]:bg-foreground/50"
          />
          <ResizablePanel defaultSize="62%" minSize="40%" className="min-h-0">
            <div className="h-full w-full">
              <PreviewPanel
                files={files}
                isLoading={isLoading}
                mode={currentMode}
                assistantText={lastAssistantText}
                onBack={() => setMobileView("chat")}
                onSettings={() => setSettingsOpen((v) => !v)}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Settings: floating trigger only visible on mobile-chat view (preview view uses inline button in PreviewPanel toolbar) */}
      <div className="fixed right-3 top-3 z-50">
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className={
            "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/70 text-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-background " +
            (mobileView === "chat" ? "flex md:hidden" : "hidden")
          }
          aria-label="Settings"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {settingsOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
            <div className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-xl border border-border/60 bg-background/95 p-1 shadow-2xl backdrop-blur-md">
              {user ? (
                <div className="border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                  Signed in as <span className="text-foreground">{user.email}</span>
                </div>
              ) : null}
              <button
                onClick={() => {
                  setSettingsOpen(false);
                  openSaveDialog();
                }}
                disabled={!hasFiles}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Save project…
              </button>
              <button
                onClick={async () => {
                  setSettingsOpen(false);
                  if (!hasFiles) {
                    toast.error("Nothing to download yet.");
                    return;
                  }
                  try {
                    const JSZip = (await import("jszip")).default;
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
                  } catch {
                    toast.error("Could not create ZIP");
                  }
                }}
                disabled={!hasFiles}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Download as ZIP
              </button>
              <Link
                to="/projects"
                onClick={() => setSettingsOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                    strokeLinejoin="round"
                  />
                </svg>
                My projects
              </Link>
              <Link
                to="/gallery"
                onClick={() => setSettingsOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
                </svg>
                Public gallery
              </Link>
              {user ? (
                <button
                  onClick={async () => {
                    setSettingsOpen(false);
                    await supabase.auth.signOut();
                    toast.success("Signed out");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      d="M16 17l5-5-5-5M21 12H9M13 21H5a2 2 0 01-2-2V5a2 2 0 012-2h8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Sign out
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    setAuthOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Sign in
                </button>
              )}
              <Link
                to="/"
                onClick={() => setSettingsOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    d="M3 12l9-9 9 9M5 10v10h14V10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Back to home
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Save dialog */}
      {saveOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 p-4 backdrop-blur"
          onClick={() => !saving && setSaveOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <h2 className="text-lg font-semibold">Save project</h2>
            <p className="mt-1 text-xs text-muted-foreground">Stored in your account.</p>

            <label className="mt-4 mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
              Name
            </label>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
            />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setSaveVisibility("private")}
                className={
                  "rounded-lg border p-3 text-left text-xs transition-all " +
                  (saveVisibility === "private"
                    ? "border-foreground bg-foreground/5"
                    : "border-border hover:border-foreground/40")
                }
              >
                <div className="font-semibold text-foreground">🔒 Private</div>
                <div className="mt-1 text-muted-foreground">Only you can see it</div>
              </button>
              <button
                onClick={() => setSaveVisibility("public")}
                className={
                  "rounded-lg border p-3 text-left text-xs transition-all " +
                  (saveVisibility === "public"
                    ? "border-foreground bg-foreground/5"
                    : "border-border hover:border-foreground/40")
                }
              >
                <div className="font-semibold text-foreground">🌐 Public</div>
                <div className="mt-1 text-muted-foreground">Shareable link + gallery</div>
              </button>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setSaveOpen(false)}
                disabled={saving}
                className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={doSave}
                disabled={saving || !saveName.trim()}
                className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Floating mobile bottom pill — Chat / Preview */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center md:hidden">
        <div
          className="pointer-events-auto inline-flex items-center rounded-full border border-border/60 p-1 shadow-2xl backdrop-blur-md"
          style={{ background: "color-mix(in oklab, var(--builder-surface) 85%, transparent)" }}
        >
          <button
            onClick={() => setMobileView("chat")}
            className={
              "inline-flex items-center gap-1.5 rounded-full px-5 py-1.5 text-[12px] font-medium transition-all " +
              (mobileView === "chat"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground")
            }
          >
            Chat
          </button>
          <button
            onClick={() => setMobileView("preview")}
            disabled={!hasFiles && !isLoading}
            className={
              "inline-flex items-center gap-1.5 rounded-full px-5 py-1.5 text-[12px] font-medium transition-all disabled:opacity-40 " +
              (mobileView === "preview"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground")
            }
          >
            {mobileView === "preview" && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            )}
            Preview
          </button>
        </div>
      </div>
    </main>
  );
}
