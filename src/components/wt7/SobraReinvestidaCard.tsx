import { useNavigate } from "react-router-dom";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useSobraReinvestida, SOBRA_META_PCT } from "@/hooks/useSobraReinvestida";
import { formatCurrency } from "@/lib/formatters";
import { Gem, ChevronRight } from "lucide-react";

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

export function SobraReinvestidaCard({ month }: Props) {
  const navigate = useNavigate();
  const { data, isLoading } = useSobraReinvestida(month);

  if (isLoading || !data) {
    return <Skeleton className="h-48" />;
  }

  const meta_ok = data.sobra_pct >= SOBRA_META_PCT;
  const color = meta_ok ? "#10B981" : data.sobra_pct >= 30 ? "#C9A84C" : "#F43F5E";

  // fatias da barra (% da receita)
  const investPct = data.receita > 0 ? (data.investimento_total / data.receita) * 100 : 0;
  const custeioPct = data.receita > 0 ? (data.custeio_total / data.receita) * 100 : 0;
  const sobraPct = Math.max(0, 100 - investPct - custeioPct);

  const topVectors = Object.entries(data.byVector)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <PremiumCard className="p-5" glowColor={meta_ok ? "#10B981" : undefined}>
      <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-mono" style={{ color: "#4A5568" }}>
            <Gem className="inline w-3.5 h-3.5 mr-1" style={{ color }} />
            Sobra Reinvestida · meta ≥ {SOBRA_META_PCT}%
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-5xl font-bold font-mono" style={{ color }}>
              {data.sobra_pct.toFixed(0)}
            </span>
            <span className="text-xl" style={{ color: "#64748B" }}>%</span>
            <span className="text-sm font-mono ml-2" style={{ color: "#94A3B8" }}>
              ({formatCurrency(data.sobra_bruta)} de {formatCurrency(data.receita)})
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate("/cards")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: "rgba(201,168,76,0.1)",
            color: "#C9A84C",
            border: "1px solid rgba(201,168,76,0.3)",
          }}
        >
          Ver cartões <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Barra empilhada: custeio | 💎 invest | sobra disponível */}
      <div className="space-y-2">
        <div className="flex justify-between text-[11px] font-mono" style={{ color: "#94A3B8" }}>
          <span style={{ color: "#F43F5E" }}>● Custeio {custeioPct.toFixed(0)}%</span>
          <span style={{ color: "#10B981" }}>● 💎 Investimento {investPct.toFixed(0)}%</span>
          <span style={{ color: "#C9A84C" }}>● Sobra livre {sobraPct.toFixed(0)}%</span>
        </div>
        <div style={{ position: "relative", height: 16, background: "#1A2535", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${custeioPct}%`, background: "linear-gradient(90deg, #F43F5E, #FB7185)" }} />
          <div style={{ position: "absolute", top: 0, left: `${custeioPct}%`, height: "100%", width: `${investPct}%`, background: "linear-gradient(90deg, #10B981, #34D399)" }} />
          <div style={{ position: "absolute", top: 0, left: `${custeioPct + investPct}%`, height: "100%", width: `${sobraPct}%`, background: "linear-gradient(90deg, #C9A84C, #E8C97A)", opacity: 0.7 }} />
          {/* Marcador 50% */}
          <div style={{ position: "absolute", top: 0, left: `${SOBRA_META_PCT}%`, height: "100%", width: 2, background: "#E8C97A", opacity: 0.9 }} title={`Meta ${SOBRA_META_PCT}%`} />
        </div>
      </div>

      {/* Breakdown financeiro */}
      <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
        <div>
          <p className="uppercase tracking-wider font-mono" style={{ color: "#4A5568" }}>Receita</p>
          <p className="font-mono font-bold mt-0.5" style={{ color: "#F0F4F8" }}>{formatCurrency(data.receita)}</p>
        </div>
        <div>
          <p className="uppercase tracking-wider font-mono" style={{ color: "#4A5568" }}>Custeio total</p>
          <p className="font-mono font-bold mt-0.5" style={{ color: "#F43F5E" }}>{formatCurrency(data.custeio_total)}</p>
          <p className="text-[10px]" style={{ color: "#64748B" }}>
            {formatCurrency(data.custeio_expenses)} desp · {formatCurrency(data.custeio_cartao)} cartão
          </p>
        </div>
        <div>
          <p className="uppercase tracking-wider font-mono" style={{ color: "#4A5568" }}>💎 Investimento</p>
          <p className="font-mono font-bold mt-0.5" style={{ color: "#10B981" }}>{formatCurrency(data.investimento_total)}</p>
          <p className="text-[10px]" style={{ color: "#64748B" }}>
            {formatCurrency(data.investimento_cartao)} cartão · {formatCurrency(data.investimento_expenses)} desp
          </p>
        </div>
      </div>

      {/* Top vetores 💎 */}
      {topVectors.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-[11px] uppercase tracking-wider font-mono mb-2" style={{ color: "#4A5568" }}>
            Top vetores de investimento (cartão)
          </p>
          <div className="flex flex-wrap gap-2">
            {topVectors.map(([vec, val]) => {
              const meta = VECTOR_LABELS[vec] || { label: vec, emoji: "•" };
              return (
                <div key={vec} className="px-2 py-1 rounded text-xs font-mono"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10B981" }}>
                  {meta.emoji} {meta.label} · {formatCurrency(val)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PremiumCard>
  );
}
