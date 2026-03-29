import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { KpiCard } from "@/components/wt7/KpiCard";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { formatCurrency, formatMonth, formatPercent } from "@/lib/formatters";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

// Mock data for initial UI
const revenueVsExpense = [
  { month: 'Out', receita: 38200, despesa: 16800 },
  { month: 'Nov', receita: 39500, despesa: 17200 },
  { month: 'Dez', receita: 41000, despesa: 19000 },
  { month: 'Jan', receita: 39800, despesa: 17500 },
  { month: 'Fev', receita: 38500, despesa: 16900 },
  { month: 'Mar', receita: 40800, despesa: 18500 },
];

const revenueComposition = [
  { name: 'Kitnets', value: 18480, color: '#C9A84C' },
  { name: 'Comissão', value: 12000, color: '#2DD4BF' },
  { name: 'Salário', value: 6000, color: '#10B981' },
  { name: 'Solar', value: 2320, color: '#F59E0B' },
  { name: 'T7', value: 1500, color: '#8B5CF6' },
  { name: 'Outros', value: 500, color: '#4A5568' },
];

const goals = [
  { name: 'R$100k/mês', icon: '💰', current: 40800, target: 100000 },
  { name: 'Novas Kitnets', icon: '🏘️', current: 13, target: 20, unit: 'unid.' },
  { name: 'Reserva', icon: '💾', current: 65000, target: 100000 },
  { name: '8% BF', icon: '📉', current: 14, target: 8, invert: true, unit: '%' },
];

const kitnets = {
  RWT02: [
    { code: 'RWT02-01', tenant: 'Inquilino 1', rent: 1540, status: 'occupied' as const },
    { code: 'RWT02-02', tenant: 'Inquilino 2', rent: 1540, status: 'occupied' as const },
    { code: 'RWT02-03', tenant: 'Inquilino 3', rent: 1877, status: 'occupied' as const },
    { code: 'RWT02-04', tenant: 'Inquilino 4', rent: 1540, status: 'occupied' as const },
    { code: 'RWT02-05', tenant: 'Inquilino 5', rent: 1540, status: 'occupied' as const },
    { code: 'RWT02-06', tenant: 'Inquilino 6', rent: 1540, status: 'occupied' as const },
    { code: 'RWT02-07', tenant: '—', rent: 0, status: 'maintenance' as const },
    { code: 'RWT02-08', tenant: 'Inquilino 8', rent: 1540, status: 'occupied' as const },
  ],
  RWT03: [
    { code: 'RWT03-01', tenant: 'Inquilino 1', rent: 1540, status: 'occupied' as const },
    { code: 'RWT03-02', tenant: 'Inquilino 2', rent: 1540, status: 'occupied' as const },
    { code: 'RWT03-03', tenant: 'Inquilino 3', rent: 1540, status: 'occupied' as const },
    { code: 'RWT03-04', tenant: 'Inquilino 4', rent: 1540, status: 'occupied' as const },
    { code: 'RWT03-05', tenant: 'Inquilino 5', rent: 1540, status: 'occupied' as const },
  ],
};

