import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Composição detalhada dos 3 KPIs do cockpit em /hoje.
 * Usado pelo CockpitDrillDownModal pra mostrar de onde vem cada centavo.
 *
 * Não duplica matemática do useSobraReinvestida — refaz com mesmas regras
 * canônicas pra coerência. Se algum total não bater, é bug em um dos dois.
 */

export type BreakdownItem = {
  id: string;
  label: string;        // descrição/merchant
  amount: number;
  date?: string | null;
  source?: string | null;
  meta?: string;        // ex: "RWT05-01 (Jorge)"
};

export type BreakdownBucket = {
  label: string;        // ex: "Despesas (expenses)"
  total: number;
  count: number;
  items: BreakdownItem[];   // top N por amount desc
  link?: { label: string; href: string };
};

export type CockpitBreakdown = {
  receita: {
    total: number;
    buckets: BreakdownBucket[];
  };
  custeio: {
    total: number;
    buckets: BreakdownBucket[];
    excluded: BreakdownBucket[];   // card_payments + transfers — pra transparência
  };
  investimento: {
    total: number;
    buckets: BreakdownBucket[];
  };
};

const TOP_N = 8;

function topN(items: BreakdownItem[], n = TOP_N): BreakdownItem[] {
  return [...items].sort((a, b) => b.amount - a.amount).slice(0, n);
}

