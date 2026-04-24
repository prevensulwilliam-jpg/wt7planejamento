import { useState, useMemo } from "react";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCashFlowByMonth, useRealizeCashFlowItem, useUpdateCashFlowItem, type CashFlowFlowType } from "@/hooks/useCashFlow";
import { useNetWorth } from "@/hooks/useFinances";
import { formatCurrency, formatMonth, sumMoney } from "@/lib/formatters";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, ComposedChart, ReferenceLine } from "recharts";
import { Wallet, AlertTriangle, Check } from "lucide-react";

const PISO_PAZ = 100000;
const FLOW_LABELS: Record<CashFlowFlowType, string> = {
  income: "Receita",
  transfer_in: "Reembolso/Transfer",
  expense_extra: "Saída extra",
  cost_of_living: "Custo de vida",
};
const FLOW_COLORS: Record<CashFlowFlowType, string> = {
  income: "#10B981",
  transfer_in: "#2DD4BF",
  expense_extra: "#F59E0B",
  cost_of_living: "#F43F5E",
};

export default function CashFlowPage() {
  const nw = useNetWorth();
  const initialCash = Math.max(0, (nw as any).bankBalanceTotal ?? 60172);  // fallback R$ 60.172
  const { months, accumulated, isLoading } = useCashFlowByMonth(initialCash);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const chartData = useMemo(() => {
    return months.map((m, idx) => ({
      month: formatMonth(m.month).split(" ")[0].slice(0, 3) + "/" + m.month.slice(2, 4),
      saldo_mes: Math.round(m.net),
      caixa_acumulado: Math.round(accumulated[idx]?.balance ?? 0),
      receita: Math.round(m.income + m.transfer_in),
      saida: -Math.round(m.expense_extra + m.cost_of_living),
    }));
  }, [months, accumulated]);

  const monthsCritical = months.filter((_, idx) => (accumulated[idx]?.balance ?? 0) < PISO_PAZ).length;
  const finalBalance = accumulated.length > 0 ? accumulated[accumulated.length - 1].balance : initialCash;
  const minBalance = accumulated.length > 0 ? Math.min(...accumulated.map(a => a.balance)) : initialCash;
  const minBalanceMonth = accumulated.find(a => a.balance === minBalance)?.month;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
          <Wallet className="inline w-6 h-6 mr-2" style={{ color: '#C9A84C' }} />
          Plano de Caixa 24 Meses
        </h1>
        <p className="text-xs" style={{ color: '#94A3B8' }}>
          Piso de paz: <span className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(PISO_PAZ)}</span>
        </p>
      </div>

      {/* KPIs gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Caixa inicial" value={initialCash} color="gold" />
        <KpiCard label="Caixa final projetado (dez/27)" value={finalBalance} color={finalBalance >= PISO_PAZ ? "green" : "red"} />
        <KpiCard label="Menor caixa projetado" value={minBalance} color="red" />
        <KpiCard label="Meses sub-piso (R$ 100k)" value={monthsCritical} color="red" compact />
      </div>

      {/* Gráfico combinado — saldo mensal (barras) + caixa acumulado (linha) */}
      <PremiumCard className="space-y-3">
        <h3 className="font-display font-bold" style={{ color: '#F0F4F8' }}>Evolução mensal</h3>
        {isLoading ? <Skeleton className="h-72" /> : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A2535" />
              <XAxis dataKey="month" stroke="#4A5568" style={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} stroke="#4A5568" />
              <Tooltip
                contentStyle={{ background: '#0D1318', border: '1px solid #1A2535' }}
                formatter={(v: any) => formatCurrency(Number(v))}
              />
              <ReferenceLine y={PISO_PAZ} stroke="#F43F5E" strokeDasharray="6 4" label={{ value: "Piso R$ 100k", fill: '#F43F5E', fontSize: 11 }} />
              <Bar dataKey="receita" fill="#10B981" name="Receita + Transfer" />
              <Bar dataKey="saida" fill="#F43F5E" name="Saída total" />
              <Line type="monotone" dataKey="caixa_acumulado" stroke="#C9A84C" strokeWidth={3} name="Caixa acumulado" dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </PremiumCard>

      {/* Alerta mês crítico */}
      {minBalance < PISO_PAZ && minBalanceMonth && (
        <div className="p-4 rounded-xl flex items-start gap-3"
          style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid #F43F5E' }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#F43F5E' }} />
          <div>
            <p className="font-bold text-sm" style={{ color: '#FCA5A5' }}>Atenção: caixa sub-piso em {monthsCritical} meses</p>
            <p className="text-xs mt-1" style={{ color: '#FCA5A5' }}>
              Menor saldo projetado: <span className="font-mono font-bold">{formatCurrency(minBalance)}</span> em {formatMonth(minBalanceMonth)}.
              Considere mitigadores: antecipar Grand Food, adiar viagem, alienar Blumenau.
            </p>
          </div>
        </div>
      )}

      {/* Tabela resumo mensal */}
      <PremiumCard className="space-y-3">
        <h3 className="font-display font-bold" style={{ color: '#F0F4F8' }}>Resumo mensal</h3>
        {isLoading ? <Skeleton className="h-96" /> : (
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: '#1A2535' }}>
                <TableHead style={{ color: '#94A3B8' }}>Mês</TableHead>
                <TableHead className="text-right" style={{ color: '#94A3B8' }}>Receita</TableHead>
                <TableHead className="text-right" style={{ color: '#94A3B8' }}>Transfer</TableHead>
                <TableHead className="text-right" style={{ color: '#94A3B8' }}>Saídas extras</TableHead>
                <TableHead className="text-right" style={{ color: '#94A3B8' }}>Custo vida</TableHead>
                <TableHead className="text-right" style={{ color: '#94A3B8' }}>Saldo mês</TableHead>
                <TableHead className="text-right" style={{ color: '#94A3B8' }}>Caixa acum.</TableHead>
                <TableHead style={{ color: '#94A3B8' }}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m, idx) => {
                const acc = accumulated[idx]?.balance ?? 0;
                const isCritical = acc < PISO_PAZ;
                const isExpanded = expandedMonth === m.month;
                return (
                  <>
                    <TableRow
                      key={m.month}
                      style={{ borderColor: '#1A2535', cursor: 'pointer' }}
                      onClick={() => setExpandedMonth(isExpanded ? null : m.month)}
                    >
                      <TableCell style={{ color: '#F0F4F8' }}>{formatMonth(m.month)}</TableCell>
                      <TableCell className="text-right font-mono" style={{ color: '#10B981' }}>{formatCurrency(m.income)}</TableCell>
                      <TableCell className="text-right font-mono" style={{ color: '#2DD4BF' }}>{m.transfer_in > 0 ? formatCurrency(m.transfer_in) : '—'}</TableCell>
                      <TableCell className="text-right font-mono" style={{ color: '#F59E0B' }}>{m.expense_extra > 0 ? formatCurrency(m.expense_extra) : '—'}</TableCell>
                      <TableCell className="text-right font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(m.cost_of_living)}</TableCell>
                      <TableCell className="text-right font-mono font-bold" style={{ color: m.net >= 0 ? '#10B981' : '#F43F5E' }}>
                        {m.net >= 0 ? '+' : ''}{formatCurrency(m.net)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold" style={{ color: isCritical ? '#F43F5E' : '#E8C97A' }}>
                        {formatCurrency(acc)}
                        {isCritical && ' 🔴'}
                      </TableCell>
                      <TableCell style={{ color: '#4A5568' }}>{isExpanded ? '▼' : '▶'}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow style={{ borderColor: '#1A2535', background: 'rgba(0,0,0,0.2)' }}>
                        <TableCell colSpan={8} className="p-0">
                          <CashFlowMonthDetail items={m.items} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </PremiumCard>
    </div>
  );
}

// ── Detalhe de um mês (quando expandido) ──
function CashFlowMonthDetail({ items }: { items: any[] }) {
  const realize = useRealizeCashFlowItem();
  const updateItem = useUpdateCashFlowItem();
  const [realizingId, setRealizingId] = useState<string | null>(null);
  const [realizedValue, setRealizedValue] = useState("");

  const handleRealize = async (id: string, projectedAmount: number) => {
    const amount = realizedValue ? parseFloat(realizedValue) : projectedAmount;
    await realize.mutateAsync({
      id,
      realized_amount: amount,
      realized_at: new Date().toISOString().split("T")[0],
    });
    setRealizingId(null);
    setRealizedValue("");
  };

  return (
    <div className="p-4 space-y-2">
      {items.map(item => (
        <div
          key={item.id}
          className="flex items-center justify-between p-2 rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.02)',
            borderLeft: `3px solid ${FLOW_COLORS[item.flow_type as CashFlowFlowType] ?? '#4A5568'}`,
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: '#F0F4F8' }}>{item.label}</span>
              <WtBadge variant={item.status === 'realized' ? 'green' : item.status === 'cancelled' ? 'red' : 'gold'}>
                {item.status === 'realized' ? '✓ Realizado' : item.status === 'cancelled' ? '✗ Cancelado' : '⏳ Projetado'}
              </WtBadge>
            </div>
            {item.notes && <p className="text-[10px]" style={{ color: '#64748B' }}>{item.notes}</p>}
            {item.realized_amount != null && (
              <p className="text-[10px]" style={{ color: '#10B981' }}>
                Realizado: {formatCurrency(item.realized_amount)} em {item.realized_at} (delta {formatCurrency(item.realized_amount - item.amount)})
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-mono text-sm font-bold" style={{ color: FLOW_COLORS[item.flow_type as CashFlowFlowType] ?? '#F0F4F8' }}>
              {['expense_extra','cost_of_living'].includes(item.flow_type) ? '−' : '+'}{formatCurrency(item.amount)}
            </span>
            {item.status !== 'realized' && item.status !== 'cancelled' && (
              realizingId === item.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={realizedValue}
                    onChange={e => setRealizedValue(e.target.value)}
                    placeholder={String(item.amount)}
                    className="w-24 h-7 text-xs"
                    style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }}
                  />
                  <button
                    onClick={() => handleRealize(item.id, Number(item.amount))}
                    className="p-1 rounded"
                    style={{ background: 'rgba(16,185,129,0.2)', color: '#10B981' }}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setRealizingId(item.id); setRealizedValue(String(item.amount)); }}
                  className="text-[10px] px-2 py-1 rounded"
                  style={{ background: 'rgba(201,168,76,0.15)', color: '#E8C97A' }}
                >
                  Realizar
                </button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
