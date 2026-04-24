import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sumMoney } from "@/lib/formatters";

// ─── Cash Flow Items ───
// Plano de caixa mensal. Cada linha representa 1 item (receita, saída, custo
// de vida ou transfer) em um mês específico. Status muda de 'projected' pra
// 'realized' quando o valor efetivo ocorre, com realized_amount pra comparação.

export type CashFlowFlowType = "income" | "expense_extra" | "cost_of_living" | "transfer_in";
export type CashFlowStatus = "projected" | "confirmed" | "realized" | "cancelled";

export interface CashFlowItem {
  id: string;
  reference_month: string;   // YYYY-MM
  label: string;
  category: string;
  flow_type: CashFlowFlowType;
  amount: number;
  notes: string | null;
  status: CashFlowStatus;
  realized_amount: number | null;
  realized_at: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CashFlowMonthSummary {
  month: string;
  income: number;
  transfer_in: number;
  expense_extra: number;
  cost_of_living: number;
  net: number;                    // saldo do mês (receitas − saídas)
  items: CashFlowItem[];
}

export function useCashFlowItems() {
  return useQuery({
    queryKey: ["cash_flow_items"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cash_flow_items")
        .select("*")
        .order("reference_month", { ascending: true })
        .order("display_order", { ascending: true })
        .order("amount", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CashFlowItem[];
    },
  });
}

// Agrupa por mês + calcula saldos
export function useCashFlowByMonth(initialCashBalance = 0) {
  const query = useCashFlowItems();

  const months: CashFlowMonthSummary[] = [];
  const accumulated: { month: string; balance: number }[] = [];

  if (query.data) {
    const byMonth = new Map<string, CashFlowItem[]>();
    for (const it of query.data) {
      const list = byMonth.get(it.reference_month) ?? [];
      list.push(it);
      byMonth.set(it.reference_month, list);
    }

    const sortedMonths = Array.from(byMonth.keys()).sort();
    let balance = initialCashBalance;

    for (const month of sortedMonths) {
      const items = byMonth.get(month)!;
      const income = sumMoney(items.filter(i => i.flow_type === "income").map(i => i.amount));
      const transferIn = sumMoney(items.filter(i => i.flow_type === "transfer_in").map(i => i.amount));
      const expenseExtra = sumMoney(items.filter(i => i.flow_type === "expense_extra").map(i => i.amount));
      const costOfLiving = sumMoney(items.filter(i => i.flow_type === "cost_of_living").map(i => i.amount));

      const net = income + transferIn - expenseExtra - costOfLiving;
      balance = balance + net;

      months.push({
        month,
        income,
        transfer_in: transferIn,
        expense_extra: expenseExtra,
        cost_of_living: costOfLiving,
        net,
        items,
      });
      accumulated.push({ month, balance });
    }
  }

  return {
    months,
    accumulated,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCreateCashFlowItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Omit<CashFlowItem, "id" | "created_at" | "updated_at" | "realized_amount" | "realized_at"> & {
      realized_amount?: number | null;
      realized_at?: string | null;
    }) => {
      const { error } = await (supabase as any).from("cash_flow_items").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cash_flow_items"] }),
  });
}

export function useUpdateCashFlowItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CashFlowItem> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("cash_flow_items")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cash_flow_items"] }),
  });
}

export function useDeleteCashFlowItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("cash_flow_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cash_flow_items"] }),
  });
}

// Marca como realizado (helper)
export function useRealizeCashFlowItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, realized_amount, realized_at }: { id: string; realized_amount: number; realized_at: string }) => {
      const { error } = await (supabase as any)
        .from("cash_flow_items")
        .update({
          status: "realized",
          realized_amount,
          realized_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cash_flow_items"] }),
  });
}