export function useCockpitBreakdown(month: string) {
  return useQuery<CockpitBreakdown>({
    queryKey: ["cockpit_breakdown", month],
    queryFn: async () => {
      // ─── PARALELO: 4 queries básicas ───
      const [revRes, expRes, kitRes, kitnetCodes] = await Promise.all([
        supabase.from("revenues")
          .select("id, amount, description, source, received_at, counts_as_income")
          .eq("reference_month", month),
        supabase.from("expenses")
          .select("id, amount, description, category, paid_at, vector, counts_as_investment, is_card_payment, nature")
          .eq("reference_month", month),
        supabase.from("kitnet_entries")
          .select("id, total_liquid, kitnet_id, tenant_name, received_at, reconciled")
          .eq("reference_month", month),
        supabase.from("kitnets").select("id, code"),
      ]);

      const codeById = new Map<string, string>(
        ((kitnetCodes.data ?? []) as any[]).map(k => [k.id, k.code ?? "?"])
      );

      // Cartões — REGIME CAIXA: faturas PAGAS neste mês (paid_at no range).
      // Em andamento (in_progress) e closed-não-pagas ficam de fora.
      const monthStart = `${month}-01`;
      const [yy, mm] = month.split("-").map(Number);
      const nextMonth = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;

      const paidInvRes = await supabase
        .from("card_invoices")
        .select("id, paid_amount, total_amount, paid_at, reference_month")
        .gte("paid_at", monthStart)
        .lt("paid_at", nextMonth);

      const paidInvs = (paidInvRes.data ?? []) as any[];
      const paidInvIds = paidInvs.map(i => i.id);

      // Ratio paid/total pra prorratear caso pagamento parcial
      const ratioByInv: Record<string, number> = {};
      for (const inv of paidInvs) {
        const total = Number(inv.total_amount ?? 0);
        const paid = Number(inv.paid_amount ?? total);
        ratioByInv[inv.id] = total > 0 ? Math.min(1, paid / total) : 1;
      }

      let cards: any[] = [];
      if (paidInvIds.length > 0) {
        const cardRes = await supabase
          .from("card_transactions")
          .select("id, amount, description, merchant_normalized, transaction_date, vector, counts_as_investment, card_id, invoice_id, custom_categories ( slug )")
          .in("invoice_id", paidInvIds);
        // Exclui tx com category 'ignorar' (PGTO CASH, estornos, etc) e aplica ratio
        cards = (cardRes.data ?? [])
          .filter((c: any) => c.custom_categories?.slug !== "ignorar")
          .map((c: any) => ({
            ...c,
            amount: Number(c.amount ?? 0) * (ratioByInv[c.invoice_id] ?? 1),
          }));
      }

      // Faturas open (informativo — vão como excluded no custeio)
      const openInvRes = await supabase
        .from("card_invoices")
        .select("id, total_amount, closed_at, paid_at, reference_month, card_id, cards ( name, bank )")
        .is("paid_at", null);
      const openInvs = (openInvRes.data ?? []) as any[];

      // ═══ RECEITA ═══
      const revsAvulsas = ((revRes.data ?? []) as any[]).filter(r => r.counts_as_income !== false);
      const revsAvulsasItems: BreakdownItem[] = revsAvulsas.map(r => ({
        id: r.id,
        label: r.description ?? r.source ?? "(sem descrição)",
        amount: Number(r.amount ?? 0),
        date: r.received_at,
        source: r.source,
      }));
      const revsAvulsasTotal = revsAvulsasItems.reduce((s, x) => s + x.amount, 0);

      const kitReconciled = ((kitRes.data ?? []) as any[]).filter(k => k.reconciled === true);
      const kitItems: BreakdownItem[] = kitReconciled.map(k => ({
        id: k.id,
        label: `${codeById.get(k.kitnet_id) ?? "?"} — ${k.tenant_name ?? "(vago)"}`,
        amount: Number(k.total_liquid ?? 0),
        date: k.received_at,
        meta: codeById.get(k.kitnet_id),
      }));
      const kitTotal = kitItems.reduce((s, x) => s + x.amount, 0);

      const receita = {
        total: revsAvulsasTotal + kitTotal,
        buckets: [
          {
            label: "Receitas avulsas",
            total: revsAvulsasTotal,
            count: revsAvulsasItems.length,
            items: topN(revsAvulsasItems),
            link: { label: "Ver todas em /revenues", href: "/revenues" },
          },
          {
            label: "Aluguéis kitnets (Modelo A)",
            total: kitTotal,
            count: kitItems.length,
            items: topN(kitItems),
            link: { label: `Ver em /kitnets (${kitItems.length} fechamentos)`, href: "/kitnets" },
          },
        ],
      };

      // ═══ CUSTEIO ═══
      const exps = (expRes.data ?? []) as any[];

      // Custeio expenses: nature='expense' && !is_card_payment && !counts_as_investment
      const custeioExps = exps.filter(e => {
        const nat = e.nature ?? "expense";
        return nat === "expense" && !e.is_card_payment && !e.counts_as_investment;
      });
      const custeioExpsItems: BreakdownItem[] = custeioExps.map(e => ({
        id: e.id,
        label: e.description ?? e.category ?? "(sem descrição)",
        amount: Number(e.amount ?? 0),
        date: e.paid_at,
        source: e.category,
      }));
      const custeioExpsTotal = custeioExpsItems.reduce((s, x) => s + x.amount, 0);

      // Custeio cartão: counts_as_investment=false
      const custeioCards = cards.filter(c => !c.counts_as_investment);
      const custeioCardsItems: BreakdownItem[] = custeioCards.map(c => ({
        id: c.id,
        label: c.merchant_normalized ?? c.description ?? "(sem descrição)",
        amount: Number(c.amount ?? 0),
        date: c.transaction_date,
        source: c.vector,
      }));
      const custeioCardsTotal = custeioCardsItems.reduce((s, x) => s + x.amount, 0);

      // EXCLUÍDOS: card_payments + transferências
      const cardPayments = exps.filter(e => e.is_card_payment === true);
      const cardPaymentsItems: BreakdownItem[] = cardPayments.map(e => ({
        id: e.id,
        label: e.description ?? "(pagamento fatura)",
        amount: Number(e.amount ?? 0),
        date: e.paid_at,
      }));
      const cardPaymentsTotal = cardPaymentsItems.reduce((s, x) => s + x.amount, 0);

      const transfers = exps.filter(e => (e.nature ?? "") === "transfer");
      const transfersItems: BreakdownItem[] = transfers.map(e => ({
        id: e.id,
        label: e.description ?? "(transferência interconta)",
        amount: Number(e.amount ?? 0),
        date: e.paid_at,
      }));
      const transfersTotal = transfersItems.reduce((s, x) => s + x.amount, 0);

      const custeio = {
        total: custeioExpsTotal + custeioCardsTotal,
        buckets: [
          {
            label: "Despesas (expenses table)",
            total: custeioExpsTotal,
            count: custeioExpsItems.length,
            items: topN(custeioExpsItems),
            link: { label: "Ver todas em /expenses", href: "/expenses" },
          },
          {
            label: "Cartões — faturas pagas no mês (regime caixa)",
            total: custeioCardsTotal,
            count: custeioCardsItems.length,
            items: topN(custeioCardsItems),
            link: { label: "Ver em /cards", href: "/cards" },
          },
        ],
        excluded: [
          {
            label: "Pagamentos de fatura (excluído — duplicaria com cartões)",
            total: cardPaymentsTotal,
            count: cardPaymentsItems.length,
            items: topN(cardPaymentsItems, 5),
          },
          {
            label: "Transferências interconta (excluído — entre suas contas)",
            total: transfersTotal,
            count: transfersItems.length,
            items: topN(transfersItems, 5),
          },
          {
            label: "Cartões em andamento (mês corrente, ainda consumindo)",
            total: openInvs.filter(i => i.closed_at === null).reduce((s: number, i: any) => s + Number(i.total_amount ?? 0), 0),
            count: openInvs.filter(i => i.closed_at === null).length,
            items: openInvs.filter(i => i.closed_at === null).map((i: any) => ({
              id: i.id,
              label: `${i.cards?.name ?? "?"} · ${i.reference_month}`,
              amount: Number(i.total_amount ?? 0),
              date: null,
              source: "in_progress",
            })),
          },
          {
            label: "Cartões fechados a pagar (entram no custeio quando pagos)",
            total: openInvs.filter(i => i.closed_at !== null).reduce((s: number, i: any) => s + Number(i.total_amount ?? 0), 0),
            count: openInvs.filter(i => i.closed_at !== null).length,
            items: openInvs.filter(i => i.closed_at !== null).map((i: any) => ({
              id: i.id,
              label: `${i.cards?.name ?? "?"} · ${i.reference_month}`,
              amount: Number(i.total_amount ?? 0),
              date: null,
              source: "closed",
            })),
          },
        ],
      };

      // ═══ INVESTIMENTO ═══
      // expenses com counts_as_investment, agrupado por vector
      const invExps = exps.filter(e => e.counts_as_investment === true);
      const invExpsByVector = new Map<string, any[]>();
      invExps.forEach(e => {
        const v = e.vector ?? "outros";
        if (!invExpsByVector.has(v)) invExpsByVector.set(v, []);
        invExpsByVector.get(v)!.push(e);
      });

      const invExpsBuckets: BreakdownBucket[] = Array.from(invExpsByVector.entries()).map(([vector, items]) => {
        const bItems: BreakdownItem[] = items.map(e => ({
          id: e.id,
          label: e.description ?? e.category ?? "(sem descrição)",
          amount: Number(e.amount ?? 0),
          date: e.paid_at,
          source: e.category,
        }));
        const total = bItems.reduce((s, x) => s + x.amount, 0);
        return {
          label: `${vector === "aporte_obra" ? "Aporte obra" : vector === "consorcios_aporte" ? "Consórcios" : vector}`,
          total,
          count: bItems.length,
          items: topN(bItems),
          link: vector === "aporte_obra"
            ? { label: "Ver em /constructions", href: "/constructions" }
            : vector === "consorcios_aporte"
            ? { label: "Ver em /consortiums", href: "/consortiums" }
            : undefined,
        };
      });

      // cards com counts_as_investment, agrupado por vector
      const invCards = cards.filter(c => c.counts_as_investment === true);
      const invCardsByVector = new Map<string, any[]>();
      invCards.forEach(c => {
        const v = c.vector ?? "outros";
        if (!invCardsByVector.has(v)) invCardsByVector.set(v, []);
        invCardsByVector.get(v)!.push(c);
      });
      const invCardsBuckets: BreakdownBucket[] = Array.from(invCardsByVector.entries()).map(([vector, items]) => {
        const bItems: BreakdownItem[] = items.map(c => ({
          id: c.id,
          label: c.merchant_normalized ?? c.description ?? "(sem descrição)",
          amount: Number(c.amount ?? 0),
          date: c.transaction_date,
          source: c.vector,
        }));
        const total = bItems.reduce((s, x) => s + x.amount, 0);
        const labels: Record<string, string> = {
          produtividade_ferramentas: "Cartão · Ferramentas (Lovable, Anthropic)",
          dev_pessoal_futuro: "Cartão · Dev Pessoal (cursos, viagens IA)",
          dev_profissional_agora: "Cartão · Dev Profissional",
          aporte_obra: "Cartão · Aporte obra",
          consorcios_aporte: "Cartão · Consórcios",
        };
        return {
          label: labels[vector] ?? `Cartão · ${vector}`,
          total,
          count: bItems.length,
          items: topN(bItems),
          link: { label: "Ver em /cards", href: "/cards" },
        };
      });

      const investBuckets = [...invExpsBuckets, ...invCardsBuckets].sort((a, b) => b.total - a.total);
      const investTotal = investBuckets.reduce((s, b) => s + b.total, 0);

      const investimento = {
        total: investTotal,
        buckets: investBuckets,
      };

      return { receita, custeio, investimento };
    },
  });
}
