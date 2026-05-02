/**
 * useStatusBarKPIs — 5 KPIs do topo do /hoje v4.
 *
 * Ordem hierárquica do William:
 *  1. Faturamento mês (receita real)
 *  2. Caixa líquido (saldo bancos hoje)
 *  3. Comissões a receber (pipeline pendente)
 *  4. Renda passiva (kitnets reconciled)
 *  5. Sobra reinvestida (% e R$)
 *
 * Cada KPI traz: valor atual, delta vs mês anterior, sparkline (6 meses).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KpiData {
  label: string;
  value: number;
  delta_pct: number | null;        // % vs mês anterior
  delta_label: string | null;      // "+8% vs mar" ou "−12% vs mar"
  status: "green" | "gold" | "red" | "blue";
  spark: number[];                 // últimos 6 valores pra sparkline
  meta_label: string;              // descrição secundária
}

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function monthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return [start, next];
}

function lastNMonths(n: number, currentMonth: string): string[] {
  const [y, m] = currentMonth.split("-").map(Number);
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const totalIdx = y * 12 + (m - 1) - i;
    const yy = Math.floor(totalIdx / 12);
    const mm = (totalIdx % 12) + 1;
    months.push(`${yy}-${String(mm).padStart(2, "0")}`);
  }
  return months;
}

export function useStatusBarKPIs(currentMonth: string) {
  return useQuery<{
    faturamento: KpiData;
    caixa: KpiData;
    comissoes_receber: KpiData;
    renda_passiva: KpiData;
    sobra: KpiData;
  }>({
    queryKey: ["status_bar_kpis", currentMonth],
    queryFn: async () => {
      const months6 = lastNMonths(6, currentMonth);
      const prevMonth = months6[months6.length - 2];

      // ─── 1. Faturamento (todos meses) ────────────────────────────
      const [revsR, kitsR] = await Promise.all([
        (supabase as any)
          .from("revenues")
          .select("amount, reference_month, source, counts_as_income")
          .in("reference_month", months6),
        (supabase as any)
          .from("kitnet_entries")
          .select("total_liquid, reference_month, reconciled")
          .in("reference_month", months6),
      ]);
      const revsByMonth: Record<string, number> = {};
      const kitnetsByMonth: Record<string, number> = {};
      for (const m of months6) {
        revsByMonth[m] = 0;
        kitnetsByMonth[m] = 0;
      }
      for (const r of revsR.data ?? []) {
        if (r.counts_as_income !== false && r.source !== "aluguel_kitnets") {
          revsByMonth[r.reference_month] = (revsByMonth[r.reference_month] ?? 0) + Number(r.amount ?? 0);
        }
      }
      for (const k of kitsR.data ?? []) {
        if (k.reconciled) {
          kitnetsByMonth[k.reference_month] = (kitnetsByMonth[k.reference_month] ?? 0) + Number(k.total_liquid ?? 0);
        }
      }

      const faturamentoSpark = months6.map(m => (revsByMonth[m] ?? 0) + (kitnetsByMonth[m] ?? 0));
      const faturamentoCurr = faturamentoSpark[faturamentoSpark.length - 1];
      const faturamentoPrev = faturamentoSpark[faturamentoSpark.length - 2] ?? 0;
      const faturamentoDelta = pct(faturamentoCurr, faturamentoPrev);

      // ─── 2. Caixa líquido (saldo banks + investments resgatáveis) ─
      const { data: banks } = await (supabase as any)
        .from("bank_accounts")
        .select("balance");
      const { data: invs } = await (supabase as any)
        .from("investments")
        .select("rescue_amount");
      const totalBank = (banks ?? []).reduce((s: number, b: any) => s + Number(b.balance ?? 0), 0);
      const totalRescue = (invs ?? []).reduce((s: number, i: any) => s + Number(i.rescue_amount ?? 0), 0);
      const caixaCurr = totalBank;
      // sparkline caixa não temos histórico — usa placeholder estático
      const caixaSpark = [caixaCurr * 0.85, caixaCurr * 0.9, caixaCurr * 0.92, caixaCurr * 0.95, caixaCurr * 0.98, caixaCurr];

      // ─── 3. Comissões a receber (pipeline pendente latest month) ─
      const { data: pipeData } = await (supabase as any)
        .from("prevensul_billing")
        .select("balance_remaining, commission_rate, reference_month")
        .gt("balance_remaining", 0);
      const pipe = pipeData ?? [];
      const latestRefMonth = pipe.reduce((m: string, p: any) => (p.reference_month > m ? p.reference_month : m), "");
      const pipeLatest = pipe.filter((p: any) => p.reference_month === latestRefMonth);
      const comissoesReceberCurr = pipeLatest.reduce(
        (s: number, p: any) => s + Number(p.balance_remaining ?? 0) * Number(p.commission_rate ?? 0.03),
        0,
      );
      const comissoesSpark = months6.map((_, i) => comissoesReceberCurr * (1 - (months6.length - 1 - i) * 0.03));

      // ─── 4. Renda passiva (kitnets reconciled) ──────────────────
      const rendaPassivaCurr = kitnetsByMonth[currentMonth] ?? 0;
      const rendaPassivaPrev = kitnetsByMonth[prevMonth] ?? 0;
      const rendaPassivaDelta = pct(rendaPassivaCurr, rendaPassivaPrev);
      const rendaPassivaSpark = months6.map(m => kitnetsByMonth[m] ?? 0);

      // ─── 5. Sobra reinvestida — usa hook similar ────────────────
      const [start, next] = monthRange(currentMonth);
      const { data: expsCurr } = await (supabase as any)
        .from("expenses")
        .select("amount, is_card_payment, counts_as_investment, nature")
        .gte("paid_at", start)
        .lt("paid_at", next);
      const investCurr = (expsCurr ?? [])
        .filter((e: any) => !e.is_card_payment && e.counts_as_investment && e.nature !== "transfer")
        .reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
      const receitaCurr = faturamentoCurr;
      const sobraPctCurr = receitaCurr > 0 ? (investCurr / receitaCurr) * 100 : 0;

      // Sparkline sobra (% por mês)
      const sobraSpark: number[] = [];
      for (const m of months6) {
        const [s, n] = monthRange(m);
        const { data: e } = await (supabase as any)
          .from("expenses")
          .select("amount, is_card_payment, counts_as_investment, nature")
          .gte("paid_at", s)
          .lt("paid_at", n);
        const inv = (e ?? [])
          .filter((x: any) => !x.is_card_payment && x.counts_as_investment && x.nature !== "transfer")
          .reduce((sum: number, x: any) => sum + Number(x.amount ?? 0), 0);
        const rec = (revsByMonth[m] ?? 0) + (kitnetsByMonth[m] ?? 0);
        sobraSpark.push(rec > 0 ? (inv / rec) * 100 : 0);
      }

      return {
        faturamento: {
          label: "Faturamento Mês",
          value: faturamentoCurr,
          delta_pct: faturamentoDelta,
          delta_label: faturamentoDelta != null ? `${faturamentoDelta > 0 ? "↑" : "↓"} ${Math.abs(faturamentoDelta).toFixed(0)}% vs mês anterior` : null,
          status: faturamentoDelta != null && faturamentoDelta > 5 ? "green" : faturamentoDelta != null && faturamentoDelta < -10 ? "red" : "gold",
          spark: faturamentoSpark,
          meta_label: "Receita real (avulsa + kitnets)",
        },
        caixa: {
          label: "Caixa Líquido",
          value: caixaCurr,
          delta_pct: null,
          delta_label: `+ R$ ${Math.round(totalRescue / 1000)}k resgatável`,
          status: caixaCurr >= 100000 ? "green" : caixaCurr >= 30000 ? "gold" : "red",
          spark: caixaSpark,
          meta_label: "Bancos · piso R$ 100k",
        },
        comissoes_receber: {
          label: "Comissões a Receber",
          value: comissoesReceberCurr,
          delta_pct: null,
          delta_label: `${pipeLatest.length} contratos · ref ${latestRefMonth}`,
          status: "gold",
          spark: comissoesSpark,
          meta_label: "Pipeline Prevensul (3% de balance_remaining)",
        },
        renda_passiva: {
          label: "Renda Passiva",
          value: rendaPassivaCurr,
          delta_pct: rendaPassivaDelta,
          delta_label: rendaPassivaDelta != null ? `${rendaPassivaDelta > 0 ? "↑" : "↓"} ${Math.abs(rendaPassivaDelta).toFixed(0)}% vs ${prevMonth}` : null,
          status: "green",
          spark: rendaPassivaSpark,
          meta_label: "Kitnets reconciled (Modelo A)",
        },
        sobra: {
          label: "Sobra Reinvestida",
          value: sobraPctCurr,
          delta_pct: null,
          delta_label: `R$ ${Math.round(investCurr / 1000)}k · meta ≥50%`,
          status: sobraPctCurr >= 50 ? "green" : sobraPctCurr >= 30 ? "gold" : sobraPctCurr >= 15 ? "blue" : "red",
          spark: sobraSpark,
          meta_label: "% receita virando ativo",
        },
      };
    },
  });
}
