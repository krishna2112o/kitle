import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Rocket, ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { bundleProject } from "@/lib/bundleProject";

interface Props {
  open: boolean;
  onClose: () => void;
  files: Record<string, string>;
}

const TOKEN_KEY = "vercel_token";

/**
 * Deploy the current Sandpack project to Vercel using the user's own
 * Vercel API token. The token is stored only in the user's browser
 * (localStorage) and is sent to Vercel via our server-side proxy.
 */
export function VercelDeployDialog({ open, onClose, files }: Props) {
  const [token, setToken] = useState("");
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setToken(localStorage.getItem(TOKEN_KEY) ?? "");
    setDeployUrl(null);
  }, [open]);

  const hasFiles = useMemo(() => Object.keys(files).length > 0, [files]);

  if (!open) return null;

  const handleDeploy = async () => {
    if (!token.trim()) {
      toast.error("Enter your Vercel API token");
      return;
    }
    if (!hasFiles) {
      toast.error("No files to deploy yet");
      return;
    }
    setBusy(true);
    try {
      localStorage.setItem(TOKEN_KEY, token.trim());
      toast.info("Building project…");
      const built = await bundleProject(files);
      const qs = new URLSearchParams();
      if (projectName.trim()) qs.set("name", projectName.trim());

      const res = await fetch(`/api/public/vercel/deploy?${qs.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vercel-token": token.trim(),
        },
        body: JSON.stringify({ files: built }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        url?: string;
        error?: string;
      };
      if (!data.ok) throw new Error(data.error || "Deploy failed");
      setDeployUrl(data.url ?? null);
      toast.success("Deployed to Vercel");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Deploy failed");
    } finally {
      setBusy(false);
    }
  };

  const dialog = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, #000, #333)" }}
            >
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Deploy to Vercel</h2>
              <p className="text-xs text-muted-foreground">
                Ship this project to your own Vercel account.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
                <KeyRound className="h-3 w-3" />
                Vercel API token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxx"
                autoComplete="off"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <a
                href="https://vercel.com/account/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Create a token <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Project name (optional)
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="my-awesome-app"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {deployUrl && (
              <a
                href={deployUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/20"
              >
                <span className="truncate">{deployUrl}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            )}

            <button
              onClick={handleDeploy}
              disabled={busy || !hasFiles}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Deploying…
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" /> Deploy
                </>
              )}
            </button>

            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Your token is stored only in this browser (localStorage). Vercel will
              auto-detect this as a Vite project and build it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}
