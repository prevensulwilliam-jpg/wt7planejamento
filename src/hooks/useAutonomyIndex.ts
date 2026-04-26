import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isReconciledKitnetEntry, isActualIncomeRevenue } from "@/lib/financialPredicates";

export type AutonomySnapshot = {
  month: string;
  active: number;      // PREVENSUL (renda ativa)
  passive: number;     // KITNETS + outros negócios recorrentes não-Prevensul
  eventual: number;    // OUTROS / eventuais
  total: number;       // active + passive + eventual
  autonomyPct: number; // (passive + eventual) / total * 100
  target: number;      // soma das monthly_target dos negócios
};

// ─── Núcleo: calcula um snapshot pro mês dado ───────────────────────
async function computeSnapshot(month: string): Promise<AutonomySnapshot> {
  // 1) Businesses (pra mapa id → code, pra saber o que é ativo/passivo)
  const { data: bizs } = await (supabase as any)
    .from("businesses")
    .select("id, code, monthly_target, category");
  const bizById = new Map<string, { code: string; category: string; target: number }>();
  (bizs ?? []).forEach((b: any) => {
    bizById.set(b.id, { code: b.code, category: b.category, target: Number(b.monthly_target ?? 0) });
  });

  // Target total do mês
  const target = (bizs ?? []).reduce((s: number, b: any) => s + Number(b.monthly_target ?? 0), 0);

  // 2) Realizado por business (espelha useBusinessRealized)
  const realized = new Map<string, number>();

  // 2a) Kitnets via kitnet_entries — Modelo A (só fechamentos reconciliados)
  const kitnetBiz = (bizs ?? []).find((b: any) => b.code === "KITNETS");
  if (kitnetBiz) {
    const { data: entries } = await (supabase as any)
      .from("kitnet_entries")
      .select("total_liquid, reconciled")
      .eq("reference_month", month);
    const total = (entries ?? [])
      .filter(isReconciledKitnetEntry)
      .reduce((s: number, e: any) => s + Number(e.total_liquid ?? 0), 0);
    realized.set(kitnetBiz.id, total);
  }

  // 2b) Demais via revenues (exceto KITNETS pra não duplicar) — exclui entradas neutras
  const { data: revs } = await (supabase as any)
    .from("revenues")
    .select("business_id, amount, counts_as_income")
    .eq("reference_month", month)
    .not("business_id", "is", null);
  (revs ?? []).filter(isActualIncomeRevenue).forEach((r: any) => {
    if (!r.business_id || r.business_id === kitnetBiz?.id) return;
    realized.set(r.business_id, (realized.get(r.business_id) ?? 0) + Number(r.amount ?? 0));
  });

  // 2c) Override manual
  const { data: manual } = await (supabase as any)
    .from("business_revenue_entries")
    .select("business_id, amount_william")
    .eq("reference_month", month);
  (manual ?? []).forEach((m: any) => {
    realized.set(m.business_id, Number(m.amount_william ?? 0));
  });

  // 3) Classifica: PREVENSUL = active; KITNETS + recorrentes não-Prevensul = passive; OUTROS/incubado = eventual
  let active = 0, passive = 0, eventual = 0;
  realized.forEach((amount, bizId) => {
    const b = bizById.get(bizId);
    if (!b) { eventual += amount; return; }
    if (b.code === "PREVENSUL") active += amount;
    else if (b.code === "OUTROS" || b.category === "incubado") eventual += amount;
    else passive += amount;
  });

  const total = active + passive + eventual;
  const autonomyPct = total > 0 ? ((passive + eventual) / total) * 100 : 0;

  return { month, active, passive, eventual, total, autonomyPct, target };
}

// ─── Hook: snapshot do mês atual ───────────────────────────────────
export function useAutonomyIndex(month: string) {
  return useQuery({
    queryKey: ["autonomy_index", month],
    queryFn: () => computeSnapshot(month),
  });
}

// ─── Hook: histórico dos últimos N meses (pro gráfico de evolução) ─
export function useAutonomyHistory(monthsBack: number = 12, refMonth?: string) {
  const ref = refMonth ?? new Date().toISOString().slice(0, 7);
  return useQuery({
    queryKey: ["autonomy_history", ref, monthsBack],
    queryFn: async () => {
      const [y, m] = ref.split("-").map(Number);
      const months: string[] = [];
      for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(y, m - 1 - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      const snapshots = await Promise.all(months.map(computeSnapshot));
      return snapshots;
    },
  });
}
