import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SobraSnap = {
  month: string;
  receita: number;
  custeio_expenses: number;      // despesas tradicionais (tabela expenses, excluindo card_payment e invest)
  custeio_cartao: number;        // faturas PAGAS no mês × tx NÃO investimento (regime caixa)
  investimento_cartao: number;   // faturas PAGAS no mês × tx 💎 (regime caixa)
  investimento_expenses: number; // despesas marcadas counts_as_investment
  custeio_total: number;
  investimento_total: number;
  sobra_bruta: number;           // receita - custeio_total
  sobra_pct: number;             // sobra_bruta / receita (potencial)
  investido_pct: number;         // investimento_total / receita (real, meta ≥50%)
  gap_meta: number;              // quanto falta pra bater 50% em R$
  byVector: Record<string, number>;
  card_payments_ignored: number; // R$ em pagamentos de fatura excluídos do cálculo
  transfers_ignored: number;     // R$ em transferências interconta (entre contas próprias)
  entradas_neutras: number;      // R$ em transferências/reembolsos/estornos (não contam como receita)
  cartao_em_andamento: number;   // R$ na invoice in_progress do mês corrente (não conta no custeio ainda)
  cartao_a_pagar: number;        // R$ em faturas closed mas não pagas (vão pro custeio quando pagas)
};

const META_PCT = 50;

/**
 * Sobra Reinvestida do mês.
 * Fórmula canônica (memoria/metas.md):
 *   investido_pct = investimento_total / receita · meta ≥ 50%
 *   sobra_pct = sobra_bruta / receita (potencial, não é meta)
 *
 * Exclusões:
 *   - expenses.is_card_payment = true → duplica com card_transactions
 *   - expenses.counts_as_investment = true → vai pra investimento_expenses, não custeio
 */
