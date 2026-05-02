import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const log = logger.scope("autoPromoteRecurring");

/**
 * Auto-promoção de despesas variáveis → recorrentes.
 *
 * Após cada classificação manual de despesa, verifica se a mesma categoria
 * aparece em 3+ meses distintos nos últimos 6 meses.
 * Se sim, cria uma recurring_bill com auto_promoted: true.
 *
 * Regras:
 * - Só despesas (intent === "despesa")
 * - Ignora categorias genéricas ("outros", "transferencia")
 * - Valor médio das ocorrências ± 15% de tolerância
 * - Dia mais frequente de ocorrência como due_day
 * - Não cria se já existe recurring_bill ativa com mesmo nome/categoria
 */
export async function checkRecurrencePromotion(
  description: string,
  category: string,
  amount: number,
): Promise<{ promoted: boolean; name?: string; dueDay?: number; avgAmount?: number } | null> {
  // Categorias ignoradas
  const IGNORED = ["outros", "transferencia", "outros_receita"];
  if (IGNORED.includes(category)) return null;

  try {
    // 1. Buscar despesas matched dos últimos 6 meses com mesma categoria
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startDate = sixMonthsAgo.toISOString().split("T")[0];

    const { data: txs } = await supabase
      .from("bank_transactions" as any)
      .select("amount, date, description, category_confirmed")
      .eq("status", "matched")
      .eq("category_intent", "despesa")
      .eq("category_confirmed", category)
      .gte("date", startDate);

    if (!txs?.length) return null;

    // 2. Agrupar por mês
    const byMonth = new Map<string, any[]>();
    for (const tx of txs as any[]) {
      const month = tx.date?.slice(0, 7);
      if (!month) continue;
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(tx);
    }

    // 3. Precisa de 3+ meses distintos
    if (byMonth.size < 3) return null;

    // 4. Calcular valor médio e dia mais frequente
    const allAmounts = (txs as any[]).map(t => Math.abs(t.amount));
    const avgAmount = allAmounts.reduce((s, a) => s + a, 0) / allAmounts.length;

    // Verificar se valores são consistentes (desvio < 30% da média)
    const maxDeviation = allAmounts.reduce((max, a) => Math.max(max, Math.abs(a - avgAmount) / avgAmount), 0);
    if (maxDeviation > 0.30) return null; // valores muito variáveis, não promover

    // Dia mais frequente
    const dayCounts = new Map<number, number>();
    for (const tx of txs as any[]) {
      const day = parseInt(tx.date?.split("-")[2] ?? "1");
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }
    let bestDay = 1;
    let bestCount = 0;
    for (const [day, count] of dayCounts) {
      if (count > bestCount) {
        bestDay = day;
        bestCount = count;
      }
    }

    // 5. Verificar se já existe recurring_bill com esta categoria
    const { data: existing } = await supabase
      .from("recurring_bills" as any)
      .select("id")
      .eq("category", category)
      .eq("active", true);

    if (existing?.length) return null; // já existe

    // 6. Gerar nome descritivo a partir da descrição mais comum
    const descCounts = new Map<string, number>();
    for (const tx of txs as any[]) {
      const desc = (tx.description ?? "").trim();
      if (!desc) continue;
      descCounts.set(desc, (descCounts.get(desc) ?? 0) + 1);
    }
    let bestDesc = description;
    let bestDescCount = 0;
    for (const [desc, count] of descCounts) {
      if (count > bestDescCount) {
        bestDesc = desc;
        bestDescCount = count;
      }
    }

    // Limpar nome — pegar parte mais legível
    const cleanName = bestDesc.length > 40 ? bestDesc.slice(0, 40).trim() + "…" : bestDesc;

    // 7. Criar recurring_bill auto-promovida
    const { error } = await supabase
      .from("recurring_bills" as any)
      .insert({
        name: cleanName,
        category,
        amount: Math.round(avgAmount * 100) / 100,
        due_day: bestDay,
        frequency: "monthly",
        is_fixed: false, // variável — valor pode oscilar
        auto_promoted: true,
        active: true,
        notes: `Auto-detectado: ${byMonth.size} meses, valor médio R$${avgAmount.toFixed(2)}, dia ${bestDay}`,
      } as any);

    if (error) {
      log.error("Erro ao auto-promover recorrente", error);
      return null;
    }

    return {
      promoted: true,
      name: cleanName,
      dueDay: bestDay,
      avgAmount: Math.round(avgAmount * 100) / 100,
    };
  } catch (err) {
    log.error("Erro em checkRecurrencePromotion", err);
    return null;
  }
}
