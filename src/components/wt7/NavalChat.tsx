import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, X, Send, Sparkles, Minimize2, Maximize2 } from "lucide-react";
import { getCurrentMonth } from "@/lib/formatters";
import ReactMarkdown from "react-markdown";

async function fetchPageContext(pathname: string): Promise<{ label: string; data: any }> {
  const month = getCurrentMonth();

  if (pathname.includes("/expenses")) {
    const { data } = await supabase.from("expenses").select("*").order("amount", { ascending: false });
    const total = (data ?? []).reduce((s, e) => s + (e.amount ?? 0), 0);
    const byCategory = (data ?? []).reduce((acc: any, e) => {
      acc[e.category ?? "sem categoria"] = (acc[e.category ?? "sem categoria"] ?? 0) + (e.amount ?? 0);
      return acc;
    }, {});
    const top5 = Object.entries(byCategory).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);
    return { label: "Despesas", data: { total, byCategory, top5, records: data?.length, recent: data?.slice(0, 10) } };
  }

  if (pathname.includes("/revenues")) {
    const { data } = await supabase.from("revenues").select("*").order("amount", { ascending: false });
    const total = (data ?? []).reduce((s, e) => s + (e.amount ?? 0), 0);
    const bySource = (data ?? []).reduce((acc: any, e) => {
      acc[e.source ?? "sem fonte"] = (acc[e.source ?? "sem fonte"] ?? 0) + (e.amount ?? 0);
      return acc;
    }, {});
    return { label: "Receitas", data: { total, bySource, records: data?.length, recent: data?.slice(0, 10) } };
  }

  if (pathname.includes("/kitnets")) {
    const { data: kitnets } = await supabase.from("kitnets").select("*");
    const { data: entries } = await supabase.from("kitnet_entries").select("*, kitnets(code, tenant_name)").eq("reference_month", month);
    const totalReceived = (entries ?? []).reduce((s, e) => s + (e.total_liquid ?? 0), 0);
    const occupied = (kitnets ?? []).filter(k => k.status === "occupied").length;
    return { label: "Kitnets", data: { total: kitnets?.length, occupied, vacant: (kitnets ?? []).filter(k => k.status === "vacant").length, maintenance: (kitnets ?? []).filter(k => k.status === "maintenance").length, totalReceived, entries: entries?.slice(0, 10), kitnets } };
  }

  if (pathname.includes("/reconciliation")) {
    const { data } = await supabase.from("bank_transactions").select("*").order("date", { ascending: false }).limit(50);
    const pending = (data ?? []).filter(t => t.status === "pending").length;
    const doubts = (data ?? []).filter(t => t.category_intent === "duvida").length;
    const totalCredits = (data ?? []).filter(t => t.type === "credit").reduce((s, t) => s + (t.amount ?? 0), 0);
    const totalDebits = (data ?? []).filter(t => t.type === "debit").reduce((s, t) => s + (t.amount ?? 0), 0);
    return { label: "Conciliação Bancária", data: { pending, doubts, totalCredits, totalDebits, recent: data?.slice(0, 20) } };
  }

  if (pathname.includes("/constructions")) {
    const { data: props } = await supabase.from("real_estate_properties").select("*");
    const { data: expenses } = await supabase.from("construction_expenses").select("*");
    const totalInvested = (expenses ?? []).reduce((s, e) => s + (e.total_amount ?? 0), 0);
    const byProperty = (expenses ?? []).reduce((acc: any, e) => {
      acc[e.property_code ?? "sem código"] = (acc[e.property_code ?? "sem código"] ?? 0) + (e.total_amount ?? 0);
      return acc;
    }, {});
    return { label: "Obras & Terrenos", data: { properties: props, totalInvested, byProperty, expenses: expenses?.slice(0, 10) } };
  }

  if (pathname.includes("/goals")) {
    const { data } = await supabase.from("goals").select("*");
    return { label: "Metas", data: { goals: data } };
  }

  if (pathname.includes("/assets")) {
    const { data: assets } = await supabase.from("assets").select("*");
    const { data: investments } = await supabase.from("investments").select("*");
    const { data: consortiums } = await supabase.from("consortiums").select("*");
    const totalAssets = (assets ?? []).reduce((s, a) => s + (a.estimated_value ?? 0), 0);
    const totalInv = (investments ?? []).reduce((s, i) => s + (i.current_amount ?? 0), 0);
    return { label: "Patrimônio & Investimentos", data: { assets, investments, consortiums, totalAssets, totalInvestments: totalInv } };
  }

  // Dashboard — contexto completo
  const [revRes, expRes, kitRes, goalRes, bilRes] = await Promise.all([
    supabase.from("revenues").select("*").eq("reference_month", month),
    supabase.from("expenses").select("*").eq("reference_month", month),
    supabase.from("kitnets").select("*"),
    supabase.from("goals").select("*"),
    supabase.from("prevensul_billing").select("*").eq("reference_month", month),
  ]);
  const totalRevenue = (revRes.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalExpenses = (expRes.data ?? []).reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalCommission = (bilRes.data ?? []).reduce((s, b) => s + (b.commission_value ?? 0), 0);
  return {
    label: "Dashboard Geral",
    data: {
      month,
      totalRevenue,
      totalExpenses,
      netResult: totalRevenue - totalExpenses,
      margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : 0,
      revenueBySource: (revRes.data ?? []).reduce((acc: any, r) => { acc[r.source ?? ""] = (acc[r.source ?? ""] ?? 0) + (r.amount ?? 0); return acc; }, {}),
      expenseByCategory: (expRes.data ?? []).reduce((acc: any, e) => { acc[e.category ?? ""] = (acc[e.category ?? ""] ?? 0) + (e.amount ?? 0); return acc; }, {}),
      kitnets: { total: kitRes.data?.length, occupied: kitRes.data?.filter(k => k.status === "occupied").length },
      goals: goalRes.data,
      totalCommission,
      meta100k: { current: totalRevenue, target: 100000, pct: ((totalRevenue / 100000) * 100).toFixed(1) },
    }
  };
}

