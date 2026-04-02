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
        .from("bank_transactions")
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
      if (!transactions.length) return { imported: 0, skipped: 0 };

      const externalIds = transactions.map(t => t.external_id).filter(Boolean);
      const { data: existing } = await supabase
        .from("bank_transactions")
        .select("external_id")
        .in("external_id", externalIds);

      const existingIds = new Set((existing ?? []).map((r: any) => r.external_id));
      const newTxs = transactions.filter(t => !existingIds.has(t.external_id));

      if (!newTxs.length) {
        throw new Error("Todas as transações desse extrato já foram importadas anteriormente.");
      }

      const { error } = await supabase
        .from("bank_transactions")
        .insert(newTxs);

      if (error) throw new Error(`Erro ao salvar: ${error.message}`);
      return { imported: newTxs.length, skipped: transactions.length - newTxs.length, newTransactions: newTxs };
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
      intent,
      revenueId,
      expenseId,
    }: {
      id: string;
      category: string;
      intent?: string;
      revenueId?: string;
      expenseId?: string;
    }) => {
      const { error } = await supabase
        .from("bank_transactions")
        .update({
          category_confirmed: category,
          category_intent: intent ?? null,
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
        .from("bank_transactions")
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
          .from("bank_transactions")
          .update({ category_confirmed: tx.category, status: "matched" })
          .eq("id", tx.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank_transactions"] }),
  });
}

// Auto-match bank credit transactions to kitnet revenues by exact amount
export function useAutoMatchKitnets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (month: string) => {
      const [y, m] = month.split("-");
      const start = `${y}-${m}-01`;
      const end = new Date(+y, +m, 0).toISOString().split("T")[0];

      // 1. Unmatched credits for the month
      const { data: credits } = await supabase
        .from("bank_transactions")
        .select("id, amount, description")
        .eq("type", "credit")
        .in("status", ["pending", "auto_categorized"])
        .gte("date", start)
        .lte("date", end);

      if (!credits?.length) return { matched: 0 };

      // 2. Kitnet revenues for the month
      const { data: kitnetRevenues } = await supabase
        .from("revenues")
        .select("id, amount, description")
        .eq("source", "kitnets")
        .eq("reference_month", month);

      if (!kitnetRevenues?.length) return { matched: 0 };

      // 3. Already matched revenue IDs (avoid double-matching)
      const { data: alreadyLinked } = await supabase
        .from("bank_transactions")
        .select("matched_revenue_id")
        .eq("status", "matched")
        .not("matched_revenue_id", "is", null);

      const usedRevenueIds = new Set((alreadyLinked ?? []).map((t: any) => t.matched_revenue_id));
      const available = kitnetRevenues.filter(r => !usedRevenueIds.has(r.id));

      // 4. Match by exact amount (compare in cents to avoid float issues)
      let matchCount = 0;
      for (const credit of credits) {
        const creditCents = Math.round(Math.abs(credit.amount) * 100);
        const match = available.find(r => Math.round(r.amount * 100) === creditCents);
        if (!match) continue;

        await supabase
          .from("bank_transactions")
          .update({
            category_confirmed: "kitnets",
            category_intent: "receita",
            category_label: match.description,
            status: "matched",
            matched_revenue_id: match.id,
          })
          .eq("id", credit.id);

        usedRevenueIds.add(match.id); // prevent same revenue from matching twice
        matchCount++;
      }

      return { matched: matchCount };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
      qc.invalidateQueries({ queryKey: ["revenues"] });
    },
  });
}

export function useReconciliationSummary(month: string) {
  const { data = [], isLoading } = useBankTransactions({ month });
  const totalCredits = data.filter((t: any) => t.type === "credit").reduce((s: number, t: any) => s + Math.abs(t.amount ?? 0), 0);
  const totalDebits = data.filter((t: any) => t.type === "debit").reduce((s: number, t: any) => s + Math.abs(t.amount ?? 0), 0);
  const pending = data.filter((t: any) => t.status === "pending").length;
  const matched = data.filter((t: any) => t.status === "matched").length;
  const ignored = data.filter((t: any) => t.status === "ignored").length;
  const autoCategorized = data.filter((t: any) => t.status === "auto_categorized").length;
  const doubts = data.filter((t: any) => t.category_intent === "duvida" && t.status === "pending").length;
  const transfers = data.filter((t: any) => t.category_intent === "transferencia").length;
  return { totalCredits, totalDebits, pending, matched, ignored, autoCategorized, doubts, transfers, total: data.length, isLoading };
}
