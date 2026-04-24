import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Travel Plans ───
// Viagens planejadas (business, leisure, honeymoon, mixed).
// Usado pela projeção de caixa pra antecipar saídas grandes + cards
// informativos em /projections e /hoje.

export function useTravelPlans() {
  return useQuery({
    queryKey: ["travel_plans"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("travel_plans")
        .select("*")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useUpcomingTravelPlans() {
  return useQuery({
    queryKey: ["travel_plans_upcoming"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await (supabase as any)
        .from("travel_plans")
        .select("*")
        .or(`start_date.gte.${today},status.eq.in_progress`)
        .neq("status", "cancelled")
        .neq("status", "completed")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useCreateTravelPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: any) => {
      const { error } = await (supabase as any).from("travel_plans").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel_plans"] });
      qc.invalidateQueries({ queryKey: ["travel_plans_upcoming"] });
    },
  });
}

export function useUpdateTravelPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await (supabase as any)
        .from("travel_plans")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel_plans"] });
      qc.invalidateQueries({ queryKey: ["travel_plans_upcoming"] });
    },
  });
}

export function useDeleteTravelPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("travel_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel_plans"] });
      qc.invalidateQueries({ queryKey: ["travel_plans_upcoming"] });
    },
  });
}
