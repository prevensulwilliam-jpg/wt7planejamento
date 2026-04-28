import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { useDRE, type DREBucket, type DREItem } from "@/hooks/useDRE";
import { useNetWorth } from "@/hooks/useFinances";
import { formatMonth, getCurrentMonth } from "@/lib/formatters";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Hammer, Heart, PartyPopper, Sparkles,
  Calculator, BarChart3, Info, RefreshCw,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────
function money(v: number): string {
  if (!isFinite(v)) return "R$ 0,00";
  const sign = v < 0 ? "-" : "";
  return `${sign}R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function moneyShort(v: number): string {
  if (!isFinite(v)) return "R$ 0";
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1_000_000) return `${sign}R$ ${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}R$ ${(a / 1_000).toFixed(1)}k`;
  return `${sign}R$ ${a.toFixed(0)}`;
}
function pct(v: number): string {
  if (!isFinite(v)) return "0,0%";
  return `${v.toFixed(1).replace(".", ",")}%`;
}
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Mini-componente: bucket expansível ─────────────────────────────
function BucketRow({ bucket, color, defaultOpen = false }: { bucket: DREBucket; color: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (bucket.total === 0 && bucket.items.length === 0) return null;
  return (
    <div className="border-b last:border-0" style={{ borderColor: "#1A2535" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-2.5 px-1 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          {bucket.items.length > 0 && (
            open
              ? <ChevronUp className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
              : <ChevronDown className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
          )}
          <span className="text-sm" style={{ color: "#F0F4F8" }}>{bucket.label}</span>
          {bucket.items.length > 0 && (
            <span className="text-[11px]" style={{ color: "#4A5568" }}>· {bucket.items.length}</span>
          )}
        </div>
        <span className="text-sm font-medium tabular-nums" style={{ color }}>{money(bucket.total)}</span>
      </button>
      {open && bucket.items.length > 0 && (
        <div className="pb-2 pl-6 pr-1 space-y-1">
          {bucket.items.map((it: DREItem, i: number) => (
            <div key={i} className="flex items-center justify-between text-[12px] py-1" style={{ color: "#94A3B8" }}>
              <div className="flex items-center gap-2 truncate">
                {it.date && <span className="text-[10px]" style={{ color: "#4A5568" }}>{it.date.slice(8, 10)}/{it.date.slice(5, 7)}</span>}
                <span className="truncate">{it.label}</span>
              </div>
              <span className="tabular-nums shrink-0 ml-2">{money(it.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bloco genérico ─────────────────────────────────────────────────
function Block({
  icon: Icon, title, total, accent, children, right,
}: {
  icon: any; title: string; total: number; accent: string; children: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <PremiumCard>
      <div className="flex items-center justify-between mb-3 pb-3 border-b" style={{ borderColor: "#1A2535" }}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: accent }} />
          <h3 className="text-base font-semibold" style={{ color: "#F0F4F8" }}>{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          {right}
          <span className="text-lg font-bold tabular-nums" style={{ color: accent }}>{money(total)}</span>
        </div>
      </div>
      <div>{children}</div>
    </PremiumCard>
  );
}

// ─── Hook auxiliar — recurring_bills total para Real×Orçado ─────────
function useBudgetTotals() {
  return useQuery({
    queryKey: ["recurring_bills_for_dre"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_bills" as any)
        .select("amount, category, is_fixed, active")
        .eq("active", true);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<{ amount: number; category: string | null; is_fixed: boolean; active: boolean }>;
      const total = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const byCat: Record<string, number> = {};
      for (const r of rows) {
        const c = (r.category || "outros").toLowerCase();
        byCat[c] = (byCat[c] ?? 0) + Number(r.amount ?? 0);
      }
      return { total, byCat };
    },
  });
}

// ─── Hook auxiliar — patrimônio do mês (info footer) ─────────────────
function NetWorthFooter() {
  const nw = useNetWorth();
  if (nw.isLoading) return null;
  return (
    <PremiumCard>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4" style={{ color: "#94A3B8" }} />
          <span className="text-sm" style={{ color: "#94A3B8" }}>
            Patrimônio Líquido (informativo · DRE ≠ Balanço Patrimonial)
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: "#94A3B8" }}>
          <span>Bens <span className="font-medium" style={{ color: "#C9A84C" }}>{moneyShort(nw.grossAssets)}</span></span>
          <span>Dívidas <span className="font-medium text-red-400">−{moneyShort(nw.debtsTotal)}</span></span>
          <span className="text-base font-bold tabular-nums" style={{ color: "#F0F4F8" }}>= {money(nw.netWorth)}</span>
        </div>
      </div>
    </PremiumCard>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function DREPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState<string>(getCurrentMonth());
  const [view, setView] = useState<"single" | "vs_budget" | "ytd">("single");

  const { data: dre, isLoading, isFetching, error, refetch } = useDRE(month);
  const { data: budget } = useBudgetTotals();

  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["dre"] });
    await qc.invalidateQueries({ queryKey: ["dre_ytd"] });
    await qc.invalidateQueries({ queryKey: ["recurring_bills_for_dre"] });
    await refetch();
  };

  // bounds da navegação livre — guard rails de 2 anos pra trás e 2 pra frente
  const minMonth = "2024-01";
  const maxMonth = "2028-12";
  const isOldest = month <= minMonth;
  const isNewest = month >= maxMonth;

  // Comparativo com mês anterior — resultado.sobra_liquida
  const prevMonth = shiftMonth(month, -1);
  const { data: dreLast } = useDRE(prevMonth);

  // YTD (jan → mês selecionado)
  const ytdMonths = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return Array.from({ length: m }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
  }, [month]);
  const ytdData = useYTD(ytdMonths, view === "ytd");

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {/* ─── HEADER + NAV MES ─── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#F0F4F8" }}>DRE Mensal</h1>
          <p className="text-sm mt-0.5" style={{ color: "#94A3B8" }}>
            Demonstração do Resultado · regime caixa (cartão = fatura paga no mês)
          </p>
        </div>

        {/* toggles */}
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
          {[
            { v: "single", l: "Mês Único", icon: Calculator },
            { v: "vs_budget", l: "Real × Orçado", icon: BarChart3 },
            { v: "ytd", l: "YTD", icon: TrendingUp },
          ].map(t => (
            <button
              key={t.v}
              onClick={() => setView(t.v as any)}
              className="px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-all"
              style={{
                background: view === t.v ? "#C9A84C" : "transparent",
                color: view === t.v ? "#000" : "#94A3B8",
                fontWeight: view === t.v ? 600 : 400,
              }}
            >
              <t.icon className="w-3 h-3" />
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* nav mês central + refresh */}
      <div className="flex items-center justify-center gap-3 py-1">
        <button
          onClick={() => !isOldest && setMonth(shiftMonth(month, -1))}
          disabled={isOldest}
          className="p-2 rounded-md hover:bg-white/5 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "#C9A84C" }} />
        </button>
        <span className="text-xl font-bold tracking-wide capitalize" style={{ color: "#F0F4F8", minWidth: 220, textAlign: "center" }}>
          {formatMonth(month)}
        </span>
        <button
          onClick={() => !isNewest && setMonth(shiftMonth(month, 1))}
          disabled={isNewest}
          className="p-2 rounded-md hover:bg-white/5 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
          aria-label="Próximo mês"
        >
          <ChevronRight className="w-5 h-5" style={{ color: "#C9A84C" }} />
        </button>
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="p-2 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"
          aria-label="Atualizar"
          title="Recarregar dados (após editar receitas/despesas em outra aba)"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} style={{ color: "#94A3B8" }} />
        </button>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-sm" style={{ color: "#94A3B8" }}>Calculando DRE…</div>
      )}
      {error && (
        <PremiumCard>
          <div className="text-sm py-4 text-center text-red-400">Erro ao carregar DRE: {(error as any).message}</div>
        </PremiumCard>
      )}

      {dre && view === "single" && (
        <SingleMonthView dre={dre} dreLast={dreLast} budget={budget?.total ?? 0} />
      )}

      {dre && view === "vs_budget" && (
        <VsBudgetView dre={dre} budgetByCat={budget?.byCat ?? {}} budgetTotal={budget?.total ?? 0} />
      )}

      {dre && view === "ytd" && (
        <YTDView months={ytdMonths} data={ytdData} />
      )}

      <NetWorthFooter />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  VIEW: MÊS ÚNICO
// ═══════════════════════════════════════════════════════════════════
function SingleMonthView({ dre, dreLast, budget }: { dre: any; dreLast: any; budget: number }) {
  const r = dre.resultado;
  const lastSobra = dreLast?.resultado?.sobra_liquida ?? null;
  const deltaSobra = lastSobra != null ? r.sobra_liquida - lastSobra : null;

  return (
    <>
      {/* ── 1. RECEITAS ── */}
      <Block icon={TrendingUp} title="1. Receitas" total={dre.receitas.total} accent="#10B981">
        <div className="space-y-0">
          <BucketRow bucket={dre.receitas.renda_ativa} color="#10B981" defaultOpen />
          <BucketRow bucket={dre.receitas.renda_passiva} color="#10B981" />
          <BucketRow bucket={dre.receitas.comissoes_extras} color="#10B981" />
          <BucketRow bucket={dre.receitas.avulsas} color="#10B981" />
          {dre.receitas.entradas_neutras > 0 && (
            <div className="flex items-center justify-between py-2.5 text-[12px]" style={{ color: "#4A5568" }}>
              <span>Entradas neutras (não conta na receita)</span>
              <span className="tabular-nums">{money(dre.receitas.entradas_neutras)}</span>
            </div>
          )}
        </div>
      </Block>

      {/* ── 2. CUSTEIO ── */}
      <Block
        icon={TrendingDown}
        title="2. Custeio Pessoal"
        total={dre.custeio.total}
        accent="#EF4444"
        right={budget > 0
          ? <span className="text-[11px]" style={{ color: dre.custeio.total > budget ? "#EF4444" : "#94A3B8" }}>orçado {moneyShort(budget)}</span>
          : undefined}
      >
        <div className="space-y-0">
          {dre.custeio.buckets.length === 0
            ? <div className="text-xs py-3 text-center" style={{ color: "#4A5568" }}>Nenhum custeio neste mês.</div>
            : dre.custeio.buckets.map((b: DREBucket, i: number) => <BucketRow key={i} bucket={b} color="#EF4444" />)}
        </div>
      </Block>

      {/* ── 3. OBRAS ── */}
      <Block icon={Hammer} title="3. Obras" total={dre.obras.total} accent="#C9A84C">
        <div className="space-y-0">
          {dre.obras.buckets.length === 0 && dre.obras.terrenos.total === 0
            ? <div className="text-xs py-3 text-center" style={{ color: "#4A5568" }}>Nenhum aporte em obra neste mês.</div>
            : <>
                {dre.obras.buckets.map((b: DREBucket, i: number) => <BucketRow key={i} bucket={b} color="#C9A84C" />)}
                {dre.obras.terrenos.total > 0 && <BucketRow bucket={dre.obras.terrenos} color="#C9A84C" />}
              </>}
        </div>
      </Block>

      {/* ── 4. CASAMENTO ── */}
      <Block icon={Heart} title="4. Casamento" total={dre.casamento.total} accent="#EC4899">
        <div className="space-y-0">
          {dre.casamento.buckets.length === 0
            ? <div className="text-xs py-3 text-center" style={{ color: "#4A5568" }}>Nenhum gasto de casamento neste mês.</div>
            : dre.casamento.buckets.map((b: DREBucket, i: number) => <BucketRow key={i} bucket={b} color="#EC4899" />)}
        </div>
      </Block>

      {/* ── 5. VIAGENS ── */}
      <Block icon={PartyPopper} title="5. Eventos" total={dre.eventos.total} accent="#3B82F6">
        <div className="space-y-0">
          {dre.eventos.buckets.length === 0
            ? <div className="text-xs py-3 text-center" style={{ color: "#4A5568" }}>Nenhum evento neste mês. Use slug <span style={{ color: "#C9A84C" }}>evento_*</span> (ex: evento_china_2027) pra rastrear viagens-evento separadas do custeio.</div>
            : dre.eventos.buckets.map((b: DREBucket, i: number) => <BucketRow key={i} bucket={b} color="#3B82F6" />)}
        </div>
      </Block>

      {/* ── 6. OUTROS APORTES ── */}
      <Block icon={Sparkles} title="6. Outros Aportes" total={dre.outros_aportes.total} accent="#A78BFA">
        <div className="space-y-0">
          {dre.outros_aportes.consorcios.total === 0
            && dre.outros_aportes.dev_profissional.total === 0
            && dre.outros_aportes.dev_pessoal.total === 0
            && dre.outros_aportes.ferramentas.total === 0
            ? <div className="text-xs py-3 text-center" style={{ color: "#4A5568" }}>Nenhum outro aporte neste mês.</div>
            : <>
                {dre.outros_aportes.consorcios.total > 0 && <BucketRow bucket={dre.outros_aportes.consorcios} color="#A78BFA" />}
                {dre.outros_aportes.dev_profissional.total > 0 && <BucketRow bucket={dre.outros_aportes.dev_profissional} color="#A78BFA" />}
                {dre.outros_aportes.dev_pessoal.total > 0 && <BucketRow bucket={dre.outros_aportes.dev_pessoal} color="#A78BFA" />}
                {dre.outros_aportes.ferramentas.total > 0 && <BucketRow bucket={dre.outros_aportes.ferramentas} color="#A78BFA" />}
              </>}
        </div>
      </Block>

      {/* ── 7. RESULTADO ── */}
      <PremiumCard glowColor={r.sobra_liquida >= 0 ? "#10B981" : "#EF4444"}>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: "#F0F4F8" }}>
          <Calculator className="w-4 h-4" style={{ color: "#C9A84C" }} />
          7. Resultado do Mês
        </h3>
        <div className="space-y-1.5 text-sm">
          <ResultLine label="Receitas" value={r.receita} color="#10B981" />
          <ResultLine label="(−) Custeio" value={-r.custeio} color="#EF4444" />
          <ResultLine label="(−) Obras" value={-r.obras} color="#C9A84C" />
          <ResultLine label="(−) Casamento" value={-r.casamento} color="#EC4899" />
          <ResultLine label="(−) Eventos" value={-r.eventos} color="#3B82F6" />
          <ResultLine label="(−) Outros Aportes" value={-r.outros_aportes} color="#A78BFA" />
          <div className="h-px my-2" style={{ background: "#1A2535" }} />
          <div className="flex items-center justify-between pt-1">
            <span className="text-base font-semibold" style={{ color: "#F0F4F8" }}>= Sobra Líquida</span>
            <div className="flex items-center gap-3">
              {deltaSobra != null && (
                <span className="text-[11px]" style={{ color: deltaSobra >= 0 ? "#10B981" : "#EF4444" }}>
                  {deltaSobra >= 0 ? "▲" : "▼"} {money(Math.abs(deltaSobra))} vs mês anterior
                </span>
              )}
              <span className="text-xl font-bold tabular-nums" style={{ color: r.sobra_liquida >= 0 ? "#10B981" : "#EF4444" }}>
                {money(r.sobra_liquida)}
              </span>
            </div>
          </div>
        </div>

        {/* indicadores % */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t" style={{ borderColor: "#1A2535" }}>
          <Indicator label="Sobra Operacional" value={r.sobra_operacional_pct} hint="(Receita − Custeio) ÷ Receita" target={50} />
          <Indicator label="Reinvestimento Patrimonial" value={r.reinvestimento_patrimonial_pct} hint="Obras ÷ Receita" />
          <Indicator label="Reinvestimento Total" value={r.reinvestimento_total_pct} hint="(Obras + Outros Aportes) ÷ Receita" target={50} />
          <Indicator label="Casamento + Eventos" value={r.casamento_eventos_pct} hint="(Casamento + Eventos) ÷ Receita" />
        </div>
      </PremiumCard>
    </>
  );
}

function ResultLine({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "#94A3B8" }}>{label}</span>
      <span className="tabular-nums" style={{ color }}>{money(value)}</span>
    </div>
  );
}

function Indicator({ label, value, hint, target }: { label: string; value: number; hint: string; target?: number }) {
  const ok = target != null ? value >= target : null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: "#4A5568" }}>{label}</p>
      <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color: ok == null ? "#F0F4F8" : ok ? "#10B981" : "#F59E0B" }}>{pct(value)}</p>
      <p className="text-[10px]" style={{ color: "#4A5568" }}>{hint}{target ? ` · alvo ≥ ${target}%` : ""}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  VIEW: REAL × ORÇADO
// ═══════════════════════════════════════════════════════════════════
function VsBudgetView({ dre, budgetByCat, budgetTotal }: { dre: any; budgetByCat: Record<string, number>; budgetTotal: number }) {
  // Apenas custeio entra em comparação direta com recurring_bills
  const realByCat: Record<string, number> = {};
  for (const b of dre.custeio.buckets as DREBucket[]) {
    realByCat[(b.label || "outros").toLowerCase()] = b.total;
  }
  const allCats = Array.from(new Set([...Object.keys(realByCat), ...Object.keys(budgetByCat)])).sort();

  const totalReal = dre.custeio.total;
  const totalDelta = totalReal - budgetTotal;

  return (
    <PremiumCard>
      <div className="flex items-center justify-between mb-4 pb-4 border-b" style={{ borderColor: "#1A2535" }}>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: "#C9A84C" }} />
          <h3 className="text-base font-semibold" style={{ color: "#F0F4F8" }}>Custeio Real × Orçado (recurring_bills)</h3>
        </div>
        <div className="text-xs" style={{ color: "#94A3B8" }}>
          Real <span className="font-medium" style={{ color: "#F0F4F8" }}>{moneyShort(totalReal)}</span>
          {" · "}Orçado <span className="font-medium" style={{ color: "#F0F4F8" }}>{moneyShort(budgetTotal)}</span>
          {" · "}Δ <span className="font-bold" style={{ color: totalDelta > 0 ? "#EF4444" : "#10B981" }}>{moneyShort(totalDelta)}</span>
        </div>
      </div>
      <div>
        <div className="grid grid-cols-12 text-[11px] uppercase tracking-wide pb-2" style={{ color: "#4A5568" }}>
          <div className="col-span-5">Categoria</div>
          <div className="col-span-2 text-right">Real</div>
          <div className="col-span-2 text-right">Orçado</div>
          <div className="col-span-2 text-right">Δ</div>
          <div className="col-span-1 text-right">%</div>
        </div>
        {allCats.length === 0 && (
          <div className="text-xs py-6 text-center" style={{ color: "#4A5568" }}>
            Nenhuma categoria com dados. Cadastre os recorrentes em <span style={{ color: "#C9A84C" }}>/recurring-bills</span>.
          </div>
        )}
        {allCats.map(cat => {
          const real = realByCat[cat] ?? 0;
          const bud = budgetByCat[cat] ?? 0;
          const delta = real - bud;
          const pctReal = bud > 0 ? (real / bud) * 100 : null;
          return (
            <div key={cat} className="grid grid-cols-12 py-2 text-sm border-b" style={{ borderColor: "#1A2535", color: "#F0F4F8" }}>
              <div className="col-span-5 truncate" style={{ color: "#94A3B8" }}>{cat}</div>
              <div className="col-span-2 text-right tabular-nums">{money(real)}</div>
              <div className="col-span-2 text-right tabular-nums" style={{ color: "#94A3B8" }}>{money(bud)}</div>
              <div className="col-span-2 text-right tabular-nums" style={{ color: delta > 0 ? "#EF4444" : delta < 0 ? "#10B981" : "#94A3B8" }}>
                {delta === 0 ? "—" : money(delta)}
              </div>
              <div className="col-span-1 text-right text-xs" style={{ color: "#4A5568" }}>
                {pctReal != null ? pct(pctReal) : "—"}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] mt-4" style={{ color: "#4A5568" }}>
        * Comparação aplicada apenas ao Custeio Pessoal — obras/casamento/viagens não são contas recorrentes.
      </p>
    </PremiumCard>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  VIEW: YTD (jan → mês selecionado)
// ═══════════════════════════════════════════════════════════════════
function useYTD(months: string[], enabled: boolean) {
  return useQuery({
    enabled: enabled && months.length > 0,
    queryKey: ["dre_ytd", months.join(",")],
    queryFn: async () => {
      const out: Array<{ month: string; receita: number; custeio: number; obras: number; casamento: number; eventos: number; outros: number; sobra: number }> = [];
      for (const m of months) {
        // Reaproveita queryClient cache se já tem (chamando o hook diretamente não é ideal aqui — replicamos lógica simplificada)
        // Pra não duplicar complexidade, fazemos uma chamada simplificada por mês reaproveitando os agregadores principais.
        const monthStart = `${m}-01`;
        const [yy, mm] = m.split("-").map(Number);
        const nextMonth = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;

        const lastDay = new Date(yy, mm, 0).getDate();
        const monthEnd = `${yy}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const [revsQ, kitQ, paidInstQ, expsQ, invQ] = await Promise.all([
          supabase.from("revenues").select("amount, source, counts_as_income, business_id, description").eq("reference_month", m),
          supabase.from("kitnet_entries").select("total_liquid, reconciled").eq("reference_month", m),
          (supabase as any).from("other_commission_installments").select("amount, paid_amount, paid_at").not("paid_at", "is", null).gte("paid_at", monthStart).lte("paid_at", monthEnd),
          supabase.from("expenses").select("amount, category, vector, counts_as_investment, description, is_card_payment, nature").eq("reference_month", m),
          supabase.from("card_invoices").select("id, paid_amount, total_amount").gte("paid_at", monthStart).lt("paid_at", nextMonth),
        ]);
        const revs = (revsQ.data ?? []).filter((r: any) => r.counts_as_income !== false);
        const isPrev = (r: any) => {
          const s = (r.source || "").toLowerCase(), d = (r.description || "").toLowerCase();
          return s.includes("prevensul") || s.includes("comiss") || s.includes("salar") || s.includes("clt") || d.includes("prevensul") || d.includes("salár") || d.includes("comiss");
        };
        const rendaAtiva = revs.filter(isPrev).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        const rendaPassiva = (kitQ.data ?? []).filter((k: any) => k.reconciled).reduce((s: number, k: any) => s + Number(k.total_liquid || 0), 0);
        const extras = (paidInstQ.data ?? []).reduce((s: number, p: any) => s + Number(p.paid_amount ?? p.amount ?? 0), 0);
        const avulsas = revs.filter((r: any) => !isPrev(r) && r.source !== "aluguel_kitnets").reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        const receita = rendaAtiva + rendaPassiva + extras + avulsas;

        // ratio de cartão por invoice
        const invs = invQ.data ?? [];
        const invIds = invs.map((i: any) => i.id);
        const ratio: Record<string, number> = {};
        for (const inv of invs) {
          const t = Number((inv as any).total_amount || 0);
          const p = Number((inv as any).paid_amount ?? t);
          ratio[(inv as any).id] = t > 0 ? Math.min(1, p / t) : 1;
        }
        let cardTxs: any[] = [];
        if (invIds.length > 0) {
          const r = await supabase.from("card_transactions").select("amount, vector, counts_as_investment, invoice_id, custom_categories ( slug )").in("invoice_id", invIds);
          cardTxs = (r.data ?? []).map((t: any) => ({ ...t, amount: Number(t.amount || 0) * (ratio[t.invoice_id] ?? 1) }));
        }

        let custeio = 0, obras = 0, casamento = 0, eventos = 0, outros = 0;
        for (const e of expsQ.data ?? []) {
          if ((e as any).is_card_payment) continue;
          if (((e as any).nature ?? "expense") === "transfer") continue;
          const c = ((e as any).category || "").toLowerCase();
          const d = ((e as any).description || "").toLowerCase();
          const v = (e as any).vector || "";
          const ci = !!(e as any).counts_as_investment;
          const amt = Number((e as any).amount || 0);
          if (c === "obras" || c === "aporte_obra" || c === "terrenos" || v === "WT7_Holding" || v === "aporte_obra") obras += amt;
          else if (c === "casamento" || c === "casamento_2027" || d.includes("villa sonali")) casamento += amt;
          else if (c.startsWith("evento_")) eventos += amt;
          else if (ci || c === "consorcio" || c === "consorcios_aporte" || c === "kitnets_manutencao" || c === "manutencao_kitnets" || c === "dev_profissional_agora" || c === "dev_pessoal_futuro" || c === "produtividade_ferramentas") outros += amt;
          else custeio += amt;
        }
        for (const t of cardTxs) {
          const slug = t.custom_categories?.slug || "";
          if (slug === "ignorar") continue;
          const amt = Number(t.amount || 0);
          if (slug === "aporte_obra") obras += amt;
          else if (slug === "casamento_2027") casamento += amt;
          else if (slug.startsWith("evento_")) eventos += amt;
          else if (t.counts_as_investment || slug === "manutencao_kitnets" || slug === "dev_profissional_agora" || slug === "dev_pessoal_futuro" || slug === "produtividade_ferramentas" || slug === "consorcios_aporte") outros += amt;
          else custeio += amt;
        }

        out.push({ month: m, receita, custeio, obras, casamento, eventos, outros, sobra: receita - custeio - obras - casamento - eventos - outros });
      }
      return out;
    },
  });
}

