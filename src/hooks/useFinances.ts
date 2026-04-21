import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ─── RECEITAS ───
export function useRevenues(month?: string) {
  return useQuery({
    queryKey: ["revenues", month],
    queryFn: async () => {
      let q = supabase.from("revenues").select("*").order("received_at", { ascending: false });
      if (month) q = q.eq("reference_month", month);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"revenues">) => {
      const { error } = await supabase.from("revenues").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
    },
  });
}

export function useDeleteRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("revenues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
    },
  });
}

// ─── DESPESAS ───
export function useExpenses(month?: string) {
  return useQuery({
    queryKey: ["expenses", month],
    queryFn: async () => {
      let q = supabase.from("expenses").select("*").order("paid_at", { ascending: false });
      if (month) q = q.eq("reference_month", month);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"expenses">) => {
      const { error } = await supabase.from("expenses").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      category?: string;
      type?: string;
      description?: string;
      amount?: number;
      counts_as_investment?: boolean;
      vector?: string | null;
      is_card_payment?: boolean;
    }) => {
      const { error } = await supabase.from("expenses").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
    },
  });
}

export function useUpdateRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      source?: string;
      type?: string;
      description?: string;
      amount?: number;
      counts_as_income?: boolean;
      nature?: string;
    }) => {
      const { error } = await supabase.from("revenues").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
    },
  });
}

// ─── KPIs DO DASHBOARD ───
export function useDashboardKPIs(month: string) {
  const revenues = useRevenues(month);
  const expenses = useExpenses(month);

  // Só receita real (counts_as_income=true). Transferências/reembolsos/estornos não contam.
  const totalRevenue = (revenues.data ?? [])
    .filter((r: any) => r.counts_as_income !== false)
    .reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalExpenses = (expenses.data ?? []).reduce((s, e) => s + (e.amount ?? 0), 0);
  const netResult = totalRevenue - totalExpenses;

  const revenueBySource = (revenues.data ?? []).filter((r: any) => r.counts_as_income !== false).reduce((acc, r) => {
    const src = r.source ?? "outros";
    acc[src] = (acc[src] ?? 0) + (r.amount ?? 0);
    return acc;
  }, {} as Record<string, number>);

  const expenseByCategory = (expenses.data ?? []).reduce((acc, e) => {
    const cat = e.category ?? "outros";
    acc[cat] = (acc[cat] ?? 0) + (e.amount ?? 0);
    return acc;
  }, {} as Record<string, number>);

  return {
    totalRevenue,
    totalExpenses,
    netResult,
    revenueBySource,
    expenseByCategory,
    isLoading: revenues.isLoading || expenses.isLoading,
  };
}

// ─── ÚLTIMOS 6 MESES para gráfico ───
export function useRevenueExpenseTrend() {
  return useQuery({
    queryKey: ["revenue_expense_trend"],
    queryFn: async () => {
      const months: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      const [revRes, expRes] = await Promise.all([
        supabase.from("revenues").select("amount, reference_month").in("reference_month", months),
        supabase.from("expenses").select("amount, reference_month").in("reference_month", months),
      ]);
      return months.map(m => {
        const [, mm] = m.split("-");
        const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        return {
          month: monthNames[parseInt(mm) - 1],
          monthKey: m,
          receita: (revRes.data ?? []).filter(r => r.reference_month === m).reduce((s, r) => s + (r.amount ?? 0), 0),
          despesa: (expRes.data ?? []).filter(e => e.reference_month === m).reduce((s, e) => s + (e.amount ?? 0), 0),
        };
      });
    },
  });
}

// ─── METAS ───
export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"goals"> & { id: string }) => {
      const { error } = await supabase.from("goals").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

// ─── PATRIMÔNIO ───
export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*").order("estimated_value", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ─── BANK ACCOUNTS ───
export function useBankAccounts() {
  return useQuery({
    queryKey: ["bank_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("bank_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { bank_name: string; account_type?: string; balance?: number; last_updated?: string; notes?: string }) => {
      const { error } = await supabase.from("bank_accounts").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank_accounts"] }),
  });
}

export function useUpdateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; balance?: number; last_updated?: string; bank_name?: string; account_type?: string; notes?: string }) => {
      const { error } = await supabase.from("bank_accounts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank_accounts"] }),
  });
}

export function useDeleteBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank_accounts"] }),
  });
}

// ─── PATRIMÔNIO LÍQUIDO ───
export function useNetWorth() {
  const assets = useAssets();
  const investments = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investments").select("current_amount");
      if (error) throw error;
      return data;
    },
  });
  const properties = useQuery({
    queryKey: ["real_estate_properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("real_estate_properties").select("property_value");
      if (error) throw error;
      return data;
    },
  });

  const total =
    (assets.data ?? []).reduce((s, a) => s + (a.estimated_value ?? 0), 0) +
    (investments.data ?? []).reduce((s, i) => s + (i.current_amount ?? 0), 0) +
    (properties.data ?? []).reduce((s, p) => s + (p.property_value ?? 0), 0);

  return {
    netWorth: total,
    isLoading: assets.isLoading || investments.isLoading || properties.isLoading,
  };
}

// ─── CSV EXPORT ───
export function exportCSV(data: Record<string, any>[], headers: string[], keys: string[], filename: string) {
  const rows = data.map(r => keys.map(k => r[k] ?? ""));
  const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
