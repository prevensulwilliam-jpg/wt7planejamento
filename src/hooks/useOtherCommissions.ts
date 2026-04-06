import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── List by month ───
export function useOtherCommissions(month?: string) {
  return useQuery({
    queryKey: ["other_commissions", month],
    queryFn: async () => {
      let q = (supabase as any)
        .from("other_commissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (month) q = q.eq("reference_month", month);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        description: string;
        source: string | null;
        reference_month: string;
        amount: number;
        commission_rate: number;
        commission_value: number;
        notes: string | null;
        created_by: string | null;
        created_at: string;
      }>;
    },
  });
}

// ─── Summary for KPIs ───
export function useOtherCommissionsSummary(month: string) {
  const { data = [], isLoading } = useOtherCommissions(month);
  const totalAmount = data.reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalCommission = data.reduce((s, r) => s + (r.commission_value ?? 0), 0);
  return { totalAmount, totalCommission, totalRecords: data.length, isLoading };
}

// ─── Create ───
export function useCreateOtherCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      description: string;
      source?: string | null;
      reference_month: string;
      amount: number;
      commission_rate: number;
      commission_value: number;
      notes?: string | null;
      created_by?: string | null;
    }) => {
      const { error } = await (supabase as any).from("other_commissions").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["other_commissions"] }),
  });
}

// ─── Delete ───
export function useDeleteOtherCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("other_commissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["other_commissions"] }),
  });
}
