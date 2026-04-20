import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SobraSnap = {
  month: string;
  receita: number;
  custeio_expenses: number;      // despesas tradicionais (tabela expenses)
  custeio_cartao: number;        // tx de cartão NÃO investimento
  investimento_cartao: number;   // tx de cartão 💎 (aporte_obra, dev_*, ferramentas, consórcios)
  investimento_expenses: number; // despesas categorizadas como investimento (se counts_as_investment)
  custeio_total: number;
  investimento_total: number;
  sobra_bruta: number;           // receita - custeio_total
  sobra_pct: number;             // sobra_bruta / receita
  byVector: Record<string, number>;
};

const META_PCT = 50;

/**
 * Sobra Reinvestida do mês.
 * Fórmula: (Receita - Custo de Vida - Impostos - Dívidas) alocada em investimento.
 * Meta: ≥50% da receita total.
 */
export function useSobraReinvestida(month: string) {
  return useQuery<SobraSnap>({
    queryKey: ["sobra_reinvestida", month],
    queryFn: async () => {
      // 1. Receitas do mês
      const { data: revs, error: er } = await supabase
        .from("revenues")
        .select("amount")
        .eq("reference_month", month);
      if (er) throw er;
      const receita = (revs || []).reduce((s: number, r: any) => s + Number(r.amount), 0);

      // 2. Despesas do mês — duas queries separadas (evita join FK opcional)
      const { data: exps, error: ee } = await supabase
        .from("expenses")
        .select("amount, category_id")
        .eq("reference_month", month);
      if (ee) throw ee;

      // Busca categorias investimento de uma vez
      const { data: invCats } = await supabase
        .from("custom_categories")
        .select("id")
        .eq("counts_as_investment", true);
      const invCatIds = new Set((invCats || []).map((c: any) => c.id));

      let custeio_expenses = 0;
      let investimento_expenses = 0;
      for (const e of exps || []) {
        const v = Number((e as any).amount);
        const isInv = invCatIds.has((e as any).category_id);
        if (isInv) investimento_expenses += v;
        else custeio_expenses += v;
      }

      // 3. Cartões do mês (invoice reference_month)
      const { data: invs } = await supabase
        .from("card_invoices")
        .select("id")
        .eq("reference_month", month);
      const invIds = (invs || []).map((i: any) => i.id);

      let custeio_cartao = 0;
      let investimento_cartao = 0;
      const byVector: Record<string, number> = {};

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
        byVector,
      };
    },
  });
}

export const SOBRA_META_PCT = META_PCT;
