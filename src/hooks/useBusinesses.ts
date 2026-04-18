import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Business = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  partner_name: string | null;
  ownership_pct: number;
  status: "ativo" | "incubado" | "encerrado";
  category: "recorrente" | "crescimento" | "incubado";
  monthly_target: number;
  target_12m: number;
  icon: string | null;
  color: string | null;
  notes: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type BusinessRevenueEntry = {
  id: string;
  business_id: string;
  reference_month: string;
  amount_william: number;
  amount_total: number | null;
  notes: string | null;
  created_at: string;
};

export function useBusinesses() {
  return useQuery({
    queryKey: ["businesses"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as Business[];
    },
  });
}

export function useCreateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Business>) => {
      const { error } = await (supabase as any).from("businesses").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["businesses"] }),
  });
}

export function useUpdateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Business> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("businesses")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["businesses"] }),
  });
}

export function useDeleteBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("businesses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["businesses"] }),
  });
}

export function useBusinessRevenueEntries(businessId?: string) {
  return useQuery({
    queryKey: ["business_revenue_entries", businessId ?? "all"],
    queryFn: async () => {
      const q = (supabase as any).from("business_revenue_entries").select("*").order("reference_month", { ascending: false });
      const { data, error } = businessId ? await q.eq("business_id", businessId) : await q;
      if (error) throw error;
      return data as BusinessRevenueEntry[];
    },
  });
}

export function useUpsertRevenueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<BusinessRevenueEntry> & { business_id: string; reference_month: string; amount_william: number }) => {
      const { error } = await (supabase as any)
        .from("business_revenue_entries")
        .upsert(payload, { onConflict: "business_id,reference_month" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business_revenue_entries"] }),
  });
}

export function useDeleteRevenueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("business_revenue_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business_revenue_entries"] }),
  });
}

// ─── Agregação automática por negócio ────────────────────────────────────────
// Kitnets: soma kitnet_entries.total_liquid do mês
// Demais: soma revenues WHERE business_id = X do mês
// Override manual: se houver business_revenue_entries do mês, sobrepõe o cálculo
export function useBusinessRealized(month: string) {
  return useQuery({
    queryKey: ["business_realized", month],
    queryFn: async () => {
      const result = new Map<string, { amount: number; source: "auto" | "manual" | "kitnet" }>();

      // 1. Kitnets (caso especial)
      const { data: kitnetBiz } = await (supabase as any)
        .from("businesses").select("id").eq("code", "KITNETS").maybeSingle();
      if (kitnetBiz?.id) {
        const { data: entries } = await (supabase as any)
          .from("kitnet_entries").select("total_liquid").eq("reference_month", month);
        const total = (entries ?? []).reduce((s: number, e: any) => s + Number(e.total_liquid ?? 0), 0);
        result.set(kitnetBiz.id, { amount: total, source: "kitnet" });
      }

      // 2. Revenues agregados por business_id
      const { data: revs, error: revErr } = await (supabase as any)
        .from("revenues")
        .select("business_id, amount")
        .eq("reference_month", month)
        .not("business_id", "is", null);
      if (revErr) throw revErr;
      (revs ?? []).forEach((r: any) => {
        if (!r.business_id) return;
        // Kitnets já preenchido via kitnet_entries — se também tiver revenue ligada, soma
        const existing = result.get(r.business_id);
        if (existing) {
          result.set(r.business_id, { amount: existing.amount + Number(r.amount), source: existing.source });
        } else {
          result.set(r.business_id, { amount: Number(r.amount), source: "auto" });
        }
      });

      // 3. Override manual (business_revenue_entries)
      const { data: manual } = await (supabase as any)
        .from("business_revenue_entries")
        .select("business_id, amount_william")
        .eq("reference_month", month);
      (manual ?? []).forEach((m: any) => {
        // Override TOTAL (não soma) quando há manual
        result.set(m.business_id, { amount: Number(m.amount_william), source: "manual" });
      });

      return result;
    },
  });
}

