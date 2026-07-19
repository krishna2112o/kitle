import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  getProfileByUsername,
  listPublicLinksByUser,
  incrementClick,
  getTheme,
  type LinkItem,
  type LinkProfile,
} from "@/lib/links";
import { LinkIcon } from "./links";

export const Route = createFileRoute("/u/$username")({
  loader: async ({ params }) => {
    const profile = await getProfileByUsername(params.username);
    if (!profile) throw notFound();
    const links = await listPublicLinksByUser(profile.user_id);
    return { profile, links };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData.profile;
    const title = `${p.display_name || p.username} — Links`;
    const desc = p.bio || `Links from @${p.username}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        ...(p.avatar_url ? [{ property: "og:image", content: p.avatar_url }] : []),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center text-foreground">
      <div>
        <h1 className="text-4xl font-bold">Profile not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This username doesn't exist yet.</p>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center text-foreground">
      <div>
        <h1 className="text-2xl font-bold">Couldn't load profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </div>
  ),
  component: PublicLinkPage,
});

function PublicLinkPage() {
  const initial = Route.useLoaderData() as { profile: LinkProfile; links: LinkItem[] };
  const [links] = useState<LinkItem[]>(initial.links);
  const profile = initial.profile;
  const t = getTheme(profile.theme);

  useEffect(() => {
    document.body.style.background = t.bg;
    return () => {
      document.body.style.background = "";
    };
  }, [t.bg]);

  const handleClick = (l: LinkItem) => {
    // Fire-and-forget; RLS allows update only for owners, will no-op for visitors.
    void incrementClick(l.id, l.clicks);
  };

  return (
    <div className="min-h-screen w-full" style={{ background: t.bg, color: t.text }}>
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center px-5 pb-16 pt-14">
        <div className="flex flex-col items-center text-center">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.display_name || profile.username}
              className="h-28 w-28 rounded-full object-cover shadow-lg ring-2 ring-white/30"
            />
          ) : (
            <div className="grid h-28 w-28 place-items-center rounded-full bg-white/10 text-4xl font-bold shadow-lg ring-2 ring-white/20">
              {(profile.display_name || profile.username).slice(0, 1).toUpperCase()}
            </div>
          )}
          <h1 className="mt-5 text-2xl font-bold tracking-tight">
            {profile.display_name || profile.username}
          </h1>
          <div className="text-sm opacity-70">@{profile.username}</div>
          {profile.bio && <p className="mt-3 max-w-[320px] text-sm opacity-90">{profile.bio}</p>}
        </div>

        <div className="mt-10 flex w-full flex-col gap-3">
          {links.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 py-10 text-center text-sm opacity-70">
              No links yet.
            </div>
          ) : (
            links.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleClick(l)}
                className="group flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm font-semibold shadow-sm backdrop-blur-sm transition hover:scale-[1.02] hover:shadow-lg"
                style={{ background: t.card, borderColor: "rgba(255,255,255,0.18)" }}
              >
                <LinkIcon name={l.icon} className="h-5 w-5 shrink-0" style={{ color: t.accent }} />
                <span className="flex-1 truncate">{l.title}</span>
                <ExternalLink className="h-4 w-4 shrink-0 opacity-40 transition group-hover:opacity-100" />
              </a>
            ))
          )}
        </div>

        <footer className="mt-auto pt-16 text-xs opacity-60">
          <a href="/links" className="hover:opacity-100">
            Make your own →
          </a>
        </footer>
      </div>
    </div>
  );
}
