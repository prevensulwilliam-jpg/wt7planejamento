/**
 * AutonomyCompact — versão compacta do Índice de Autonomia pro /hoje v4.
 * 1 linha enxuta + decomposição expandível por vetor (Passiva/Eventual/Ativa).
 */
import { useState } from "react";
import { useAutonomyIndex } from "@/hooks/useAutonomyIndex";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { useNavigate } from "react-router-dom";
import { Compass, ChevronRight, ChevronDown } from "lucide-react";

type Props = { month: string };

const TARGET_PCT = 50;

export function AutonomyCompact({ month }: Props) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const { data: snap, isLoading } = useAutonomyIndex(month);

  if (isLoading) return <Skeleton className="h-32 rounded-xl" style={{ background: "#0D1318" }} />;
  if (!snap) return null;

  const pct = Math.round(snap.autonomyPct);
  const passiva = (snap as any).passive ?? 0;
  const eventual = (snap as any).eventual ?? 0;
  const ativa = (snap as any).active ?? 0;
  const totalRecorrente = passiva + eventual;
  const gap = TARGET_PCT - pct;

  return (
    <div
      className="rounded-xl p-4 border h-full flex flex-col"
      style={{ background: "#0F141B", borderColor: "#1A2535" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4" style={{ color: "#C9A84C" }} />
          <span className="text-[11px] font-mono uppercase tracking-[1.5px]" style={{ color: "#64748B" }}>
            Índice de Autonomia
          </span>
        </div>
        <button
          onClick={() => navigate("/hoje")}
          className="text-[10px] flex items-center gap-1 hover:opacity-80"
          style={{ color: "#94A3B8" }}
        >
          histórico <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div
        onClick={() => setExpanded(v => !v)}
        className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors hover:border-[#C9A84C]"
        style={{ background: "#0B1220", border: "1px solid #1C2333" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-3xl font-bold font-mono leading-none"
            style={{
              backgroundImage: "linear-gradient(135deg,#10B981,#E8C97A)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            {pct}%
          </span>
          <div className="text-[11px] font-mono" style={{ color: "#64748B" }}>
            <div className="font-semibold mb-0.5" style={{ color: "#94A3B8", fontSize: 12 }}>{month} · trajetória 2028</div>
            <span>{formatCurrency(totalRecorrente)} autônoma · meta <b style={{ color: "#94A3B8" }}>{TARGET_PCT}%</b> · gap <b style={{ color: gap > 0 ? "#F43F5E" : "#10B981" }}>{Math.abs(gap)}pp</b></span>
          </div>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4" style={{ color: "#C9A84C" }} /> : <ChevronRight className="w-4 h-4" style={{ color: "#C9A84C" }} />}
      </div>

      {expanded && (
        <div className="grid grid-cols-3 gap-2 mt-2.5">
          <div className="p-2.5 rounded-lg" style={{ background: "#0B1220", border: "1px solid #1C2333" }}>
            <div className="text-[10px] font-mono tracking-wider" style={{ color: "#10B981" }}>● Passiva {formatCurrency(passiva)}</div>
            <div className="text-[10px] mt-1.5" style={{ color: "#94A3B8" }}>Aluguéis kitnets, JW7, RWT05.</div>
          </div>
          <div className="p-2.5 rounded-lg" style={{ background: "#0B1220", border: "1px solid #1C2333" }}>
            <div className="text-[10px] font-mono tracking-wider" style={{ color: "#E8C97A" }}>● Eventual {formatCurrency(eventual)}</div>
            <div className="text-[10px] mt-1.5" style={{ color: "#94A3B8" }}>T7/TDI, CW7, comissões externas.</div>
          </div>
          <div className="p-2.5 rounded-lg" style={{ background: "#0B1220", border: "1px solid #1C2333" }}>
            <div className="text-[10px] font-mono tracking-wider" style={{ color: "#F43F5E" }}>● Ativa {formatCurrency(ativa)}</div>
            <div className="text-[10px] mt-1.5" style={{ color: "#94A3B8" }}>Prevensul (CLT + comissões).</div>
          </div>
        </div>
      )}
    </div>
  );
}
