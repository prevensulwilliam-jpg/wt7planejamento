import { useNavigate } from "react-router-dom";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useSobraReinvestida, SOBRA_META_PCT } from "@/hooks/useSobraReinvestida";
import { formatCurrency } from "@/lib/formatters";
import { Gem, ChevronRight, Info, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const VECTOR_LABELS: Record<string, { label: string; emoji: string }> = {
  aporte_obra: { label: "Aporte Obra", emoji: "🧱" },
  dev_profissional_agora: { label: "Dev Pro", emoji: "⚡" },
  dev_pessoal_futuro: { label: "Dev Pessoal", emoji: "🧠" },
  produtividade_ferramentas: { label: "Ferramentas", emoji: "🛠️" },
  consorcios_aporte: { label: "Consórcios", emoji: "🔁" },
  outros_invest: { label: "Outros", emoji: "•" },
};

interface Props {
  month: string;
}

function InfoBadge({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="w-3 h-3 inline cursor-help opacity-60 hover:opacity-100" style={{ color: "#94A3B8" }} />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs" style={{ background: "#0D1318", border: "1px solid #1A2535", color: "#E2E8F0" }}>
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SobraReinvestidaCard({ month }: Props) {
  const navigate = useNavigate();
  const { data, isLoading, error } = useSobraReinvestida(month);

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) {
    return (
      <PremiumCard className="p-5">
        <p className="text-sm" style={{ color: "#F43F5E" }}>
          ⚠️ Erro ao calcular Sobra Reinvestida: {(error as any).message || String(error)}
        </p>
      </PremiumCard>
    );
  }
  if (!data) return null;

  const meta_ok = data.investido_pct >= SOBRA_META_PCT;
  const investColor = meta_ok ? "#10B981" : data.investido_pct >= 25 ? "#C9A84C" : "#F43F5E";
  const meta_valor = data.receita * (SOBRA_META_PCT / 100);

  // Fatias da barra (% da receita)
  const investPct = data.receita > 0 ? (data.investimento_total / data.receita) * 100 : 0;
  const custeioPct = data.receita > 0 ? (data.custeio_total / data.receita) * 100 : 0;
  const sobraPct = Math.max(0, 100 - investPct - custeioPct);

  const topVectors = Object.entries(data.byVector)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <PremiumCard className="p-5" glowColor={meta_ok ? "#10B981" : undefined}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-mono flex items-center gap-1.5" style={{ color: "#4A5568" }}>
            <Gem className="inline w-3.5 h-3.5" style={{ color: investColor }} />
            Sobra Reinvestida · meta ≥ {SOBRA_META_PCT}%
            <InfoBadge text="Fórmula canônica (metas.md): investimento / receita. Conta como 💎 só o que vira ativo gerador de patrimônio: aporte obra, consórcios, ferramentas, educação pro/pessoal." />
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className="text-6xl font-bold font-mono"
              style={{
                backgroundImage: meta_ok
                  ? "linear-gradient(135deg, #10B981, #34D399)"
                  : "linear-gradient(135deg, #10B981 0%, #E8C97A 60%, #C9A84C 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              {data.investido_pct.toFixed(0)}
            </span>
            <span className="text-2xl" style={{ color: "#64748B" }}>%</span>
            <span className="text-sm font-mono ml-2" style={{ color: "#94A3B8" }}>
              💎 {formatCurrency(data.investimento_total)} de {formatCurrency(data.receita)}
            </span>
          </div>
          {!meta_ok ? (
            <p className="text-xs mt-2 font-mono flex items-center gap-1" style={{ color: "#C9A84C" }}>
              <AlertTriangle className="w-3 h-3" />
              Faltam <span className="font-bold">{formatCurrency(data.gap_meta)}</span> ({(SOBRA_META_PCT - data.investido_pct).toFixed(0)} pts) pra meta {SOBRA_META_PCT}% ({formatCurrency(meta_valor)})
            </p>
          ) : (
            <p className="text-xs mt-2 font-mono" style={{ color: "#10B981" }}>
              ✓ Meta {SOBRA_META_PCT}% batida — +{formatCurrency(data.investimento_total - meta_valor)} acima do alvo
            </p>
          )}
        </div>

        <button
          onClick={() => navigate("/cards")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors h-fit"
          style={{
            background: "rgba(201,168,76,0.1)",
            color: "#C9A84C",
            border: "1px solid rgba(201,168,76,0.3)",
          }}
        >
          Ver cartões <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Barra de meta — só o investimento vs 50% */}
      <TooltipProvider delayDuration={100}>
        <div className="space-y-2 mb-5">
          <div className="flex justify-between text-[11px] font-mono" style={{ color: "#94A3B8" }}>
            <span>Progresso pra meta</span>
            <span>{data.investido_pct.toFixed(0)}% / {SOBRA_META_PCT}%</span>
          </div>
          <div style={{ position: "relative", height: 14, background: "#0B1220", borderRadius: 99, overflow: "hidden", border: "1px solid #1A2535" }}>
            <div
              style={{
                position: "absolute", top: 0, left: 0, height: "100%",
                width: `${Math.min(100, (data.investido_pct / SOBRA_META_PCT) * 100)}%`,
                background: meta_ok
                  ? "linear-gradient(90deg, #10B981, #34D399)"
                  : "linear-gradient(90deg, #10B981, #E8C97A)",
                boxShadow: "0 0 12px rgba(16,185,129,0.4)",
              }}
            />
            <div style={{ position: "absolute", top: -2, right: 0, height: "calc(100% + 4px)", width: 2, background: "#FDE68A", opacity: 0.9, boxShadow: "0 0 6px rgba(253,230,138,0.6)" }} />
          </div>
        </div>

        {/* 3 cards: Receita / 💎 Investido / Potencial (sobra livre) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          {/* Receita */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-3 rounded-lg cursor-help transition-colors hover:bg-white/5" style={{ border: "1px solid #1A2535" }}>
                <p className="text-[10px] uppercase tracking-wider font-mono flex items-center gap-1" style={{ color: "#4A5568" }}>
                  Receita <Info className="w-2.5 h-2.5 opacity-50" />
                </p>
                <p className="font-mono font-bold text-lg mt-0.5" style={{ color: "#F0F4F8" }}>{formatCurrency(data.receita)}</p>
                <p className="text-[10px]" style={{ color: "#64748B" }}>entrada total do mês</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs" style={{ background: "#0D1318", border: "1px solid #1A2535", color: "#E2E8F0" }}>
              Soma de tudo em <code>revenues</code> com reference_month = {month}. Inclui aluguel kitnets, comissões Prevensul, CLT, T7 (futuro).
            </TooltipContent>
          </Tooltip>

          {/* 💎 Investido real */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-3 rounded-lg cursor-help transition-colors hover:bg-emerald-500/5" style={{ border: "1px solid rgba(16,185,129,0.25)" }}>
                <p className="text-[10px] uppercase tracking-wider font-mono flex items-center gap-1" style={{ color: "#10B981" }}>
                  <Gem className="w-2.5 h-2.5" /> Investido real
                </p>
                <p className="font-mono font-bold text-lg mt-0.5" style={{ color: "#10B981" }}>{formatCurrency(data.investimento_total)}</p>
                <p className="text-[10px]" style={{ color: "#64748B" }}>
                  {formatCurrency(data.investimento_cartao)} cartão · {formatCurrency(data.investimento_expenses)} desp
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs" style={{ background: "#0D1318", border: "1px solid #1A2535", color: "#E2E8F0" }}>
              Tx marcadas <b>💎 counts_as_investment</b> em cartões + despesas. É o número que conta pra meta ≥50%. Categorize mais coisas como 💎 pra aumentar.
            </TooltipContent>
          </Tooltip>

          {/* Potencial (sobra livre) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-3 rounded-lg cursor-help transition-colors hover:bg-amber-500/5" style={{ border: "1px solid rgba(201,168,76,0.25)" }}>
                <p className="text-[10px] uppercase tracking-wider font-mono flex items-center gap-1" style={{ color: "#C9A84C" }}>
                  Potencial <Info className="w-2.5 h-2.5 opacity-50" />
                </p>
                <p className="font-mono font-bold text-lg mt-0.5" style={{ color: "#C9A84C" }}>{formatCurrency(data.sobra_bruta - data.investimento_total)}</p>
                <p className="text-[10px]" style={{ color: "#64748B" }}>sobra não alocada</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs" style={{ background: "#0D1318", border: "1px solid #1A2535", color: "#E2E8F0" }}>
              Sobrou depois do custeio, mas ainda NÃO virou ativo. Realoca em obra/consórcio/ferramenta pra virar 💎. Se ficar parado, é caixa ocioso.
            </TooltipContent>
          </Tooltip>

          {/* Custeio */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-3 rounded-lg cursor-help transition-colors hover:bg-rose-500/5" style={{ border: "1px solid rgba(244,63,94,0.25)" }}>
                <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "#F43F5E" }}>Custeio</p>
                <p className="font-mono font-bold text-lg mt-0.5" style={{ color: "#F43F5E" }}>{formatCurrency(data.custeio_total)}</p>
                <p className="text-[10px]" style={{ color: "#64748B" }}>
                  {formatCurrency(data.custeio_expenses)} desp · {formatCurrency(data.custeio_cartao)} cartão
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs" style={{ background: "#0D1318", border: "1px solid #1A2535", color: "#E2E8F0" }}>
              Custo de vida: aluguel, consumo, Rampage, clubes, saúde. Pagamentos de fatura de cartão foram excluídos ({formatCurrency(data.card_payments_ignored)} ignorado{data.card_payments_ignored > 0 ? "" : ""}) pra não duplicar com tx individuais.
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Barra de distribuição secundária — full width */}
      <div className="space-y-1 mb-4">
        <div className="flex justify-between text-[10px] font-mono" style={{ color: "#64748B" }}>
          <span>Distribuição da receita</span>
          <span>
            <span style={{ color: "#F43F5E" }}>{custeioPct.toFixed(0)}% custeio</span>
            {" · "}
            <span style={{ color: "#10B981" }}>{investPct.toFixed(0)}% 💎</span>
            {" · "}
            <span style={{ color: "#C9A84C" }}>{sobraPct.toFixed(0)}% livre</span>
          </span>
        </div>
        <div style={{ position: "relative", height: 6, background: "#0B1220", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${investPct}%`, background: "#10B981" }} />
          <div style={{ position: "absolute", top: 0, left: `${investPct}%`, height: "100%", width: `${sobraPct}%`, background: "#C9A84C", opacity: 0.8 }} />
          <div style={{ position: "absolute", top: 0, left: `${investPct + sobraPct}%`, height: "100%", width: `${custeioPct}%`, background: "#F43F5E" }} />
        </div>
      </div>

      {/* Top vetores 💎 */}
      {topVectors.length > 0 && (
        <div className="pt-3 border-t border-white/5">
          <p className="text-[11px] uppercase tracking-wider font-mono mb-2 flex items-center gap-1" style={{ color: "#4A5568" }}>
            💎 Onde está indo o investimento
            <InfoBadge text="Agregado por vetor canônico: aporte_obra (kitnets + obras), dev_pro, dev_pessoal, ferramentas, consórcios. Somando cartão + despesas." />
          </p>
          <div className="flex flex-wrap gap-2">
            {topVectors.map(([vec, val]) => {
              const meta = VECTOR_LABELS[vec] || { label: vec, emoji: "•" };
              const pct = data.investimento_total > 0 ? (val / data.investimento_total) * 100 : 0;
              return (
                <div
                  key={vec}
                  className="px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10B981" }}
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                  <span className="opacity-60">·</span>
                  <span className="font-bold">{formatCurrency(val)}</span>
                  <span className="text-[10px] opacity-60">({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Call-to-action pra bater a meta */}
      {!meta_ok && data.gap_meta > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5 text-xs flex items-start gap-2" style={{ color: "#94A3B8" }}>
          <span style={{ color: "#C9A84C" }}>🎯</span>
          <span>
            Pra bater <span style={{ color: "#10B981" }}>{SOBRA_META_PCT}%</span> neste mês, realoca{" "}
            <span className="font-mono font-bold" style={{ color: "#C9A84C" }}>{formatCurrency(data.gap_meta)}</span>{" "}
            do "potencial" pra obra, consórcio ou ferramenta. Ou categoriza tx de cartão que ainda estão como custeio mas são aporte/dev/ferramenta.
          </span>
        </div>
      )}
    </PremiumCard>
  );
}
