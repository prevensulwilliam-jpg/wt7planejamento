import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { Skeleton } from "@/components/ui/skeleton";
import { useKitnetEntries } from "@/hooks/useKitnets";
import { exportCSV } from "@/hooks/useFinances";
import { formatCurrency, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { ChevronLeft, ChevronRight, FileDown, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function KitnetsReportPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [complex, setComplex] = useState("todos");
  const { data: entries, isLoading } = useKitnetEntries(month);

  const filtered = (entries ?? []).filter(e => {
    if (complex === "todos") return true;
    return (e as any).kitnets?.residencial_code === complex;
  });

  const totalReceived = filtered.reduce((s, e) => s + (e.total_liquid ?? 0), 0);
  const totalCelesc = filtered.reduce((s, e) => s + (e.celesc ?? 0), 0);
  const totalAdm = filtered.reduce((s, e) => s + (e.adm_fee ?? 0), 0);
  const totalGross = filtered.reduce((s, e) => s + (e.rent_gross ?? 0), 0);

  const barData = filtered.map(e => ({
    name: (e as any).kitnets?.code ?? "?",
    liquido: e.total_liquid ?? 0,
  }));

  // 3-month comparison
  const prev1 = (() => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const prev2 = (() => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 3, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();

  const { data: prev1Data } = useKitnetEntries(prev1);
  const { data: prev2Data } = useKitnetEntries(prev2);

  const compData = [
    { month: formatMonth(prev2), total: (prev2Data ?? []).reduce((s, e) => s + (e.total_liquid ?? 0), 0) },
    { month: formatMonth(prev1), total: (prev1Data ?? []).reduce((s, e) => s + (e.total_liquid ?? 0), 0) },
    { month: formatMonth(month), total: totalReceived },
  ];

  const navMonth = (dir: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const handleExport = () => {
    exportCSV(
      filtered.map(e => ({ ...e, codigo: (e as any).kitnets?.code, inquilino: (e as any).kitnets?.tenant_name })),
      ["Código", "Inquilino", "Bruto", "IPTU", "CELESC", "SEMASA", "ADM", "Líquido"],
      ["codigo", "inquilino", "rent_gross", "iptu_taxa", "celesc", "semasa", "adm_fee", "total_liquid"],
      `relatorio-kitnets-${month}.csv`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
          <BarChart3 className="inline w-6 h-6 mr-2" style={{ color: '#C9A84C' }} />
          Relatório Kitnets
        </h1>
        <div className="flex items-center gap-3">
          <Select value={complex} onValueChange={setComplex}>
            <SelectTrigger className="w-40" style={{ background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' }}><SelectValue /></SelectTrigger>
            <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="RWT02">RWT02</SelectItem>
              <SelectItem value="RWT03">RWT03</SelectItem>
            </SelectContent>
          </Select>
          <button onClick={() => navMonth(-1)} className="p-2 rounded-lg hover:bg-white/5"><ChevronLeft className="w-5 h-5" style={{ color: '#94A3B8' }} /></button>
          <span className="font-display font-bold min-w-[160px] text-center" style={{ color: '#F0F4F8' }}>{formatMonth(month)}</span>
          <button onClick={() => navMonth(1)} className="p-2 rounded-lg hover:bg-white/5"><ChevronRight className="w-5 h-5" style={{ color: '#94A3B8' }} /></button>
          <GoldButton variant="outline" onClick={handleExport}><FileDown className="w-4 h-4" />CSV</GoldButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Total Recebido" value={totalReceived} color="gold" />
        <KpiCard label="Total CELESC" value={totalCelesc} color="red" />
        <KpiCard label="Total ADM Corretor" value={totalAdm} color="cyan" />
        <KpiCard label="Receita Bruta" value={totalGross} color="green" />
      </div>

      {isLoading ? <Skeleton className="h-64 rounded-2xl" /> : (
        <>
          <PremiumCard>
            <Table>
              <TableHeader><TableRow style={{ borderColor: '#1A2535' }}>
                {["Código", "Inquilino", "Bruto", "IPTU", "CELESC", "SEMASA", "ADM", "Líquido"].map(h => <TableHead key={h} style={{ color: '#94A3B8' }}>{h}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8" style={{ color: '#94A3B8' }}>Sem lançamentos no mês</TableCell></TableRow>
                ) : filtered.map(e => (
                  <TableRow key={e.id} style={{ borderColor: '#1A2535' }}>
                    <TableCell style={{ color: '#F0F4F8' }}>{(e as any).kitnets?.code}</TableCell>
                    <TableCell style={{ color: '#CBD5E1' }}>{(e as any).kitnets?.tenant_name}</TableCell>
                    <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(e.rent_gross ?? 0)}</TableCell>
                    <TableCell className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(e.iptu_taxa ?? 0)}</TableCell>
                    <TableCell className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(e.celesc ?? 0)}</TableCell>
                    <TableCell className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(e.semasa ?? 0)}</TableCell>
                    <TableCell className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(e.adm_fee ?? 0)}</TableCell>
                    <TableCell className="font-mono font-bold" style={{ color: '#10B981' }}>{formatCurrency(e.total_liquid ?? 0)}</TableCell>
                  </TableRow>
                ))}
                {filtered.length > 0 && (
                  <TableRow style={{ borderColor: '#C9A84C' }}>
                    <TableCell colSpan={7} className="font-bold text-right" style={{ color: '#E8C97A' }}>Total Líquido</TableCell>
                    <TableCell className="font-mono font-bold" style={{ color: '#E8C97A' }}>{formatCurrency(totalReceived)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </PremiumCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PremiumCard>
              <h3 className="font-display font-bold mb-3" style={{ color: '#F0F4F8' }}>Receita Líquida por Unidade</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData} layout="vertical">
                  <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} stroke="#4A5568" />
                  <YAxis type="category" dataKey="name" width={80} stroke="#94A3B8" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: '#0D1318', border: '1px solid #1A2535' }} />
                  <Bar dataKey="liquido" fill="#C9A84C" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </PremiumCard>

            <PremiumCard>
              <h3 className="font-display font-bold mb-3" style={{ color: '#F0F4F8' }}>Comparativo Mensal</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={compData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A2535" />
                  <XAxis dataKey="month" stroke="#4A5568" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} stroke="#4A5568" />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: '#0D1318', border: '1px solid #1A2535' }} />
                  <Line type="monotone" dataKey="total" stroke="#C9A84C" strokeWidth={2} dot={{ fill: '#C9A84C' }} />
                </LineChart>
              </ResponsiveContainer>
            </PremiumCard>
          </div>
        </>
      )}
    </div>
  );
}
