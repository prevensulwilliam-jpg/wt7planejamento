import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useDashboardKPIs, useGoals } from "./useFinances";
import { useKitnets, useKitnetSummary } from "./useKitnets";
import { usePrevensulBilling } from "./useBilling";
import { getCurrentMonth, formatMonth } from "@/lib/formatters";
import { callNaval } from "@/lib/naval";

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

  const isReady = !kpis.isLoading;

  const context = useMemo(
    () =>
      isReady
        ? {
            month: formatMonth(month),
            monthKey: month,
            totalRevenue: kpis.totalRevenue,
            totalExpenses: kpis.totalExpenses,
            netResult: kpis.netResult,
            revenueBySource: kpis.revenueBySource,
            expenseByCategory: kpis.expenseByCategory,
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
    ],
  );

  return { context, isReady };
}

export function useNavalAnalysis() {
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
          `Analise os dados financeiros de ${context.month} e me dê:\n1. Os 2 pontos mais positivos do mês\n2. Os 2 alertas ou oportunidades de melhoria\n3. 1 ação prioritária que devo tomar esta semana\n\nDados do mês:\n${JSON.stringify(context, null, 2)}`;
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

  useEffect(() => {
    if (!isReady || !context || generated.current) return;
    generated.current = true;
    void generate();
  }, [isReady, context, generate]);

  return { analysis, loading, generate, context };
}

type ChatMsg = { role: "user" | "assistant"; content: string };

export function useNavalChat() {
  const { context } = useNavalContext();
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
    [context, messages],
  );

  return { messages, loading, send };
}

export function useNavalInsight(topic: string, prompt: string) {
  const { context, isReady } = useNavalContext();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const generated = useRef(false);

  useEffect(() => {
    if (!isReady || !context || generated.current) return;
    generated.current = true;
    setLoading(true);
    const fullPrompt = `${prompt}\n\nDados: ${JSON.stringify(context, null, 2)}`;
    callNaval([{ role: "user", content: fullPrompt }])
      .then((responseText) => setText(responseText))
      .catch((error) => setText(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [isReady, context, prompt, topic]);

  return { text, loading };
}
