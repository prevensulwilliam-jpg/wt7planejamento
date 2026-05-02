/**
 * CashFlowChart — Bloco 4 do /hoje v4 (Cash Flow projetado).
 * Lê tool get_cashflow_forecast via Naval (n_months=6).
 * Visual: linha curva verde de evolução + área degradê.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { Wallet, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ForecastMonth {
  month: string;
  entradas: { aluguel_kitnets: number; clt: number; comissao_prevensul_pipeline: number; total: number };
  saidas: { recurring_fixo: number; debt_installments: number; casamento: number; total: number };
  liquido_mes: number;
  caixa_acumulado: number;
}

export function CashFlowChart() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<{
    starting_cash: number;
    forecast: ForecastMonth[];
  } | null>({
    queryKey: ["cashflow_chart"],
    queryFn: async () => {
      // Chama wisely-ai pra rodar get_cashflow_forecast
      const { data: navalRes, error } = await supabase.functions.invoke("wisely-ai", {
        body: {
          messages: [
            { role: "user", content: "Use get_cashflow_forecast com n_months=6 e retorne APENAS o JSON sem texto adicional." },
          ],
          stream: false,
        },
      });
      if (error) throw error;

      // Naval pode retornar texto com JSON inline. Tenta extrair.
      const text = navalRes?.text || "";
      const m = text.match(/\{[\s\S]*"forecast"[\s\S]*?\][\s\S]*?\}/);
      if (!m) return null;
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    },
    staleTime: 30 * 60_000, // 30 min
  });

  if (isLoading) return <Skeleton className="h-64 rounded-xl" style={{ background: "#0D1318" }} />;
  if (!data || !data.forecast || data.forecast.length === 0) {
    return (
      <div className="rounded-xl p-4 border" style={{ background: "#0F141B", borderColor: "#1A2535" }}>
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4" style={{ color: "#C9A84C" }} />
          <span className="text-[11px] font-mono uppercase tracking-[1.5px]" style={{ color: "#64748B" }}>
            Cash Flow projetado
          </span>
        </div>
        <p className="text-xs" style={{ color: "#94A3B8" }}>
          Não foi possível carregar projeção. Cadastre dados em /banks, /debts e /recurring-bills.
        </p>
      </div>
    );
  }

  const { starting_cash, forecast } = data;
  const points = [{ idx: 0, value: starting_cash }, ...forecast.map((f, i) => ({ idx: i + 1, value: f.caixa_acumulado }))];

  const maxValue = Math.max(...points.map(p => p.value), starting_cash);
  const minValue = Math.min(...points.map(p => p.value), 0);
  const range = maxValue - minValue || 1;

  const W = 600;
  const H = 160;
  const xStep = W / (points.length - 1);
  const polylinePoints = points
    .map((p, i) => `${i * xStep},${H - 10 - ((p.value - minValue) / range) * (H - 30)}`)
    .join(" ");

  const lastValue = points[points.length - 1].value;
  const totalIn = forecast.reduce((s, f) => s + f.entradas.total, 0);
  const totalOut = forecast.reduce((s, f) => s + f.saidas.total, 0);
  const liquido = totalIn - totalOut;

  return (
    <div className="rounded-xl p-4 border" style={{ background: "#0F141B", borderColor: "#1A2535" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4" style={{ color: "#C9A84C" }} />
          <span className="text-[11px] font-mono uppercase tracking-[1.5px]" style={{ color: "#64748B" }}>
            Cash Flow · próximos {forecast.length} meses
          </span>
        </div>
        <button
          onClick={() => navigate("/cashflow")}
          className="text-[10px] flex items-center gap-1 hover:opacity-80"
          style={{ color: "#94A3B8" }}
        >
          expandir <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="relative" style={{ height: H }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1={H * 0.25} x2={W} y2={H * 0.25} stroke="#1A2535" strokeDasharray="2,3" />
          <line x1="0" y1={H * 0.5} x2={W} y2={H * 0.5} stroke="#1A2535" strokeDasharray="2,3" />
          <line x1="0" y1={H * 0.75} x2={W} y2={H * 0.75} stroke="#1A2535" strokeDasharray="2,3" />

          {/* Area gradient */}
          <defs>
            <linearGradient id="cfgrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area path */}
          <path
            d={`M 0,${H} L ${polylinePoints} L ${W},${H} Z`}
            fill="url(#cfgrad)"
            opacity="0.18"
          />

          {/* Line */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#10B981"
            strokeWidth="2.5"
            style={{ filter: "drop-shadow(0 0 4px #10B981)" }}
          />

          {/* End dot */}
          <circle
            cx={W}
            cy={H - 10 - ((lastValue - minValue) / range) * (H - 30)}
            r="5"
            fill="#10B981"
            style={{ filter: "drop-shadow(0 0 6px #10B981)" }}
          />
        </svg>
      </div>

      <div className="flex justify-between text-[9px] font-mono mt-1 px-1" style={{ color: "#4A5568" }}>
        <span>hoje</span>
        {forecast.slice(0, 4).map(f => (
          <span key={f.month}>{f.month.slice(5)}</span>
        ))}
        <span>{forecast[forecast.length - 1]?.month.slice(5)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t" style={{ borderColor: "#1C2333" }}>
        <div className="px-2.5 py-2 rounded-lg" style={{ background: "#0B1220", border: "1px solid #1C2333" }}>
          <div className="text-[9px] uppercase tracking-wider font-mono" style={{ color: "#4A5568" }}>Entrar</div>
          <div className="text-sm font-bold font-mono" style={{ color: "#34D399" }}>+{formatCurrency(totalIn)}</div>
        </div>
        <div className="px-2.5 py-2 rounded-lg" style={{ background: "#0B1220", border: "1px solid #1C2333" }}>
          <div className="text-[9px] uppercase tracking-wider font-mono" style={{ color: "#4A5568" }}>Sair</div>
          <div className="text-sm font-bold font-mono" style={{ color: "#F43F5E" }}>−{formatCurrency(totalOut)}</div>
        </div>
        <div className="px-2.5 py-2 rounded-lg" style={{ background: "#0B1220", border: "1px solid #1C2333" }}>
          <div className="text-[9px] uppercase tracking-wider font-mono" style={{ color: "#4A5568" }}>Caixa final</div>
          <div className="text-sm font-bold font-mono" style={{ color: "#E8C97A" }}>{formatCurrency(lastValue)}</div>
        </div>
      </div>
    </div>
  );
}
