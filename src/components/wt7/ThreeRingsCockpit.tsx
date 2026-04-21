import { useSobraReinvestida, SOBRA_META_PCT } from "@/hooks/useSobraReinvestida";
import { PremiumCard } from "./PremiumCard";
import { formatCurrency } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";

type Props = { month: string };

/**
 * 3 anéis concêntricos — fotografia canônica do mês em 1 olhada.
 *
 * Anel 1 (fora, dourado): Receita Real ÷ meta mensal (hoje hardcoded R$85k —
 *   depois puxar de goals se precisar).
 * Anel 2 (meio, vermelho): Custeio ÷ Receita (alerta se >50%).
 * Anel 3 (dentro, verde): Investimento ÷ Receita (META ≥50%).
 *
 * Se Anel 3 fecha verde → mês está no CAGR 17,3% a.a. pra bater R$70M/2041.
 */
const RECEITA_META_MENSAL = 85000; // TODO: puxar de /goals quando tiver

function Ring({ pct, color, radius, stroke, track = "#1A2535" }: {
  pct: number; color: string; radius: number; stroke: number; track?: string;
}) {
  const circ = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circ - (clamped / 100) * circ;
  return (
    <>
      <circle cx={120} cy={120} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={120} cy={120} r={radius} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 120 120)"
        style={{ transition: "stroke-dashoffset 0.8s ease-out", filter: `drop-shadow(0 0 4px ${color}88)` }}
      />
    </>
  );
}

