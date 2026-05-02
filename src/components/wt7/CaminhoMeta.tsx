/**
 * CaminhoMeta — Bloco 5 do /hoje v4.
 * Mostra YTD vs meta anual com pipeline confirmado + curva ideal.
 */
import { useGoalsActive } from "@/hooks/useGoalsActive";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { Target } from "lucide-react";

type Props = { month: string };

export function CaminhoMeta({ month }: Props) {
  const { data: goals, isLoading } = useGoalsActive({ metric: "revenue", period_type: "yearly" });

  if (isLoading) {
    return <Skeleton className="h-44 rounded-xl" style={{ background: "#0D1318" }} />;
  }

  // Pega a goal anual ativa que cobre o mês corrente
  const currentDate = `${month}-15`;
  const yearGoal = (goals ?? []).find(
    g => g.period_start && g.period_end && g.period_start <= currentDate && g.period_end >= currentDate,
  );

  if (!yearGoal) {
    return (
      <div
        className="rounded-xl p-4 border"
        style={{ background: "#0F141B", borderColor: "#1A2535" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4" style={{ color: "#C9A84C" }} />
          <span className="text-[11px] font-mono uppercase tracking-[1.5px]" style={{ color: "#64748B" }}>
            Caminho da Meta · não cadastrada
          </span>
        </div>
        <p className="text-xs" style={{ color: "#94A3B8" }}>
          Cadastre uma goal anual em <a href="/goals" className="underline" style={{ color: "#C9A84C" }}>/goals</a> com{" "}
          <code style={{ color: "#E8C97A" }}>metric=revenue</code> + <code style={{ color: "#E8C97A" }}>period_type=yearly</code>{" "}
          pra ver progresso aqui.
        </p>
      </div>
    );
  }

  const realized = yearGoal.current_value;
  const target = yearGoal.target_value;
  const realizedPct = target > 0 ? (realized / target) * 100 : 0;
  const remaining = target - realized;

  // Curva ideal: progresso linear pelo tempo decorrido
  const periodStart = new Date(yearGoal.period_start!);
  const periodEnd = new Date(yearGoal.period_end!);
  const today = new Date();
  const totalDays = (periodEnd.getTime() - periodStart.getTime()) / 86400000;
  const elapsedDays = Math.max(0, (today.getTime() - periodStart.getTime()) / 86400000);
  const expectedPct = Math.min(100, (elapsedDays / totalDays) * 100);

  // Meses passados / restantes
  const monthsElapsed = Math.round((elapsedDays / 365) * 12);
  const monthsTotal = Math.round((totalDays / 365) * 12);
  const monthsRemaining = monthsTotal - monthsElapsed;
  const avgMonthlyNeeded = monthsRemaining > 0 ? remaining / monthsRemaining : 0;

  const yearLabel = `${periodStart.getFullYear()}`;
  const status = realizedPct > expectedPct + 5 ? "a_frente" : realizedPct < expectedPct - 5 ? "atras" : "no_trilho";
  const statusColors = {
    a_frente: "#10B981",
    no_trilho: "#C9A84C",
    atras: "#F43F5E",
  };

  return (
    <div
      className="rounded-xl p-4 border"
      style={{ background: "#0F141B", borderColor: "#1A2535" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4" style={{ color: "#C9A84C" }} />
          <span className="text-[11px] font-mono uppercase tracking-[1.5px]" style={{ color: "#64748B" }}>
            Caminho da Meta · {yearGoal.name}
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: statusColors[status] }}>
          {status === "a_frente" ? "↑ à frente" : status === "atras" ? "↓ atrás" : "→ no trilho"}
        </span>
      </div>

      <div className="rounded-lg p-3 border" style={{
        background: "linear-gradient(135deg, rgba(201,168,76,.06), transparent)",
        borderColor: "rgba(201,168,76,.2)",
      }}>
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-[11px]" style={{ color: "#64748B" }}>YTD · {monthsElapsed}/{monthsTotal} meses</span>
          <span className="text-base font-bold font-mono" style={{ color: "#E8C97A" }}>
            {formatCurrency(realized)} <span style={{ color: "#64748B", fontWeight: 400 }}>/ {formatCurrency(target)}</span>
          </span>
        </div>

        {/* Barra dupla com marker */}
        <div className="relative h-3.5 rounded-full overflow-hidden" style={{ background: "#0B1220", border: "1px solid #1C2333" }}>
          <div
            className="absolute top-0 bottom-0 left-0"
            style={{
              width: `${Math.min(100, realizedPct)}%`,
              background: "linear-gradient(90deg, #10B981, #34D399)",
            }}
          />
          <div
            className="absolute top-[-2px] h-[18px] w-[2px]"
            style={{
              left: `${expectedPct}%`,
              background: "#FDE68A",
              boxShadow: "0 0 4px #FDE68A",
            }}
          />
        </div>

        <div className="flex justify-between text-[10px] font-mono mt-1.5" style={{ color: "#4A5568" }}>
          <span>● realizado <b style={{ color: "#34D399" }}>{realizedPct.toFixed(1)}%</b></span>
          <span>│ esperado <b style={{ color: "#FDE68A" }}>{expectedPct.toFixed(1)}%</b></span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="px-2.5 py-2 rounded-lg" style={{ background: "#0B1220", border: "1px solid #1C2333" }}>
          <div className="text-[9px] uppercase tracking-[1px] font-mono" style={{ color: "#4A5568" }}>Falta</div>
          <div className="text-sm font-bold font-mono" style={{ color: "#F43F5E" }}>{formatCurrency(remaining)}</div>
        </div>
        <div className="px-2.5 py-2 rounded-lg" style={{ background: "#0B1220", border: "1px solid #1C2333" }}>
          <div className="text-[9px] uppercase tracking-[1px] font-mono" style={{ color: "#4A5568" }}>Média/mês</div>
          <div className="text-sm font-bold font-mono" style={{ color: "#94A3B8" }}>{formatCurrency(avgMonthlyNeeded)}</div>
        </div>
        <div className="px-2.5 py-2 rounded-lg" style={{ background: "#0B1220", border: "1px solid #1C2333" }}>
          <div className="text-[9px] uppercase tracking-[1px] font-mono" style={{ color: "#4A5568" }}>Você está em</div>
          <div className="text-sm font-bold font-mono" style={{ color: statusColors[status] }}>
            {realizedPct.toFixed(0)}% {status === "a_frente" ? "↑" : status === "atras" ? "↓" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
