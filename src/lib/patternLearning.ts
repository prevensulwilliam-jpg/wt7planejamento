import { supabase } from "@/integrations/supabase/client";

export function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\d{2}\/\d{2}\/\d{4}/g, "")
    .replace(/\d{2}\/\d{2}/g, "")
    .replace(/\d{2}:\d{2}/g, "")
    .replace(/r\$[\s\d.,]+/g, "")
    .replace(/[\d]{5,}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export async function getAllPatterns() {
  const { data } = await supabase
    .from("classification_patterns" as any)
    .select("*")
    .eq("auto_apply", true)
    .order("count", { ascending: false });
  return data ?? [];
}

export async function recordClassification(
  description: string,
  category: string,
  intent: string,
  label: string
) {
  const normalized = normalizeDescription(description);
  if (!normalized || normalized.length < 4) return;

  const { data: existing } = await supabase
    .from("classification_patterns" as any)
    .select("*")
    .eq("description_pattern", normalized)
    .eq("category", category)
    .eq("intent", intent)
    .single() as { data: any };

  if (existing) {
    const newCount = (existing.count ?? 0) + 1;
    await supabase
      .from("classification_patterns" as any)
      .update({
        count: newCount,
        auto_apply: newCount >= 3,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("classification_patterns" as any)
      .insert({
        description_pattern: normalized,
        category,
        intent,
        label,
        count: 1,
        auto_apply: false,
      });
  }
}

export async function removePattern(id: string) {
  await supabase
    .from("classification_patterns" as any)
    .delete()
    .eq("id", id);
}
