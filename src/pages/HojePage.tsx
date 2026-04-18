import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAutonomyIndex, useAutonomyHistory } from "@/hooks/useAutonomyIndex";
import { useKitnetOrphans } from "@/hooks/useReconcileMonth";
import { useMonthRevenueReconciliation, useBusinesses, useBusinessRealized } from "@/hooks/useBusinesses";
import { formatCurrency, getCurrentMonth, formatMonth } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Compass, TrendingUp, AlertTriangle, Target, Rocket, Home, Flame, ChevronRight, Bot, Loader2 } from "lucide-react";

export default function HojePage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const navigate = useNavigate();

  const { data: snap, isLoading } = useAutonomyIndex(month);
  const { data: history = [], isLoading: histLoading } = useAutonomyHistory(12, month);
  const { data: kitnetOrphans } = useKitnetOrphans(month);
  const { data: reconc } = useMonthRevenueReconciliation(month);
  const { data: businesses = [] } = useBusinesses();
  const { data: realizedMap } = useBusinessRealized(month);

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const { toast } = useToast();

  const runNavalAnalysis = async () => {
    if (!snap) return;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const bizPayload = (businesses as any[]).map((b: any) => ({
        code: b.code,
        name: b.name,
        category: b.category,
        monthly_target: Number(b.monthly_target ?? 0),
        realized: Number(realizedMap?.get(b.id)?.amount ?? 0),
      }));

      const { data, error } = await supabase.functions.invoke("wisely-ai", {
        body: {
          action: "analyze-autonomy",
          snapshot: snap,
          history,
          businesses: bizPayload,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Naval não retornou análise");
      setAnalysis(data.analysis);
    } catch (e: any) {
      toast({ title: "Erro ao consultar Naval", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  // Meta de autonomia do William: 50% até 2028
  const TARGET_AUTONOMY = 50;

  const excedente = useMemo(() => {
    if (!snap) return 0;
    return snap.total - snap.target;
  }, [snap]);

  const alertas = useMemo(() => {
    const list: Array<{ id: string; level: "warn" | "info" | "good"; msg: string; href?: string }> = [];
    if (kitnetOrphans && kitnetOrphans.count > 0) {
      list.push({
        id: "kit-orphans",
        level: "warn",
        msg: `${kitnetOrphans.count} depósito${kitnetOrphans.count > 1 ? "s" : ""} de kitnet aguardando fechamento do ADM — ${formatCurrency(kitnetOrphans.total)}`,
        href: `/kitnets?tab=entries&month=${month}`,
      });
    }
    if (reconc && reconc.unlinkedCount > 0) {
      list.push({
        id: "unlinked",
        level: "warn",
        msg: `${reconc.unlinkedCount} receita${reconc.unlinkedCount > 1 ? "s" : ""} sem negócio vinculado — ${formatCurrency(reconc.unlinked)}`,
        href: `/businesses`,
      });
    }
    if (snap && snap.autonomyPct >= TARGET_AUTONOMY) {
      list.push({
        id: "autonomy-good",
        level: "good",
        msg: `🎉 Meta de autonomia 50% batida este mês (${snap.autonomyPct.toFixed(0)}%)`,
      });
    }
    if (snap && snap.target > 0 && snap.total >= snap.target) {
      list.push({
        id: "target-hit",
        level: "good",
        msg: `✓ Meta consolidada batida: +${formatCurrency(snap.total - snap.target)} acima do alvo`,
      });
    }
    return list;
  }, [kitnetOrphans, reconc, snap, month]);

  // Para o gráfico: escala de autonomia (0-100%)
  const chartMax = 100;
  const chartHeight = 120;

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: "#080C10" }}>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#F0F4F8" }}>
              <Compass className="inline w-6 h-6 mr-2" style={{ color: "#C9A84C" }} />
              Hoje — Cockpit Estratégico
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#94A3B8" }}>
              Seu norte diário · Índice de Autonomia · Meta: 50% até 2028
            </p>
          </div>
          <MonthPicker value={month} onChange={setMonth} className="w-44" />
        </div>

        {isLoading || !snap ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-64" /><Skeleton className="h-64" />
          </div>
        ) : (
          <>
            {/* ═══ BLOCO 1: Índice de Autonomia (destaque) ═══ */}
            <PremiumCard className="p-6" glowColor={snap.autonomyPct >= TARGET_AUTONOMY ? "#10B981" : "#C9A84C"}>
              <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-widest font-mono" style={{ color: "#4A5568" }}>
                    Índice de Autonomia {formatMonth(month)}
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-6xl font-bold font-mono" style={{
                      color: snap.autonomyPct >= TARGET_AUTONOMY ? "#10B981" : snap.autonomyPct >= 30 ? "#C9A84C" : "#F43F5E"
                    }}>
                      {snap.autonomyPct.toFixed(0)}
                    </span>
                    <span className="text-2xl" style={{ color: "#64748B" }}>%</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#64748B" }}>
                    (passiva + eventual) ÷ total · alvo 50%
                  </p>
                </div>

                <div className="flex-1 min-w-[300px]">
                  {/* Barra dupla: passiva + eventual / total */}
                  <div className="flex justify-between text-xs mb-1.5" style={{ color: "#94A3B8" }}>
                    <span>{formatCurrency(snap.passive + snap.eventual)} autônoma</span>
                    <span className="font-mono">{formatCurrency(snap.total)} total</span>
                  </div>
                  <div style={{ position: "relative", height: 20, background: "#1A2535", borderRadius: 99, overflow: "hidden" }}>
                    {/* Passiva */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, height: "100%",
                      width: snap.total > 0 ? `${(snap.passive / snap.total) * 100}%` : "0%",
                      background: "linear-gradient(90deg, #10B981, #34D399)",
                    }} />
                    {/* Eventual */}
                    <div style={{
                      position: "absolute", top: 0,
                      left: snap.total > 0 ? `${(snap.passive / snap.total) * 100}%` : "0%",
                      height: "100%",
                      width: snap.total > 0 ? `${(snap.eventual / snap.total) * 100}%` : "0%",
                      background: "linear-gradient(90deg, #94A3B8, #CBD5E1)",
                    }} />
                    {/* Marcador 50% */}
                    <div style={{
                      position: "absolute", top: 0, left: "50%", height: "100%", width: 2,
                      background: "#E8C97A", opacity: 0.6,
                    }} title="Meta 50%" />
                  </div>
                  <div className="flex gap-4 text-[11px] mt-2 font-mono">
                    <span style={{ color: "#10B981" }}>● Passiva {formatCurrency(snap.passive)}</span>
                    <span style={{ color: "#94A3B8" }}>● Eventual {formatCurrency(snap.eventual)}</span>
                    <span style={{ color: "#F43F5E" }}>● Ativa (Prevensul) {formatCurrency(snap.active)}</span>
                  </div>
                </div>
              </div>
            </PremiumCard>

            {/* ═══ BLOCO 2: Excedente + Meta ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <PremiumCard className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4" style={{ color: "#C9A84C" }} />
                  <p className="text-xs uppercase tracking-wider font-mono" style={{ color: "#4A5568" }}>Meta do mês</p>
                </div>
                <p className="text-2xl font-mono font-bold" style={{ color: "#C9A84C" }}>{formatCurrency(snap.target)}</p>
                <p className="text-[11px] mt-1" style={{ color: "#64748B" }}>soma dos alvos mensais</p>
              </PremiumCard>

              <PremiumCard className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4" style={{ color: excedente >= 0 ? "#10B981" : "#F43F5E" }} />
                  <p className="text-xs uppercase tracking-wider font-mono" style={{ color: "#4A5568" }}>
                    {excedente >= 0 ? "Excedente" : "Gap"}
                  </p>
                </div>
                <p className="text-2xl font-mono font-bold" style={{ color: excedente >= 0 ? "#10B981" : "#F43F5E" }}>
                  {excedente >= 0 ? "+" : ""}{formatCurrency(excedente)}
                </p>
                <p className="text-[11px] mt-1" style={{ color: "#64748B" }}>
                  {excedente >= 0 ? "disponível pra reinvestir" : "faltando pra bater meta"}
                </p>
              </PremiumCard>

              <PremiumCard className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Rocket className="w-4 h-4" style={{ color: "#A78BFA" }} />
                  <p className="text-xs uppercase tracking-wider font-mono" style={{ color: "#4A5568" }}>Dependência Prevensul</p>
                </div>
                <p className="text-2xl font-mono font-bold" style={{ color: snap.total > 0 && (snap.active / snap.total) < 0.5 ? "#10B981" : "#F43F5E" }}>
                  {snap.total > 0 ? ((snap.active / snap.total) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-[11px] mt-1" style={{ color: "#64748B" }}>
                  quanto menor, mais livre
                </p>
              </PremiumCard>
            </div>

            {/* ═══ BLOCO 3: Alertas & Ações ═══ */}
            {alertas.length > 0 && (
              <PremiumCard className="p-4">
                <p className="text-xs uppercase tracking-widest font-mono mb-3" style={{ color: "#4A5568" }}>
                  <AlertTriangle className="inline w-3.5 h-3.5 mr-1" />
                  Próximas ações
                </p>
                <div className="space-y-2">
                  {alertas.map(a => {
                    const bg = a.level === "warn" ? "rgba(59,130,246,0.08)"
                             : a.level === "good" ? "rgba(16,185,129,0.08)"
                             : "rgba(148,163,184,0.08)";
                    const border = a.level === "warn" ? "rgba(59,130,246,0.3)"
                                 : a.level === "good" ? "rgba(16,185,129,0.3)"
                                 : "rgba(148,163,184,0.3)";
                    const color = a.level === "warn" ? "#3B82F6"
                                : a.level === "good" ? "#10B981"
                                : "#94A3B8";
                    return (
                      <button
                        key={a.id}
                        onClick={() => a.href && navigate(a.href)}
                        disabled={!a.href}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors hover:opacity-80"
                        style={{ background: bg, border: `1px solid ${border}`, cursor: a.href ? "pointer" : "default" }}
                      >
                        <span className="text-sm" style={{ color }}>{a.msg}</span>
                        {a.href && <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color }} />}
                      </button>
                    );
                  })}
                </div>
              </PremiumCard>
            )}

            {/* ═══ BLOCO 3.5: Leitura Estratégica do Naval ═══ */}
            <PremiumCard className="p-4" glowColor={analysis ? "#A78BFA" : undefined}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <p className="text-xs uppercase tracking-widest font-mono" style={{ color: "#4A5568" }}>
                  <Bot className="inline w-3.5 h-3.5 mr-1" style={{ color: "#A78BFA" }} />
                  Leitura estratégica do Naval
                </p>
                <button
                  onClick={runNavalAnalysis}
                  disabled={analyzing || !snap}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  style={{
                    background: "rgba(167,139,250,0.15)",
                    color: "#A78BFA",
                    border: "1px solid rgba(167,139,250,0.4)",
                  }}
                >
                  {analyzing ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Naval pensando...</>
                  ) : analysis ? (
                    <><Bot className="w-3.5 h-3.5" /> Regenerar análise</>
                  ) : (
                    <><Bot className="w-3.5 h-3.5" /> Pedir análise deste mês</>
                  )}
                </button>
              </div>
              {analysis ? (
                <div
                  className="text-sm leading-relaxed mt-3 p-3 rounded-lg"
                  style={{
                    color: "#E8EEF5",
                    background: "rgba(167,139,250,0.05)",
                    border: "1px solid rgba(167,139,250,0.2)",
                    whiteSpace: "pre-wrap",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: analysis
                      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#E8C97A">$1</strong>')
                      .replace(/\n/g, "<br>"),
                  }}
                />
              ) : (
                <p className="text-xs mt-2" style={{ color: "#64748B" }}>
                  Clique pra receber diagnóstico cirúrgico do mês com base nos seus negócios cadastrados, tendência 12m e excedente disponível pra reinvestir.
                </p>
              )}
            </PremiumCard>

            {/* ═══ BLOCO 4: Evolução 12m ═══ */}
            <PremiumCard className="p-4">
              <div className="flex justify-between items-baseline mb-3">
                <p className="text-xs uppercase tracking-widest font-mono" style={{ color: "#4A5568" }}>
                  Evolução do Índice de Autonomia · últimos 12 meses
                </p>
                <span className="text-[10px]" style={{ color: "#64748B" }}>alvo 50%</span>
              </div>

              {histLoading ? (
                <Skeleton className="h-32" />
              ) : (
                <div style={{ position: "relative", height: chartHeight + 30 }}>
                  {/* Linha 50% target */}
                  <div style={{
                    position: "absolute",
                    top: chartHeight - (chartHeight * TARGET_AUTONOMY / chartMax),
                    left: 0, right: 0, height: 1,
                    borderTop: "1px dashed #C9A84C", opacity: 0.4,
                  }} />

                  {/* Barras */}
                  <div className="flex items-end justify-between gap-1" style={{ height: chartHeight }}>
                    {history.map((s, i) => {
                      const pct = Math.min(s.autonomyPct, chartMax);
                      const barH = (pct / chartMax) * chartHeight;
                      const isCurrentMonth = s.month === month;
                      const color = s.autonomyPct >= TARGET_AUTONOMY ? "#10B981"
                                  : s.autonomyPct >= 30 ? "#C9A84C" : "#F43F5E";
                      return (
                        <div key={s.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div
                            style={{
                              width: "100%",
                              height: barH,
                              background: color,
                              opacity: isCurrentMonth ? 1 : 0.5,
                              borderRadius: "4px 4px 0 0",
                              transition: "opacity 0.2s",
                              border: isCurrentMonth ? `1px solid ${color}` : "none",
                              boxShadow: isCurrentMonth ? `0 0 8px ${color}88` : "none",
                            }}
                            title={`${s.month}: ${s.autonomyPct.toFixed(0)}%`}
                          />
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                               style={{ background: "#0D1117", border: "1px solid #1C2333", padding: "4px 8px", borderRadius: 4, fontSize: 10, whiteSpace: "nowrap" }}>
                            <div style={{ color: "#F0F4F8" }}>{s.month}</div>
                            <div style={{ color }}>{s.autonomyPct.toFixed(1)}%</div>
                            <div style={{ color: "#64748B" }}>{formatCurrency(s.total)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Labels mês */}
                  <div className="flex justify-between gap-1 mt-1">
                    {history.map(s => (
                      <div key={s.month} className="flex-1 text-center text-[9px] font-mono" style={{ color: "#4A5568" }}>
                        {s.month.slice(5)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </PremiumCard>

            {/* Atalhos rápidos */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => navigate("/businesses")} className="p-3 rounded-lg text-left transition-colors"
                style={{ background: "#0F141B", border: "1px solid #1A2535", color: "#C9A84C" }}>
                <div className="flex items-center gap-2 text-xs font-mono uppercase">
                  <Flame className="w-3.5 h-3.5" />Negócios
                </div>
                <p className="text-[11px] mt-1" style={{ color: "#64748B" }}>meta vs realizado</p>
              </button>
              <button onClick={() => navigate("/kitnets")} className="p-3 rounded-lg text-left transition-colors"
                style={{ background: "#0F141B", border: "1px solid #1A2535", color: "#10B981" }}>
                <div className="flex items-center gap-2 text-xs font-mono uppercase">
                  <Home className="w-3.5 h-3.5" />Kitnets
                </div>
                <p className="text-[11px] mt-1" style={{ color: "#64748B" }}>renda passiva</p>
              </button>
              <button onClick={() => navigate("/reconciliation")} className="p-3 rounded-lg text-left transition-colors"
                style={{ background: "#0F141B", border: "1px solid #1A2535", color: "#3B82F6" }}>
                <div className="flex items-center gap-2 text-xs font-mono uppercase">
                  <TrendingUp className="w-3.5 h-3.5" />Reconciliar
                </div>
                <p className="text-[11px] mt-1" style={{ color: "#64748B" }}>extrato ↔ receitas</p>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
