import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrevensulBillingRange, useImportHistory, exportCSV } from "@/hooks/useBilling";
import { formatCurrency, formatMonth, getCurrentMonth, formatDate } from "@/lib/formatters";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download } from "lucide-react";

export default function CommissionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
        Comissões Prevensul
      </h1>
      <Tabs defaultValue="monthly" className="w-full">
        <TabsList style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <TabsTrigger value="monthly" className="data-[state=active]:bg-[#1A2535] data-[state=active]:text-[#F0F4F8]" style={{ color: '#94A3B8' }}>Comissões por Mês</TabsTrigger>
          <TabsTrigger value="clients" className="data-[state=active]:bg-[#1A2535] data-[state=active]:text-[#F0F4F8]" style={{ color: '#94A3B8' }}>Clientes</TabsTrigger>
          <TabsTrigger value="imports" className="data-[state=active]:bg-[#1A2535] data-[state=active]:text-[#F0F4F8]" style={{ color: '#94A3B8' }}>Histórico de Imports</TabsTrigger>
        </TabsList>
        <TabsContent value="monthly"><MonthlyTab /></TabsContent>
        <TabsContent value="clients"><ClientsTab /></TabsContent>
        <TabsContent value="imports"><ImportsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function MonthlyTab() {
  const current = getCurrentMonth();
  const [startMonth, setStartMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [endMonth, setEndMonth] = useState(current);
  const { data = [], isLoading } = usePrevensulBillingRange(startMonth, endMonth);

  const totals = useMemo(() => {
    const totalBilled = data.reduce((s, r) => s + (r.contract_total ?? 0), 0);
    const totalReceived = data.reduce((s, r) => s + (r.amount_paid ?? 0), 0);
    const totalCommission = data.reduce((s, r) => s + (r.commission_value ?? 0), 0);
    const months = new Set(data.map(r => r.reference_month)).size || 1;
    return { totalBilled, totalReceived, totalCommission, avgMonthly: totalCommission / months };
  }, [data]);

  const chartData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    data.forEach(r => {
      const m = r.reference_month ?? "?";
      byMonth[m] = (byMonth[m] ?? 0) + (r.commission_value ?? 0);
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ month: formatMonth(month), value }));
  }, [data]);

  const inputStyle = { background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' };

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Mês inicial</label>
          <Input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)} className="w-40" style={inputStyle} />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Mês final</label>
          <Input type="month" value={endMonth} onChange={e => setEndMonth(e.target.value)} className="w-40" style={inputStyle} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Faturado" value={totals.totalBilled} color="cyan" compact />
        <KpiCard label="Total Recebido" value={totals.totalReceived} color="green" compact />
        <KpiCard label="Comissão Total" value={totals.totalCommission} color="gold" compact />
        <KpiCard label="Média Mensal" value={totals.avgMonthly} color="gold" compact />
      </div>

      {chartData.length > 0 && (
        <PremiumCard>
          <h3 className="font-display font-semibold mb-4" style={{ color: '#F0F4F8' }}>Evolução das Comissões</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A2535" />
              <XAxis dataKey="month" stroke="#4A5568" tick={{ fontSize: 11 }} />
              <YAxis stroke="#4A5568" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#0D1318', border: '1px solid #1A2535', borderRadius: 12 }}
                labelStyle={{ color: '#F0F4F8' }}
                formatter={(value: number) => [formatCurrency(value), "Comissão"]}
              />
              <Line type="monotone" dataKey="value" stroke="#C9A84C" strokeWidth={2} dot={{ fill: '#C9A84C', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </PremiumCard>
      )}

      <PremiumCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold" style={{ color: '#F0F4F8' }}>Detalhamento</h3>
          <button
            onClick={() => exportCSV(data, `comissoes_${startMonth}_${endMonth}.csv`)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'rgba(201,168,76,0.15)', color: '#E8C97A' }}
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>
        </div>
        <div className="overflow-auto rounded-xl" style={{ border: '1px solid #1A2535' }}>
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: '#1A2535' }}>
                <TableHead style={{ color: '#94A3B8' }}>Cliente</TableHead>
                <TableHead style={{ color: '#94A3B8' }}>Contrato/NF</TableHead>
                <TableHead style={{ color: '#94A3B8' }}>Parcela</TableHead>
                <TableHead style={{ color: '#94A3B8' }}>Valor Contrato</TableHead>
                <TableHead style={{ color: '#94A3B8' }}>Recebido</TableHead>
                <TableHead style={{ color: '#94A3B8' }}>Comissão</TableHead>
                <TableHead style={{ color: '#94A3B8' }}>Status</TableHead>
                <TableHead style={{ color: '#94A3B8' }}>Mês</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(r => (
                <TableRow key={r.id} style={{ borderColor: '#1A2535' }}>
                  <TableCell style={{ color: '#F0F4F8' }}>{r.client_name}</TableCell>
                  <TableCell className="font-mono" style={{ color: '#94A3B8' }}>{r.contract_nf || "—"}</TableCell>
                  <TableCell className="font-mono" style={{ color: '#94A3B8' }}>{r.installment_current ?? "—"}/{r.installment_total ?? "—"}</TableCell>
                  <TableCell className="font-mono" style={{ color: '#94A3B8' }}>{formatCurrency(r.contract_total ?? 0)}</TableCell>
                  <TableCell className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(r.amount_paid ?? 0)}</TableCell>
                  <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(r.commission_value ?? 0)}</TableCell>
                  <TableCell><WtBadge variant={statusBadge(r.status)}>{r.status}</WtBadge></TableCell>
                  <TableCell style={{ color: '#94A3B8' }}>{r.reference_month ? formatMonth(r.reference_month) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow style={{ borderColor: '#1A2535', background: 'rgba(201,168,76,0.05)' }}>
                <TableCell colSpan={3} className="font-semibold" style={{ color: '#E8C97A' }}>TOTAIS</TableCell>
                <TableCell className="font-mono font-semibold" style={{ color: '#94A3B8' }}>{formatCurrency(totals.totalBilled)}</TableCell>
                <TableCell className="font-mono font-semibold" style={{ color: '#10B981' }}>{formatCurrency(totals.totalReceived)}</TableCell>
                <TableCell className="font-mono font-semibold" style={{ color: '#E8C97A' }}>{formatCurrency(totals.totalCommission)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </PremiumCard>
    </div>
  );
}

