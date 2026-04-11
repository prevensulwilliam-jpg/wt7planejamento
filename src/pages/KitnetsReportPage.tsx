import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { Skeleton } from "@/components/ui/skeleton";
import { useKitnetEntries, useKitnets } from "@/hooks/useKitnets";
import { exportCSV } from "@/hooks/useFinances";
import { formatCurrency, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { ChevronLeft, ChevronRight, FileDown, BarChart3, Info, ChevronDown, ChevronUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function getYearMonths(year: number) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

function useAllYearEntries(year: number) {
  return useQuery({
    queryKey: ["kitnet_entries_year", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kitnet_entries")
        .select("*, kitnets(code, tenant_name, residencial_code)")
        .gte("reference_month", `${year}-01`)
        .lte("reference_month", `${year}-12`);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function KitnetsReportPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [complex, setComplex] = useState("todos");
  const [tableOpen, setTableOpen] = useState(false);
  const year = parseInt(month.split("-")[0]);

  const { data: entries, isLoading } = useKitnetEntries(month);
  const { data: kitnets } = useKitnets();
  const { data: yearEntries } = useAllYearEntries(year);

  const { data: energyReadings } = useQuery({
    queryKey: ["energy_readings_report", month],
    queryFn: async () => {
      const { data, error } = await supabase.from("energy_readings").select("*, kitnets(residencial_code)").eq("reference_month", month);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: celescInvoices } = useQuery({
    queryKey: ["celesc_invoices_report", month],
    queryFn: async () => {
      const { data, error } = await supabase.from("celesc_invoices").select("*").eq("reference_month", month);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bankDeposits } = useQuery({
    queryKey: ["bank_deposits_kitnets", month],
    queryFn: async () => {
      const [y, m] = month.split("-");
      const start = `${y}-${m}-01`;
      const end = new Date(+y, +m, 0).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("amount, kitnet_entry_id")
        .eq("type", "credit")
        .eq("category_confirmed", "aluguel_kitnets")
        .gte("date", start)
        .lte("date", end);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Depósitos anuais para gráfico
  const { data: yearBankDeposits } = useQuery({
    queryKey: ["bank_deposits_year", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("amount, date")
        .eq("type", "credit")
        .eq("category_confirmed", "aluguel_kitnets")
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (entries ?? []).filter(e => complex === "todos" ? true : (e as any).kitnets?.residencial_code === complex);
  const filteredEnergy = (energyReadings ?? []).filter(e => complex === "todos" ? true : (e as any).kitnets?.residencial_code === complex);

  // Mapa: kitnet_entry_id -> valor depositado
  const depositadoPorEntry = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of (bankDeposits ?? [])) {
      if (t.kitnet_entry_id) {
        map[t.kitnet_entry_id] = (map[t.kitnet_entry_id] ?? 0) + Math.abs(t.amount ?? 0);
      }
    }
    return map;
  }, [bankDeposits]);

  const totalPrevisto = filtered.reduce((s, e) => s + (e.rent_gross ?? 0), 0);
  const totalLiquido = filtered.reduce((s, e) => s + (e.total_liquid ?? 0), 0);
  const totalDepositadoBanco = (bankDeposits ?? []).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
  const totalDepositado = totalDepositadoBanco > 0 ? totalDepositadoBanco : totalLiquido;
  const diferenca = totalDepositadoBanco > 0 ? totalLiquido - totalDepositadoBanco : 0;
  const temDivergencia = Math.abs(diferenca) > 1;
  const totalCobradoInquilinos = filteredEnergy.reduce((s, e) => s + ((e as any).amount_to_charge ?? 0), 0);
  const totalFaturasCelesc = (celescInvoices ?? []).reduce((s, inv) => s + ((inv as any).invoice_total ?? 0), 0);
  const saldoSolar = totalCobradoInquilinos - totalFaturasCelesc;

  const yearMonths = getYearMonths(year);

  const monthlyData = useMemo(() => yearMonths.map(m => {
    const me = (yearEntries ?? []).filter(e => e.reference_month === m);
    const [y, mo] = m.split("-");
    const start = `${y}-${mo}-01`;
    const end = new Date(+y, +mo, 0).toISOString().split("T")[0];
    const dep = (yearBankDeposits ?? [])
      .filter(t => t.date >= start && t.date <= end)
      .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    const liquido = me.reduce((s, e) => s + (e.total_liquid ?? 0), 0);
    return {
      month: formatMonth(m).slice(0, 3),
      liquido,
      depositado: dep > 0 ? dep : 0,
    };
  }), [yearEntries, yearMonths, yearBankDeposits]);

  const totalAnoPrevisto = (yearEntries ?? []).reduce((s, e) => s + (e.rent_gross ?? 0), 0);
  const totalAnoLiquido = monthlyData.reduce((s, m) => s + m.liquido, 0);
  const totalAnoDepositado = monthlyData.reduce((s, m) => s + m.depositado, 0);
  const eficiencia = totalAnoLiquido > 0 ? (totalAnoDepositado / totalAnoLiquido) * 100 : 0;

  const kitnetList = useMemo(() => {
    return (kitnets ?? [])
      .filter(k => complex === "todos" ? true : k.residencial_code === complex)
      .map(k => {
        const months = yearMonths.map(m => {
          const entry = (yearEntries ?? []).find(e => e.kitnet_id === k.id && e.reference_month === m);
          return { month: m, liquido: entry?.total_liquid ?? null };
        });
        return { ...k, months, total: months.reduce((s, m) => s + (m.liquido ?? 0), 0) };
      });
  }, [kitnets, yearEntries, yearMonths, complex]);

  const barData = filtered.map(e => ({
    name: (e as any).kitnets?.code ?? "?",
    previsto: e.rent_gross ?? 0,
    liquido: e.total_liquid ?? 0,
  }));

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
      {/* Header */}
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

      {/* KPIs mensais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 space-y-1" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <p className="text-xs uppercase font-mono tracking-widest" style={{ color: '#94A3B8' }}>Valor Previsto</p>
          <p className="font-mono text-2xl font-bold" style={{ color: '#C9A84C' }}>{formatCurrency(totalPrevisto)}</p>
          <p className="text-xs" style={{ color: '#4A5568' }}>Aluguéis brutos contratados</p>
        </div>
        <div className="rounded-2xl p-5 space-y-1" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <p className="text-xs uppercase font-mono tracking-widest" style={{ color: '#94A3B8' }}>Valor Líquido ADM</p>
          <p className="font-mono text-2xl font-bold" style={{ color: '#10B981' }}>{formatCurrency(totalLiquido)}</p>
          <p className="text-xs" style={{ color: '#4A5568' }}>Após CELESC, SEMASA, IPTU e ADM</p>
        </div>
        <div className="rounded-2xl p-5 space-y-1" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <p className="text-xs uppercase font-mono tracking-widest" style={{ color: '#94A3B8' }}>Valor Depositado</p>
          <p className="font-mono text-2xl font-bold" style={{ color: '#2DD4BF' }}>{formatCurrency(totalDepositado)}</p>
          <p className="text-xs" style={{ color: '#4A5568' }}>{totalDepositadoBanco > 0 ? "Conciliado no extrato" : "Estimado pelo líquido ADM"}</p>
        </div>
        <div className="rounded-2xl p-5 space-y-1 relative group" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <div className="flex items-center gap-1.5">
            <p className="text-xs uppercase font-mono tracking-widest" style={{ color: '#94A3B8' }}>Saldo Solar</p>
            <div className="relative">
              <Info className="w-3.5 h-3.5 cursor-help" style={{ color: '#4A5568' }} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 rounded-lg text-xs z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: '#131B22', border: '1px solid #2A3F55', color: '#94A3B8' }}>
                Embutido nos valores Previsto/Líquido/Depositado. Ganho líquido do sistema solar: cobrado dos inquilinos menos fatura CELESC.
              </div>
            </div>
          </div>
          <p className="font-mono text-2xl font-bold" style={{ color: saldoSolar >= 0 ? '#F59E0B' : '#F43F5E' }}>{formatCurrency(saldoSolar)}</p>
          <p className="text-xs" style={{ color: '#4A5568' }}>Cobrado {formatCurrency(totalCobradoInquilinos)} − Fatura {formatCurrency(totalFaturasCelesc)}</p>
        </div>
      </div>

      {/* Alerta Naval */}
      {temDivergencia && (
        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)' }}>
          <span className="text-lg">⚓</span>
          <div>
            <p className="font-bold text-sm" style={{ color: '#E8C97A' }}>Naval — Divergência detectada em {formatMonth(month)}</p>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
              Líquido ADM <span style={{ color: '#10B981' }}>{formatCurrency(totalLiquido)}</span> vs depositado <span style={{ color: '#2DD4BF' }}>{formatCurrency(totalDepositadoBanco)}</span>.{" "}
              {diferenca > 0
                ? <>Diferença de <span style={{ color: '#F43F5E' }}>{formatCurrency(diferenca)}</span> não localizada. Verifique: (1) depósitos pendentes de conciliação, (2) aluguéis em atraso, (3) depósitos em outra conta.</>
                : <>Extrato mostra <span style={{ color: '#F43F5E' }}>{formatCurrency(Math.abs(diferenca))}</span> a mais. Verifique se há depósitos de outros meses categorizados incorretamente.</>
              }
            </p>
          </div>
        </div>
      )}

      {/* KPIs anuais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 space-y-1" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <p className="text-xs uppercase font-mono tracking-widest" style={{ color: '#94A3B8' }}>Previsto {year}</p>
          <p className="font-mono text-xl font-bold" style={{ color: '#C9A84C' }}>{formatCurrency(totalAnoPrevisto)}</p>
          <p className="text-xs" style={{ color: '#4A5568' }}>Acumulado no ano</p>
        </div>
        <div className="rounded-2xl p-5 space-y-1" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <p className="text-xs uppercase font-mono tracking-widest" style={{ color: '#94A3B8' }}>Líquido {year}</p>
          <p className="font-mono text-xl font-bold" style={{ color: '#10B981' }}>{formatCurrency(totalAnoLiquido)}</p>
          <p className="text-xs" style={{ color: '#4A5568' }}>Recebido no ano</p>
        </div>
        <div className="rounded-2xl p-5 space-y-1" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <p className="text-xs uppercase font-mono tracking-widest" style={{ color: '#94A3B8' }}>Depositado {year}</p>
          <p className="font-mono text-xl font-bold" style={{ color: '#2DD4BF' }}>
            {totalAnoDepositado > 0 ? formatCurrency(totalAnoDepositado) : formatCurrency(totalAnoLiquido)}
          </p>
          <p className="text-xs" style={{ color: eficiencia >= 95 ? '#10B981' : eficiencia >= 85 ? '#F59E0B' : '#F43F5E' }}>
            {totalAnoDepositado > 0 ? `${eficiencia.toFixed(1)}% de eficiência` : "Sem conciliação ainda"}
          </p>
        </div>
        <div className="rounded-2xl p-5 space-y-1" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <p className="text-xs uppercase font-mono tracking-widest" style={{ color: '#94A3B8' }}>Projeção Anual</p>
          <p className="font-mono text-xl font-bold" style={{ color: '#8B5CF6' }}>{formatCurrency(totalPrevisto * 12)}</p>
          <p className="text-xs" style={{ color: '#4A5568' }}>Base mês atual × 12</p>
        </div>
      </div>

      {/* Gráfico anual previsto vs líquido */}
      <PremiumCard>
        <h3 className="font-display font-bold mb-4" style={{ color: '#F0F4F8' }}>Líquido ADM vs Depositado — {year}</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1A2535" />
            <XAxis dataKey="month" stroke="#4A5568" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} stroke="#4A5568" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' }} />
            <Legend wrapperStyle={{ color: '#94A3B8', fontSize: 12 }} />
            <Bar dataKey="liquido" name="Líquido ADM" fill="#10B981" opacity={0.4} radius={[4, 4, 0, 0]} />
            <Bar dataKey="depositado" name="Depositado" fill="#2DD4BF" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </PremiumCard>



      {/* Tabela anual kitnet × mês */}
      <PremiumCard>
        <h3 className="font-display font-bold mb-4" style={{ color: '#F0F4F8' }}>Kitnet × Mês — {year}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1A2535' }}>
                <th className="text-left py-2 px-3 sticky left-0" style={{ color: '#94A3B8', background: '#0A1118', minWidth: 100 }}>Kitnet</th>
                {yearMonths.map(m => (
                  <th key={m} className="text-right py-2 px-2" style={{ color: '#94A3B8', minWidth: 72 }}>
                    {formatMonth(m).slice(0, 3)}
                  </th>
                ))}
                <th className="text-right py-2 px-3" style={{ color: '#C9A84C', minWidth: 90 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {kitnetList.map(k => (
                <tr key={k.id} style={{ borderBottom: '1px solid #1A2535' }}>
                  <td className="py-2 px-3 sticky left-0" style={{ color: '#F0F4F8', background: '#0A1118' }}>
                    <div>{k.code}</div>
                    <div style={{ color: '#4A5568', fontSize: 10 }}>{k.tenant_name}</div>
                  </td>
                  {k.months.map(({ month: m, liquido }) => (
                    <td key={m} className="text-right py-2 px-2">
                      {liquido !== null
                        ? <span style={{ color: liquido >= (k.rent_value ?? 0) * 0.85 ? '#10B981' : '#F59E0B' }}>{(liquido / 1000).toFixed(1)}k</span>
                        : <span style={{ color: '#2A3F55' }}>—</span>
                      }
                    </td>
                  ))}
                  <td className="text-right py-2 px-3 font-bold" style={{ color: '#C9A84C' }}>{formatCurrency(k.total)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '1px solid #C9A84C' }}>
                <td className="py-2 px-3 font-bold sticky left-0" style={{ color: '#E8C97A', background: '#0A1118' }}>Total</td>
                {yearMonths.map(m => {
                  const t = kitnetList.reduce((s, k) => s + (k.months.find(mo => mo.month === m)?.liquido ?? 0), 0);
                  return <td key={m} className="text-right py-2 px-2 font-bold" style={{ color: t > 0 ? '#E8C97A' : '#2A3F55' }}>{t > 0 ? `${(t/1000).toFixed(1)}k` : "—"}</td>;
                })}
                <td className="text-right py-2 px-3 font-bold" style={{ color: '#E8C97A' }}>{formatCurrency(kitnetList.reduce((s, k) => s + k.total, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-3" style={{ color: '#4A5568' }}>Verde ≥ 95% eficiência · Âmbar {'<'} 95% · — sem lançamento</p>
      </PremiumCard>

      {/* Detalhes do mês — colapsável */}
      {!isLoading && (
        <PremiumCard>
          <button className="w-full flex items-center justify-between" onClick={() => setTableOpen(o => !o)}>
            <h3 className="font-display font-bold" style={{ color: '#F0F4F8' }}>Detalhes — {formatMonth(month)}</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono" style={{ color: '#10B981' }}>{formatCurrency(totalLiquido)}</span>
              {tableOpen ? <ChevronUp className="w-5 h-5" style={{ color: '#94A3B8' }} /> : <ChevronDown className="w-5 h-5" style={{ color: '#94A3B8' }} />}
            </div>
          </button>
          {tableOpen && (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: '#1A2535' }}>
                    {["Código", "Inquilino", "Bruto", "IPTU", "CELESC", "SEMASA", "ADM", "Líquido", "Depositado"].map(h => (
                      <TableHead key={h} style={{ color: '#94A3B8' }}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0
                    ? <TableRow><TableCell colSpan={8} className="text-center py-8" style={{ color: '#94A3B8' }}>Sem lançamentos</TableCell></TableRow>
                    : filtered.map(e => (
                      <TableRow key={e.id} style={{ borderColor: '#1A2535' }}>
                        <TableCell style={{ color: '#F0F4F8' }}>{(e as any).kitnets?.code}</TableCell>
                        <TableCell style={{ color: '#CBD5E1' }}>{(e as any).kitnets?.tenant_name}</TableCell>
                        <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(e.rent_gross ?? 0)}</TableCell>
                        <TableCell className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(e.iptu_taxa ?? 0)}</TableCell>
                        <TableCell className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(e.celesc ?? 0)}</TableCell>
                        <TableCell className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(e.semasa ?? 0)}</TableCell>
                        <TableCell className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(e.adm_fee ?? 0)}</TableCell>
                        <TableCell className="font-mono font-bold" style={{ color: '#10B981' }}>{formatCurrency(e.total_liquid ?? 0)}</TableCell>
                        <TableCell className="font-mono font-bold">
                          {depositadoPorEntry[e.id]
                            ? <span style={{ color: '#2DD4BF' }}>✓ {formatCurrency(depositadoPorEntry[e.id])}</span>
                            : <span style={{ color: '#F59E0B' }}>⏳ —</span>
                          }
                        </TableCell>
                      </TableRow>
                    ))
                  }
                  {filtered.length > 0 && (
                    <TableRow style={{ borderColor: '#C9A84C' }}>
                      <TableCell colSpan={7} className="font-bold text-right" style={{ color: '#E8C97A' }}>Total Líquido</TableCell>
                      <TableCell className="font-mono font-bold" style={{ color: '#E8C97A' }}>{formatCurrency(totalLiquido)}</TableCell>
                      <TableCell className="font-mono font-bold" style={{ color: '#2DD4BF' }}>{formatCurrency(totalDepositado)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </PremiumCard>
      )}
    </div>
  );
}