function YTDView({ months, data }: { months: string[]; data: any }) {
  if (data.isLoading || !data.data) {
    return <div className="text-center py-12 text-sm" style={{ color: "#94A3B8" }}>Calculando YTD…</div>;
  }
  const rows = data.data as Array<{ month: string; receita: number; custeio: number; obras: number; casamento: number; eventos: number; outros: number; sobra: number }>;
  const totals = rows.reduce((acc, r) => ({
    receita: acc.receita + r.receita,
    custeio: acc.custeio + r.custeio,
    obras: acc.obras + r.obras,
    casamento: acc.casamento + r.casamento,
    eventos: acc.eventos + r.eventos,
    outros: acc.outros + r.outros,
    sobra: acc.sobra + r.sobra,
  }), { receita: 0, custeio: 0, obras: 0, casamento: 0, eventos: 0, outros: 0, sobra: 0 });

  return (
    <PremiumCard>
      <div className="flex items-center justify-between mb-4 pb-4 border-b" style={{ borderColor: "#1A2535" }}>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: "#C9A84C" }} />
          <h3 className="text-base font-semibold" style={{ color: "#F0F4F8" }}>Year-to-Date · {months[0]} → {months[months.length - 1]}</h3>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wide" style={{ borderColor: "#1A2535", color: "#4A5568" }}>
              <th className="text-left py-2 px-2">Mês</th>
              <th className="text-right py-2 px-2">Receita</th>
              <th className="text-right py-2 px-2">Custeio</th>
              <th className="text-right py-2 px-2">Obras</th>
              <th className="text-right py-2 px-2">Casamento</th>
              <th className="text-right py-2 px-2">Eventos</th>
              <th className="text-right py-2 px-2">Outros</th>
              <th className="text-right py-2 px-2">Sobra</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.month} className="border-b" style={{ borderColor: "#1A2535", color: "#F0F4F8" }}>
                <td className="py-2 px-2 text-xs" style={{ color: "#94A3B8" }}>{r.month}</td>
                <td className="py-2 px-2 text-right tabular-nums" style={{ color: "#10B981" }}>{moneyShort(r.receita)}</td>
                <td className="py-2 px-2 text-right tabular-nums" style={{ color: "#EF4444" }}>{moneyShort(r.custeio)}</td>
                <td className="py-2 px-2 text-right tabular-nums" style={{ color: "#C9A84C" }}>{moneyShort(r.obras)}</td>
                <td className="py-2 px-2 text-right tabular-nums" style={{ color: "#EC4899" }}>{moneyShort(r.casamento)}</td>
                <td className="py-2 px-2 text-right tabular-nums" style={{ color: "#3B82F6" }}>{moneyShort(r.eventos)}</td>
                <td className="py-2 px-2 text-right tabular-nums" style={{ color: "#A78BFA" }}>{moneyShort(r.outros)}</td>
                <td className="py-2 px-2 text-right tabular-nums font-bold" style={{ color: r.sobra >= 0 ? "#10B981" : "#EF4444" }}>{moneyShort(r.sobra)}</td>
              </tr>
            ))}
            <tr style={{ background: "rgba(201,168,76,0.06)" }}>
              <td className="py-3 px-2 font-bold" style={{ color: "#C9A84C" }}>YTD</td>
              <td className="py-3 px-2 text-right tabular-nums font-bold" style={{ color: "#10B981" }}>{moneyShort(totals.receita)}</td>
              <td className="py-3 px-2 text-right tabular-nums font-bold" style={{ color: "#EF4444" }}>{moneyShort(totals.custeio)}</td>
              <td className="py-3 px-2 text-right tabular-nums font-bold" style={{ color: "#C9A84C" }}>{moneyShort(totals.obras)}</td>
              <td className="py-3 px-2 text-right tabular-nums font-bold" style={{ color: "#EC4899" }}>{moneyShort(totals.casamento)}</td>
              <td className="py-3 px-2 text-right tabular-nums font-bold" style={{ color: "#3B82F6" }}>{moneyShort(totals.eventos)}</td>
              <td className="py-3 px-2 text-right tabular-nums font-bold" style={{ color: "#A78BFA" }}>{moneyShort(totals.outros)}</td>
              <td className="py-3 px-2 text-right tabular-nums font-bold" style={{ color: totals.sobra >= 0 ? "#10B981" : "#EF4444" }}>{moneyShort(totals.sobra)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PremiumCard>
  );
}
