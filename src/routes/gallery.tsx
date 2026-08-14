import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listPublicProjects } from "@/lib/projects";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Public Gallery — nuvic" },
      { name: "description", content: "Browse public AI-generated projects from the nuvic community." },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const [items, setItems] = useState<Array<{ id: string; name: string; updated_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listPublicProjects()
      .then((d) => setItems(d))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="dark min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
        <Link to="/" className="text-lg font-semibold">nuvic</Link>
        <div className="flex gap-3 text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground">Home</Link>
          <Link to="/builder" className="text-muted-foreground hover:text-foreground" search={{}}>Builder</Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <h1 className="text-3xl font-semibold sm:text-4xl">Public gallery</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Projects shared publicly by the community. Open any to view its live preview.
        </p>

        {loading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
        {err && <p className="mt-8 text-sm text-destructive">{err}</p>}
        {!loading && !err && items.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">No public projects yet — be the first!</p>
        )}

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Link
              key={p.id}
              to="/p/$id"
              params={{ id: p.id }}
              className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-xl"
            >
              <div className="mb-3 aspect-[4/3] rounded-lg bg-gradient-to-br from-primary/20 to-muted" />
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-[11px] text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</div>
              <span className="mt-3 text-xs text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                Open project →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
