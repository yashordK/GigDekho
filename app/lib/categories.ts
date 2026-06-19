import { supabase } from "~/lib/supabase.client";

export async function fetchSkillCategories() {
  const { data } = await supabase
    .from("skill_categories")
    .select("id, name, emoji, category_group")
    .eq("is_active", true)
    .order("category_group")
    .order("name");
  return data ?? [];
}