type Message = { role: "user" | "assistant"; content: string; loading?: boolean };

const SUGGESTIONS: Record<string, string[]> = {
  "/expenses": ["Quais meus 5 maiores custos?", "Onde posso cortar despesas?", "Qual categoria cresceu mais?", "Minha margem está saudável?"],
  "/revenues": ["Qual fonte de receita tem mais potencial?", "Como está minha diversificação de renda?", "O que preciso fazer para chegar a R$100k?", "Qual receita cresceu mais?"],
  "/kitnets": ["Os repasses estão de acordo com os contratos?", "Qual kitnet me dá mais retorno?", "Tenho risco de inadimplência?", "Vale a pena expandir as kitnets?"],
  "/reconciliation": ["Tem alguma transação suspeita?", "Qual meu maior gasto recorrente?", "Como estão minhas transferências?", "Tem algum padrão de gasto que devo revisar?"],
  "/constructions": ["Qual obra está consumindo mais capital?", "Qual projeto tem melhor ROI esperado?", "Como está o ritmo de investimento?", "Quando devo esperar retorno das obras?"],
  "/dashboard": ["Como estou em relação à meta de R$100k?", "Qual área devo priorizar agora?", "Minha situação financeira está saudável?", "O que está me impedindo de crescer mais rápido?"],
  "default": ["Analise minha situação atual", "Onde devo focar agora?", "O que está me custando mais?", "Como posso aumentar minha renda?"],
};

function getSuggestions(pathname: string): string[] {
  for (const key of Object.keys(SUGGESTIONS)) {
    if (key !== "default" && pathname.includes(key)) return SUGGESTIONS[key];
  }
  return SUGGESTIONS["default"];
}

