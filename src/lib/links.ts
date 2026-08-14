import { supabase } from "@/integrations/supabase/client";

export type LinkProfile = {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  theme: string;
  created_at: string;
  updated_at: string;
};

export type LinkItem = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  icon: string;
  position: number;
  active: boolean;
  clicks: number;
  created_at: string;
  updated_at: string;
};

export const THEMES = [
  { id: "midnight", label: "Midnight", bg: "linear-gradient(180deg,#0b0b16,#1a1030)", card: "rgba(255,255,255,0.06)", text: "#f4f4f5", accent: "#a78bfa" },
  { id: "sunset", label: "Sunset", bg: "linear-gradient(180deg,#1a0b1f,#3a0e1f 40%,#f97316)", card: "rgba(255,255,255,0.08)", text: "#fff7ed", accent: "#fb923c" },
  { id: "ocean", label: "Ocean", bg: "linear-gradient(180deg,#031627,#0c4a6e,#38bdf8)", card: "rgba(255,255,255,0.08)", text: "#e0f2fe", accent: "#38bdf8" },
  { id: "forest", label: "Forest", bg: "linear-gradient(180deg,#02150e,#064e3b,#10b981)", card: "rgba(255,255,255,0.08)", text: "#ecfdf5", accent: "#34d399" },
  { id: "peach", label: "Peach", bg: "linear-gradient(180deg,#fff7ed,#fed7aa,#fca5a5)", card: "rgba(255,255,255,0.7)", text: "#1c0a06", accent: "#ea580c" },
  { id: "mono", label: "Mono", bg: "#0a0a0a", card: "rgba(255,255,255,0.05)", text: "#fafafa", accent: "#fafafa" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export function getTheme(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export const ICONS = [
  "link", "globe", "instagram", "twitter", "youtube", "tiktok",
  "github", "linkedin", "spotify", "facebook", "twitch", "mail",
  "phone", "shop", "music", "video", "book", "star",
] as const;

export async function getMyProfile(): Promise<LinkProfile | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from("link_profiles")
    .select("*")
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return data as LinkProfile | null;
}

export async function getProfileByUsername(username: string): Promise<LinkProfile | null> {
  const { data, error } = await supabase
    .from("link_profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data as LinkProfile | null;
}

export async function upsertMyProfile(input: {
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  theme: string;
}): Promise<LinkProfile> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const payload = {
    user_id: u.user.id,
    username: input.username.toLowerCase(),
    display_name: input.display_name,
    bio: input.bio,
    avatar_url: input.avatar_url,
    theme: input.theme,
  };
  const { data, error } = await supabase
    .from("link_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as LinkProfile;
}

export async function listMyLinks(): Promise<LinkItem[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from("links")
    .select("*")
    .eq("user_id", u.user.id)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LinkItem[];
}

export async function listPublicLinksByUser(userId: string): Promise<LinkItem[]> {
  const { data, error } = await supabase
    .from("links")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LinkItem[];
}

export async function createLink(input: { title: string; url: string; icon: string; position: number }) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("links")
    .insert({ ...input, user_id: u.user.id })
    .select("*")
    .single();
  if (error) throw error;
  return data as LinkItem;
}

export async function updateLink(id: string, patch: Partial<Pick<LinkItem, "title" | "url" | "icon" | "position" | "active">>) {
  const { error } = await supabase.from("links").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteLink(id: string) {
  const { error } = await supabase.from("links").delete().eq("id", id);
  if (error) throw error;
}

export async function incrementClick(id: string, currentClicks: number) {
  // Best-effort — RLS allows update only for owners, so this silently no-ops for visitors.
  await supabase.from("links").update({ clicks: currentClicks + 1 }).eq("id", id);
}
