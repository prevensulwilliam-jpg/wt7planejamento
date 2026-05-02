/**
 * GoalsPage — refatorada (Sprint 4 fix).
 *
 * Hoje:
 *  1. SobraReinvestidaCard (meta estratégica ≥50%)
 *  2. MultiPeriodGoals (CRUD de metas com qualquer período/métrica)
 *  3. Marcos Canônicos R$70M/2041 (visualização only — sincronizado com metas.md)
 *
 * Removido: form antigo "Nova Meta" (duplicava MultiPeriodGoals com schema mais limitado).
 */
import { Progress } from "@/components/ui/progress";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { SobraReinvestidaCard } from "@/components/wt7/SobraReinvestidaCard";
import { MultiPeriodGoals } from "@/components/wt7/MultiPeriodGoals";
import { useDashboardKPIs, useNetWorth } from "@/hooks/useFinances";
import { formatCurrency, getCurrentMonth } from "@/lib/formatters";
import { Target } from "lucide-react";

// Marcos canônicos (sincronizados com ~/.claude/memoria/metas.md).
// Renda = meta MENSAL; Patrimônio = meta de net worth TOTAL.
const MILESTONES = [
  { year: 2027, label: "Casamento (11/12/2027)",   renda: 100_000, patrimonio: 6_500_000 },
  { year: 2030, label: "Consolidação (44 anos)",   renda: 165_000, patrimonio: 7_750_000 },
  { year: 2035, label: "Meio do caminho (49 anos)", renda: 200_000, patrimonio: 15_000_000 },
  { year: 2041, label: "Destino (55 anos)",        renda: 200_000, patrimonio: 70_000_000 },
];

export default function GoalsPage() {
  const kpis = useDashboardKPIs(getCurrentMonth());
  const nw = useNetWorth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl" style={{ color: "#F0F4F8" }}>
          <Target className="inline w-6 h-6 mr-2" style={{ color: "#C9A84C" }} />
          Metas
        </h1>
        <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
          Meta-âncora: R$ 70M até 2041 · Sobra Reinvestida ≥50% mensal · CAGR 17,3% a.a.
        </p>
      </div>

      {/* Sobra Reinvestida — meta estratégica do William */}
      <SobraReinvestidaCard month={getCurrentMonth()} />

      {/* CRUD de metas multi-período */}
      <MultiPeriodGoals />

      {/* Marcos canônicos (visualização) */}
      <PremiumCard className="space-y-3">
        <div>
          <h3 className="font-display font-bold text-lg" style={{ color: "#F0F4F8" }}>📅 Marcos Canônicos</h3>
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            Trajetória R$70M / 2041 — sincronizado com <code className="text-[10px]">~/.claude/memoria/metas.md</code>
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {MILESTONES.map(m => {
            const pctR = Math.min((kpis.totalRevenue / m.renda) * 100, 100);
            const pctP = nw.netWorth > 0 ? Math.min((nw.netWorth / m.patrimonio) * 100, 100) : 0;
            const isNext = MILESTONES.find(x => kpis.totalRevenue < x.renda)?.year === m.year;
            return (
              <div
                key={m.year}
                className="p-4 rounded-xl space-y-3"
                style={{
                  background: isNext ? "rgba(201,168,76,0.08)" : "rgba(15,23,42,0.4)",
                  border: `1px solid ${isNext ? "#C9A84C" : "#1A2535"}`,
                }}
              >
                <div>
                  <p className="font-display font-bold" style={{ color: isNext ? "#E8C97A" : "#F0F4F8" }}>{m.year}</p>
                  <p className="text-xs" style={{ color: "#94A3B8" }}>{m.label}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "#94A3B8" }}>💰 Renda/mês</span>
                    <span className="font-mono" style={{ color: "#E8C97A" }}>{formatCurrency(m.renda)}</span>
                  </div>
                  <Progress value={pctR} className="h-1.5" />
                  <p className="text-[10px]" style={{ color: "#4A5568" }}>{pctR.toFixed(0)}% atingido</p>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "#94A3B8" }}>🏦 Patrimônio</span>
                    <span className="font-mono" style={{ color: "#2DD4BF" }}>{formatCurrency(m.patrimonio)}</span>
                  </div>
                  <Progress value={pctP} className="h-1.5" />
                  <p className="text-[10px]" style={{ color: "#4A5568" }}>
                    {nw.isLoading ? "carregando…" : `${pctP.toFixed(0)}% atingido`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </PremiumCard>
    </div>
  );
}
