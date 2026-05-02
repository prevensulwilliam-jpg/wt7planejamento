/**
 * StatusBar — 5 KPIs em linha no topo do /hoje v4.
 * Inspiração: Fathom KPI Summary + Monarch widgets.
 */
import { useStatusBarKPIs, type KpiData } from "@/hooks/useStatusBarKPIs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { useNavigate } from "react-router-dom";

type Props = { month: string };

const STATUS_COLORS: Record<KpiData["status"], { left: string; value: string; spark: string }> = {
  green: { left: "#10B981", value: "#34D399", spark: "#10B981" },
  gold: { left: "#C9A84C", value: "#E8C97A", spark: "#C9A84C" },
  red: { left: "#F43F5E", value: "#F43F5E", spark: "#F43F5E" },
  blue: { left: "#3B82F6", value: "#3B82F6", spark: "#3B82F6" },
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return <svg className="h-[18px] w-full" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 18 - ((v - min) / range) * 16 - 1;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="h-[18px] w-full mt-1.5" viewBox="0 0 100 18" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function KPICell({
  kpi,
  formatAs = "currency",
  onClick,
}: {
  kpi: KpiData;
  formatAs?: "currency" | "percent";
  onClick?: () => void;
}) {
  const colors = STATUS_COLORS[kpi.status];
  const displayValue =
    formatAs === "percent"
      ? `${Math.round(kpi.value)}%`
      : formatCurrency(kpi.value);

  return (
    <div
      onClick={onClick}
      className="cell relative cursor-pointer transition-all px-4 py-3.5 border-r last:border-r-0 hover:bg-[#141A24]"
      style={{ borderColor: "#1A2535" }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: colors.left }}
      />
      <div className="text-[9px] tracking-[1.5px] uppercase font-mono" style={{ color: "#4A5568" }}>
        {kpi.label}
      </div>
      <div className="text-[22px] font-bold font-mono mt-1.5 leading-none" style={{ color: colors.value }}>
        {displayValue}
      </div>
      {kpi.delta_label && (
        <div className="text-[10px] font-mono mt-1" style={{ color: "#64748B" }}>
          {kpi.delta_label}
        </div>
      )}
      <Sparkline data={kpi.spark} color={colors.spark} />
    </div>
  );
}

export function StatusBar({ month }: Props) {
  const { data: kpis, isLoading } = useStatusBarKPIs(month);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border rounded-2xl overflow-hidden" style={{ borderColor: "#1A2535", background: "#0F141B" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px]" style={{ background: "#0D1318", borderRadius: 0 }} />
        ))}
      </div>
    );
  }
  if (!kpis) return null;

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-5 gap-0 border rounded-2xl overflow-hidden"
      style={{ borderColor: "#1A2535", background: "#0F141B" }}
    >
      <KPICell kpi={kpis.faturamento} onClick={() => navigate("/dre")} />
      <KPICell kpi={kpis.caixa} onClick={() => navigate("/banks")} />
      <KPICell kpi={kpis.comissoes_receber} onClick={() => navigate("/commissions/portal")} />
      <KPICell kpi={kpis.renda_passiva} onClick={() => navigate("/kitnets")} />
      <KPICell kpi={kpis.sobra} formatAs="percent" onClick={() => navigate("/dre")} />
    </div>
  );
}
