import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardKPIs, useGoals } from "./useFinances";
import { useKitnets, useKitnetSummary } from "./useKitnets";
import { usePrevensulBilling } from "./useBilling";
import { getCurrentMonth, formatMonth } from "@/lib/formatters";

export function useNavalContext() {
  const month = getCurrentMonth();
  const kpis = useDashboardKPIs(month);
  const { data: kitnets } = useKitnets();
  const summary = useKitnetSummary(month);
  const { data: goals } = useGoals();
  const { data: billing } = usePrevensulBilling(month);

  const isReady = !kpis.isLoading;

  const context = isReady
    ? {
        month: formatMonth(month),
        monthKey: month,
        totalRevenue: kpis.totalRevenue,
        totalExpenses: kpis.totalExpenses,
        netResult: kpis.netResult,
        revenueBySource: kpis.revenueBySource,
        expenseByCategory: kpis.expenseByCategory,
        kitnets: {
          total: kitnets?.length ?? 13,
          occupied: summary.occupied,
          maintenance: summary.maintenance,
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
            0
          ),
          totalCommission: (billing ?? []).reduce(
            (s, r) => s + (r.commission_value ?? 0),
            0
          ),
          records: billing?.length ?? 0,
        },
      }
    : null;

  return { context, isReady };
}

async function callNaval(
  messages: { role: string; content: string }[]
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("wisely-ai", {
    body: { messages, stream: false },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.text ?? "";
}

export function useNavalAnalysis() {
  const { context, isReady } = useNavalContext();
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const generated = useRef(false);

  const generate = useCallback(
    async (customPrompt?: string) => {
      if (!context) return;
      setLoading(true);
      try {
        const prompt =
          customPrompt ??
          `Analise os dados financeiros de ${context.month} e me dê:\n1. Os 2 pontos mais positivos do mês\n2. Os 2 alertas ou oportunidades de melhoria\n3. 1 ação prioritária que devo tomar esta semana\n\nDados do mês:\n${JSON.stringify(context, null, 2)}`;
        const text = await callNaval([{ role: "user", content: prompt }]);
        setAnalysis(text);
        generated.current = true;
      } catch (e) {
        console.error("Naval error:", e);
        setAnalysis("Erro ao gerar análise. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    [context]
  );

  useEffect(() => {
    if (isReady && !generated.current) generate();
  }, [isReady, generate]);

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
      } catch (e) {
        console.error("Naval chat error:", e);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Desculpe, ocorreu um erro. Tente novamente.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [context, messages]
  );

  return { messages, loading, send };
}

export function useWiselyInsight(topic: string, prompt: string) {
  const { context, isReady } = useWiselyContext();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const generated = useRef(false);

  useEffect(() => {
    if (!isReady || !context || generated.current) return;
    generated.current = true;
    setLoading(true);
    const fullPrompt = `${prompt}\n\nDados: ${JSON.stringify(context, null, 2)}`;
    callWisely([{ role: "user", content: fullPrompt }])
      .then((t) => setText(t))
      .catch(() => setText("Erro ao carregar insight."))
      .finally(() => setLoading(false));
  }, [isReady, context, prompt]);

  return { text, loading };
}
