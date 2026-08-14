import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PreviewPanel } from "@/components/builder/PreviewPanel";
import { getProject, type SavedProject } from "@/lib/projects";

export const Route = createFileRoute("/p/$id")({
  head: () => ({
    meta: [
      { title: "Shared project — nuvic" },
      { name: "description", content: "View a public project shared on nuvic." },
    ],
  }),
  component: PublicProjectPage,
});

function PublicProjectPage() {
  const { id } = Route.useParams();
  const [project, setProject] = useState<SavedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getProject(id)
      .then((p) => {
        if (!p) {
          setErr("Project not found or not public.");
          return;
        }
        setProject(p);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex h-[100dvh] items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  }

  if (err || !project) {
    return (
      <div className="dark flex h-[100dvh] flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">{err ?? "Not available"}</p>
        <Link to="/gallery" className="rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">
          Back to gallery
        </Link>
      </div>
    );
  }

  return (
    <main className="dark flex h-[100dvh] w-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm font-semibold">nuvic</Link>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-sm">{project.name}</span>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Public</span>
        </div>
        <Link to="/gallery" className="text-xs text-muted-foreground hover:text-foreground">Gallery →</Link>
      </div>
      <div className="min-h-0 flex-1">
        <PreviewPanel files={project.files} />
      </div>
    </main>
  );
}
