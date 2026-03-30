import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCategories(type?: "despesa" | "receita" | "ambos") {
  return useQuery({
    queryKey: ["custom_categories", type],
    queryFn: async () => {
      let q = supabase
        .from("custom_categories")
        .select("*")
        .eq("active", true)
        .order("type")
        .order("name");
      if (type) q = q.in("type", [type, "ambos"]);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useAllCategories() {
  return useQuery({
    queryKey: ["custom_categories", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_categories" as any)
        .select("*")
        .order("type")
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: { name: string; emoji: string; type: string; color: string }) => {
      const { error } = await supabase.from("custom_categories" as any).insert(cat);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; emoji?: string; type?: string; color?: string; active?: boolean }) => {
      const { error } = await supabase.from("custom_categories" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("custom_categories" as any)
        .update({ active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_categories"] }),
  });
}