function statusBadge(status: string | null): "green" | "gold" | "red" | "cyan" | "gray" {
  if (!status) return "gray";
  const map: Record<string, "green" | "gold" | "red" | "cyan" | "gray"> = {
    Pago: "green", Parcial: "gold", Pendente: "cyan", Inadimplente: "red", Quitado: "green",
  };
  return map[status] || "gray";
}

function ClientsTab() {
  const current = getCurrentMonth();
  const { data = [], isLoading } = usePrevensulBillingRange("2020-01", current);

  const clients = useMemo(() => {
    const map: Record<string, { name: string; totalBilled: number; totalReceived: number; pending: number; commission: number; lastInstallment: string; status: string }> = {};
    data.forEach(r => {
      const name = r.client_name ?? "?";
      if (!map[name]) map[name] = { name, totalBilled: 0, totalReceived: 0, pending: 0, commission: 0, lastInstallment: "", status: "" };
      const c = map[name];
      c.totalBilled += r.contract_total ?? 0;
      c.totalReceived += r.amount_paid ?? 0;
      c.pending += r.balance_remaining ?? 0;
      c.commission += r.commission_value ?? 0;
      c.lastInstallment = `${r.installment_current ?? ""}/${r.installment_total ?? ""}`;
      c.status = r.status ?? "";
    });
    return Object.values(map).sort((a, b) => b.totalReceived - a.totalReceived);
  }, [data]);

  const getClientBadge = (c: typeof clients[0]): "green" | "gold" | "red" => {
    if (c.status === "Inadimplente") return "red";
    if (c.pending <= 0 || c.status === "Quitado" || c.status === "Pago") return "green";
    return "gold";
  };
  const getClientLabel = (c: typeof clients[0]) => {
    const b = getClientBadge(c);
    return b === "green" ? "Quitado" : b === "red" ? "Inadimplente" : "Em andamento";
  };

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (clients.length === 0) {
    return <PremiumCard><p className="text-center py-8 font-mono text-sm" style={{ color: '#4A5568' }}>Nenhum cliente encontrado</p></PremiumCard>;
  }

  return (
    <PremiumCard>
      <h3 className="font-display font-semibold mb-4" style={{ color: '#F0F4F8' }}>Clientes</h3>
      <div className="overflow-auto rounded-xl" style={{ border: '1px solid #1A2535' }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: '#1A2535' }}>
              <TableHead style={{ color: '#94A3B8' }}>Cliente</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Total Faturado</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Total Recebido</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Saldo Pendente</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Comissão Gerada</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Última Parcela</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map(c => (
              <TableRow key={c.name} style={{ borderColor: '#1A2535' }}>
                <TableCell style={{ color: '#F0F4F8' }}>{c.name}</TableCell>
                <TableCell className="font-mono" style={{ color: '#94A3B8' }}>{formatCurrency(c.totalBilled)}</TableCell>
                <TableCell className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(c.totalReceived)}</TableCell>
                <TableCell className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(c.pending)}</TableCell>
                <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(c.commission)}</TableCell>
                <TableCell className="font-mono" style={{ color: '#94A3B8' }}>{c.lastInstallment}</TableCell>
                <TableCell><WtBadge variant={getClientBadge(c)}>{getClientLabel(c)}</WtBadge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PremiumCard>
  );
}

function ImportsTab() {
  const { data = [], isLoading } = useImportHistory();
  if (isLoading) return <Skeleton className="h-32 rounded-2xl" />;
  if (data.length === 0) {
    return <PremiumCard><p className="text-center py-8 font-mono text-sm" style={{ color: '#4A5568' }}>Nenhum import realizado</p></PremiumCard>;
  }

  return (
    <PremiumCard>
      <h3 className="font-display font-semibold mb-4" style={{ color: '#F0F4F8' }}>Histórico de Imports</h3>
      <div className="overflow-auto rounded-xl" style={{ border: '1px solid #1A2535' }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: '#1A2535' }}>
              <TableHead style={{ color: '#94A3B8' }}>Arquivo</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Mês</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Registros</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Total Recebido</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Comissão Total</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Data Import</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(r => (
              <TableRow key={r.id} style={{ borderColor: '#1A2535' }}>
                <TableCell className="font-mono text-xs" style={{ color: '#F0F4F8' }}>{r.file_name}</TableCell>
                <TableCell style={{ color: '#94A3B8' }}>{r.reference_month ? formatMonth(r.reference_month) : "—"}</TableCell>
                <TableCell className="font-mono" style={{ color: '#2DD4BF' }}>{r.records_imported}</TableCell>
                <TableCell className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(r.total_paid ?? 0)}</TableCell>
                <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(r.total_commission ?? 0)}</TableCell>
                <TableCell className="font-mono text-xs" style={{ color: '#94A3B8' }}>{r.imported_at ? formatDate(r.imported_at) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PremiumCard>
  );
}