export function NavalChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<{ label: string; data: any } | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  // ── Drag ──
  const [pos, setPos] = useState({ bottom: 24, right: 24 });
  const dragState = useRef({ active: false, startX: 0, startY: 0, origBottom: 24, origRight: 24, moved: false });
  const btnRef = useRef<HTMLButtonElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { active: true, startX: e.clientX, startY: e.clientY, origBottom: pos.bottom, origRight: pos.right, moved: false };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    d.moved = true;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const newRight = Math.max(8, Math.min(vw - 60, d.origRight - dx));
    const newBottom = Math.max(8, Math.min(vh - 60, d.origBottom - dy));
    setPos({ bottom: newBottom, right: newRight });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragState.current;
    d.active = false;
    if (!d.moved) setOpen(true);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoadingContext(true);
    setContext(null);
    fetchPageContext(location.pathname)
      .then(ctx => {
        setContext(ctx);
        if (messages.length === 0) {
          setMessages([{
            role: "assistant",
            content: `Olá William! Estou na página **${ctx.label}** e já carreguei seus dados.\n\nO que quer saber? Pode perguntar sobre números específicos, pedir análises ou estratégias.`
          }]);
        }
      })
      .finally(() => setLoadingContext(false));
  }, [open, location.pathname]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  const send = useCallback(async (text?: string) => {
    const userText = text ?? input.trim();
    if (!userText || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: userText };
    const loadingMsg: Message = { role: "assistant", content: "", loading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    try {
      const contextStr = context
        ? `\n\nPágina atual: ${context.label}\nDados da página:\n${JSON.stringify(context.data, null, 2)}`
        : "";

      const historyForApi = messages
        .filter(m => !m.loading)
        .map(m => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("wisely-ai", {
        body: {
          messages: [
            ...historyForApi,
            { role: "user", content: userText + contextStr }
          ],
          stream: false,
        },
      });

      if (error) throw error;

      const reply = data?.text ?? "Não consegui processar sua pergunta. Tente novamente.";
      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        { role: "assistant", content: reply }
      ]);
    } catch {
      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        { role: "assistant", content: "Erro ao conectar com a IA. Tente novamente." }
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, context]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const suggestions = getSuggestions(location.pathname);

  if (!open) {
    return (
      <button
        ref={btnRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="fixed z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl transition-shadow select-none touch-none"
        style={{
          bottom: pos.bottom,
          right: pos.right,
          background: "linear-gradient(135deg, #C9A84C, #E8C97A)",
          color: "#080C10",
          boxShadow: "0 8px 32px rgba(201,168,76,0.4)",
          cursor: dragState.current.active ? "grabbing" : "grab",
        }}
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-display font-bold text-sm">Naval</span>
      </button>
    );
  }

  return (
    <div
      className="fixed z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
      style={{
        bottom: pos.bottom,
        right: pos.right,
        width: minimized ? 260 : 380,
        maxHeight: minimized ? "auto" : "min(600px, calc(100vh - 100px))",
        background: "#0D1117",
        border: "1px solid rgba(201,168,76,0.25)",
        boxShadow: "0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.1)",
      }}
    >
      {/* Header — draggable */}
      <div
        className="flex items-center justify-between px-4 py-3 select-none touch-none"
        style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))", borderBottom: "1px solid rgba(201,168,76,0.15)", cursor: "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => {
          const d = dragState.current;
          d.active = false;
          if (!d.moved) setMinimized(m => !m);
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4" style={{ color: "#C9A84C" }} />
          <div>
            <span className="font-display font-bold text-sm" style={{ color: "#E8C97A" }}>Naval</span>
            {context && !minimized && (
              <span className="ml-2 text-xs" style={{ color: "rgba(201,168,76,0.6)" }}>{context.label}</span>
            )}
            {loadingContext && (
              <span className="ml-2 text-xs animate-pulse" style={{ color: "rgba(201,168,76,0.4)" }}>carregando dados...</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {minimized ? <Maximize2 className="w-3.5 h-3.5" style={{ color: "#C9A84C" }} /> : <Minimize2 className="w-3.5 h-3.5" style={{ color: "#C9A84C" }} />}
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); setMessages([]); }}
            className="p-0.5 rounded hover:opacity-70"
          >
            <X className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 380 }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1" style={{ background: "rgba(201,168,76,0.15)" }}>
                    <Sparkles className="w-3 h-3" style={{ color: "#C9A84C" }} />
                  </div>
                )}
                <div
                  className="rounded-xl px-3 py-2 text-sm max-w-[85%]"
                  style={{
                    background: msg.role === "user" ? "rgba(201,168,76,0.15)" : "rgba(240,244,248,0.05)",
                    color: msg.role === "user" ? "#E8C97A" : "#CBD5E1",
                    border: msg.role === "user" ? "1px solid rgba(201,168,76,0.2)" : "none",
                  }}
                >
                  {msg.loading ? (
                    <div className="flex gap-1 py-1">
                      {[0, 1, 2].map(j => (
                        <div key={j} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#C9A84C", animationDelay: `${j * 0.15}s` }} />
                      ))}
                    </div>
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none [&_p]:m-0 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:m-0 [&_ul]:pl-4 [&_li]:m-0 [&_strong]:text-gold-light">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-2.5 py-1 rounded-full transition-all hover:opacity-80"
                  style={{ background: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.25)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3" style={{ borderTop: "1px solid rgba(201,168,76,0.1)" }}>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(240,244,248,0.05)", border: "1px solid rgba(201,168,76,0.15)" }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre seus dados..."
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "#F0F4F8" }}
                disabled={loading}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="p-1.5 rounded-lg transition-all disabled:opacity-30"
                style={{ background: input.trim() ? "rgba(201,168,76,0.2)" : "transparent" }}
              >
                <Send className="w-4 h-4" style={{ color: "#C9A84C" }} />
              </button>
            </div>
            <div className="text-center mt-1.5">
              <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.4)" }}>Enter para enviar · Naval lê os dados desta página</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
