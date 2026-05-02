/**
 * PipelineCompact — Pipeline Prevensul resumido em 6 linhas.
 * Lê prevensul_billing latest reference_month, ordena por balance_remaining,
 * mostra top 6 com stage (manual ou derivado de closing_date).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { useNavigate } from "react-router-dom";
import { Flame, ChevronRight } from "lucide-react";

type Row = {
  client_name: string;
  balance_remaining: number;
  closing_date: string | null;
  pipeline_stage: string | null;
};

function deriveStage(row: Row): "quente" | "proposta" | "fechando" {
  if (row.pipeline_stage === "fechando" || row.pipeline_stage === "ganho") return "fechando";
  if (row.pipeline_stage === "proposta") return "proposta";
  if (row.pipeline_stage === "quente" || row.pipeline_stage === "perdido") return "quente";
  // Fallback: deriva de closing_date
  if (!row.closing_date) return "quente";
  const dias = (new Date(row.closing_date).getTime() - Date.now()) / 86400000;
  if (dias < 30) return "fechando";
  if (dias < 90) return "proposta";
  return "quente";
}

const STAGE_CSS: Record<string, { bg: string; color: string; label: string }> = {
  quente:    { bg: "rgba(244,63,94,.12)",  color: "#E11D48",  label: "QUENTE" },
  proposta:  { bg: "rgba(201,168,76,.12)", color: "#E8C97A",  label: "PROPOSTA" },
  fechando:  { bg: "rgba(16,185,129,.12)", color: "#34D399",  label: "FECHANDO" },
};

export function PipelineCompact() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<Row[]>({
    queryKey: ["pipeline_compact"],
    queryFn: async () => {
      // Pega o reference_month mais recente
      const { data: latestData } = await (supabase as any)
        .from("prevensul_billing")
        .select("reference_month")
        .order("reference_month", { ascending: false })
        .limit(1);
      const latest = (latestData ?? [])[0]?.reference_month;
      if (!latest) return [];

      const { data: rows } = await (supabase as any)
        .from("prevensul_billing")
        .select("client_name, balance_remaining, closing_date, pipeline_stage")
        .eq("reference_month", latest)
        .gt("balance_remaining", 0)
        .order("balance_remaining", { ascending: false });
      return (rows ?? []) as Row[];
    },
  });

  if (isLoading) return <Skeleton className="h-64 rounded-xl" style={{ background: "#0D1318" }} />;
  const rows = data ?? [];
  const top = rows.slice(0, 6);
  const totalSaldo = rows.reduce((s, r) => s + Number(r.balance_remaining ?? 0), 0);

  return (
    <div
      className="rounded-xl p-4 border h-full"
      style={{ background: "#0F141B", borderColor: "#1A2535" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4" style={{ color: "#F43F5E" }} />
          <span className="text-[11px] font-mono uppercase tracking-[1.5px]" style={{ color: "#64748B" }}>
            Pipeline · {rows.length} contratos · {formatCurrency(totalSaldo)}
          </span>
        </div>
        <button
          onClick={() => navigate("/commissions/portal")}
          className="text-[10px] flex items-center gap-1 hover:opacity-80"
          style={{ color: "#94A3B8" }}
        >
          CRM <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {top.length === 0 ? (
        <p className="text-xs" style={{ color: "#94A3B8" }}>Nenhum contrato pendente.</p>
      ) : (
        <div className="space-y-1.5">
          {top.map((r, i) => {
            const stage = deriveStage(r);
            const css = STAGE_CSS[stage];
            return (
              <div
                key={i}
                className="grid items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-mono"
                style={{
                  gridTemplateColumns: "1fr auto auto",
                  background: "#0B1220",
                  border: "1px solid #1C2333",
                }}
              >
                <span style={{ color: "#94A3B8" }} className="truncate">{r.client_name}</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[9px] tracking-wider uppercase"
                  style={{ background: css.bg, color: css.color }}
                >
                  {css.label}
                </span>
                <span className="font-bold" style={{ color: "#E8C97A" }}>{formatCurrency(r.balance_remaining)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
