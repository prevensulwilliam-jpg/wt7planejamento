import { useState } from "react";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProperties, useConstructionExpenses } from "@/hooks/useConstructions";
import { formatCurrency } from "@/lib/formatters";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { TrendingUp, Calculator, Building2 } from "lucide-react";

export default function ProjectionsPage() {
  const [rendaAtual, setRendaAtual] = useState(40000);
  const [taxaCrescimento, setTaxaCrescimento] = useState(18);
  const [meta, setMeta] = useState(100000);
  const { data: properties, isLoading } = useProperties();

  // Compound growth simulation
  const anos = Math.log(meta / rendaAtual) / Math.log(1 + taxaCrescimento / 100);
  const anoChegada = Math.ceil(2026 + anos);

  const scenarios = [
    { name: "Conservador", rate: 10, color: "#4A5568" },
    { name: "Moderado", rate: taxaCrescimento, color: "#C9A84C" },
    { name: "Agressivo", rate: 28, color: "#2DD4BF" },
  ];

  const chartData = Array.from({ length: 10 }, (_, i) => {
    const year = 2026 + i;
    const row: Record<string, any> = { year: String(year) };
    scenarios.forEach(s => {
      row[s.name] = Math.round(rendaAtual * Math.pow(1 + s.rate / 100, i));
    });
    return row;
  });

  // Kitnet projection
  const kitnetProjection = [
    { label: "Hoje (2026)", kits: 13, owner_pct: 100, rent: 1540 },
    { label: "RWW01 (dez/26)", kits: 10, owner_pct: 50, rent: 1540, code: "RWW01" },
    { label: "RWT04 (jan/27)", kits: 10, owner_pct: 100, rent: 1540, code: "RWT04" },
    { label: "RJW01 (jan/27)", kits: 10, owner_pct: 50, rent: 1540, code: "RJW01" },
    { label: "RJW02 (dez/27)", kits: 20, owner_pct: 50, rent: 1540, code: "RJW02" },
  ];

  let cumRent = 0;
  const projRows = kitnetProjection.map(p => {
    const increment = p.kits * p.rent * (p.owner_pct / 100);
    cumRent += p.code ? increment : increment; // first row is base
    return { ...p, monthlyIncome: cumRent, increment: p.code ? increment : cumRent };
  });

  // ROI per project
  const roiData = (properties ?? []).filter(p => p.status !== "patrimonial").map(p => {
    const rentMonthly = (p.total_units_planned ?? 0) * (p.estimated_rent_per_unit ?? 0) * ((p.ownership_pct ?? 100) / 100);
    const investTotal = (p.property_value ?? 0) * ((p.ownership_pct ?? 100) / 100);
    const roiAnnual = investTotal > 0 ? (rentMonthly * 12 / investTotal) * 100 : 0;
    const payback = rentMonthly > 0 ? Math.ceil(investTotal / rentMonthly) : 0;
    return { code: p.code, name: p.name, investTotal, rentMonthly, roiAnnual, payback };
  });

  const inputStyle = { background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' };

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
        <TrendingUp className="inline w-6 h-6 mr-2" style={{ color: '#C9A84C' }} />
        Projeções
      </h1>

      {/* Simulator */}
      <PremiumCard glowColor="#C9A84C" className="space-y-4">
        <h3 className="font-display font-bold text-lg" style={{ color: '#E8C97A' }}>
          <Calculator className="inline w-5 h-5 mr-2" />Simulador R$ 100k/mês
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label style={{ color: '#94A3B8' }}>Renda Atual (R$)</Label><Input type="number" value={rendaAtual} onChange={e => setRendaAtual(Number(e.target.value) || 0)} style={inputStyle} /></div>
          <div><Label style={{ color: '#94A3B8' }}>Crescimento Anual (%)</Label><Input type="number" value={taxaCrescimento} onChange={e => setTaxaCrescimento(Number(e.target.value) || 0)} style={inputStyle} /></div>
          <div><Label style={{ color: '#94A3B8' }}>Meta (R$)</Label><Input type="number" value={meta} onChange={e => setMeta(Number(e.target.value) || 0)} style={inputStyle} /></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div><p className="text-xs" style={{ color: '#94A3B8' }}>Anos necessários</p><p className="font-mono text-xl" style={{ color: '#E8C97A' }}>{anos.toFixed(1)}</p></div>
          <div><p className="text-xs" style={{ color: '#94A3B8' }}>Ano de chegada</p><p className="font-mono text-xl" style={{ color: '#E8C97A' }}>{anoChegada}</p></div>
          <div><p className="text-xs" style={{ color: '#94A3B8' }}>Em 3 anos</p><p className="font-mono text-xl" style={{ color: '#2DD4BF' }}>{formatCurrency(rendaAtual * Math.pow(1 + taxaCrescimento / 100, 3))}</p></div>
          <div><p className="text-xs" style={{ color: '#94A3B8' }}>Em 5 anos</p><p className="font-mono text-xl" style={{ color: '#10B981' }}>{formatCurrency(rendaAtual * Math.pow(1 + taxaCrescimento / 100, 5))}</p></div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1A2535" />
            <XAxis dataKey="year" stroke="#4A5568" />
            <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} stroke="#4A5568" />
            <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: '#0D1318', border: '1px solid #1A2535' }} />
            <Legend />
            <ReferenceLine y={meta} stroke="#F43F5E" strokeDasharray="8 4" label={{ value: `Meta ${formatCurrency(meta)}`, fill: '#F43F5E', fontSize: 11 }} />
            {scenarios.map(s => <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </PremiumCard>

      {/* Kitnet projection */}
      <PremiumCard className="space-y-4">
        <h3 className="font-display font-bold text-lg" style={{ color: '#F0F4F8' }}>
          <Building2 className="inline w-5 h-5 mr-2" style={{ color: '#2DD4BF' }} />
          Projeção de Kitnets
        </h3>
        <Table>
          <TableHeader><TableRow style={{ borderColor: '#1A2535' }}>
            {["Período", "Kitnets", "Sua Parte", "Incremento", "Renda Mensal"].map(h => <TableHead key={h} style={{ color: '#94A3B8' }}>{h}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>
            {projRows.map((r, i) => (
              <TableRow key={i} style={{ borderColor: '#1A2535' }}>
                <TableCell style={{ color: '#F0F4F8' }}>{r.label}</TableCell>
                <TableCell style={{ color: '#CBD5E1' }}>{r.kits} kits</TableCell>
                <TableCell style={{ color: '#94A3B8' }}>{r.owner_pct}%</TableCell>
                <TableCell className="font-mono" style={{ color: '#2DD4BF' }}>+{formatCurrency(r.increment)}</TableCell>
                <TableCell className="font-mono font-bold" style={{ color: '#E8C97A' }}>{formatCurrency(r.monthlyIncome)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs" style={{ color: '#94A3B8' }}>* Projetos com sócio consideram apenas 50% da renda</p>
      </PremiumCard>

      {/* ROI by project */}
      <PremiumCard className="space-y-4">
        <h3 className="font-display font-bold text-lg" style={{ color: '#F0F4F8' }}>📊 ROI por Projeto</h3>
        {isLoading ? <Skeleton className="h-32" /> : roiData.length === 0 ? (
          <p className="text-center py-4" style={{ color: '#94A3B8' }}>Sem dados de projetos</p>
        ) : (
          <Table>
            <TableHeader><TableRow style={{ borderColor: '#1A2535' }}>
              {["Projeto", "Investimento (parte)", "Renda Mensal", "ROI Anual", "Payback"].map(h => <TableHead key={h} style={{ color: '#94A3B8' }}>{h}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {roiData.map(r => (
                <TableRow key={r.code} style={{ borderColor: '#1A2535' }}>
                  <TableCell style={{ color: '#F0F4F8' }}>{r.code}</TableCell>
                  <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(r.investTotal)}</TableCell>
                  <TableCell className="font-mono" style={{ color: '#2DD4BF' }}>{formatCurrency(r.rentMonthly)}</TableCell>
                  <TableCell className="font-mono" style={{ color: '#10B981' }}>{r.roiAnnual.toFixed(1)}%</TableCell>
                  <TableCell className="font-mono" style={{ color: '#F0F4F8' }}>{r.payback} meses</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PremiumCard>
    </div>
  );
}
