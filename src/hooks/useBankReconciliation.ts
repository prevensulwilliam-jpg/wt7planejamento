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
      kitnetEntryId,
    }: {
      id: string;
      category: string;
      intent?: string;
      revenueId?: string;
      expenseId?: string;
      kitnetEntryId?: string;
    }) => {
      const { error } = await supabase
        .from("bank_transactions")
        .update({
          category_confirmed: category,
          category_intent: intent ?? null,
          status: "matched",
          matched_revenue_id: revenueId ?? null,
          matched_expense_id: expenseId ?? null,
          kitnet_entry_id: kitnetEntryId ?? null as any,
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

// Auto-match: cruza depósitos com kitnet_entries por valor exato
// Grava matched_revenue_id E kitnet_entry_id para rastreabilidade completa
export function useAutoMatchKitnets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (month: string) => {
      const [y, m] = month.split("-");
      const start = `${y}-${m}-01`;
      const end = new Date(+y, +m, 0).toISOString().split("T")[0];

      // 1. Créditos não conciliados do mês
      const { data: credits } = await supabase
        .from("bank_transactions")
        .select("id, amount, description")
        .eq("type", "credit")
        .in("status", ["pending", "auto_categorized"])
        .gte("date", start)
        .lte("date", end);

      if (!credits?.length) return { matched: 0 };

      // 2. Kitnet entries do mês (com kitnet_id para identificação)
      const { data: kitnetEntries } = await supabase
        .from("kitnet_entries")
        .select("id, total_liquid, kitnet_id, kitnets(code, tenant_name)")
        .eq("reference_month", month);

      if (!kitnetEntries?.length) return { matched: 0 };

      // 3. Receitas de kitnets do mês (para manter matched_revenue_id)
      const { data: kitnetRevenues } = await supabase
        .from("revenues")
        .select("id, amount")
        .eq("source", "kitnets")
        .eq("reference_month", month);

      // 4. Já vinculados — evitar duplo match
      const { data: alreadyLinked } = await supabase
        .from("bank_transactions")
        .select("kitnet_entry_id")
        .eq("status", "matched")
        .not("kitnet_entry_id", "is", null);

      const usedEntryIds = new Set((alreadyLinked ?? []).map((t: any) => t.kitnet_entry_id));
      const availableEntries = (kitnetEntries ?? []).filter(e => !usedEntryIds.has(e.id));

      // 5. Match por valor exato (em centavos para evitar float)
      let matchCount = 0;
      for (const credit of credits) {
        const creditCents = Math.round(Math.abs(credit.amount) * 100);

        // Tentar match com kitnet_entry por total_liquid
        const entryMatch = availableEntries.find(
          e => Math.round((e.total_liquid ?? 0) * 100) === creditCents
        );

        if (!entryMatch) continue;

        // Encontrar revenue correspondente pelo mesmo valor
        const revenueMatch = (kitnetRevenues ?? []).find(
          r => Math.round((r.amount ?? 0) * 100) === creditCents
        );

        await supabase
          .from("bank_transactions")
          .update({
            category_confirmed: "aluguel_kitnets",
            category_intent: "receita",
            category_label: `${(entryMatch as any).kitnets?.code} - ${(entryMatch as any).kitnets?.tenant_name}`,
            status: "matched",
            kitnet_entry_id: entryMatch.id as any,
            matched_revenue_id: revenueMatch?.id ?? null,
          })
          .eq("id", credit.id);

        usedEntryIds.add(entryMatch.id);
        matchCount++;
      }

      return { matched: matchCount };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["kitnet_entries"] });
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
  const doubts = data.filter((t: any) => t.status === "pending").length;
  const transfers = data.filter((t: any) => t.category_intent === "transferencia").length;
  return { totalCredits, totalDebits, pending, matched, ignored, autoCategorized, doubts, transfers, total: data.length, isLoading };
}
