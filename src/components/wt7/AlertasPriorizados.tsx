/**
 * AlertasPriorizados — Bloco 3 do /hoje v4.
 * Versão estilo Fathom Alerts Dashboard:
 *  - Lista ranqueada (critical → warning → info → ok)
 *  - 4-6 sinais discretos com ação direta
 *  - Diferente do NavalBriefing (narrativo) — aqui é checklist operacional
 */
import { useNavalAlerts } from "@/hooks/useNavalAlerts";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ChevronRight, BookmarkPlus } from "lucide-react";

// Semântica WT7: warning = amarelo (não dourado)
const SEVERITY_CSS: Record<string, { border: string; bg: string; dot: string; glow: string }> = {
  critical: { border: "rgba(244,63,94,.3)", bg: "rgba(244,63,94,.04)", dot: "#F43F5E", glow: "0 0 8px #F43F5E" },
  warning:  { border: "rgba(251,191,36,.3)", bg: "rgba(251,191,36,.04)", dot: "#FBBF24", glow: "0 0 8px #FBBF24" },
  info:     { border: "rgba(59,130,246,.3)", bg: "rgba(59,130,246,.04)", dot: "#3B82F6", glow: "0 0 8px #3B82F6" },
};

export function AlertasPriorizados() {
  const { data: alerts = [], isLoading } = useNavalAlerts();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  if (isLoading) return <Skeleton className="h-32 rounded-xl" style={{ background: "#0D1318" }} />;
  if (alerts.length === 0) return null;

  const top = alerts.slice(0, 6);

  const handlePromote = async (alertId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("wisely-ai", {
        body: {
          messages: [{ role: "user", content: `Use promote_alert_to_task com alert_id="${alertId}" pra hoje.` }],
          stream: false,
        },
      });
      if (error) throw error;
      toast({ title: "Alerta virou task", description: "Veja no Stream do Dia" });
      qc.invalidateQueries({ queryKey: ["daily_stream"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="rounded-xl p-4 border" style={{ background: "#0F141B", borderColor: "#1A2535" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" style={{ color: "#FBBF24" }} />
          <span className="text-[11px] font-mono uppercase tracking-[1.5px]" style={{ color: "#64748B" }}>
            Alertas priorizados · {alerts.length} ativo{alerts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => navigate("/naval")}
          className="text-[10px] flex items-center gap-1 hover:opacity-80"
          style={{ color: "#94A3B8" }}
        >
          tudo <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-1.5">
        {top.map(alert => {
          const css = SEVERITY_CSS[alert.severity] ?? SEVERITY_CSS.info;
          return (
            <div
              key={alert.id}
              className="grid items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:translate-x-0.5 group"
              style={{
                gridTemplateColumns: "auto 1fr auto auto",
                background: css.bg,
                border: "1px solid",
                borderColor: css.border,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: css.dot, boxShadow: css.glow }}
              />
              <div className="min-w-0">
                <b className="text-[13px] block truncate" style={{ color: "#F0F4F8" }}>{alert.title}</b>
                <span className="text-[11px] font-mono truncate block" style={{ color: "#64748B" }}>
                  {alert.message}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handlePromote(alert.id); }}
                className="opacity-0 group-hover:opacity-100 px-2 py-1 rounded text-[10px] flex items-center gap-1 transition-opacity"
                style={{
                  background: "rgba(167,139,250,.12)",
                  color: "#C4B5FD",
                  border: "1px solid rgba(167,139,250,.4)",
                }}
                title="Promover a task no Stream do Dia"
              >
                <BookmarkPlus className="w-3 h-3" /> task
              </button>
              <ChevronRight className="w-4 h-4" style={{ color: "#4A5568" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
