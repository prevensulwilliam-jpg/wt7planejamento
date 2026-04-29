import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDashboardKPIs, useGoals } from "./useFinances";
import { useKitnets, useKitnetSummary } from "./useKitnets";
import { usePrevensulBilling } from "./useBilling";
import { useSobraReinvestida, SOBRA_META_PCT } from "./useSobraReinvestida";
import { getCurrentMonth, formatMonth } from "@/lib/formatters";
import { callNaval } from "@/lib/naval";
import { supabase } from "@/integrations/supabase/client";

/**
 * Memória permanente do Naval — mesmos arquivos .md que o Claude Code carrega
 * via @memoria/*.md. Sincronizada via scripts/sync-naval-memory.ts.
 * Sem esse hook, Naval perde contexto entre sessões.
 */
export function useNavalMemory() {
  return useQuery({
    queryKey: ["naval_memory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("naval_memory")
        .select("slug,title,content,priority")
        .order("priority", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

const NAVAL_FALLBACK_ERROR = "Erro ao conectar com o Naval. Tente novamente.";

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : NAVAL_FALLBACK_ERROR;
}

export function useNavalContext() {
  const month = getCurrentMonth();
  const kpis = useDashboardKPIs(month);
  const { data: kitnets } = useKitnets();
  const summary = useKitnetSummary(month);
  const { data: goals } = useGoals();
  const { data: billing } = usePrevensulBilling(month);
  const { data: memory } = useNavalMemory();
  const { data: sobra } = useSobraReinvestida(month);

  const isReady = !kpis.isLoading;

  const context = useMemo(
    () =>
      isReady
        ? {
            month: formatMonth(month),
            monthKey: month,
            // IMPORTANTE: totalRevenue = SÓ receita real (counts_as_income=true)
            //   + aluguéis kitnets (Modelo A — kitnet_entries.total_liquid).
            // totalExpenses = custeio_total da Sobra Reinvestida (custeio_expenses
            //   + custeio_cartao). NÃO usar kpis.totalExpenses, que ignora cartões
            //   (~74% do custo de vida do William vai por cartões BB+XP).
            // Transferências, reembolsos e estornos estão em entradasNeutras e NÃO
            // contam no denominador da Sobra Reinvestida.
            totalRevenue: kpis.totalRevenue,
            totalExpenses: sobra ? sobra.custeio_total : kpis.totalExpenses,
            netResult: kpis.totalRevenue - (sobra ? sobra.custeio_total : kpis.totalExpenses),
            revenueBySource: kpis.revenueBySource,
            expenseByCategory: kpis.expenseByCategory,
            sobraReinvestida: sobra
              ? {
                  receitaReal: sobra.receita,
                  entradasNeutras: sobra.entradas_neutras,
                  custeioTotal: sobra.custeio_total,
                  investimentoTotal: sobra.investimento_total,
                  sobraBruta: sobra.sobra_bruta,
                  sobraPct: Math.round(sobra.sobra_pct * 10) / 10,
                  investidoPct: Math.round(sobra.investido_pct * 10) / 10,
                  metaPct: SOBRA_META_PCT,
                  gapMeta: sobra.gap_meta,
                  byVector: sobra.byVector,
                  cardPaymentsIgnored: sobra.card_payments_ignored,
                }
              : null,
            kitnets: {
              totalKitnets: kitnets?.length ?? 13,
              occupied: summary.occupied,
              total: summary.total,
              vacant: summary.vacant,
              totalRent: summary.totalReceived,
            },
            goals: (goals ?? []).map((g) => ({
              name: g.name,
              current: g.current_value,
              target: g.target_value,
              pct: g.target_value
                ? Math.round(((g.current_value ?? 0) / g.target_value) * 100)
                : 0,
            })),
            prevensulBilling: {
              totalReceived: (billing ?? []).reduce(
                (s, r) => s + (r.amount_paid ?? 0),
                0,
              ),
              totalCommission: (billing ?? []).reduce(
                (s, r) => s + (r.commission_value ?? 0),
                0,
              ),
              records: billing?.length ?? 0,
            },
            memory: (memory ?? []).map((m) => ({
              slug: m.slug,
              title: m.title,
              content: m.content,
            })),
          }
        : null,
    [
      isReady,
      month,
      kpis.totalRevenue,
      kpis.totalExpenses,
      kpis.netResult,
      kpis.revenueBySource,
      kpis.expenseByCategory,
      kitnets,
      summary.occupied,
      summary.total,
      summary.vacant,
      summary.totalReceived,
      goals,
      billing,
      memory,
      sobra,
    ],
  );

  return { context, isReady };
}

export function useNavalAnalysis(autoGenerate: boolean = false) {
  const { context, isReady } = useNavalContext();
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const generated = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const generate = useCallback(
    async (customPrompt?: string) => {
      if (!context || !mounted.current) return;
      setLoading(true);
      try {
        const prompt =
          customPrompt ??
          `Analise os dados financeiros de ${context.month} e me dê:\n1. Os 2 pontos mais positivos do mês\n2. Os 2 alertas ou oportunidades de melhoria\n3. 1 ação prioritária que devo tomar esta semana\n\nREGRAS CANÔNICAS:\n- totalRevenue = SÓ receita real. Entradas neutras (transferência/reembolso/estorno) estão em sobraReinvestida.entradasNeutras e NÃO contam no cálculo.\n- Meta canônica: investidoPct ≥ ${SOBRA_META_PCT}% (memoria/metas.md). Se estiver abaixo, sinalize o gap em R$.\n- Se houver entradasNeutras relevantes, mencione explicitamente ("ignoradas R$ X em reembolsos/transferências, que virarão despesa no cartão").\n\nDados do mês:\n${JSON.stringify(context, null, 2)}`;
        const text = await callNaval([{ role: "user", content: prompt }]);
        if (mounted.current) {
          setAnalysis(text);
          generated.current = true;
        }
      } catch (error) {
        console.error("Naval error:", error);
        if (mounted.current) setAnalysis(getErrorMessage(error));
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [context],
  );

  // Só dispara automaticamente se autoGenerate=true. Default false → user
  // clica pra carregar (economiza tokens da IA + cache hit não é gasto).
  useEffect(() => {
    if (!autoGenerate) return;
    if (!isReady || !context || generated.current) return;
    generated.current = true;
    void generate();
  }, [autoGenerate, isReady, context, generate]);

  return { analysis, loading, generate, context, hasGenerated: generated.current };
}

type ChatMsg = { role: "user" | "assistant"; content: string };

export function useNavalChat() {
  const { context } = useNavalContext();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);

  const send = useCallback(
    async (input: string) => {
      if (!context) return;
      const userMsg: ChatMsg = { role: "user", content: input };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      try {
        const contextMsg = `Contexto financeiro atual (${context.month}):\n${JSON.stringify(context, null, 2)}`;
        const allMsgs = [
          { role: "user", content: contextMsg },
          ...messages,
          userMsg,
        ];
        const text = await callNaval(allMsgs);
        setMessages((prev) => [...prev, { role: "assistant", content: text }]);
        // edge function salvou em naval_chats → invalida histórico pra refletir
        qc.invalidateQueries({ queryKey: ["naval_chats"] });
      } catch (error) {
        console.error("Naval chat error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: getErrorMessage(error),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [context, messages, qc],
  );

  return { messages, loading, send };
}

export function useNavalInsight(topic: string, prompt: string, autoGenerate: boolean = false) {
  const { context, isReady } = useNavalContext();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const generated = useRef(false);

  const generate = useCallback(() => {
    if (!isReady || !context) return;
    generated.current = true;
    setLoading(true);
    const fullPrompt = `${prompt}\n\nDados: ${JSON.stringify(context, null, 2)}`;
    callNaval([{ role: "user", content: fullPrompt }])
      .then((responseText) => setText(responseText))
      .catch((error) => setText(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [isReady, context, prompt]);

  useEffect(() => {
    if (!autoGenerate) return;
    if (!isReady || !context || generated.current) return;
    generate();
  }, [autoGenerate, isReady, context, generate]);

  return { text, loading, generate, hasGenerated: generated.current };
}
