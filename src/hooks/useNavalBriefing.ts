/**
 * useNavalBriefing — Briefing diário do /hoje v4.
 *
 * Estratégia (decisão #4):
 *   - 6 cascatas testadas DETERMINISTICAMENTE em JS local (não custa Naval call)
 *   - Identifica a cascata ATIVA com maior severidade
 *   - Naval gera narrativa SÓ da cascata escolhida
 *   - Cache 24h em naval_chats (evita custar token toda visita)
 *   - Botão refresh manual pra regenerar
 *
 * Cascatas (ordem hierárquica):
 *   1. Faturamento atrasado vs histórico
 *   2. Caixa fechamento aperta
 *   3. Projeção anual atrás do ritmo
 *   4. Capital ocioso (sobra parada)
 *   5. Aporte obra agendado
 *   6. Prevensul caiu vs média 6m  ← MAIS GRAVE
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callNaval } from "@/lib/naval";

export type CascadeId = 1 | 2 | 3 | 4 | 5 | 6;

export interface CascadeStatus {
  id: CascadeId;
  title: string;
  active: boolean;
  severity: "info" | "warning" | "critical";
  context?: string;          // detalhe usado na geração da narrativa
  metric_value?: number;
}

export interface BriefingResult {
  active_cascades: CascadeStatus[];
  chosen: CascadeStatus | null;
  narrative: string | null;          // gerada por Naval (cacheada)
  generated_at: string | null;
  expires_at: string | null;         // expira após 24h
  is_stale: boolean;
}

const CACHE_KEY = "naval_briefing";
const CACHE_TTL_HOURS = 24;

async function evaluateCascades(): Promise<CascadeStatus[]> {
  const today = new Date();
  const monthStr = today.toISOString().slice(0, 7);
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    return d.toISOString().slice(0, 7);
  });

  // ─── Pega dados base ────────────────────────────────────────────
  const [
    revsR,
    kitsR,
    expsR,
    banksR,
    pipeR,
    obrasAportes,
  ] = await Promise.all([
    (supabase as any).from("revenues")
      .select("amount, reference_month, source, counts_as_income")
      .in("reference_month", last6Months),
    (supabase as any).from("kitnet_entries")
      .select("total_liquid, reference_month, reconciled")
      .in("reference_month", last6Months),
    (supabase as any).from("expenses")
      .select("amount, reference_month, counts_as_investment, is_card_payment, nature")
      .in("reference_month", last6Months),
    (supabase as any).from("bank_accounts").select("balance"),
    (supabase as any).from("prevensul_billing")
      .select("balance_remaining, commission_rate, reference_month")
      .gt("balance_remaining", 0),
    (supabase as any).from("construction_expenses")
      .select("william_amount, expense_date, construction_id")
      .gte("expense_date", today.toISOString().slice(0, 10))
      .lte("expense_date", new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10)),
  ]);

  // Receita por mês
  const revByMonth: Record<string, number> = {};
  const kitByMonth: Record<string, number> = {};
  const fatByMonth: Record<string, number> = {};
  for (const m of last6Months) { revByMonth[m] = 0; kitByMonth[m] = 0; fatByMonth[m] = 0; }
  for (const r of revsR.data ?? []) {
    if (r.counts_as_income !== false && r.source !== "aluguel_kitnets") {
      revByMonth[r.reference_month] = (revByMonth[r.reference_month] ?? 0) + Number(r.amount ?? 0);
    }
  }
  for (const k of kitsR.data ?? []) {
    if (k.reconciled) {
      kitByMonth[k.reference_month] = (kitByMonth[k.reference_month] ?? 0) + Number(k.total_liquid ?? 0);
    }
  }
  for (const m of last6Months) fatByMonth[m] = (revByMonth[m] ?? 0) + (kitByMonth[m] ?? 0);

  const fatCurrent = fatByMonth[monthStr] ?? 0;
  const fatHistorico = (last6Months
    .filter(m => m !== monthStr)
    .reduce((s, m) => s + (fatByMonth[m] ?? 0), 0)) / 5;

  // Caixa
  const totalCaixa = (banksR.data ?? []).reduce((s: number, b: any) => s + Number(b.balance ?? 0), 0);

  // Pipeline
  const latestRefMonth = (pipeR.data ?? []).reduce(
    (m: string, p: any) => (p.reference_month > m ? p.reference_month : m),
    "",
  );
  const pipeLatest = (pipeR.data ?? []).filter((p: any) => p.reference_month === latestRefMonth);
  const totalPipelineFuturo = pipeLatest.reduce(
    (s: number, p: any) => s + Number(p.balance_remaining ?? 0) * Number(p.commission_rate ?? 0.03),
    0,
  );

  // Comissões Prevensul histórico (separado do total)
  const prevHistByMonth: Record<string, number> = {};
  for (const m of last6Months) prevHistByMonth[m] = 0;
  for (const r of revsR.data ?? []) {
    if (r.source === "comissao_prevensul" && r.reference_month) {
      prevHistByMonth[r.reference_month] = (prevHistByMonth[r.reference_month] ?? 0) + Number(r.amount ?? 0);
    }
  }
  const prevAvg6m = (Object.values(prevHistByMonth).reduce((s, v) => s + v, 0)) / 6;
  const prevCurrent = prevHistByMonth[monthStr] ?? 0;

  // Sobra parada (caixa - receita média mensal × 1.5 = "necessário operacional")
  const necessidadeOpercional = fatHistorico * 1.5;
  const sobraParada = Math.max(0, totalCaixa - necessidadeOpercional);

  // ─── Avalia 6 cascatas ──────────────────────────────────────────
  const cascades: CascadeStatus[] = [
    {
      id: 1,
      title: "Faturamento atrasado vs histórico",
      active: fatHistorico > 0 && fatCurrent < fatHistorico * 0.8,
      severity: "warning",
      metric_value: fatHistorico > 0 ? (fatCurrent / fatHistorico) * 100 - 100 : 0,
      context: `fat atual ${fatCurrent.toFixed(0)} vs histórico ${fatHistorico.toFixed(0)}`,
    },
    {
      id: 2,
      title: "Caixa fim de mês aperta",
      active: totalCaixa < 100000,
      severity: "warning",
      metric_value: totalCaixa,
      context: `caixa hoje ${totalCaixa.toFixed(0)} (piso R$100k)`,
    },
    {
      id: 3,
      title: "Projeção anual atrás do ritmo",
      active: false, // calculado no Naval call quando precisar (depende de goal)
      severity: "info",
      context: "lendo goal anual...",
    },
    {
      id: 4,
      title: "Capital ocioso (sobra parada)",
      active: sobraParada > 20000,
      severity: "info",
      metric_value: sobraParada,
      context: `R$ ${sobraParada.toFixed(0)} de sobra acima do operacional`,
    },
    {
      id: 5,
      title: "Aporte obra agendado próximos 14 dias",
      active: (obrasAportes.data ?? []).length > 0,
      severity: "info",
      metric_value: (obrasAportes.data ?? []).reduce((s: number, e: any) => s + Number(e.william_amount ?? 0), 0),
      context: `${(obrasAportes.data ?? []).length} aportes próximos`,
    },
    {
      id: 6,
      title: "Prevensul caiu vs média 6m",
      active: prevAvg6m > 0 && prevCurrent < prevAvg6m * 0.7,
      severity: "critical",
      metric_value: prevAvg6m > 0 ? (prevCurrent / prevAvg6m) * 100 - 100 : 0,
      context: `prev atual ${prevCurrent.toFixed(0)} vs avg6m ${prevAvg6m.toFixed(0)}`,
    },
  ];

  return cascades;
}

function pickHighestSeverity(cascades: CascadeStatus[]): CascadeStatus | null {
  const active = cascades.filter(c => c.active);
  if (active.length === 0) return null;
  const order = { critical: 0, warning: 1, info: 2 };
  return [...active].sort(
    (a, b) => (order[a.severity] - order[b.severity]) || (b.id - a.id),
  )[0];
}

export function useNavalBriefing() {
  const qc = useQueryClient();

  return useQuery<BriefingResult>({
    queryKey: ["naval_briefing"],
    queryFn: async () => {
      // 1. Avalia cascatas (sempre fresh)
      const cascades = await evaluateCascades();
      const chosen = pickHighestSeverity(cascades);

      // 2. Tenta cache em naval_chats (entry com question='__briefing__')
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: cached } = await (supabase as any)
        .from("naval_chats")
        .select("answer, created_at")
        .eq("question", "__briefing__")
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        const generatedAt = cached.created_at;
        const expiresAt = new Date(new Date(generatedAt).getTime() + CACHE_TTL_HOURS * 3600 * 1000).toISOString();
        const isStale = new Date(expiresAt) < new Date();
        return {
          active_cascades: cascades.filter(c => c.active),
          chosen,
          narrative: cached.answer,
          generated_at: generatedAt,
          expires_at: expiresAt,
          is_stale: isStale,
        };
      }

      // Sem cache → cascade vazio retorna sem chamar Naval
      if (!chosen) {
        return {
          active_cascades: [],
          chosen: null,
          narrative: null,
          generated_at: null,
          expires_at: null,
          is_stale: false,
        };
      }

      return {
        active_cascades: cascades.filter(c => c.active),
        chosen,
        narrative: null, // será gerada via mutation refreshBriefing()
        generated_at: null,
        expires_at: null,
        is_stale: true,
      };
    },
    staleTime: 5 * 60_000, // 5 min
  });
}

export function useRefreshBriefing() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const cascades = await evaluateCascades();
      const chosen = pickHighestSeverity(cascades);
      if (!chosen) {
        return { ok: true, message: "Nenhuma cascata ativa hoje. Nenhum briefing gerado." };
      }

      // Pede narrativa pro Naval
      const prompt =
        `Gere um briefing matinal CURTO (3-4 frases, máx 60 palavras) sobre a situação:\n\n` +
        `**Cascata ativa #${chosen.id}: ${chosen.title}**\n` +
        `Severidade: ${chosen.severity}\n` +
        `Contexto: ${chosen.context}\n\n` +
        `Tom: direto, executivo, sem floreio. Mostra o problema, impacto em R$ ou %, e próxima ação concreta. ` +
        `NÃO use markdown estruturado (sem listas, sem títulos). Texto contínuo. ` +
        `NÃO mencione 'cascata' nem números técnicos. Apresente como insight estratégico.`;

      const text = await callNaval([{ role: "user", content: prompt }]);
      const narrative = text || "Briefing indisponível agora.";

      // Salva em naval_chats com question=__briefing__
      await (supabase as any).from("naval_chats").insert({
        question: "__briefing__",
        answer: narrative,
        tools_used: ["briefing_cascades"],
      });

      qc.invalidateQueries({ queryKey: ["naval_briefing"] });
      return { ok: true, narrative };
    },
  });
}
