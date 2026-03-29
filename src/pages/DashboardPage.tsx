import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { KpiCard } from "@/components/wt7/KpiCard";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { useDashboardKPIs, useRevenueExpenseTrend, useGoals } from "@/hooks/useFinances";
import { useKitnets } from "@/hooks/useKitnets";
import { useWiselyAnalysis } from "@/hooks/useWisely";
import ReactMarkdown from "react-markdown";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const sourceColors: Record<string, string> = {
  kitnets: '#C9A84C',
  comissao_prevensul: '#2DD4BF',
  salario: '#10B981',
  solar_energia: '#F59E0B',
  t7: '#8B5CF6',
  laudos: '#3B82F6',
  casamento_energia: '#EC4899',
  outros: '#4A5568',
};

const sourceLabels: Record<string, string> = {
  kitnets: 'Kitnets',
  comissao_prevensul: 'Comissão',
  salario: 'Salário',
  solar_energia: 'Solar',
  t7: 'T7',
  laudos: 'Laudos',
  casamento_energia: 'Casamento',
  outros: 'Outros',
};

const statusDot: Record<string, string> = {
  occupied: '#10B981',
  vacant: '#F43F5E',
  maintenance: '#F59E0B',
};

const goalIcons: Record<string, string> = {
  renda: '💰',
  imoveis: '🏘️',
  reserva: '💾',
  saude: '📉',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="font-mono text-xs rounded-[10px] p-3" style={{ background: '#131B22', border: '1px solid #2A3F55' }}>
      <p className="font-semibold mb-1" style={{ color: '#F0F4F8' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
      ))}
    </div>
  );
};

