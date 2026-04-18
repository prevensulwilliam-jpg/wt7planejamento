import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAutoMatchKitnets } from "@/hooks/useBankReconciliation";
import { suggestBusinessCode } from "@/lib/suggestBusiness";
import { categorizeTransaction } from "@/lib/categorizeTransaction";

export type ReconcileResult = {
  kitnetMatches: number;       // bank_tx ↔ kitnet_entry linkados
  recategorized: number;        // bank_tx reclassificadas (keywords)
  revenuesCreated: number;      // revenues criadas a partir de bank_tx matched
  expensesCreated: number;      // expenses criadas idem
  businessLinked: number;       // revenues que ganharam business_id
  kitnetOrphans: number;        // depósitos aluguel_kitnets sem fechamento (warning)
  kitnetOrphansTotal: number;   // soma em R$ dos orphans
};

/**
 * Hook único de reconciliação mensal. Usado pelo botão "🔄 Reconciliar valores"
 * em /reconciliation e pelo banner "Reconciliar agora →" em /businesses.
 *
 * Pipeline:
 *  1) Match bank_tx ↔ kitnet_entry por valor exato
 *  2) Recategorizar bank_tx pending/auto por keywords
 *  3) Criar revenues/expenses faltantes para bank_tx matched (com business_id preenchido)
 *  4) Resolver business_id em revenues órfãs por keyword
 *  5) Retornar warnings: depósitos aluguel_kitnets sem fechamento (ADM pendente)
 */
