/**
 * HojePage — Cockpit estratégico /hoje v4.
 *
 * Layout (Sprint 2):
 *   1. Header (título + MonthPicker)
 *   2. Alertas Naval (críticos no topo)
 *   3. StatusBar (5 KPIs com sparklines)
 *   4. ThreeRingsCockpit (Receita / Custeio / Investimento)
 *   5. SobraReinvestidaCard (decomposição da sobra por vetor)
 *   6. CaminhoMeta (YTD vs goal anual)
 *   7. Split PipelineCompact + AutonomyCompact
 *   8. AtalhosRapidos (6 botões)
 *
 * Sprint 3 adiciona: Naval Briefing + Stream do Dia
 * Sprint 4 adiciona: Cash Flow Forecast chart + WhatsApp share
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { useNavalAlerts } from "@/hooks/useNavalAlerts";
import { SobraReinvestidaCard } from "@/components/wt7/SobraReinvestidaCard";
import { ThreeRingsCockpit } from "@/components/wt7/ThreeRingsCockpit";
import { StatusBar } from "@/components/wt7/StatusBar";
import { CaminhoMeta } from "@/components/wt7/CaminhoMeta";
import { PipelineCompact } from "@/components/wt7/PipelineCompact";
import { AutonomyCompact } from "@/components/wt7/AutonomyCompact";
import { AtalhosRapidos } from "@/components/wt7/AtalhosRapidos";
import { NavalBriefing } from "@/components/wt7/NavalBriefing";
import { DailyStream } from "@/components/wt7/DailyStream";
import { getCurrentMonth, formatMonth } from "@/lib/formatters";
import { Compass, AlertTriangle, ChevronRight } from "lucide-react";

export default function HojePage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const navigate = useNavigate();
  const { data: alerts = [] } = useNavalAlerts();
  const criticalAlerts = alerts.filter(a => a.severity === "critical");
  const warningAlerts = alerts.filter(a => a.severity === "warning");

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: "#080C10" }}>
      <div className="max-w-7xl mx-auto space-y-4">

        {/* ═══ HEADER ═══════════════════════════════════════════════ */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b" style={{ borderColor: "#1A2535" }}>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5" style={{ color: "#F0F4F8" }}>
              <Compass className="w-6 h-6" style={{ color: "#C9A84C" }} />
              Hoje · William
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              Cockpit estratégico · {formatMonth(month)} · meta R$70M / 2041
            </p>
          </div>
          <MonthPicker value={month} onChange={setMonth} className="w-44" />
        </div>

        {/* ═══ ALERTAS NAVAL (críticos sempre visíveis no topo) ═══ */}
        {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
          <PremiumCard className="p-4" glowColor={criticalAlerts.length > 0 ? "#F43F5E" : "#F59E0B"}>
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle
                  className="w-4 h-4"
                  style={{ color: criticalAlerts.length > 0 ? "#F43F5E" : "#F59E0B" }}
                />
                <span className="text-sm font-semibold" style={{ color: "#F0F4F8" }}>
                  Naval detectou {alerts.length} alerta{alerts.length !== 1 ? "s" : ""}
                  {criticalAlerts.length > 0 && (
                    <span
                      className="ml-1.5 px-2 py-0.5 rounded text-[10px]"
                      style={{ background: "rgba(244,63,94,0.15)", color: "#F87171" }}
                    >
                      {criticalAlerts.length} crítico{criticalAlerts.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => navigate("/naval")}
                  className="ml-auto text-xs px-2 py-1 rounded hover:bg-white/5 flex items-center gap-1"
                  style={{ color: "#94A3B8" }}
                >
                  Ver todos no Naval <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {[...criticalAlerts, ...warningAlerts].slice(0, 3).map(a => (
                <div key={a.id} className="flex items-start gap-2 text-xs" style={{ color: "#CBD5E1" }}>
                  <span style={{ color: a.severity === "critical" ? "#F87171" : "#FCD34D" }}>
                    {a.severity === "critical" ? "🚨" : "⚠"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: "#F0F4F8" }}>{a.title}</p>
                    <p className="truncate text-[11px]" style={{ color: "#94A3B8" }}>{a.message}</p>
                  </div>
                </div>
              ))}
              {alerts.length > 3 && (
                <p className="text-[10px] pl-6" style={{ color: "#64748B" }}>
                  +{alerts.length - 3} alerta(s). Veja todos em /naval
                </p>
              )}
            </div>
          </PremiumCard>
        )}

        {/* ═══ BLOCO 1 · STATUS BAR (5 KPIs) ═══════════════════════ */}
        <StatusBar month={month} />

        {/* ═══ BLOCO 2 · NAVAL BRIEFING (cascatas + narrativa) ═════ */}
        <NavalBriefing />

        {/* ═══ BLOCO 3 · COCKPIT 3 ANÉIS ═══════════════════════════ */}
        <ThreeRingsCockpit month={month} />

        {/* ═══ BLOCO 3 · SOBRA REINVESTIDA (decomposição) ═════════ */}
        <SobraReinvestidaCard month={month} />

        {/* ═══ BLOCO 4 · CAMINHO DA META (YTD) ═════════════════════ */}
        <CaminhoMeta month={month} />

        {/* ═══ BLOCO 6 · STREAM DO DIA ═════════════════════════════ */}
        <DailyStream />

        {/* ═══ BLOCO 7 · SPLIT (Pipeline + Autonomia) ══════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <PipelineCompact />
          </div>
          <div className="lg:col-span-2">
            <AutonomyCompact month={month} />
          </div>
        </div>

        {/* ═══ BLOCO 8 · ATALHOS RÁPIDOS ═══════════════════════════ */}
        <AtalhosRapidos />

        {/* TODO Sprint 4: AlertasPriorizados + CashFlow chart + WhatsAppShare */}
      </div>
    </div>
  );
}
