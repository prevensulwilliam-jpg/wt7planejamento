/**
 * WhatsAppShareButton — Bloco final do /hoje v4.
 * Gera resumo formatado do dia + share via WhatsApp Web.
 * Sprint 4.5 (cereja) conecta Evolution API pra notificações automáticas.
 */
import { useState } from "react";
import { useStatusBarKPIs } from "@/hooks/useStatusBarKPIs";
import { useNavalAlerts } from "@/hooks/useNavalAlerts";
import { useDailyStream } from "@/hooks/useDailyStream";
import { useNavalBriefing } from "@/hooks/useNavalBriefing";
import { useGoalsActive } from "@/hooks/useGoalsActive";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Share2 } from "lucide-react";

type Props = { month: string };

function fmtBR(n: number): string {
  return formatCurrency(n).replace(/^R\$\s*/, "R$ ");
}

export function WhatsAppShareButton({ month }: Props) {
  const { data: kpis } = useStatusBarKPIs(month);
  const { data: alerts = [] } = useNavalAlerts();
  const { data: stream } = useDailyStream();
  const { data: briefing } = useNavalBriefing();
  const { data: goals = [] } = useGoalsActive({ metric: "revenue", period_type: "yearly" });
  const { toast } = useToast();
  const [copying, setCopying] = useState(false);

  const generate = (): string => {
    const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const lines: string[] = [`🧭 *WT7 · Hoje ${today}*`, ""];

    // KPIs
    if (kpis) {
      lines.push(
        `💰 *Faturamento:* ${fmtBR(kpis.faturamento.value)} ${kpis.faturamento.delta_label ? `(${kpis.faturamento.delta_label})` : ""}`,
      );
      lines.push(`📊 *Sobra Reinvestida:* ${Math.round(kpis.sobra.value)}% (${kpis.sobra.delta_label})`);
      lines.push(`💵 *Caixa:* ${fmtBR(kpis.caixa.value)}`);
      lines.push(`🏠 *Renda Passiva:* ${fmtBR(kpis.renda_passiva.value)}`);
      lines.push("");
    }

    // Caminho da meta
    const yearGoal = (goals ?? []).find(g => g.period_type === "yearly");
    if (yearGoal) {
      lines.push(`🎯 *${yearGoal.name}:* ${yearGoal.progress_pct.toFixed(1)}% YTD (${fmtBR(yearGoal.current_value)} de ${fmtBR(yearGoal.target_value)})`);
      lines.push("");
    }

    // Naval briefing
    if (briefing?.narrative) {
      lines.push(`🤖 *Naval:*`);
      lines.push(briefing.narrative.slice(0, 280));
      lines.push("");
    }

    // Alertas críticos
    const critical = alerts.filter(a => a.severity === "critical");
    if (critical.length > 0) {
      lines.push(`🚨 *Alertas críticos (${critical.length}):*`);
      critical.slice(0, 3).forEach(a => lines.push(`• ${a.title}`));
      lines.push("");
    }

    // Stream do dia (top 4)
    if (stream && stream.items.length > 0) {
      lines.push(`📋 *Hoje (${stream.summary.total} itens):*`);
      stream.items.slice(0, 4).forEach(it => {
        const sign = it.kind === "in" ? "+" : it.kind === "out" ? "−" : "→";
        const amt = it.amount ? `${sign}${fmtBR(Math.abs(it.amount))}` : "";
        lines.push(`• ${it.time} ${it.title} ${amt}`);
      });
      if (stream.items.length > 4) lines.push(`... +${stream.items.length - 4}`);
      lines.push("");
    }

    lines.push(`→ wt7planejamento.lovable.app/hoje`);
    return lines.join("\n");
  };

  const handleShare = async () => {
    setCopying(true);
    try {
      const text = generate();
      // 1. Tenta Web Share API (mobile native)
      if ("share" in navigator) {
        try {
          await (navigator as any).share({ text, title: "WT7 · Hoje" });
          toast({ title: "Compartilhado" });
          return;
        } catch {
          // Cancelou ou não suportado — fallback
        }
      }
      // 2. Fallback: abre WhatsApp Web com texto
      const encoded = encodeURIComponent(text);
      window.open(`https://wa.me/?text=${encoded}`, "_blank");
      // 3. Também copia pra clipboard
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: "WhatsApp aberto", description: "Texto também copiado pro clipboard" });
      } catch {
        toast({ title: "WhatsApp aberto" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setCopying(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={copying}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-[12px] uppercase tracking-wider transition-all hover:-translate-y-0.5 disabled:opacity-50"
      style={{
        background: "linear-gradient(135deg, rgba(37,211,102,.12), rgba(37,211,102,.06))",
        border: "1px solid rgba(37,211,102,.4)",
        color: "#25D366",
      }}
    >
      <Share2 className="w-4 h-4" />
      {copying ? "Gerando..." : "📱 Compartilhar resumo do dia"}
    </button>
  );
}
