import { useState, useMemo } from "react";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProperties } from "@/hooks/useConstructions";
import { useKitnets } from "@/hooks/useKitnets";
import { useNetWorth } from "@/hooks/useFinances";
import { formatCurrency, sumMoney } from "@/lib/formatters";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { TrendingUp, Calculator, Building2 } from "lucide-react";

// CAGR = (final / inicial)^(1/anos) − 1
function cagr(initial: number, final: number, years: number): number | null {
  if (!initial || !final || initial <= 0 || final <= 0 || years <= 0) return null;
  return Math.pow(final / initial, 1 / years) - 1;
}

// Resolve anos necessários pra ir de inicial → meta numa taxa anual.
function yearsTo(initial: number, target: number, annualRate: number): number | null {
  if (!initial || !target || initial <= 0 || target <= 0 || annualRate <= -1) return null;
  if (target <= initial) return 0;
  const denom = Math.log(1 + annualRate);
  if (denom === 0) return null;
  return Math.log(target / initial) / denom;
}

export default function ProjectionsPage() {
  const [rendaAtual, setRendaAtual] = useState(40000);
  const [taxaCrescimento, setTaxaCrescimento] = useState(19); // CAGR real recomputado com patrimônio correto
  const [meta, setMeta] = useState(200000); // Marco 2035 canônico (metas.md)

  const { data: properties, isLoading: isLoadingProperties } = useProperties();
  const { data: kitnets, isLoading: isLoadingKitnets } = useKitnets();
  const nw = useNetWorth();

  // ── Simulador de renda mensal ─────────────────────────────────────────
  const anos = useMemo(() => {
    const y = yearsTo(rendaAtual, meta, taxaCrescimento / 100);
    return y == null ? null : y;
  }, [rendaAtual, meta, taxaCrescimento]);
  const anoChegada = anos == null ? "—" : Math.ceil(2026 + anos);
  const anosDisplay = anos == null ? "—" : anos.toFixed(1);

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

  // ── Projeção de kitnets: vem do banco (real_estate_properties + kitnets) ───
  // Base: kitnets em operação hoje (soma de rent_value).
  // Obras: cada property em construção vira uma linha, com renda projetada =
  //   total_units_planned × estimated_rent_per_unit × ownership_pct/100.
  const kitnetProjRows = useMemo(() => {
    const rows: Array<{
      label: string;
      kits: number;
      owner_pct: number;
      increment: number;
      monthlyIncome: number;
      code?: string;
    }> = [];

    // Linha base: kitnets em operação
    const activeKitnets = (kitnets ?? []).filter((k: any) => k.status === "occupied" || k.status === "maintenance");
    const baseRent = sumMoney(activeKitnets.map((k: any) => k.rent_value));
    rows.push({
      label: `Hoje (${new Date().getFullYear()})`,
      kits: activeKitnets.length,
      owner_pct: 100,
      increment: baseRent,
      monthlyIncome: baseRent,
    });

    // Obras em andamento — ordenadas por data de entrega prevista
    const inConstruction = (properties ?? [])
      .filter((p: any) => p.status && p.status !== "operational" && p.status !== "patrimonial")
      .sort((a: any, b: any) => String(a.estimated_completion ?? "9999").localeCompare(String(b.estimated_completion ?? "9999")));

    let cum = baseRent;
    for (const p of inConstruction) {
      const units = Number(p.total_units_planned) || 0;
      const rentPerUnit = Number(p.estimated_rent_per_unit) || 0;
      const ownerPct = p.ownership_pct == null ? 100 : Number(p.ownership_pct);
      const increment = units * rentPerUnit * (ownerPct / 100);
      cum = sumMoney([cum, increment]);
      const labelDate = p.estimated_completion
        ? new Date(p.estimated_completion).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        : "s/data";
      rows.push({
        label: `${p.code ?? p.name ?? "?"} (${labelDate})`,
        kits: units,
        owner_pct: ownerPct,
        increment,
        monthlyIncome: cum,
        code: p.code ?? undefined,
      });
    }

    return rows;
  }, [properties, kitnets]);

  // ── ROI por projeto (cota do William) ────────────────────────────────
  const roiData = (properties ?? [])
    .filter((p: any) => p.status !== "patrimonial")
    .map((p: any) => {
      const units = Number(p.total_units_planned) || 0;
      const rentPerUnit = Number(p.estimated_rent_per_unit) || 0;
      const ownerPct = p.ownership_pct == null ? 100 : Number(p.ownership_pct);
      const propertyValue = Number(p.property_value) || 0;

      const rentMonthly = units * rentPerUnit * (ownerPct / 100);
      const investTotal = propertyValue * (ownerPct / 100);
      const roiAnnual = investTotal > 0 ? (rentMonthly * 12 / investTotal) * 100 : 0;
      const payback = rentMonthly > 0 ? Math.ceil(investTotal / rentMonthly) : 0;
      return { code: p.code, name: p.name, investTotal, rentMonthly, roiAnnual, payback };
    });

  // ── CAGR real pro patrimônio-alvo R$ 70M até 2041 ─────────────────────
  const anosAte2041 = 2041 - new Date().getFullYear();
  const cagrPatrimonioNecessario = cagr(nw.netWorth || 0, 70_000_000, anosAte2041);
  const cagrPct = cagrPatrimonioNecessario == null ? null : cagrPatrimonioNecessario * 100;

  const inputStyle = { background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' };
  const loading = isLoadingProperties || isLoadingKitnets || nw.isLoading;

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
        <TrendingUp className="inline w-6 h-6 mr-2" style={{ color: '#C9A84C' }} />
        Projeções
      </h1>

      {/* Patrimônio-alvo R$ 70M / 2041 — CAGR real exigido */}
      <PremiumCard glowColor="#2DD4BF" className="space-y-3">
        <h3 className="font-display font-bold text-lg" style={{ color: '#E8C97A' }}>
          🎯 Patrimônio-alvo R$ 70M em 2041
        </h3>
        {loading ? (
          <Skeleton className="h-20" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs" style={{ color: '#94A3B8' }}>Patrimônio hoje</p>
              <p className="font-mono text-xl" style={{ color: '#E8C97A' }}>{formatCurrency(nw.netWorth)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#94A3B8' }}>Meta 2041</p>
              <p className="font-mono text-xl" style={{ color: '#2DD4BF' }}>{formatCurrency(70_000_000)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#94A3B8' }}>Anos até 2041</p>
              <p className="font-mono text-xl" style={{ color: '#F0F4F8' }}>{anosAte2041}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#94A3B8' }}>CAGR necessário</p>
              <p className="font-mono text-xl font-bold" style={{ color: '#F43F5E' }}>
                {cagrPct == null ? "—" : `${cagrPct.toFixed(1)}% a.a.`}
              </p>
            </div>
          </div>
        )}
      </PremiumCard>

      {/* Simulador de renda */}
      <PremiumCard glowColor="#C9A84C" className="space-y-4">
        <h3 className="font-display font-bold text-lg" style={{ color: '#E8C97A' }}>
          <Calculator className="inline w-5 h-5 mr-2" />Simulador de Renda Mensal
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label style={{ color: '#94A3B8' }}>Renda Atual (R$)</Label>
            <Input type="number" value={rendaAtual} onChange={e => setRendaAtual(Math.max(0, Number(e.target.value) || 0))} style={inputStyle} />
          </div>
          <div>
            <Label style={{ color: '#94A3B8' }}>Crescimento Anual (%)</Label>
            <Input type="number" value={taxaCrescimento} onChange={e => setTaxaCrescimento(Number(e.target.value) || 0)} style={inputStyle} />
          </div>
          <div>
            <Label style={{ color: '#94A3B8' }}>Meta (R$)</Label>
            <Input type="number" value={meta} onChange={e => setMeta(Math.max(0, Number(e.target.value) || 0))} style={inputStyle} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div><p className="text-xs" style={{ color: '#94A3B8' }}>Anos necessários</p><p className="font-mono text-xl" style={{ color: '#E8C97A' }}>{anosDisplay}</p></div>
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

      {/* Projeção de kitnets — dados do banco, respeitando ownership_pct e aluguel real */}
      <PremiumCard className="space-y-4">
        <h3 className="font-display font-bold text-lg" style={{ color: '#F0F4F8' }}>
          <Building2 className="inline w-5 h-5 mr-2" style={{ color: '#2DD4BF' }} />
          Projeção de Kitnets
        </h3>
        {loading ? <Skeleton className="h-40" /> : kitnetProjRows.length === 0 ? (
          <p className="text-center py-4" style={{ color: '#94A3B8' }}>Cadastre propriedades em <a href="/constructions" className="underline">/constructions</a> pra ver projeções.</p>
        ) : (
          <Table>
            <TableHeader><TableRow style={{ borderColor: '#1A2535' }}>
              {["Período", "Kitnets", "Sua Parte", "Incremento", "Renda Mensal"].map(h => <TableHead key={h} style={{ color: '#94A3B8' }}>{h}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {kitnetProjRows.map((r, i) => (
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
        )}
        <p className="text-xs" style={{ color: '#94A3B8' }}>
          * Valores calculados a partir de <code>real_estate_properties.ownership_pct × estimated_rent_per_unit × total_units_planned</code>.
          Para atualizar, edite a propriedade em <a href="/constructions" className="underline">/constructions</a>.
        </p>
      </PremiumCard>

      {/* ROI por projeto */}
      <PremiumCard className="space-y-4">
        <h3 className="font-display font-bold text-lg" style={{ color: '#F0F4F8' }}>📊 ROI por Projeto</h3>
        {loading ? <Skeleton className="h-32" /> : roiData.length === 0 ? (
          <p className="text-center py-4" style={{ color: '#94A3B8' }}>Sem dados de projetos</p>
        ) : (
          <Table>
            <TableHeader><TableRow style={{ borderColor: '#1A2535' }}>
              {["Projeto", "Investimento (sua parte)", "Renda Mensal", "ROI Anual", "Payback"].map(h => <TableHead key={h} style={{ color: '#94A3B8' }}>{h}</TableHead>)}
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
