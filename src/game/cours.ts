import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Cours = { id: string; title: string; type: string; text: string; author_id: string; created_at: string; auteur: string };

export async function chargerCours(): Promise<Cours[]> {
  const { data, error } = await supabase.from("courses").select("id,title,type,text,author_id,created_at").order("created_at");
  if (error) throw error;
  const ids = [...new Set(data.map((c) => c.author_id))];
  const { data: ps } = ids.length ? await supabase.from("profiles").select("id,pseudo").in("id", ids) : { data: [] };
  const noms = new Map((ps ?? []).map((p) => [p.id, p.pseudo]));
  return data.map((c) => ({ ...c, auteur: noms.get(c.author_id) ?? "Inconnu" }));
}

export const useCours = () => useQuery({ queryKey: ["cours"], queryFn: chargerCours });

export async function deposerCours(author_id: string, c: { title: string; type: string; text: string }) {
  const { error } = await supabase.from("courses").insert({ ...c, author_id });
  if (error) throw error;
}

export async function supprimerCours(id: string) {
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw error;
}