export function useReconcileMonth() {
  const qc = useQueryClient();
  const autoMatchKitnets = useAutoMatchKitnets();

  return useMutation({
    mutationFn: async (month: string): Promise<ReconcileResult> => {
      const [y, m] = month.split("-");
      const monthStart = `${y}-${m}-01`;
      const monthEnd = new Date(+y, +m, 0).toISOString().split("T")[0];

      // ═══ 1) Auto-match kitnets ═══
      const kitResult = await autoMatchKitnets.mutateAsync(month);
      const kitnetMatches = kitResult?.matched ?? 0;

      // ═══ 2) Buscar dicionário de businesses ═══
      const { data: businesses } = await supabase
        .from("businesses" as any)
        .select("id, code");
      const bizByCode = new Map<string, string>();
      ((businesses as any[]) ?? []).forEach((b: any) => bizByCode.set(b.code, b.id));

      // ═══ 3) Recategorizar bank_transactions não matched/ignored ═══
      const { data: txs } = await supabase
        .from("bank_transactions" as any)
        .select("*")
        .neq("status", "ignored")
        .neq("status", "matched")
        .gte("date", monthStart)
        .lte("date", monthEnd);

      let recategorized = 0;
      let revenuesCreated = 0;
      let expensesCreated = 0;
      let businessLinked = 0;

      for (const tx of ((txs as any[]) ?? [])) {
        const result = categorizeTransaction(tx.description, tx.type, tx.amount, []);
        const isAuto = result.confidence === "high" && result.intent !== "duvida";
        const newStatus =
          result.intent === "transferencia" ? "ignored" : isAuto ? "matched" : "pending";

        const businessCode = suggestBusinessCode({ description: tx.description, source: result.category });
        const businessId = bizByCode.get(businessCode) ?? null;

        let revenueId: string | null = null;
        let expenseId: string | null = null;

        if (isAuto && result.intent === "receita" && !tx.matched_revenue_id) {
          const { data, error } = await supabase.from("revenues").insert({
            source: result.category,
            description: tx.description,
            amount: tx.amount,
            type: "variable",
            reference_month: tx.date?.slice(0, 7),
            received_at: tx.date,
            business_id: businessId,
          } as any).select("id").single();
          if (!error && data) {
            revenueId = data.id;
            revenuesCreated++;
            if (businessId) businessLinked++;
          }
        } else if (isAuto && result.intent === "despesa" && !tx.matched_expense_id) {
          const { data, error } = await supabase.from("expenses").insert({
            category: result.category,
            description: tx.description,
            amount: tx.amount,
            type: "variable",
            reference_month: tx.date?.slice(0, 7),
            paid_at: tx.date,
          } as any).select("id").single();
          if (!error && data) {
            expenseId = data.id;
            expensesCreated++;
          }
        }

        const updatePayload: any = {
          category_suggestion: result.category,
          category_intent: result.intent,
          status: newStatus,
        };
        if (revenueId) updatePayload.matched_revenue_id = revenueId;
        if (expenseId) updatePayload.matched_expense_id = expenseId;

        await supabase.from("bank_transactions" as any).update(updatePayload).eq("id", tx.id);
        recategorized++;
      }

      // ═══ 4) Resolver business_id em revenues órfãs do mês ═══
      const { data: orphanRevs } = await supabase
        .from("revenues")
        .select("id, description, source")
        .eq("reference_month", month)
        .is("business_id", null);

      for (const r of ((orphanRevs as any[]) ?? [])) {
        const code = suggestBusinessCode({ description: r.description, source: r.source });
        const bid = bizByCode.get(code);
        if (!bid) continue;
        await supabase.from("revenues").update({ business_id: bid } as any).eq("id", r.id);
        businessLinked++;
      }

      // ═══ 5) Identificar depósitos aluguel_kitnets sem kitnet_entry ═══
      // (gap silencioso = ADM ainda não fechou)
      const { data: kitnetRevs } = await supabase
        .from("revenues")
        .select("id, amount")
        .eq("reference_month", month)
        .in("source", ["aluguel_kitnets", "kitnets"]);

      const { data: kitnetEntries } = await supabase
        .from("kitnet_entries")
        .select("total_liquid")
        .eq("reference_month", month);

      const entryAmounts = new Set(
        ((kitnetEntries as any[]) ?? []).map(e => Math.round(Number(e.total_liquid ?? 0) * 100))
      );

      let kitnetOrphans = 0;
      let kitnetOrphansTotal = 0;
      ((kitnetRevs as any[]) ?? []).forEach(r => {
        const cents = Math.round(Number(r.amount ?? 0) * 100);
        if (!entryAmounts.has(cents)) {
          kitnetOrphans++;
          kitnetOrphansTotal += Number(r.amount ?? 0);
        }
      });

      return {
        kitnetMatches,
        recategorized,
        revenuesCreated,
        expensesCreated,
        businessLinked,
        kitnetOrphans,
        kitnetOrphansTotal,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["revenues_reconciliation"] });
      qc.invalidateQueries({ queryKey: ["revenues_unlinked"] });
      qc.invalidateQueries({ queryKey: ["business_realized"] });
      qc.invalidateQueries({ queryKey: ["business_breakdown"] });
      qc.invalidateQueries({ queryKey: ["kitnet_entries"] });
      qc.invalidateQueries({ queryKey: ["kitnet_entries_unreconciled"] });
    },
  });
}

/**
 * Query leve pra mostrar o warning "X depósitos de kitnet sem fechamento"
 * no banner do /businesses sem precisar rodar o pipeline completo.
 */
export function useKitnetOrphans(month: string) {
  return useQuery({
    queryKey: ["kitnet_orphans", month],
    queryFn: async () => {
      const { data: revs } = await supabase
        .from("revenues")
        .select("id, amount, description, received_at")
        .eq("reference_month", month)
        .in("source", ["aluguel_kitnets", "kitnets"]);

      const { data: entries } = await supabase
        .from("kitnet_entries")
        .select("total_liquid")
        .eq("reference_month", month);

      const entryAmounts = new Set(
        ((entries as any[]) ?? []).map(e => Math.round(Number(e.total_liquid ?? 0) * 100))
      );

      const orphans = ((revs as any[]) ?? []).filter(r => {
        const cents = Math.round(Number(r.amount ?? 0) * 100);
        return !entryAmounts.has(cents);
      });

      const total = orphans.reduce((s, r) => s + Number(r.amount ?? 0), 0);
      return { count: orphans.length, total, items: orphans };
    },
  });
}
