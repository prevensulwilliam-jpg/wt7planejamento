import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CashFlowItem, CashFlowFlowType } from "./useCashFlow";

// ─── Cash Flow Auto-Match ───
// Busca itens projetados em cash_flow_items que possam corresponder
// a um expense ou revenue recém-criado, usando valor + mês como chave.
//
// Regra (validada com William 24/04/2026):
//   "Relacione pelo VALOR, não pela descrição."
//
// Algoritmo de score:
//   - Mesmo mês + valor exato         → 100
//   - Mesmo mês + valor ±1%           → 95
//   - Mesmo mês + valor ±5% ou ±R$5   → 80
//   - Mês adjacente + valor exato     → 70
//   - Mês adjacente + valor ±5%       → 50
// Score mínimo aceito: 50.

export interface CashFlowMatch {
  item: CashFlowItem;
  score: number;
  reason: string;
}

export type FlowDirection = "outflow" | "inflow_income" | "inflow_transfer";

const FLOW_TYPE_BY_DIRECTION: Record<FlowDirection, CashFlowFlowType[]> = {
  outflow: ["expense_extra", "cost_of_living"],
  inflow_income: ["income"],
  inflow_transfer: ["transfer_in"],
};

function adjacentMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function scoreMatch(
  item: CashFlowItem,
  amount: number,
  refMonth: string
): { score: number; reason: string } | null {
  const itemAmount = Number(item.amount);
  const diffPct = Math.abs(amount - itemAmount) / Math.max(itemAmount, 1);
  const diffAbs = Math.abs(amount - itemAmount);
  const sameMonth = item.reference_month === refMonth;
  const adjMonth =
    item.reference_month === adjacentMonth(refMonth, -1) ||
    item.reference_month === adjacentMonth(refMonth, 1);

  if (sameMonth && diffAbs < 0.01) return { score: 100, reason: "Mesmo mês + valor exato" };
  if (sameMonth && diffPct <= 0.01) return { score: 95, reason: "Mesmo mês + diferença <1%" };
  if (sameMonth && (diffPct <= 0.05 || diffAbs <= 5)) return { score: 80, reason: "Mesmo mês + diferença <5%" };
  if (adjMonth && diffAbs < 0.01) return { score: 70, reason: "Mês adjacente + valor exato" };
  if (adjMonth && (diffPct <= 0.05 || diffAbs <= 5)) return { score: 50, reason: "Mês adjacente + diferença <5%" };

  return null;
}

export function useFindCashFlowMatches(params: {
  amount: number | null;
  refMonth: string | null;
  direction: FlowDirection | null;
  enabled?: boolean;
}) {
  const { amount, refMonth, direction, enabled = true } = params;

  return useQuery({
    queryKey: ["cash_flow_matches", amount, refMonth, direction],
    enabled: enabled && amount != null && refMonth != null && direction != null,
    queryFn: async (): Promise<CashFlowMatch[]> => {
      if (amount == null || refMonth == null || direction == null) return [];

      const allowedFlowTypes = FLOW_TYPE_BY_DIRECTION[direction];

      // Janela de 3 meses (anterior, atual, próximo) e status 'projected' ou 'confirmed'
      const monthsToSearch = [
        adjacentMonth(refMonth, -1),
        refMonth,
        adjacentMonth(refMonth, 1),
      ];

      const { data, error } = await (supabase as any)
        .from("cash_flow_items")
        .select("*")
        .in("reference_month", monthsToSearch)
        .in("flow_type", allowedFlowTypes)
        .in("status", ["projected", "confirmed"]);

      if (error) throw error;

      const matches: CashFlowMatch[] = [];
      for (const item of (data ?? []) as CashFlowItem[]) {
        const result = scoreMatch(item, amount, refMonth);
        if (result) {
          matches.push({ item, score: result.score, reason: result.reason });
        }
      }

      // Ordena por score descendente
      return matches.sort((a, b) => b.score - a.score);
    },
  });
}

// Versão imperativa (sem React Query) — útil pra disparar dentro de mutations
export async function findCashFlowMatchesNow(
  amount: number,
  refMonth: string,
  direction: FlowDirection
): Promise<CashFlowMatch[]> {
  const allowedFlowTypes = FLOW_TYPE_BY_DIRECTION[direction];
  const monthsToSearch = [
    adjacentMonth(refMonth, -1),
    refMonth,
    adjacentMonth(refMonth, 1),
  ];

  const { data, error } = await (supabase as any)
    .from("cash_flow_items")
    .select("*")
    .in("reference_month", monthsToSearch)
    .in("flow_type", allowedFlowTypes)
    .in("status", ["projected", "confirmed"]);

  if (error) throw error;

  const matches: CashFlowMatch[] = [];
  for (const item of (data ?? []) as CashFlowItem[]) {
    const result = scoreMatch(item, amount, refMonth);
    if (result) {
      matches.push({ item, score: result.score, reason: result.reason });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}