function navigateMonth(current: string, delta: number): string {
  const [y, m] = current.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const kpis = useDashboardKPIs(currentMonth);
  const trend = useRevenueExpenseTrend();
  const goalsQuery = useGoals();
  const kitnetsQuery = useKitnets();

  const revenueComposition = Object.entries(kpis.revenueBySource).map(([key, value]) => ({
    name: sourceLabels[key] ?? key,
    value,
    color: sourceColors[key] ?? '#4A5568',
  }));

  const kitnetsByComplex = (kitnetsQuery.data ?? []).reduce((acc, k) => {
    const code = k.residencial_code ?? 'Outros';
    if (!acc[code]) acc[code] = [];
    acc[code].push(k);
    return acc;
  }, {} as Record<string, typeof kitnetsQuery.data>);

  // Meta R$100k
  const metaGoal = (goalsQuery.data ?? []).find(g => g.type === 'renda');
  const metaCurrent = kpis.totalRevenue || (metaGoal?.current_value ?? 0);
  const metaTarget = metaGoal?.target_value ?? 100000;
  const metaPct = (metaCurrent / metaTarget) * 100;
  const metaGap = metaTarget - metaCurrent;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(m => navigateMonth(m, -1))} className="text-wt-text-muted hover:text-wt-text-secondary"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="font-display font-bold text-xl text-wt-text-primary">{formatMonth(currentMonth)}</h1>
          <button onClick={() => setCurrentMonth(m => navigateMonth(m, 1))} className="text-wt-text-muted hover:text-wt-text-secondary"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-3">
          <GoldButton variant="outline"><Plus className="w-4 h-4" /> Lançamento</GoldButton>
          <GoldButton><Sparkles className="w-4 h-4" /> Wisely</GoldButton>
        </div>
      </div>

      {/* Meta R$100k card */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.04))',
          border: '1px solid rgba(201,168,76,0.25)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🎯</span>
          <h2 className="font-display font-bold text-lg" style={{ color: '#E8C97A' }}>META R$ 100.000/mês</h2>
        </div>
        <div className="flex flex-wrap gap-6 text-sm font-mono mb-3" style={{ color: '#F0F4F8' }}>
          <span>Atual: <strong style={{ color: '#E8C97A' }}>{formatCurrency(metaCurrent)}</strong></span>
          <span>Gap: <strong style={{ color: '#F43F5E' }}>{formatCurrency(metaGap > 0 ? metaGap : 0)}</strong></span>
          <span>Prazo: <strong>~2029</strong></span>
          <span>Crescimento: <strong>18%/ano</strong></span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(201,168,76,0.15)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(metaPct, 100)}%`, background: 'linear-gradient(90deg, #C9A84C, #E8C97A)' }} />
        </div>
        <p className="text-right text-xs font-mono mt-1" style={{ color: '#94A3B8' }}>{metaPct.toFixed(1)}%</p>
      </div>

      {/* Wisely Card */}
      <WiselyDashboardCard />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-2xl" style={{ background: '#0D1318' }} />
          ))
        ) : (
          <>
            <KpiCard label="Receita Total" value={kpis.totalRevenue} color="gold" />
            <KpiCard label="Resultado Líquido" value={kpis.netResult} color="green" />
            <KpiCard label="Despesas Totais" value={kpis.totalExpenses} color="red" />
            <KpiCard label="Patrimônio Líquido" value={4200000} color="cyan" compact />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PremiumCard>
          <h3 className="font-display font-bold text-sm mb-4" style={{ color: '#F0F4F8' }}>Receitas vs Despesas — 6 meses</h3>
          {trend.isLoading ? (
            <Skeleton className="h-[260px] rounded-xl" style={{ background: '#131B22' }} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend.data}>
                <defs>
                  <linearGradient id="gradGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A2535" horizontal vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#4A5568', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="receita" stroke="#C9A84C" fill="url(#gradGold)" name="Receita" />
                <Area type="monotone" dataKey="despesa" stroke="#F43F5E" fill="url(#gradRed)" name="Despesa" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </PremiumCard>

        <PremiumCard>
          <h3 className="font-display font-bold text-sm mb-4" style={{ color: '#F0F4F8' }}>Composição de Receitas</h3>
          {revenueComposition.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm" style={{ color: '#4A5568' }}>
              Nenhuma receita neste mês
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={revenueComposition} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2} dataKey="value">
                  {revenueComposition.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: '#131B22', border: '1px solid #2A3F55', borderRadius: 10, fontFamily: 'JetBrains Mono' }} />
                <Legend iconType="circle" formatter={(value) => <span style={{ color: '#94A3B8', fontSize: 12 }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </PremiumCard>
      </div>

      {/* Goals */}
      <PremiumCard>
        <h3 className="font-display font-bold text-sm mb-4" style={{ color: '#F0F4F8' }}>Metas</h3>
        {goalsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" style={{ background: '#131B22' }} />)}
          </div>
        ) : (goalsQuery.data ?? []).length === 0 ? (
          <p className="text-sm" style={{ color: '#4A5568' }}>Nenhuma meta cadastrada</p>
        ) : (
          <div className="space-y-4">
            {(goalsQuery.data ?? []).map(g => {
              const isInvert = g.type === 'saude';
              const current = g.current_value ?? 0;
              const target = g.target_value ?? 1;
              const pct = isInvert ? Math.max(0, (1 - (current - target) / current) * 100) : (current / target) * 100;
              const icon = goalIcons[g.type ?? ''] ?? '🎯';
              const isUnitBased = g.type === 'imoveis' || g.type === 'saude';
              const unit = g.type === 'saude' ? '%' : g.type === 'imoveis' ? ' unid.' : '';

              return (
                <div key={g.id} className="flex items-center gap-4">
                  <span className="text-lg w-6">{icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: '#F0F4F8' }}>{g.name}</span>
                      <span className="font-mono text-xs" style={{ color: '#94A3B8' }}>
                        {isUnitBased ? `${current}${unit} / ${target}${unit}` : `${formatCurrency(current)} / ${formatCurrency(target)}`}
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: '#1A2535' }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: 'linear-gradient(90deg, #C9A84C, #E8C97A)' }} />
                    </div>
                  </div>
                  <span className="font-mono text-xs w-12 text-right" style={{ color: '#E8C97A' }}>{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        )}
      </PremiumCard>

      {/* Kitnets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {kitnetsQuery.isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[200px] rounded-2xl" style={{ background: '#0D1318' }} />)
        ) : Object.entries(kitnetsByComplex).map(([complex, units]) => (
          <PremiumCard key={complex}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-sm" style={{ color: '#F0F4F8' }}>{complex}</h3>
              <WtBadge variant="gold">{(units ?? []).filter(u => u.status === 'occupied').length}/{(units ?? []).length} ocupadas</WtBadge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(units ?? []).map(k => (
                <div
                  key={k.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                  style={{ background: '#0D1318', border: '1px solid #1A2535' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: statusDot[k.status ?? ''] ?? '#4A5568' }} />
                    <span className="font-mono" style={{ color: '#F0F4F8' }}>{String(k.unit_number ?? '').padStart(2, '0')}</span>
                  </div>
                  <span className="font-mono" style={{ color: (k.rent_value ?? 0) > 0 ? '#E8C97A' : '#4A5568' }}>
                    {(k.rent_value ?? 0) > 0 ? formatCurrency(k.rent_value!) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </PremiumCard>
        ))}
      </div>
    </div>
  );
}
