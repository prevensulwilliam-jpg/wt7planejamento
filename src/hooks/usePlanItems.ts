import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlanKind =
  | "obra"
  | "viagem"
  | "casamento"
  | "custo_fixo"
  | "receita_travada"
  | "receita_projetada"
  | "imposto"
  | "outro";

export type PlanItem = {
  id: string;
  month: string;           // YYYY-MM
  kind: PlanKind;
  category: string | null;
  description: string;
  amount: number;
  is_revenue: boolean;
  locked: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const PLAN_KIND_META: Record<PlanKind, { emoji: string; label: string; color: string; isRevenue: boolean }> = {
  obra:               { emoji: "🏗️", label: "Obra",             color: "#F43F5E", isRevenue: false },
  viagem:             { emoji: "✈️",  label: "Viagem",           color: "#F43F5E", isRevenue: false },
  casamento:          { emoji: "💍", label: "Casamento",         color: "#F43F5E", isRevenue: false },
  custo_fixo:         { emoji: "💸", label: "Custo Fixo",        color: "#F43F5E", isRevenue: false },
  imposto:            { emoji: "🏛️", label: "Imposto",           color: "#F43F5E", isRevenue: false },
  outro:              { emoji: "📌", label: "Outro",             color: "#94A3B8", isRevenue: false },
  receita_travada:    { emoji: "🔒", label: "Receita Travada",   color: "#3B82F6", isRevenue: true },
  receita_projetada:  { emoji: "📈", label: "Receita Projetada", color: "#3B82F6", isRevenue: true },
};

export function usePlanItems() {
  return useQuery({
    queryKey: ["plan_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_items" as any)
        .select("*")
        .order("month", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PlanItem[];
    },
  });
}

export function useCreatePlanItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Partial<PlanItem>) => {
      const { error } = await supabase.from("plan_items" as any).insert(entry as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan_items"] }),
  });
}

export function useUpdatePlanItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlanItem> & { id: string }) => {
      const { error } = await supabase.from("plan_items" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan_items"] }),
  });
}

export function useDeletePlanItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plan_items" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan_items"] }),
  });
}
