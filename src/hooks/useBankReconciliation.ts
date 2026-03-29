import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useBankTransactions(filters?: {
  accountId?: string;
  month?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ["bank_transactions", filters],
    queryFn: async () => {
      let q = supabase
        .from("bank_transactions" as any)
        .select("*, bank_accounts(bank_name, account_type)")
        .order("date", { ascending: false });
      if (filters?.accountId) q = q.eq("bank_account_id", filters.accountId);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.month) {
        const [y, m] = filters.month.split("-");
        const start = `${y}-${m}-01`;
        const end = new Date(+y, +m, 0).toISOString().split("T")[0];
        q = q.gte("date", start).lte("date", end);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useImportTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transactions: any[]) => {
      const { error } = await supabase
        .from("bank_transactions" as any)
        .upsert(transactions, { onConflict: "external_id" } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank_transactions"] }),
  });
}

export function useMatchTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      category,
      revenueId,
      expenseId,
    }: {
      id: string;
      category: string;
      revenueId?: string;
      expenseId?: string;
    }) => {
      const { error } = await supabase
        .from("bank_transactions" as any)
        .update({
          category_confirmed: category,
          status: "matched",
          matched_revenue_id: revenueId ?? null,
          matched_expense_id: expenseId ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank_transactions"] }),
  });
}

export function useIgnoreTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bank_transactions" as any)
        .update({ status: "ignored" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank_transactions"] }),
  });
}

export function useBulkConfirmSuggestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transactions: { id: string; category: string }[]) => {
      for (const tx of transactions) {
        const { error } = await supabase
          .from("bank_transactions" as any)
          .update({ category_confirmed: tx.category, status: "matched" })
          .eq("id", tx.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank_transactions"] }),
  });
}

export function useReconciliationSummary(month: string) {
  const { data = [], isLoading } = useBankTransactions({ month });
  const totalCredits = data.filter((t: any) => t.type === "credit").reduce((s: number, t: any) => s + Math.abs(t.amount ?? 0), 0);
  const totalDebits = data.filter((t: any) => t.type === "debit").reduce((s: number, t: any) => s + Math.abs(t.amount ?? 0), 0);
  const pending = data.filter((t: any) => t.status === "pending").length;
  const matched = data.filter((t: any) => t.status === "matched").length;
  const ignored = data.filter((t: any) => t.status === "ignored").length;
  return { totalCredits, totalDebits, pending, matched, ignored, total: data.length, isLoading };
}