const statusDot: Record<string, string> = {
  occupied: '#10B981',
  vacant: '#F43F5E',
  maintenance: '#F59E0B',
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

export default function DashboardPage() {
  const [currentMonth] = useState("2026-03");

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="text-wt-text-muted hover:text-wt-text-secondary"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="font-display font-bold text-xl text-wt-text-primary">{formatMonth(currentMonth)}</h1>
          <button className="text-wt-text-muted hover:text-wt-text-secondary"><ChevronRight className="w-5 h-5" /></button>
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
          <span>Atual: <strong style={{ color: '#E8C97A' }}>{formatCurrency(40800)}</strong></span>
          <span>Gap: <strong style={{ color: '#F43F5E' }}>{formatCurrency(59200)}</strong></span>
          <span>Prazo: <strong>~2029</strong></span>
          <span>Crescimento: <strong>18%/ano</strong></span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(201,168,76,0.15)' }}>
          <div className="h-full rounded-full" style={{ width: '40.8%', background: 'linear-gradient(90deg, #C9A84C, #E8C97A)' }} />
        </div>
        <p className="text-right text-xs font-mono mt-1" style={{ color: '#94A3B8' }}>40,8%</p>
      </div>

      {/* Wisely Card */}
      <PremiumCard glowColor="rgba(45,212,191,0.3)">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <h3 className="font-display font-bold" style={{ color: '#2DD4BF' }}>WISELY — Análise de {formatMonth(currentMonth)}</h3>
          </div>
          <button className="text-xs flex items-center gap-1 hover:text-wt-text-primary transition-colors" style={{ color: '#94A3B8' }}>
            ↻ Atualizar
          </button>
        </div>
        <ul className="space-y-2 text-sm" style={{ color: '#F0F4F8' }}>
          <li>• Receita +6,2% vs fev — acima da meta trimestral</li>
          <li>• Kitnet K07 em manutenção há 3 meses: custo oculto estimado R$4.620</li>
          <li>• Comissão GRAND FOOD pendente: R$39k esperados em abr/26</li>
          <li>• Margem solar RWT02 cresceu 12% — maior geração desde nov/25</li>
        </ul>
      </PremiumCard>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Receita Total" value={40800} change={6.2} color="gold" />
        <KpiCard label="Resultado Líquido" value={22300} change={4.8} color="green" />
        <KpiCard label="Despesas Totais" value={18500} change={-2.1} color="red" />
        <KpiCard label="Patrimônio Líquido" value={4200000} change={1.3} color="cyan" compact />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PremiumCard>
          <h3 className="font-display font-bold text-sm mb-4" style={{ color: '#F0F4F8' }}>Receitas vs Despesas — 6 meses</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueVsExpense}>
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
        </PremiumCard>

        <PremiumCard>
          <h3 className="font-display font-bold text-sm mb-4" style={{ color: '#F0F4F8' }}>Composição de Receitas</h3>
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
        </PremiumCard>
      </div>

      {/* Goals */}
      <PremiumCard>
        <h3 className="font-display font-bold text-sm mb-4" style={{ color: '#F0F4F8' }}>Metas</h3>
        <div className="space-y-4">
          {goals.map(g => {
            const pct = g.invert ? Math.max(0, (1 - (g.current - g.target) / g.current) * 100) : (g.current / g.target) * 100;
            return (
              <div key={g.name} className="flex items-center gap-4">
                <span className="text-lg w-6">{g.icon}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: '#F0F4F8' }}>{g.name}</span>
                    <span className="font-mono text-xs" style={{ color: '#94A3B8' }}>
                      {g.unit ? `${g.current}${g.unit === '%' ? '%' : ''} / ${g.target}${g.unit}` : `${formatCurrency(g.current)} / ${formatCurrency(g.target)}`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: '#1A2535' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: 'linear-gradient(90deg, #C9A84C, #E8C97A)' }} />
                  </div>
                </div>
                <span className="font-mono text-xs w-12 text-right" style={{ color: '#E8C97A' }}>{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </PremiumCard>

      {/* Kitnets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(kitnets).map(([complex, units]) => (
          <PremiumCard key={complex}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-sm" style={{ color: '#F0F4F8' }}>{complex}</h3>
              <WtBadge variant="gold">{units.filter(u => u.status === 'occupied').length}/{units.length} ocupadas</WtBadge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {units.map(k => (
                <div
                  key={k.code}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                  style={{ background: '#0D1318', border: '1px solid #1A2535' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: statusDot[k.status] }} />
                    <span className="font-mono" style={{ color: '#F0F4F8' }}>{k.code.split('-')[1]}</span>
                  </div>
                  <span className="font-mono" style={{ color: k.rent > 0 ? '#E8C97A' : '#4A5568' }}>
                    {k.rent > 0 ? formatCurrency(k.rent) : '—'}
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
