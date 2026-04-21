import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SobraSnap = {
  month: string;
  receita: number;
  custeio_expenses: number;      // despesas tradicionais (tabela expenses, excluindo card_payment e invest)
  custeio_cartao: number;        // tx de cartão NÃO investimento
  investimento_cartao: number;   // tx de cartão 💎 (aporte_obra, dev_*, ferramentas, consórcios)
  investimento_expenses: number; // despesas marcadas counts_as_investment
  custeio_total: number;
  investimento_total: number;
  sobra_bruta: number;           // receita - custeio_total
  sobra_pct: number;             // sobra_bruta / receita (potencial)
  investido_pct: number;         // investimento_total / receita (real, meta ≥50%)
  gap_meta: number;              // quanto falta pra bater 50% em R$
  byVector: Record<string, number>;
  card_payments_ignored: number; // R$ em pagamentos de fatura excluídos do cálculo
  entradas_neutras: number;      // R$ em transferências/reembolsos/estornos (não contam como receita)
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
      //    Transferências entre contas, reembolsos e estornos não contam
      const { data: revs, error: er } = await supabase
        .from("revenues")
        .select("amount, counts_as_income, nature")
        .eq("reference_month", month);
      if (er) throw er;
      const receita = (revs || [])
        .filter((r: any) => r.counts_as_income !== false)
        .reduce((s: number, r: any) => s + Number(r.amount), 0);
      const entradas_neutras = (revs || [])
        .filter((r: any) => r.counts_as_income === false)
        .reduce((s: number, r: any) => s + Number(r.amount), 0);

      // 2. Despesas do mês — separar: custeio puro × investimento × pagamento cartão (ignora)
      const { data: exps, error: ee } = await supabase
        .from("expenses")
        .select("amount, counts_as_investment, vector, is_card_payment")
        .eq("reference_month", month);
      if (ee) throw ee;

      let custeio_expenses = 0;
      let investimento_expenses = 0;
      let card_payments_ignored = 0;
      const byVector: Record<string, number> = {};

      for (const e of exps || []) {
        const v = Number((e as any).amount);
        if ((e as any).is_card_payment) {
          card_payments_ignored += v;
          continue; // NÃO conta — duplicação com card_transactions
        }
        if ((e as any).counts_as_investment) {
          investimento_expenses += v;
          const vec = (e as any).vector || "outros_invest";
          byVector[vec] = (byVector[vec] || 0) + v;
        } else {
          custeio_expenses += v;
        }
      }

      // 3. Cartões do mês (invoice reference_month)
      const { data: invs } = await supabase
        .from("card_invoices")
        .select("id")
        .eq("reference_month", month);
      const invIds = (invs || []).map((i: any) => i.id);

      let custeio_cartao = 0;
      let investimento_cartao = 0;

      if (invIds.length > 0) {
        const { data: txs, error: et } = await supabase
          .from("card_transactions")
          .select("amount, counts_as_investment, vector")
          .in("invoice_id", invIds);
        if (et) throw et;
        for (const t of txs || []) {
          const v = Number((t as any).amount);
          if ((t as any).counts_as_investment) {
            investimento_cartao += v;
            const vec = (t as any).vector || "outros_invest";
            byVector[vec] = (byVector[vec] || 0) + v;
          } else {
            custeio_cartao += v;
          }
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
        entradas_neutras,
      };
    },
  });
}

export const SOBRA_META_PCT = META_PCT;