export function ThreeRingsCockpit({ month }: Props) {
  const { data: sobra, isLoading } = useSobraReinvestida(month);

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (!sobra) return null;

  const receitaPct = sobra.receita > 0 ? (sobra.receita / RECEITA_META_MENSAL) * 100 : 0;
  const custeioPctReceita = sobra.receita > 0 ? (sobra.custeio_total / sobra.receita) * 100 : 0;
  const investidoPct = sobra.investido_pct;

  const metaBatida = investidoPct >= SOBRA_META_PCT;
  const custeioOk = custeioPctReceita < 50;
  const receitaOk = receitaPct >= 100;

  // Cores dinâmicas conforme performance
  const corReceita = receitaOk ? "#E8C97A" : "#C9A84C";
  const corCusteio = custeioOk ? "#10B981" : "#F43F5E";
  const corInvest = metaBatida ? "#10B981" : investidoPct >= 40 ? "#E8C97A" : "#F43F5E";

  return (
    <PremiumCard className="p-6" glowColor={metaBatida && custeioOk ? "#10B981" : undefined}>
      <div className="flex items-start justify-between flex-wrap gap-6">
        {/* SVG dos anéis */}
        <div className="flex-shrink-0">
          <svg width={240} height={240} viewBox="0 0 240 240">
            {/* Anel 1 (externo): Receita */}
            <Ring pct={receitaPct} color={corReceita} radius={100} stroke={14} />
            {/* Anel 2 (meio): Custeio — invertido (menos é melhor) */}
            <Ring pct={custeioPctReceita} color={corCusteio} radius={80} stroke={14} />
            {/* Anel 3 (interno): Investimento — meta 50% */}
            <Ring pct={investidoPct} color={corInvest} radius={60} stroke={14} />

            {/* Marcador 50% no anel interno */}
            <circle cx={120} cy={20} r={3} fill="#FDE68A" transform={`rotate(${(50/100)*360 - 90} 120 120) translate(0 100)`} />

            {/* Centro: % investido (métrica-chave) */}
            <text x={120} y={115} textAnchor="middle" fontSize={28} fontWeight="bold" fill={corInvest}
              style={{ fontFamily: "monospace" }}>
              {investidoPct.toFixed(0)}%
            </text>
            <text x={120} y={135} textAnchor="middle" fontSize={9} fill="#64748B"
              style={{ fontFamily: "monospace", letterSpacing: 1 }}>
              INVESTIDO · META {SOBRA_META_PCT}%
            </text>
          </svg>
        </div>

        {/* Legenda / breakdown */}
        <div className="flex-1 min-w-[280px] space-y-3">
          <div>
            <p className="text-xs uppercase tracking-widest font-mono mb-2" style={{ color: "#4A5568" }}>
              Cockpit Canônico · R$70M / 2041
            </p>
          </div>

          {/* Linha Receita */}
          <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "rgba(201,168,76,0.05)", border: `1px solid ${corReceita}33` }}>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: corReceita }} />
                <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "#94A3B8" }}>Receita Real</span>
              </div>
              <p className="text-lg font-mono font-bold mt-0.5" style={{ color: corReceita }}>
                {formatCurrency(sobra.receita)}
              </p>
              {sobra.entradas_neutras > 0 && (
                <p className="text-[10px] mt-0.5" style={{ color: "#64748B" }}>
                  + {formatCurrency(sobra.entradas_neutras)} em entradas neutras (ignoradas)
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xl font-mono font-bold" style={{ color: corReceita }}>{receitaPct.toFixed(0)}%</p>
              <p className="text-[10px]" style={{ color: "#64748B" }}>de {formatCurrency(RECEITA_META_MENSAL)}</p>
            </div>
          </div>

          {/* Linha Custeio */}
          <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "rgba(244,63,94,0.05)", border: `1px solid ${corCusteio}33` }}>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: corCusteio }} />
                <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "#94A3B8" }}>Custeio</span>
              </div>
              <p className="text-lg font-mono font-bold mt-0.5" style={{ color: corCusteio }}>
                {formatCurrency(sobra.custeio_total)}
              </p>
              <p className="text-[10px]" style={{ color: "#64748B" }}>
                despesas {formatCurrency(sobra.custeio_expenses)} + cartão {formatCurrency(sobra.custeio_cartao)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-mono font-bold" style={{ color: corCusteio }}>{custeioPctReceita.toFixed(0)}%</p>
              <p className="text-[10px]" style={{ color: "#64748B" }}>da receita · alvo &lt;50%</p>
            </div>
          </div>

          {/* Linha Investimento (meta canônica) */}
          <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "rgba(16,185,129,0.05)", border: `1px solid ${corInvest}33` }}>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: corInvest }} />
                <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "#94A3B8" }}>Investimento</span>
              </div>
              <p className="text-lg font-mono font-bold mt-0.5" style={{ color: corInvest }}>
                {formatCurrency(sobra.investimento_total)}
              </p>
              <p className="text-[10px]" style={{ color: "#64748B" }}>
                {metaBatida
                  ? `✓ meta batida · ${formatCurrency(sobra.investimento_total - sobra.receita * SOBRA_META_PCT / 100)} acima`
                  : `gap ${formatCurrency(sobra.gap_meta)} pra bater 50%`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-mono font-bold" style={{ color: corInvest }}>{investidoPct.toFixed(0)}%</p>
              <p className="text-[10px]" style={{ color: "#64748B" }}>da receita · meta ≥{SOBRA_META_PCT}%</p>
            </div>
          </div>

          {/* Veredito curto */}
          <div className="pt-2 text-xs" style={{ color: "#94A3B8" }}>
            {metaBatida && custeioOk && receitaOk && <span style={{ color: "#10B981" }}>● Mês redondo. CAGR 17,3% a.a. em dia.</span>}
            {metaBatida && !receitaOk && <span style={{ color: "#E8C97A" }}>● Investimento em dia, receita atrás da meta.</span>}
            {!metaBatida && custeioOk && <span style={{ color: "#E8C97A" }}>● Custeio controlado mas investimento abaixo de 50%.</span>}
            {!metaBatida && !custeioOk && <span style={{ color: "#F43F5E" }}>● Alerta: custeio alto E investimento abaixo da meta. Revisar cartões.</span>}
          </div>
        </div>
      </div>
    </PremiumCard>
  );
}
