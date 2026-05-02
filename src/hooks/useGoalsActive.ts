/**
 * useGoalsActive — lê metas multi-período da tabela `goals` expandida.
 *
 * Calcula current_value em runtime quando auto_calculated=true:
 * - metric=revenue: SUM(revenues + kitnet_entries reconciled) no período
 * - metric=savings/profit: receita - custeio no período
 * - metric=renda_passiva: SUM(kitnet_entries reconciled) no período
 * - metric=patrimony: snapshot manual (current_value direto)
 *
 * Usado por: CaminhoMeta (Bloco 5 do /hoje v4), GoalsPage,
 * ThreeRingsCockpit (meta receita mensal).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GoalMetric = "revenue" | "patrimony" | "savings" | "profit" | "renda_passiva" | "custom";
export type GoalPeriodType = "monthly" | "quarterly" | "semestral" | "yearly" | "3y" | "5y" | "10y" | "custom";
export type GoalStatus = "atingida" | "perto" | "no_caminho" | "atras";

export interface ActiveGoal {
  id: string;
  name: string;
  notes: string | null;
  period_type: GoalPeriodType | null;
  period_start: string | null;
  period_end: string | null;
  metric: GoalMetric | null;
  target_value: number;
  current_value: number;
  progress_pct: number;
  remaining: number;
  status: GoalStatus;
  auto_calculated: boolean;
}

function classify(pct: number): GoalStatus {
  if (pct >= 100) return "atingida";
  if (pct >= 75) return "perto";
  if (pct >= 50) return "no_caminho";
  return "atras";
}

export function useGoalsActive(filter?: {
  metric?: GoalMetric;
  period_type?: GoalPeriodType;
}) {
  return useQuery<ActiveGoal[]>({
    queryKey: ["goals_active", filter?.metric, filter?.period_type],
    queryFn: async () => {
      let q = (supabase as any).from("goals").select("*");
      if (filter?.metric) q = q.eq("metric", filter.metric);
      if (filter?.period_type) q = q.eq("period_type", filter.period_type);
      const { data, error } = await q;
      if (error) throw error;
      const goals = data ?? [];
      const out: ActiveGoal[] = [];

      for (const g of goals) {
        const target = Number(g.target_value ?? 0);
        let current = Number(g.current_value ?? 0);
        const periodStart = g.period_start;
        const periodEnd = g.period_end;
        const metric = (g.metric ?? null) as GoalMetric | null;
        const autoCalc = g.auto_calculated !== false;

        if (autoCalc && metric && periodStart && periodEnd) {
          if (metric === "revenue") {
            const [revsR, kitsR] = await Promise.all([
              (supabase as any)
                .from("revenues")
                .select("amount")
                .eq("counts_as_income", true)
                .neq("source", "aluguel_kitnets")
                .gte("received_at", periodStart)
                .lte("received_at", periodEnd),
              (supabase as any)
                .from("kitnet_entries")
                .select("total_liquid")
                .eq("reconciled", true)
                .gte("period_end", periodStart)
                .lte("period_end", periodEnd),
            ]);
            const revs = (revsR.data ?? []).reduce(
              (s: number, r: any) => s + Number(r.amount ?? 0),
              0,
            );
            const kits = (kitsR.data ?? []).reduce(
              (s: number, k: any) => s + Number(k.total_liquid ?? 0),
              0,
            );
            current = revs + kits;
          } else if (metric === "renda_passiva") {
            const { data: kits } = await (supabase as any)
              .from("kitnet_entries")
              .select("total_liquid")
              .eq("reconciled", true)
              .gte("period_end", periodStart)
              .lte("period_end", periodEnd);
            current = (kits ?? []).reduce((s: number, k: any) => s + Number(k.total_liquid ?? 0), 0);
          } else if (metric === "savings" || metric === "profit") {
            const [revsR, kitsR, expsR] = await Promise.all([
              (supabase as any)
                .from("revenues")
                .select("amount")
                .eq("counts_as_income", true)
                .neq("source", "aluguel_kitnets")
                .gte("received_at", periodStart)
                .lte("received_at", periodEnd),
              (supabase as any)
                .from("kitnet_entries")
                .select("total_liquid")
                .eq("reconciled", true)
                .gte("period_end", periodStart)
                .lte("period_end", periodEnd),
              (supabase as any)
                .from("expenses")
                .select("amount, is_card_payment, counts_as_investment, nature")
                .gte("paid_at", periodStart)
                .lte("paid_at", periodEnd),
            ]);
            const revTotal =
              (revsR.data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0) +
              (kitsR.data ?? []).reduce((s: number, k: any) => s + Number(k.total_liquid ?? 0), 0);
            const custeio = (expsR.data ?? [])
              .filter((e: any) => !e.is_card_payment && !e.counts_as_investment && e.nature !== "transfer")
              .reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
            current = revTotal - custeio;
          }
        }

        const pct = target > 0 ? (current / target) * 100 : 0;
        out.push({
          id: g.id,
          name: g.name,
          notes: g.notes,
          period_type: g.period_type,
          period_start: g.period_start,
          period_end: g.period_end,
          metric,
          target_value: target,
          current_value: current,
          progress_pct: pct,
          remaining: target - current,
          status: classify(pct),
          auto_calculated: autoCalc,
        });
      }

      return out;
    },
  });
}

/**
 * Helper pra pegar a goal atual de receita mensal — usado no
 * ThreeRingsCockpit pra anel dourado.
 */
export function useMonthlyRevenueGoal(month?: string) {
  return useQuery<{ target: number; goal: ActiveGoal | null }>({
    queryKey: ["monthly_revenue_goal", month],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("goals")
        .select("*")
        .or("metric.eq.revenue,type.eq.monthly_revenue")
        .or("period_type.eq.monthly,period_type.eq.yearly,period_type.is.null");
      const goals = data ?? [];

      // Priority: goal com period_type=monthly ativa cobrindo o mês
      const refDate = month ? `${month}-15` : new Date().toISOString().slice(0, 10);

      const monthlyGoal = goals.find(
        (g: any) =>
          g.period_type === "monthly" &&
          g.period_start &&
          g.period_end &&
          g.period_start <= refDate &&
          g.period_end >= refDate &&
          g.metric === "revenue",
      );
      if (monthlyGoal) {
        return {
          target: Number(monthlyGoal.target_value ?? 85000),
          goal: monthlyGoal,
        };
      }

      // Fallback: goal anual / 12
      const yearlyGoal = goals.find(
        (g: any) =>
          g.period_type === "yearly" &&
          g.period_start &&
          g.period_end &&
          g.period_start <= refDate &&
          g.period_end >= refDate &&
          g.metric === "revenue",
      );
      if (yearlyGoal) {
        return {
          target: Number(yearlyGoal.target_value ?? 85000 * 12) / 12,
          goal: yearlyGoal,
        };
      }

      // Fallback antigo (compat)
      return { target: 85000, goal: null };
    },
  });
}
