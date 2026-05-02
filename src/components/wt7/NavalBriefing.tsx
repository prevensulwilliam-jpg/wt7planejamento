/**
 * NavalBriefing — Bloco 2 do /hoje v4.
 * Narrativa diária do Naval (1 cascata escolhida + opcional expand de outras).
 */
import { useState } from "react";
import { useNavalBriefing, useRefreshBriefing, type CascadeStatus } from "@/hooks/useNavalBriefing";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, Bot } from "lucide-react";

const SEVERITY_COLORS = {
  critical: "#F43F5E",
  warning: "#C9A84C",
  info: "#3B82F6",
};

function CascadePill({ cascade }: { cascade: CascadeStatus }) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] leading-relaxed"
      style={{
        background: cascade.active ? "rgba(167,139,250,.06)" : "#141A24",
        border: "1px solid",
        borderColor: cascade.active ? "rgba(167,139,250,.4)" : "#1C2333",
      }}
    >
      <span
        className="px-1.5 py-0.5 rounded-full text-[9px] font-mono tracking-wider flex-shrink-0"
        style={{
          background: cascade.active ? "rgba(167,139,250,.2)" : "#1A2535",
          color: cascade.active ? "#C4B5FD" : "#4A5568",
        }}
      >
        {cascade.id} · {cascade.active ? "ATIVA" : "INATIVA"}
      </span>
      <span style={{ color: cascade.active ? "#E8C97A" : "#94A3B8" }}>
        <b style={{ color: cascade.active ? "#E8C97A" : "#F0F4F8" }}>{cascade.title}</b>
        {cascade.context && (
          <span className="text-[10px] ml-1" style={{ color: "#64748B" }}>· {cascade.context}</span>
        )}
      </span>
    </div>
  );
}

export function NavalBriefing() {
  const { data: briefing, isLoading } = useNavalBriefing();
  const refreshMutation = useRefreshBriefing();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) return <Skeleton className="h-32 rounded-xl" style={{ background: "#0D1318" }} />;
  if (!briefing) return null;

  const handleRefresh = async () => {
    try {
      const r = await refreshMutation.mutateAsync();
      toast({ title: "Briefing atualizado", description: r.message ?? "Naval gerou nova narrativa" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const hasNarrative = briefing.narrative && !briefing.is_stale;
  const chosen = briefing.chosen;

  // Se não houve cascata ativa nem narrativa
  if (!chosen && !hasNarrative) {
    return (
      <div
        className="rounded-xl p-4 border"
        style={{
          background: "linear-gradient(135deg, rgba(16,185,129,.06), rgba(201,168,76,.04))",
          borderColor: "rgba(16,185,129,.3)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-base"
            style={{
              background: "radial-gradient(circle, #10B981, #059669)",
              boxShadow: "0 0 20px rgba(16,185,129,.5)",
            }}
          >
            ✓
          </div>
          <div className="flex-1">
            <strong className="text-[12px] uppercase tracking-wider block mb-1" style={{ color: "#34D399" }}>
              Briefing do dia
            </strong>
            <p className="text-[13px]" style={{ color: "#F0F4F8" }}>
              Nenhum alerta financeiro ativo hoje. Tudo no rumo. Use o tempo pra avançar uma decisão estratégica.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Se há cascata mas sem narrativa cacheada — gera ao primeiro click
  const severityColor = chosen ? SEVERITY_COLORS[chosen.severity] : "#A78BFA";
  const generatedDate = briefing.generated_at
    ? new Date(briefing.generated_at).toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      className="rounded-2xl p-4 border"
      style={{
        background: "linear-gradient(135deg, rgba(167,139,250,.06), rgba(201,168,76,.04))",
        borderColor: "rgba(167,139,250,.2)",
      }}
    >
      <div className="grid items-start gap-4" style={{ gridTemplateColumns: "42px 1fr auto" }}>
        {/* Avatar */}
        <div
          className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-base"
          style={{
            background: "radial-gradient(circle, #A78BFA, #6D28D9)",
            boxShadow: "0 0 20px rgba(167,139,250,.5)",
          }}
        >
          <Sparkles className="w-5 h-5 text-white" />
        </div>

        {/* Body */}
        <div className="min-w-0">
          <strong
            className="text-[12px] uppercase tracking-wider block mb-1.5"
            style={{ color: "#E8C97A" }}
          >
            Briefing do dia
            {chosen && (
              <span className="ml-2 text-[10px] font-normal" style={{ color: severityColor }}>
                · alerta #{chosen.id} {chosen.severity}
              </span>
            )}
          </strong>

          {hasNarrative ? (
            <p className="text-[13px] leading-relaxed" style={{ color: "#F0F4F8", maxWidth: 780 }}>
              {briefing.narrative}
            </p>
          ) : (
            <p className="text-[13px]" style={{ color: "#94A3B8" }}>
              {chosen?.title} — clique em <b style={{ color: "#E8C97A" }}>🔄 Gerar</b> pra Naval criar a análise.
            </p>
          )}

          {generatedDate && (
            <span
              className="text-[10px] font-mono mt-2 block"
              style={{ color: "#4A5568", letterSpacing: 1 }}
            >
              gerado: {generatedDate} · {briefing.active_cascades.length} alerta(s) ativo(s)
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 items-end">
          <button
            onClick={() => navigate("/naval")}
            className="px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 hover:opacity-80"
            style={{
              background: "rgba(16,185,129,.12)",
              color: "#34D399",
              border: "1px solid rgba(16,185,129,.4)",
            }}
          >
            <Bot className="w-3 h-3" /> Conversar
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshMutation.isPending}
            className="px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 hover:opacity-80 disabled:opacity-50"
            style={{
              background: "rgba(167,139,250,.1)",
              color: "#C4B5FD",
              border: "1px solid rgba(167,139,250,.4)",
            }}
          >
            <RefreshCw className={`w-3 h-3 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            {hasNarrative ? "Atualizar" : "Gerar"}
          </button>
          {briefing.active_cascades.length > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 hover:opacity-80"
              style={{
                background: "rgba(255,255,255,.02)",
                color: "#94A3B8",
                border: "1px solid #1A2535",
              }}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Ocultar" : `${briefing.active_cascades.length} alertas`}
            </button>
          )}
        </div>
      </div>

      {/* Expand das cascatas */}
      {expanded && briefing.active_cascades.length > 0 && (
        <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: "#1A2535" }}>
          <div className="text-[11px] font-mono uppercase tracking-[1.5px] mb-2" style={{ color: "#64748B" }}>
            🚨 alertas financeiros
          </div>
          {briefing.active_cascades.map(c => <CascadePill key={c.id} cascade={c} />)}
        </div>
      )}
    </div>
  );
}
