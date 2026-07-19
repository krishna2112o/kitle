import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";
import {
  listMyProjects,
  deleteProject,
  updateProjectVisibility,
  type Visibility,
} from "@/lib/projects";

export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [{ title: "My projects — nuvic" }] }),
  component: ProjectsPage,
});

type Row = { id: string; name: string; visibility: Visibility; updated_at: string };

function ProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);

  const refresh = () => {
    setLoading(true);
    listMyProjects()
      .then((d) => setItems(d as Row[]))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAuthOpen(true);
      setLoading(false);
      return;
    }
    refresh();
  }, [user, authLoading]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    try {
      await deleteProject(id);
      setItems((prev) => prev.filter((p) => p.id !== id));
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const toggleVisibility = async (p: Row) => {
    const next: Visibility = p.visibility === "public" ? "private" : "public";
    try {
      await updateProjectVisibility(p.id, next);
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, visibility: next } : x)));
      if (next === "public") {
        const url = `${window.location.origin}/p/${p.id}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.success("Now public — link copied");
      } else {
        toast.success("Now private");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  return (
    <main className="dark min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-6">
        <Link to="/" className="text-lg font-semibold">
          nuvic
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/gallery" className="text-muted-foreground hover:text-foreground">
            Gallery
          </Link>
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            Home
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 pb-16">
        <h1 className="text-3xl font-semibold sm:text-4xl">My projects</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Saved in your account. Toggle public to share.
        </p>

        {!user && !authLoading && (
          <div className="mt-8 rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Sign in to view your saved projects.</p>
            <button
              onClick={() => setAuthOpen(true)}
              className="mt-4 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background"
            >
              Sign in
            </button>
          </div>
        )}

        {user && loading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
        {user && !loading && items.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            No projects yet — build something on the home page.
          </p>
        )}

        {user && items.length > 0 && (
          <ul className="mt-8 flex flex-col gap-2">
            {items.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <Link to="/builder" search={{ saved: p.id }} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(p.updated_at).toLocaleString()} ·{" "}
                    <span className={p.visibility === "public" ? "text-emerald-400" : ""}>
                      {p.visibility === "public" ? "🌐 Public" : "🔒 Private"}
                    </span>
                  </div>
                </Link>
                <button
                  onClick={() => toggleVisibility(p)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {p.visibility === "public" ? "Make private" : "Make public"}
                </button>
                <button
                  onClick={() => onDelete(p.id)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Delete"
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
                      d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