export function useSobraReinvestida(month: string) {
  return useQuery<SobraSnap>({
    queryKey: ["sobra_reinvestida", month],
    queryFn: async () => {
      // 1. Receitas do mês — SÓ receita real (counts_as_income=true)
      //    Transferências entre contas, reembolsos e estornos não contam.
      //    + receita kitnets = SUM(kitnet_entries.total_liquid) reconciled
      //      (Modelo A — William declara, banco valida).
      const { data: revs, error: er } = await supabase
        .from("revenues")
        .select("amount, counts_as_income, nature")
        .eq("reference_month", month);
      if (er) throw er;
      const { data: kitEntries, error: ek } = await supabase
        .from("kitnet_entries")
        .select("total_liquid, reconciled")
        .eq("reference_month", month);
      if (ek) throw ek;

      const receitaAvulsa = (revs || [])
        .filter((r: any) => r.counts_as_income !== false)
        .reduce((s: number, r: any) => s + Number(r.amount), 0);
      const receitaKitnets = (kitEntries || [])
        .filter((k: any) => k.reconciled === true)
        .reduce((s: number, k: any) => s + Number(k.total_liquid ?? 0), 0);

      const receita = receitaAvulsa + receitaKitnets;
      const entradas_neutras = (revs || [])
        .filter((r: any) => r.counts_as_income === false)
        .reduce((s: number, r: any) => s + Number(r.amount), 0);

      // 2. Despesas do mês — separar: custeio puro × investimento × pagamento cartão (ignora)
      //                                × transferência interconta (ignora — entre contas próprias)
      const { data: exps, error: ee } = await supabase
        .from("expenses")
        .select("amount, counts_as_investment, vector, is_card_payment, nature")
        .eq("reference_month", month);
      if (ee) throw ee;

      let custeio_expenses = 0;
      let investimento_expenses = 0;
      let card_payments_ignored = 0;
      let transfers_ignored = 0;
      const byVector: Record<string, number> = {};

      for (const e of exps || []) {
        const v = Number((e as any).amount);
        if ((e as any).is_card_payment) {
          card_payments_ignored += v;
          continue; // NÃO conta — duplicação com card_transactions
        }
        if ((e as any).nature === "transfer") {
          transfers_ignored += v;
          continue; // NÃO conta — transferência entre contas próprias do William
        }
        if ((e as any).counts_as_investment) {
          investimento_expenses += v;
          const vec = (e as any).vector || "outros_invest";
          byVector[vec] = (byVector[vec] || 0) + v;
        } else {
          custeio_expenses += v;
        }
      }

      // 3. Cartões — REGIME CAIXA: faturas PAGAS neste mês.
      //    paid_at no range [mês-01, próximo-mês-01). Invoice in_progress
      //    e closed-não-paga NÃO entram no custeio (vão em cartao_em_andamento
      //    e cartao_a_pagar pra exibição informativa).
      const monthStart = `${month}-01`;
      const [yy, mm] = month.split("-").map(Number);
      const nextMonth = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;

      const { data: paidInvs } = await supabase
        .from("card_invoices")
        .select("id, paid_amount, total_amount")
        .gte("paid_at", monthStart)
        .lt("paid_at", nextMonth);

      const paidInvIds = (paidInvs || []).map((i: any) => i.id);
      // Ratio paid/total pra prorratear caso pagamento parcial (raro, mas blindagem)
      const ratioByInv: Record<string, number> = {};
      for (const inv of paidInvs || []) {
        const total = Number((inv as any).total_amount ?? 0);
        const paid = Number((inv as any).paid_amount ?? total);
        ratioByInv[(inv as any).id] = total > 0 ? Math.min(1, paid / total) : 1;
      }

      let custeio_cartao = 0;
      let investimento_cartao = 0;

      if (paidInvIds.length > 0) {
        const { data: txs, error: et } = await supabase
          .from("card_transactions")
          .select("amount, counts_as_investment, vector, invoice_id, custom_categories ( slug )")
          .in("invoice_id", paidInvIds);
        if (et) throw et;
        for (const t of txs || []) {
          // Categoria "🚫 Ignorar" — não conta nem custeio nem investimento
          if ((t as any).custom_categories?.slug === "ignorar") continue;
          const ratio = ratioByInv[(t as any).invoice_id] ?? 1;
          const v = Number((t as any).amount) * ratio;
          if ((t as any).counts_as_investment) {
            investimento_cartao += v;
            const vec = (t as any).vector || "outros_invest";
            byVector[vec] = (byVector[vec] || 0) + v;
          } else {
            custeio_cartao += v;
          }
        }
      }

      // 3b. Cartão informativo — em andamento (mês corrente) + a pagar (closed sem paid)
      //     Não entram no custeio_total. Só pra UI.
      const { data: openInvs } = await supabase
        .from("card_invoices")
        .select("id, total_amount, closed_at, paid_at")
        .is("paid_at", null);

      let cartao_em_andamento = 0;
      let cartao_a_pagar = 0;
      const openIds = (openInvs || []).filter((i: any) => i.closed_at === null).map((i: any) => i.id);

      // Em andamento: soma das tx das invoices in_progress (closed_at null, paid_at null)
      // Exclui tx com category 'ignorar' (PGTO CASH, estornos, etc).
      if (openIds.length > 0) {
        const { data: openTxs } = await supabase
          .from("card_transactions")
          .select("amount, invoice_id, custom_categories ( slug )")
          .in("invoice_id", openIds);
        for (const t of openTxs || []) {
          if ((t as any).custom_categories?.slug === "ignorar") continue;
          cartao_em_andamento += Number((t as any).amount);
        }
      }
      // A pagar: total_amount das invoices closed mas não pagas
      for (const inv of openInvs || []) {
        if ((inv as any).closed_at !== null) {
          cartao_a_pagar += Number((inv as any).total_amount ?? 0);
        }
      }

      const custeio_total = custeio_expenses + custeio_cartao;
      const investimento_total = investimento_expenses + investimento_cartao;
      const sobra_bruta = receita - custeio_total;
      const sobra_pct = receita > 0 ? (sobra_bruta / receita) * 100 : 0;
      const investido_pct = receita > 0 ? (investimento_total / receita) * 100 : 0;
      const meta_valor = receita * (META_PCT / 100);
      const gap_meta = Math.max(0, meta_valor - investimento_total);

      return {
        month,
        receita,
        custeio_expenses,
        custeio_cartao,
        investimento_cartao,
        investimento_expenses,
        custeio_total,
        investimento_total,
        sobra_bruta,
        sobra_pct,
        investido_pct,
        gap_meta,
        byVector,
        card_payments_ignored,
        transfers_ignored,
        entradas_neutras,
        cartao_em_andamento,
        cartao_a_pagar,
      };
    },
  });
}

export const SOBRA_META_PCT = META_PCT;
