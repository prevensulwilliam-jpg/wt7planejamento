/**
 * LegalSummaryCard — widget compacto de status jurídico no /hoje.
 * Mostra contadores rápidos + click → /legal.
 */
import { useNavigate } from "react-router-dom";
import { Scale, AlertTriangle, ChevronRight, CheckCircle2 } from "lucide-react";
import { useLegalActionsSummary } from "@/hooks/useLegalActions";
import { Skeleton } from "@/components/ui/skeleton";

export function LegalSummaryCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useLegalActionsSummary();

  if (isLoading) return <Skeleton className="h-20 rounded-xl" style={{ background: "#0D1318" }} />;
  if (!data) return null;

  // Se não tem nada ativo, mostra estado positivo discreto
  if (data.total_active === 0) {
    return (
      <button
        onClick={() => navigate("/legal")}
        className="w-full rounded-xl p-3 border flex items-center justify-between text-left transition-colors hover:bg-white/5"
        style={{ background: "rgba(16,185,129,.04)", borderColor: "rgba(16,185,129,.3)" }}
      >
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-xs font-mono uppercase tracking-wider" style={{ color: "#34D399" }}>
              Jurídico em dia
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>
              Nenhuma ação pendente. {data.concluidos > 0 ? `${data.concluidos} concluída(s)` : ""}
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4" style={{ color: "#34D399" }} />
      </button>
    );
  }

  const hasUrgent = data.deadline_estourada > 0 || data.alta_prioridade_pendente > 0;
  const hasWarn = data.deadline_proxima > 0;

  return (
    <button
      onClick={() => navigate("/legal")}
      className="w-full rounded-xl p-4 border text-left transition-all hover:scale-[1.005]"
      style={{
        background: hasUrgent
          ? "rgba(244,63,94,.04)"
          : hasWarn
            ? "rgba(251,191,36,.04)"
            : "rgba(201,168,76,.04)",
        borderColor: hasUrgent
          ? "rgba(244,63,94,.3)"
          : hasWarn
            ? "rgba(251,191,36,.3)"
            : "rgba(201,168,76,.3)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Scale className="w-5 h-5" style={{ color: hasUrgent ? "#F43F5E" : hasWarn ? "#FBBF24" : "#C9A84C" }} />
          <div>
            <div className="flex items-center gap-2">
              <strong className="text-xs font-mono uppercase tracking-[1.5px]" style={{ color: "#E8C97A" }}>
                Jurídico
              </strong>
              {hasUrgent && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-red-300/10 text-red-300 border border-red-300/30">
                  ⚠️ atenção
                </span>
              )}
            </div>
            <p className="text-sm mt-0.5" style={{ color: "#F0F4F8" }}>
              <span className="font-bold">{data.total_active}</span> ação{data.total_active === 1 ? "" : "ões"} pendente{data.total_active === 1 ? "" : "s"}
              {data.alta_prioridade_pendente > 0 && (
                <span className="text-red-300 ml-2">· {data.alta_prioridade_pendente} alta prioridade</span>
              )}
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono" style={{ color: "#64748B" }}>
              {data.deadline_estourada > 0 && (
                <span className="text-red-400">🔴 {data.deadline_estourada} venc.</span>
              )}
              {data.deadline_proxima > 0 && (
                <span className="text-yellow-400">🟡 {data.deadline_proxima} em 30d</span>
              )}
              {data.em_andamento > 0 && (
                <span style={{ color: "#94A3B8" }}>{data.em_andamento} em andamento</span>
              )}
              {data.concluidos > 0 && (
                <span style={{ color: "#34D399" }}>✓ {data.concluidos} concluída(s)</span>
              )}
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4" style={{ color: "#94A3B8" }} />
      </div>
    </button>
  );
}
