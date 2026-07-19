import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Globe,
  Instagram,
  Twitter,
  Youtube,
  Github,
  Linkedin,
  Music2,
  Facebook,
  Twitch,
  Mail,
  Phone,
  ShoppingBag,
  Video,
  BookOpen,
  Star,
  Link2,
  Copy,
  User,
  Palette,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";
import {
  THEMES,
  ICONS,
  getMyProfile,
  upsertMyProfile,
  listMyLinks,
  createLink,
  updateLink,
  deleteLink,
  type LinkItem,
  type LinkProfile,
} from "@/lib/links";

export const Route = createFileRoute("/links")({
  head: () => ({
    meta: [
      { title: "Link in bio — Manage your links" },
      {
        name: "description",
        content:
          "Create a beautiful link-in-bio page. Manage your profile, add links, pick a theme.",
      },
      { property: "og:title", content: "Link in bio — Manage your links" },
      { property: "og:description", content: "A Linktree-style link-in-bio page you fully own." },
    ],
  }),
  component: LinksPage,
});

const ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  link: Link2,
  globe: Globe,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
  tiktok: Music2,
  github: Github,
  linkedin: Linkedin,
  spotify: Music2,
  facebook: Facebook,
  twitch: Twitch,
  mail: Mail,
  phone: Phone,
  shop: ShoppingBag,
  music: Music2,
  video: Video,
  book: BookOpen,
  star: Star,
};
export function LinkIcon({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const C = ICON_MAP[name] ?? Link2;
  return <C className={className} style={style} />;
}

function LinksPage() {
  const { user, loading: authLoading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<LinkProfile | null>(null);
  const [links, setLinks] = useState<LinkItem[]>([]);

  // Form state for profile
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [theme, setTheme] = useState("midnight");
  const [savingProfile, setSavingProfile] = useState(false);

  // Form state for new link
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newIcon, setNewIcon] = useState("link");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAuthOpen(true);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [p, l] = await Promise.all([getMyProfile(), listMyLinks()]);
        if (p) {
          setProfile(p);
          setUsername(p.username);
          setDisplayName(p.display_name);
          setBio(p.bio);
          setAvatarUrl(p.avatar_url);
          setTheme(p.theme);
        }
        setLinks(l);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading]);

  const saveProfile = async () => {
    if (!/^[a-z0-9_-]{2,32}$/i.test(username)) {
      toast.error("Username must be 2–32 chars: letters, numbers, - or _");
      return;
    }
    setSavingProfile(true);
    try {
      const p = await upsertMyProfile({
        username,
        display_name: displayName,
        bio,
        avatar_url: avatarUrl,
        theme,
      });
      setProfile(p);
      toast.success("Profile saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg.includes("unique") ? "That username is already taken." : msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const addLink = async () => {
    if (!profile) {
      toast.error("Save your profile first.");
      return;
    }
    if (!newTitle.trim() || !newUrl.trim()) {
      toast.error("Title and URL are required.");
      return;
    }
    const url = /^https?:\/\//i.test(newUrl.trim()) ? newUrl.trim() : `https://${newUrl.trim()}`;
    setAdding(true);
    try {
      const item = await createLink({
        title: newTitle.trim(),
        url,
        icon: newIcon,
        position: links.length,
      });
      setLinks((prev) => [...prev, item]);
      setNewTitle("");
      setNewUrl("");
      setNewIcon("link");
      toast.success("Link added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (l: LinkItem) => {
    const active = !l.active;
    setLinks((prev) => prev.map((x) => (x.id === l.id ? { ...x, active } : x)));
    try {
      await updateLink(l.id, { active });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setLinks((prev) => prev.map((x) => (x.id === l.id ? { ...x, active: !active } : x)));
    }
  };

  const removeLink = async (id: string) => {
    if (!confirm("Delete this link?")) return;
    const prev = links;
    setLinks((p) => p.filter((x) => x.id !== id));
    try {
      await deleteLink(id);
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setLinks(prev);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= links.length) return;
    const next = [...links];
    [next[index], next[j]] = [next[j], next[index]];
    const reindexed = next.map((l, i) => ({ ...l, position: i }));
    setLinks(reindexed);
    try {
      await Promise.all(reindexed.map((l) => updateLink(l.id, { position: l.position })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reorder");
    }
  };

  const editField = async (l: LinkItem, patch: Partial<LinkItem>) => {
    setLinks((prev) => prev.map((x) => (x.id === l.id ? { ...x, ...patch } : x)));
    try {
      await updateLink(l.id, patch as never);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const publicUrl = profile
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/u/${profile.username}`
    : "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <div className="text-xs text-muted-foreground">Link in bio</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Your link page</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            Build a beautiful link-in-bio page. Edit your profile, add links, pick a theme — share
            one URL everywhere.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-96 animate-pulse rounded-2xl border border-border/40 bg-card/40" />
            <div className="h-96 animate-pulse rounded-2xl border border-border/40 bg-card/40" />
          </div>
        ) : !user ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center">
            <p className="text-sm text-muted-foreground">Sign in to manage your link page.</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* LEFT: manager */}
            <div className="space-y-6">
              {/* Profile card */}
              <section className="rounded-2xl border border-border/60 bg-card/40 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold">Profile</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Username">
                    <div className="flex items-center overflow-hidden rounded-lg border border-border/60 bg-background/60 focus-within:border-primary/60">
                      <span className="border-r border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                        /u/
                      </span>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        placeholder="yourname"
                        className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                      />
                    </div>
                  </Field>
                  <Field label="Display name">
                    <TextInput
                      value={displayName}
                      onChange={setDisplayName}
                      placeholder="Your name"
                    />
                  </Field>
                  <Field label="Avatar URL" full>
                    <TextInput
                      value={avatarUrl}
                      onChange={setAvatarUrl}
                      placeholder="https://…/photo.jpg"
                    />
                  </Field>
                  <Field label="Bio" full>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      maxLength={200}
                      placeholder="Short description shown on your page"
                      className="w-full resize-none rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
                    />
                  </Field>
                  <Field label="Theme" full>
                    <div className="flex flex-wrap gap-2">
                      {THEMES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTheme(t.id)}
                          className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            theme === t.id
                              ? "border-primary bg-primary/10"
                              : "border-border/60 hover:border-primary/60"
                          }`}
                        >
                          <span
                            className="h-4 w-4 rounded-full border border-border/60"
                            style={{ background: t.bg }}
                          />
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  {profile && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Palette className="h-3.5 w-3.5" /> Live at
                      <code className="rounded bg-background/60 px-2 py-1 text-foreground">
                        /u/{profile.username}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(publicUrl);
                          toast.success("Link copied");
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 hover:border-primary/60"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                      <Link
                        to="/u/$username"
                        params={{ username: profile.username }}
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 hover:border-primary/60"
                      >
                        <ExternalLink className="h-3 w-3" /> Open
                      </Link>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 transition hover:bg-primary/90 disabled:opacity-60"
                  >
                    {savingProfile ? "Saving…" : profile ? "Save changes" : "Create profile"}
                  </button>
                </div>
              </section>

              {/* Add link */}
              <section className="rounded-2xl border border-border/60 bg-card/40 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold">Add a link</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <TextInput
                    value={newTitle}
                    onChange={setNewTitle}
                    placeholder="Title (e.g. My YouTube)"
                  />
                  <TextInput value={newUrl} onChange={setNewUrl} placeholder="https://…" />
                  <IconPicker value={newIcon} onChange={setNewIcon} />
                </div>
                <button
                  type="button"
                  onClick={addLink}
                  disabled={adding || !profile}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary/90 px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" /> {adding ? "Adding…" : "Add link"}
                </button>
                {!profile && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Save your profile above first.
                  </p>
                )}
              </section>

              {/* Links list */}
              <section className="rounded-2xl border border-border/60 bg-card/40 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Your links ({links.length})</h2>
                </div>
                {links.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
                    No links yet — add your first one above.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {links.map((l, i) => (
                      <li
                        key={l.id}
                        className={`rounded-xl border p-3 transition ${l.active ? "border-border/60 bg-background/40" : "border-border/40 bg-background/20 opacity-60"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => move(i, -1)}
                              disabled={i === 0}
                              className="rounded p-1 hover:bg-muted/50 disabled:opacity-30"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => move(i, 1)}
                              disabled={i === links.length - 1}
                              className="rounded p-1 hover:bg-muted/50 disabled:opacity-30"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <LinkIcon name={l.icon} className="h-4 w-4" />
                          </div>
                          <div className="grid flex-1 gap-1.5">
                            <TextInput
                              value={l.title}
                              onChange={(v) => editField(l, { title: v })}
                              placeholder="Title"
                            />
                            <TextInput
                              value={l.url}
                              onChange={(v) => editField(l, { url: v })}
                              placeholder="URL"
                            />
                          </div>
                          <IconPicker value={l.icon} onChange={(v) => editField(l, { icon: v })} />
                          <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                            <span>{l.clicks}</span>
                            <span className="text-[10px] uppercase tracking-wider">clicks</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleActive(l)}
                              title={l.active ? "Hide" : "Show"}
                              className="rounded-lg border border-border/60 p-2 transition hover:border-primary/60"
                            >
                              {l.active ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeLink(l.id)}
                              title="Delete"
                              className="rounded-lg border border-border/60 p-2 text-red-400 transition hover:border-red-400/60 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* RIGHT: preview */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
                <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
                  Live preview
                </div>
                <PhonePreview
                  profile={{
                    username: username || "you",
                    display_name: displayName || "Your name",
                    bio: bio || "Short bio here",
                    avatar_url: avatarUrl,
                    theme,
                  }}
                  links={links.filter((l) => l.active)}
                />
              </div>
            </aside>
          </div>
        )}
      </main>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
    />
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border/60 bg-background/60 px-2 py-2 text-sm outline-none focus:border-primary/60"
    >
      {ICONS.map((i) => (
        <option key={i} value={i}>
          {i}
        </option>
      ))}
    </select>
  );
}

function PhonePreview({
  profile,
  links,
}: {
  profile: {
    username: string;
    display_name: string;
    bio: string;
    avatar_url: string;
    theme: string;
  };
  links: LinkItem[];
}) {
  const t = THEMES.find((x) => x.id === profile.theme) ?? THEMES[0];
  return (
    <div
      className="mx-auto h-[540px] w-full max-w-[300px] overflow-hidden rounded-[36px] border-8 border-neutral-900 shadow-2xl"
      style={{ background: t.bg, color: t.text }}
    >
      <div className="h-full overflow-y-auto px-4 py-6">
        <div className="flex flex-col items-center text-center">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-20 w-20 rounded-full object-cover ring-2 ring-white/30"
            />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-full bg-white/10 text-2xl font-bold ring-2 ring-white/20">
              {(profile.display_name || profile.username).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="mt-3 text-lg font-bold">{profile.display_name || profile.username}</div>
          <div className="text-xs opacity-70">@{profile.username}</div>
          {profile.bio && <p className="mt-2 max-w-[220px] text-xs opacity-80">{profile.bio}</p>}
        </div>
        <div className="mt-6 space-y-2.5">
          {links.length === 0 ? (
            <div className="rounded-xl border border-white/10 py-8 text-center text-xs opacity-60">
              No links yet
            </div>
          ) : (
            links.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium backdrop-blur-sm transition"
                style={{ background: t.card, borderColor: "rgba(255,255,255,0.15)" }}
              >
                <LinkIcon name={l.icon} className="h-4 w-4 shrink-0" style={{ color: t.accent }} />
                <span className="truncate">{l.title || "Untitled"}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
