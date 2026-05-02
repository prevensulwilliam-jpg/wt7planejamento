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
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { SobraReinvestidaCard } from "@/components/wt7/SobraReinvestidaCard";
import { ThreeRingsCockpit } from "@/components/wt7/ThreeRingsCockpit";
import { StatusBar } from "@/components/wt7/StatusBar";
import { CaminhoMeta } from "@/components/wt7/CaminhoMeta";
import { PipelineCompact } from "@/components/wt7/PipelineCompact";
import { AutonomyCompact } from "@/components/wt7/AutonomyCompact";
import { AtalhosRapidos } from "@/components/wt7/AtalhosRapidos";
import { NavalBriefing } from "@/components/wt7/NavalBriefing";
import { DailyStream } from "@/components/wt7/DailyStream";
import { AlertasPriorizados } from "@/components/wt7/AlertasPriorizados";
import { CashFlowChart } from "@/components/wt7/CashFlowChart";
import { WhatsAppShareButton } from "@/components/wt7/WhatsAppShareButton";
import { getCurrentMonth, formatMonth } from "@/lib/formatters";
import { Compass } from "lucide-react";

export default function HojePage() {
  const [month, setMonth] = useState(getCurrentMonth());
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

        {/* ═══ ALERTAS PRIORIZADOS (estilo Fathom) ═══════════════════ */}
        <AlertasPriorizados />

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

        {/* ═══ BLOCO 6 · CASH FLOW + STREAM (split) ═════════════════ */}
        {/* items-stretch faz os 2 cards terem a MESMA altura (a do maior conteúdo).
            Stream rola internamente se passar — sem min-h forçada que cria espaço morto. */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:items-stretch">
          <div className="lg:col-span-3 lg:max-h-[640px] flex flex-col">
            <CashFlowChart />
          </div>
          <div className="lg:col-span-2 lg:max-h-[640px] flex flex-col overflow-hidden">
            <DailyStream />
          </div>
        </div>

        {/* ═══ BLOCO 7 · SPLIT (Pipeline + Autonomia) ══════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:items-stretch">
          <div className="lg:col-span-3 flex flex-col">
            <PipelineCompact />
          </div>
          <div className="lg:col-span-2 flex flex-col">
            <AutonomyCompact month={month} />
          </div>
        </div>

        {/* ═══ BLOCO 8 · ATALHOS RÁPIDOS ═══════════════════════════ */}
        <AtalhosRapidos />

        {/* ═══ BLOCO 9 · WHATSAPP SHARE (cereja) ═══════════════════ */}
        <WhatsAppShareButton month={month} />
      </div>
    </div>
  );
}
