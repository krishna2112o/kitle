import { supabase } from "@/integrations/supabase/client";

export type Visibility = "public" | "private";

export type SavedProject = {
  id: string;
  user_id: string;
  name: string;
  files: Record<string, string>;
  messages: Array<{ role: string; content: string }>;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
};

export async function listMyProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("id,name,visibility,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listPublicProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("id,name,updated_at,user_id")
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return data ?? [];
}

export async function getProject(id: string) {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as SavedProject | null;
}

export async function saveProject(input: {
  name: string;
  files: Record<string, string>;
  messages: Array<{ role: string; content: string }>;
  visibility: Visibility;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: u.user.id,
      name: input.name,
      files: input.files,
      messages: input.messages,
      visibility: input.visibility,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateProjectVisibility(id: string, visibility: Visibility) {
  const { error } = await supabase.from("projects").update({ visibility }).eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}
