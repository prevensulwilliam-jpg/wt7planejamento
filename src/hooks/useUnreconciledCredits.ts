import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TenantHistory } from "@/lib/suggestForCredit";
import { recordClassification } from "@/lib/patternLearning";

/**
 * Lista créditos do mês que não estão vinculados a nenhum revenue,
 * expense, kitnet_entry, e não foram marcados como ignored. Esses são
 * os candidatos pra revisão manual.
 */
export function useUnreconciledCredits(month: string) {
  return useQuery({
    queryKey: ["unreconciled_credits", month],
    queryFn: async () => {
      const [y, m] = month.split("-");
      const start = `${y}-${m}-01`;
      const end = new Date(+y, +m, 0).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("bank_transactions")
        .select("id, date, amount, description, type, status, bank_account_id, matched_revenue_id, matched_expense_id, kitnet_entry_id, category_intent, category_suggestion")
        .eq("type", "credit")
        .gte("date", start)
        .lte("date", end)
        .is("matched_revenue_id", null)
        .is("matched_expense_id", null)
        .is("kitnet_entry_id", null)
        .neq("status", "ignored")
        .order("date", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Dicionário de inquilinos ativos dos últimos 12 meses, com último
 * aluguel bruto/líquido conhecido. Usado pra gerar sugestões.
 */
export function useTenantHistory() {
  return useQuery({
    queryKey: ["tenant_history"],
    queryFn: async (): Promise<TenantHistory[]> => {
      // Últimos 12 meses de fechamentos
      const now = new Date();
      const past = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      const cutoff = past.toISOString().split("T")[0].slice(0, 7);

      // Busca entries + kitnets em queries separadas (evita problemas de FK)
      const [entriesRes, kitnetsRes] = await Promise.all([
        supabase
          .from("kitnet_entries")
          .select("tenant_name, kitnet_id, rent_value, total_liquid, reference_month")
          .gte("reference_month", cutoff)
          .not("tenant_name", "is", null),
        supabase
          .from("kitnets")
          .select("id, code"),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      if (kitnetsRes.error) throw kitnetsRes.error;

      const codeById = new Map<string, string>(
        (kitnetsRes.data ?? []).map((k: any) => [k.id, k.code ?? "?"])
      );

      // Pega o registro mais recente por tenant_name + kitnet_id
      const byKey = new Map<string, TenantHistory>();
      const recentMonth = (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split("T")[0].slice(0, 7);
      })();

      for (const e of (entriesRes.data ?? []) as any[]) {
        const tenant = e.tenant_name?.trim();
        if (!tenant) continue;
        const key = `${tenant}::${e.kitnet_id}`;
        const existing = byKey.get(key);
        if (!existing || (e.reference_month > existing.last_seen_month)) {
          byKey.set(key, {
            tenant_name: tenant,
            kitnet_id: e.kitnet_id,
            kitnet_code: codeById.get(e.kitnet_id) ?? "?",
            rent_value: Number(e.rent_value ?? 0),
            total_liquid: Number(e.total_liquid ?? 0),
            last_seen_month: e.reference_month,
            is_active: e.reference_month >= recentMonth,
          });
        }
      }

      return Array.from(byKey.values()).sort((a, b) =>
        Number(b.is_active) - Number(a.is_active) || a.tenant_name.localeCompare(b.tenant_name)
      );
    },
    staleTime: 5 * 60 * 1000, // 5min — não muda a cada keystroke
  });
}

/**
 * Aplica uma sugestão escolhida pelo William. Cria o revenue (se for receita),
 * linka ao bank_tx, marca como matched, e registra padrão pra aprender.
 *
 * Para casos de "aluguel_kitnets" + tenant + kitnet_code: também cria/linka
 * a uma kitnet_entry avulsa? NÃO — se for repasse fora de fechamento, fica como
 * revenue avulsa com source=aluguel_kitnets + business_id=KITNETS. Modelo A
 * preserva: total_liquid em kitnet_entries é o oficial; repasses extras vão
 * em revenues marcadas como kitnets pra contar no business_id mas sem
 * confundir o fechamento mensal.
 */
export function useApplySuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      bankTxId: string;
      bankTxDescription: string;
      bankTxAmount: number;
      bankTxDate: string;
      category: string;
      intent: "receita" | "transferencia" | "duvida";
      label: string;
      tenant?: string;
      kitnet_code?: string;
    }) => {
      const { bankTxId, bankTxDescription, bankTxAmount, bankTxDate, category, intent, label, tenant, kitnet_code } = input;

      // 1) Resolve business_id KITNETS se aplicável
      let businessId: string | null = null;
      if (category === "aluguel_kitnets") {
        const { data: biz } = await supabase
          .from("businesses" as any)
          .select("id")
          .eq("code", "KITNETS")
          .maybeSingle();
        businessId = (biz as any)?.id ?? null;
      }

      const refMonth = bankTxDate.slice(0, 7);
      let revenueId: string | null = null;

      // 2) Se for receita ou kitnets, cria revenue
      if (intent === "receita") {
        const desc = tenant
          ? `${label} — ${bankTxDescription}`
          : bankTxDescription;
        const { data, error } = await supabase
          .from("revenues")
          .insert({
            source: category,
            description: desc,
            amount: bankTxAmount,
            type: "variable",
            received_at: bankTxDate,
            reference_month: refMonth,
            business_id: businessId,
            counts_as_income: true,
            nature: "income",
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        revenueId = (data as any)?.id ?? null;
      }

      // 3) Atualiza bank_tx → matched + link
      const updatePayload: any = {
        category_confirmed: category,
        category_intent: intent,
        category_suggestion: category,
      };
      if (intent === "transferencia") {
        updatePayload.status = "ignored";
      } else {
        updatePayload.status = "matched";
        if (revenueId) updatePayload.matched_revenue_id = revenueId;
      }

      const { error: btErr } = await supabase
        .from("bank_transactions")
        .update(updatePayload)
        .eq("id", bankTxId);
      if (btErr) throw btErr;

      // 4) Aprende padrão (descrição → categoria) pra próxima vez
      try {
        await recordClassification(bankTxDescription, category, intent, label);
      } catch (e) {
        console.warn("recordClassification falhou (não-fatal):", e);
      }

      return { revenueId, bankTxId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unreconciled_credits"] });
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
      qc.invalidateQueries({ queryKey: ["business_realized"] });
    },
  });
}

/**
 * Marca o crédito como ignored sem criar revenue (caso seja transferência
 * própria não detectada antes, ou erro de extrato).
 */
export function useIgnoreCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bankTxId: string) => {
      const { error } = await supabase
        .from("bank_transactions")
        .update({ status: "ignored" })
        .eq("id", bankTxId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unreconciled_credits"] });
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
    },
  });
}
