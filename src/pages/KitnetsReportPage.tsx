import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useKitnets, useKitnetEntries, usePrevMonth } from "@/hooks/useKitnets";
import { useCeoConfig, useUpdateCeoConfig } from "@/hooks/useCeoConfig";
import { formatCurrency, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { ChevronLeft, ChevronRight, Monitor, Sun, Settings, X, Plus, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function getYearMonths(year: number) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

function useAllYearEntries(year: number) {
  return useQuery({
    queryKey: ["kitnet_entries_year_ceo", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kitnet_entries")
        .select("*, kitnets(code, tenant_name, residencial_code, rent_value, status)")
        .gte("reference_month", `${year}-01`)
        .lte("reference_month", `${year}-12`);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useCelescAllMonths(year: number) {
  return useQuery({
    queryKey: ["celesc_year_ceo", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("celesc_invoices")
        .select("*")
        .gte("reference_month", `${year}-01`)
        .lte("reference_month", `${year}-12`);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Despesas reais por categoria (para demonstrativo CEO) ───
const CATEGORIAS_KITNET = [
  "celesc_rwt02", "celesc_rwt03",
  "semasa_rwt02", "semasa_rwt03",
  "iptu_rwt02", "iptu_rwt03",
  "ambiental_rwt02", "ambiental_rwt03",
  "internet_rwt02", "internet_rwt03",
  "manutencao_rwt02", "manutencao_rwt03",
] as const;

function useExpensesByCategory(month: string) {
  return useQuery({
    queryKey: ["expenses_kitnets_ceo", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("category, amount")
        .eq("reference_month", month)
        .in("category", [...CATEGORIAS_KITNET]);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!month,
  });
}

function sumExpenses(expenses: { category: string | null; amount: number | null }[], complex: "total" | "RWT02" | "RWT03", prefix: string): number {
  return expenses
    .filter(e => {
      const cat = e.category ?? "";
      if (!cat.startsWith(prefix)) return false;
      if (complex === "total") return cat.includes("rwt02") || cat.includes("rwt03");
      return cat.includes(complex.toLowerCase());
    })
    .reduce((s, e) => s + (e.amount ?? 0), 0);
}

function useEnergyReadingsMonth(month: string) {
  return useQuery({
    queryKey: ["energy_readings_ceo", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("energy_readings")
        .select("*, kitnets(residencial_code)")
        .eq("reference_month", month);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useCelescMonth(month: string) {
  return useQuery({
    queryKey: ["celesc_month_ceo", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("celesc_invoices")
        .select("*")
        .eq("reference_month", month);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Estilos por tema ───
function getTheme(dark: boolean) {
  return {
    wrap: dark ? { background: "#080C10", minHeight: "100vh", padding: "0" } : { background: "#FFFFFF", minHeight: "100vh", padding: "0" },
    outer: dark
      ? { background: "#080C10", color: "#F0F4F8" }
      : { background: "#FFFFFF", color: "#1A202C" },
    card: dark
      ? { background: "#0D1117", border: "1px solid #1C2333", borderRadius: 10 }
      : { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
    kpi: dark
      ? { background: "#080C10", border: "1px solid #1C2333", borderRadius: 8, padding: "14px 16px" }
      : { background: "#FAFBFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 16px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
    kpiAccent: dark
      ? { background: "#080C10", border: "1px solid #C9A84C44", borderRadius: 8, padding: "14px 16px" }
      : { background: "#FFFBEB", border: "1px solid #D4A853", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 3px rgba(212,168,83,0.15)" },
    label: dark ? { color: "#4A5568", fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.08em" } : { color: "#64748B", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.08em" },
    value: dark ? { color: "#F0F4F8", fontSize: 26, fontWeight: 500, lineHeight: 1 } : { color: "#1A202C", fontSize: 24, fontWeight: 600 },
    sub: dark ? { color: "#2D3748", fontSize: 10, marginTop: 3 } : { color: "#94A3B8", fontSize: 11, marginTop: 3 },
    sectionLabel: dark
      ? { fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#2D3748", marginBottom: 8 }
      : { fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#64748B", marginBottom: 8, fontWeight: 500 },
    row: dark
      ? { display: "flex" as const, justifyContent: "space-between" as const, padding: "7px 0", borderBottom: "1px solid #0D1117" }
      : { display: "flex" as const, justifyContent: "space-between" as const, padding: "7px 0", borderBottom: "1px solid #E2E8F0" },
    rl: dark ? { fontSize: 11, color: "#4A5568" } : { fontSize: 12, color: "#64748B" },
    rv: dark ? { fontSize: 12, fontWeight: 500, color: "#94A3B8" } : { fontSize: 13, fontWeight: 500, color: "#1E293B" },
    tab: (active: boolean) => dark
      ? { padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none", background: "none", color: active ? "#C9A84C" : "#4A5568", borderBottom: active ? "2px solid #C9A84C" : "2px solid transparent", marginBottom: -1 }
      : { padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none", background: "none", color: active ? "#1A202C" : "#94A3B8", borderBottom: active ? "2px solid #BA7517" : "2px solid transparent", marginBottom: -1 },
    tabBar: dark
      ? { display: "flex" as const, gap: 4, borderBottom: "1px solid #1C2333", marginBottom: 20 }
      : { display: "flex" as const, gap: 4, borderBottom: "1px solid #E2E8F0", marginBottom: 20 },
    divider: dark ? { height: 1, background: "#1C2333", margin: "8px 0" } : { height: 1, background: "#E2E8F0", margin: "8px 0" },
    gold: dark ? "#C9A84C" : "#B45309",
    green: dark ? "#10B981" : "#059669",
    red: dark ? "#F43F5E" : "#DC2626",
    purple: dark ? "#8B5CF6" : "#7C3AED",
    blue: dark ? "#60A5FA" : "#2563EB",
    muted: dark ? "#94A3B8" : "#64748B",
    gridColor: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
    tooltipStyle: dark
      ? { background: "#0D1117", border: "1px solid #1C2333", color: "#F0F4F8", fontSize: 12 }
      : { background: "#FFFFFF", border: "1px solid #E2E8F0", color: "#1A202C", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", borderRadius: 8 },
  };
}

// ─── Comparativo dinâmico RWT02 vs RWT03 ───
function ComparativoCard({ dark, t, kitnets, entries, energyReadings, celescMonth, INVESTIMENTO, META_MENSAL, LUCRO_HISTORICO, CDI_TAXA }: any) {
  const calc = (complex: "RWT02" | "RWT03") => {
    const fk = kitnets.filter((k: any) => k.residencial_code === complex);
    const fe = (entries as any[]).filter((e: any) => e.kitnets?.residencial_code === complex);
    const total = fk.length || 1;
    const ocupadas = fk.filter((k: any) => k.status === "occupied" || k.status === "maintenance").length;
    const receita = fe.reduce((s: number, e: any) => s + (e.total_liquid ?? 0), 0);
    const inv = complex === "RWT02" ? INVESTIMENTO.RWT02 : INVESTIMENTO.RWT03;
    const lucroHist = inv > 0 ? (LUCRO_HISTORICO * (inv / INVESTIMENTO.total)) : 0;
    const roiAcum = inv > 0 ? (lucroHist / inv) * 100 : 0;
    const yieldM = inv > 0 ? (receita / inv) * 100 : 0;
    const yieldA = yieldM * 12;
    const payback = yieldA > 0 ? 100 / yieldA : 0;
    const er = (energyReadings as any[]).filter((e: any) => e.kitnets?.residencial_code === complex);
    const cobrado = er.reduce((s: number, e: any) => s + (e.amount_to_charge ?? 0), 0);
    const fatura = (celescMonth as any[]).filter((c: any) => c.residencial_code === complex).reduce((s: number, c: any) => s + (c.invoice_total ?? 0), 0);
    const margem = cobrado > 0 ? ((cobrado - fatura) / cobrado) * 100 : 0;
    return { ocupacao: (ocupadas / total) * 100, unidades: `${ocupadas}/${total}`, investimento: inv, yieldAnual: yieldA, roiAcum, payback, margem };
  };
  const r02 = calc("RWT02");
  const r03 = calc("RWT03");
  const rows = [
    { label: "Investimento", v02: formatCurrency(r02.investimento), v03: formatCurrency(r03.investimento), c: t.gold },
    { label: "Yield anual", v02: `${r02.yieldAnual.toFixed(1)}%`, v03: `${r03.yieldAnual.toFixed(1)}%`, c: t.purple },
    { label: "Ocupação", v02: `${r02.ocupacao.toFixed(0)}% (${r02.unidades})`, v03: `${r03.ocupacao.toFixed(0)}% (${r03.unidades})`, c: t.green },
    { label: "ROI acumulado", v02: `${r02.roiAcum.toFixed(1)}%`, v03: `${r03.roiAcum.toFixed(1)}%`, c: t.purple },
    { label: "Payback", v02: `${r02.payback.toFixed(1)} anos`, v03: `${r03.payback.toFixed(1)} anos`, c: "#94A3B8" },
    { label: "Margem energia", v02: `${r02.margem.toFixed(1)}%`, v03: `${r03.margem.toFixed(1)}%`, c: t.green },
  ];
  return (
    <div style={{ ...(dark ? { background: "#0D1117", border: "1px solid #1C2333", borderRadius: 10 } : { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }), padding: 16, marginBottom: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: dark ? "#F0F4F8" : "#1A202C", marginBottom: 12, paddingBottom: 8, borderBottom: dark ? "1px solid #1C2333" : "1px solid #E2E8F0" }}>Comparativo RWT02 vs RWT03</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, fontSize: 10, color: dark ? "#4A5568" : "#94A3B8", paddingBottom: 6, marginBottom: 4 }}>
        <span></span><span style={{ textAlign: "center", fontWeight: 600 }}>RWT02</span><span style={{ textAlign: "right", fontWeight: 600 }}>RWT03</span>
      </div>
      {rows.map(r => (
        <div key={r.label} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, fontSize: 11, padding: "6px 0", borderBottom: dark ? "1px solid #0D1117" : "1px solid #E2E8F0" }}>
          <span style={{ color: dark ? "#4A5568" : "#94A3B8" }}>{r.label}</span>
          <span style={{ color: r.c, fontWeight: 500, textAlign: "center" }}>{r.v02}</span>
          <span style={{ color: r.c, fontWeight: 500, textAlign: "right" }}>{r.v03}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Modal de configuração do CEO ───
function CeoConfigModal({ open, onClose, dark }: { open: boolean; onClose: () => void; dark: boolean }) {
  const { data: config } = useCeoConfig();
  const updateMut = useUpdateCeoConfig();
  const [inv02, setInv02] = useState("");
  const [inv03, setInv03] = useState("");
  const [meta02, setMeta02] = useState("");
  const [meta03, setMeta03] = useState("");
  const [lucroHist, setLucroHist] = useState("");
  const [lucroNota, setLucroNota] = useState("");
  const [cdi, setCdi] = useState("");
  const [projecoes, setProjecoes] = useState<{ ano: string; unidades: number }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setInv02(String(config.investimento.RWT02));
      setInv03(String(config.investimento.RWT03));
      setMeta02(String(config.meta_mensal.RWT02));
      setMeta03(String(config.meta_mensal.RWT03));
      setLucroHist(String(config.lucro_historico.valor));
      setLucroNota(config.lucro_historico.nota);
      setCdi(String(config.cdi_referencia.taxa));
      setProjecoes([...config.projecao_crescimento]);
    }
  }, [config]);

  if (!open) return null;

  const bg = dark ? "#0D1117" : "#FFFFFF";
  const border = dark ? "#1C2333" : "#E2E8F0";
  const text = dark ? "#F0F4F8" : "#1A202C";
  const muted = dark ? "#4A5568" : "#94A3B8";
  const inputStyle = { width: "100%", padding: "6px 10px", borderRadius: 6, border: `1px solid ${border}`, background: dark ? "#080C10" : "#F8FAFC", color: text, fontSize: 13, outline: "none" };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMut.mutateAsync({ key: "investimento", value: { RWT02: Number(inv02), RWT03: Number(inv03) } });
      await updateMut.mutateAsync({ key: "meta_mensal", value: { RWT02: Number(meta02), RWT03: Number(meta03) } });
      await updateMut.mutateAsync({ key: "lucro_historico", value: { valor: Number(lucroHist), nota: lucroNota } });
      await updateMut.mutateAsync({ key: "cdi_referencia", value: { taxa: Number(cdi) } });
      await updateMut.mutateAsync({ key: "projecao_crescimento", value: projecoes });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: 24, width: 480, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: text }}>Configurações CEO</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: muted }}><X size={18} /></button>
        </div>

        {/* Investimento */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: muted, marginBottom: 8 }}>Investimento patrimonial</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={{ fontSize: 10, color: muted }}>RWT02</label><input style={inputStyle} value={inv02} onChange={e => setInv02(e.target.value)} /></div>
            <div><label style={{ fontSize: 10, color: muted }}>RWT03</label><input style={inputStyle} value={inv03} onChange={e => setInv03(e.target.value)} /></div>
          </div>
        </div>

        {/* Metas mensais */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: muted, marginBottom: 8 }}>Meta mensal (R$)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={{ fontSize: 10, color: muted }}>RWT02</label><input style={inputStyle} value={meta02} onChange={e => setMeta02(e.target.value)} /></div>
            <div><label style={{ fontSize: 10, color: muted }}>RWT03</label><input style={inputStyle} value={meta03} onChange={e => setMeta03(e.target.value)} /></div>
          </div>
        </div>

        {/* Lucro histórico */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: muted, marginBottom: 8 }}>Lucro histórico acumulado (ROI base)</div>
          <input style={{ ...inputStyle, marginBottom: 6 }} value={lucroHist} onChange={e => setLucroHist(e.target.value)} placeholder="Valor em R$" />
          <input style={inputStyle} value={lucroNota} onChange={e => setLucroNota(e.target.value)} placeholder="Nota/observação" />
        </div>

        {/* CDI */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: muted, marginBottom: 8 }}>CDI referência (%)</div>
          <input style={inputStyle} value={cdi} onChange={e => setCdi(e.target.value)} />
        </div>

        {/* Projeções */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: muted, marginBottom: 8 }}>Projeção de crescimento (unidades)</div>
          {projecoes.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 6, alignItems: "center" }}>
              <input style={inputStyle} value={p.ano} onChange={e => { const np = [...projecoes]; np[i] = { ...np[i], ano: e.target.value }; setProjecoes(np); }} placeholder="Ano" />
              <input style={inputStyle} type="number" value={p.unidades} onChange={e => { const np = [...projecoes]; np[i] = { ...np[i], unidades: Number(e.target.value) }; setProjecoes(np); }} placeholder="Unidades" />
              <button onClick={() => setProjecoes(projecoes.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#F43F5E", padding: 4 }}><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={() => setProjecoes([...projecoes, { ano: "", unidades: 0 }])} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px dashed ${border}`, borderRadius: 6, padding: "6px 12px", fontSize: 11, color: muted, cursor: "pointer", width: "100%" }}>
            <Plus size={12} /> Adicionar linha
          </button>
        </div>

        <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: dark ? "#C9A84C" : "#B45309", color: dark ? "#080C10" : "#FFFFFF" }}>
          {saving ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}

export default function KitnetsReportPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [complex, setComplex] = useState<"total" | "RWT02" | "RWT03">("total");
  const [dark, setDark] = useState(true);
  const [solarOpen, setSolarOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // Toggle body class for sidebar/layout light mode
  useEffect(() => {
    if (!dark) {
      document.body.classList.add("ceo-light-mode");
    } else {
      document.body.classList.remove("ceo-light-mode");
    }
    return () => document.body.classList.remove("ceo-light-mode");
  }, [dark]);

  const year = parseInt(month.split("-")[0]);
  const t = getTheme(dark);
  const yearMonths = getYearMonths(year);

  // ─── Configurações dinâmicas do CEO ───
  const { data: ceoConfig } = useCeoConfig();
  const INVESTIMENTO = useMemo(() => {
    const inv = ceoConfig?.investimento ?? { RWT02: 1_000_000, RWT03: 500_000 };
    return { ...inv, total: inv.RWT02 + inv.RWT03 };
  }, [ceoConfig]);
  const META_MENSAL = useMemo(() => {
    const meta = ceoConfig?.meta_mensal ?? { RWT02: 14_400, RWT03: 6_700 };
    return { ...meta, total: meta.RWT02 + meta.RWT03 };
  }, [ceoConfig]);
  const LUCRO_HISTORICO = ceoConfig?.lucro_historico?.valor ?? 405_120;
  const CRESCIMENTO = ceoConfig?.projecao_crescimento ?? [
    { ano: "Hoje", unidades: 13 }, { ano: "2026", unidades: 28 },
    { ano: "2027", unidades: 43 }, { ano: "2028", unidades: 58 },
  ];
  const CDI_TAXA = ceoConfig?.cdi_referencia?.taxa ?? 10.5;

  const { data: kitnets = [] } = useKitnets();
  const { data: entries = [] } = useKitnetEntries(month);
  const prevMonth = usePrevMonth(month);
  const { data: prevEntries = [] } = useKitnetEntries(prevMonth);
  const { data: yearEntries = [] } = useAllYearEntries(year);
  const { data: energyReadings = [] } = useEnergyReadingsMonth(month);
  const { data: celescMonth = [] } = useCelescMonth(month);
  const { data: celescYear = [] } = useCelescAllMonths(year);
  const { data: expensesMonth = [] } = useExpensesByCategory(month);

  // ─── Navegar mês ───
  const changeMonth = (dir: -1 | 1) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  // ─── Filtros por complexo ───
  const filteredEntries = entries.filter((e: any) =>
    complex === "total" ? true : e.kitnets?.residencial_code === complex
  );
  const filteredKitnets = kitnets.filter(k =>
    complex === "total" ? true : k.residencial_code === complex
  );
  const filteredEnergy = energyReadings.filter((e: any) =>
    complex === "total" ? true : e.kitnets?.residencial_code === complex
  );
  const filteredCelesc = celescMonth.filter((c: any) =>
    complex === "total" ? true : c.residencial_code === complex
  );

  // ─── KPIs operacionais ───
  // Receita = total_liquid (o que efetivamente cai na conta, já sem ADM)
  const receita = filteredEntries.reduce((s: number, e: any) => s + (e.total_liquid ?? 0), 0);
  const admInfo = filteredEntries.reduce((s: number, e: any) => s + (e.adm_fee ?? 0), 0);
  // Custos reais vindos de expenses categorizados por edificação
  const celescCusto = sumExpenses(expensesMonth, complex, "celesc_rwt");
  const semasa = sumExpenses(expensesMonth, complex, "semasa_rwt");
  const iptu = sumExpenses(expensesMonth, complex, "iptu_rwt");
  const ambiental = sumExpenses(expensesMonth, complex, "ambiental_rwt");
  const internet = sumExpenses(expensesMonth, complex, "internet_rwt");
  const manutencao = sumExpenses(expensesMonth, complex, "manutencao_rwt");
  const custosOperacionais = celescCusto + semasa + iptu + ambiental + internet + manutencao;
  const custosTotal = custosOperacionais + admInfo;
  const lucroLiquido = receita - custosOperacionais;

  // ─── Solar ───
  const cobradoInquilinos = filteredEnergy.reduce((s: number, e: any) => s + (e.amount_to_charge ?? 0), 0);
  const faturasCelesc = filteredCelesc.reduce((s: number, c: any) => s + (c.invoice_total ?? 0), 0);
  const saldoSolar = cobradoInquilinos - faturasCelesc;
  const margemEnergia = cobradoInquilinos > 0 ? (saldoSolar / cobradoInquilinos) * 100 : 0;
  const pctLucro = lucroLiquido > 0 ? (saldoSolar / lucroLiquido) * 100 : 0;

  // ─── Solar mês a mês (ano) — usa energy_readings.amount_to_charge ───
  const { data: yearEnergyReadings = [] } = useQuery({
    queryKey: ["energy_readings_year_ceo", year],
    queryFn: async () => {
      const { data, error } = await supabase.from("energy_readings").select("*, kitnets(residencial_code)").gte("reference_month", `${year}-01`).lte("reference_month", `${year}-12`);
      if (error) throw error;
      return data ?? [];
    },
  });
  const solarMeses = useMemo(() => yearMonths.map(m => {
    const er = (yearEnergyReadings as any[]).filter(e => e.reference_month === m && (complex === "total" || e.kitnets?.residencial_code === complex));
    const cobrado = er.reduce((s: number, e: any) => s + (e.amount_to_charge ?? 0), 0);
    const fatura = celescYear.filter((c: any) => c.reference_month === m && (complex === "total" || c.residencial_code === complex)).reduce((s: number, c: any) => s + (c.invoice_total ?? 0), 0);
    return { mes: formatMonth(m).slice(0, 3), cobrado, fatura, saldo: cobrado - fatura };
  }), [yearEnergyReadings, celescYear, yearMonths, complex]);

  // ─── Ocupação / inadimplência ───
  const totalUnidades = filteredKitnets.length || 1;
  const ocupadas = filteredKitnets.filter(k => k.status === "occupied" || k.status === "maintenance").length;
  const vagas = filteredKitnets.filter(k => k.status === "vacant" || !k.status).length;
  const fechados = filteredEntries.length;
  const aguardando = ocupadas - fechados;
  const aluguelMedio = filteredKitnets.reduce((s, k) => s + (k.rent_value ?? 0), 0) / (filteredKitnets.length || 1);
  const perdaVacancia = vagas * aluguelMedio;
  const inadimplenciaValor = Math.max(0, aguardando) * aluguelMedio;
  const ocupacaoPct = (ocupadas / totalUnidades) * 100;
  const inadimplenciaPct = ocupadas > 0 ? (Math.max(0, aguardando) / ocupadas) * 100 : 0;
  const eficienciaReceita = receita > 0 ? (receita / (filteredKitnets.reduce((s, k) => s + (k.rent_value ?? 0), 0) || 1)) * 100 : 0;

  // ─── Rentabilidade ───
  const investimento = complex === "total" ? INVESTIMENTO.total : complex === "RWT02" ? INVESTIMENTO.RWT02 : INVESTIMENTO.RWT03;
  const metaMensal = complex === "total" ? META_MENSAL.total : complex === "RWT02" ? META_MENSAL.RWT02 : META_MENSAL.RWT03;
  const yieldMensal = investimento > 0 ? (lucroLiquido / investimento) * 100 : 0;
  const yieldAnual = yieldMensal * 12;
  const margemLiquida = receita > 0 ? (lucroLiquido / receita) * 100 : 0;
  const roiAcumulado = investimento > 0 ? ((LUCRO_HISTORICO * (investimento / INVESTIMENTO.total)) / investimento) * 100 : 0;
  const lucroAnualProj = lucroLiquido * 12;
  const paybackAnos = lucroAnualProj > 0 ? investimento / lucroAnualProj : 0;
  const roiPct = roiAcumulado;

  // ─── Anual ───
  const anoLiquido = useMemo(() => yearMonths.reduce((s, m) => {
    return s + (yearEntries as any[]).filter(e => e.reference_month === m && (complex === "total" || e.kitnets?.residencial_code === complex)).reduce((ss: number, e: any) => ss + (e.total_liquid ?? 0), 0);
  }, 0), [yearEntries, yearMonths, complex]);

  const metaAnual = metaMensal * 12;

  // ─── Meses para gráfico ───
  const chartData = useMemo(() => yearMonths.map(m => {
    const me = (yearEntries as any[]).filter(e => e.reference_month === m && (complex === "total" || e.kitnets?.residencial_code === complex));
    const liq = me.reduce((s: number, e: any) => s + (e.total_liquid ?? 0), 0);
    return { mes: formatMonth(m).slice(0, 3), recebido: liq, meta: metaMensal };
  }), [yearEntries, yearMonths, complex, metaMensal]);

  // ─── Ranking unidades ───
  const ranking = useMemo(() => filteredKitnets.map(k => {
    const entry = (entries as any[]).find((e: any) => e.kitnet_id === k.id);
    return { code: k.code, tenant: k.tenant_name || "—", receita: entry?.total_liquid ?? 0, status: entry ? "fechado" : k.status === "occupied" ? "aguardando" : "vaga" };
  }).sort((a, b) => b.receita - a.receita), [filteredKitnets, entries]);

  // ─── Projeção crescimento ───
  const lucroMedioUnidade = lucroLiquido / (ocupadas || 1);
  const crescimentoData = CRESCIMENTO.map(c => ({
    ano: c.ano,
    unidades: c.unidades,
    lucroAnual: Math.round(c.unidades * lucroMedioUnidade * 12),
  }));

  const g4 = { display: "grid" as const, gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginBottom: 12 };
  const g3 = { display: "grid" as const, gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginBottom: 12 };
  const g2 = { display: "grid" as const, gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 };

  const KPI = ({ label, value, color, sub, delta, deltaPos, accent }: { label: string; value: string; color?: string; sub?: string; delta?: string; deltaPos?: boolean; accent?: boolean }) => (
    <div style={accent ? t.kpiAccent : t.kpi}>
      <div style={t.label}>{label}</div>
      <div style={{ ...t.value, color: color || t.value.color }}>{value}</div>
      {sub && <div style={t.sub}>{sub}</div>}
      {delta && <div style={{ ...t.sub, color: deltaPos ? t.green : t.red }}>{delta}</div>}
    </div>
  );

  const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div style={{ ...t.row }}>
      <span style={t.rl}>{label}</span>
      <span style={{ ...t.rv, color: color || t.rv.color }}>{value}</span>
    </div>
  );

  const SectionLabel = ({ children }: { children: string }) => (
    <div style={{ ...t.sectionLabel, marginTop: 16 }}>{children}</div>
  );

  const CardWrap = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ ...t.card, padding: 16, marginBottom: 12, ...style }}>{children}</div>
  );

  return (
    <div style={{ ...t.outer, fontFamily: "var(--font-sans)", padding: "1rem 0" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: dark ? "#4A5568" : "#94A3B8" }}>WT7 Holding · Kitnets</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: dark ? "#F0F4F8" : "#1A202C", marginTop: 2 }}>
            Dashboard CEO
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Navegação mês */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => changeMonth(-1)} style={{ background: dark ? "none" : "#F8FAFC", border: dark ? "1px solid #1C2333" : "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: dark ? "#94A3B8" : "#475569" }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 500, color: dark ? "#F0F4F8" : "#1A202C", minWidth: 90, textAlign: "center" }}>{formatMonth(month)}</span>
            <button onClick={() => changeMonth(1)} style={{ background: dark ? "none" : "#F8FAFC", border: dark ? "1px solid #1C2333" : "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: dark ? "#94A3B8" : "#475569" }}>
              <ChevronRight size={14} />
            </button>
          </div>
          <button
            onClick={() => setDark(d => !d)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", border: dark ? "1px solid #C9A84C44" : "1px solid #B45309", background: dark ? "#0D1117" : "#FFFBEB", color: dark ? "#C9A84C" : "#92400E" }}
          >
            {dark ? <Sun size={14} /> : <Monitor size={14} />}
            {dark ? "Modo Claro" : "Modo Escuro"}
          </button>
          <button
            onClick={() => setConfigOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", border: dark ? "1px solid #1C2333" : "1px solid #E2E8F0", background: "none", color: dark ? "#4A5568" : "#94A3B8" }}
            title="Configurações CEO"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>
      <CeoConfigModal open={configOpen} onClose={() => setConfigOpen(false)} dark={dark} />

      {/* Tabs complexo */}
      <div style={t.tabBar}>
        {(["total", "RWT02", "RWT03"] as const).map(c => (
          <button key={c} style={t.tab(complex === c)} onClick={() => setComplex(c)}>
            {c === "total" ? "Consolidado" : c}
          </button>
        ))}
      </div>

      {/* ── BLOCO 1: RENTABILIDADE ── */}
      <SectionLabel>Bloco 1 — Rentabilidade</SectionLabel>
      <div style={g4}>
        <KPI label="Lucro líquido" value={formatCurrency(lucroLiquido)} color={t.gold} delta={lucroLiquido >= metaMensal ? `+${((lucroLiquido/metaMensal-1)*100).toFixed(1)}% vs meta` : `${((lucroLiquido/metaMensal-1)*100).toFixed(1)}% vs meta`} deltaPos={lucroLiquido >= metaMensal} accent />
        <KPI label="Yield mensal" value={`${yieldMensal.toFixed(2)}%`} color={t.purple} sub={`Anualizado ${yieldAnual.toFixed(1)}%`} accent />
        <KPI label="Margem líquida" value={`${margemLiquida.toFixed(1)}%`} color={margemLiquida >= 70 ? t.green : t.red} sub={`Meta 70%+ ${margemLiquida >= 70 ? "✓" : "✗"}`} accent />
        <KPI label="ROI acumulado" value={`${roiPct.toFixed(1)}%`} color={t.purple} sub={`Desde jan/2024`} accent />
      </div>

      {/* ── BLOCO 2: EFICIÊNCIA ── */}
      <SectionLabel>Bloco 2 — Eficiência operacional</SectionLabel>
      <div style={g4}>
        <KPI label="Ocupação" value={`${ocupacaoPct.toFixed(1)}%`} color={ocupacaoPct >= 95 ? t.green : t.gold} sub={`${ocupadas}/${totalUnidades} unidades · Meta 95%+`} />
        <KPI label="Vacância (perda)" value={`— ${formatCurrency(perdaVacancia)}`} color={t.red} sub={`${vagas} unidade${vagas !== 1 ? "s" : ""} vaga${vagas !== 1 ? "s" : ""}`} />
        <KPI label="Inadimplência" value={`— ${formatCurrency(inadimplenciaValor)}`} color={inadimplenciaPct > 20 ? t.red : t.gold} sub={`${inadimplenciaPct.toFixed(0)}% · ${Math.max(0, aguardando)} aguardando`} />
        <KPI label="Payback" value={`${paybackAnos.toFixed(1)} anos`} color={"#94A3B8"} sub={`${roiPct.toFixed(0)}% do invest. recuperado`} />
      </div>

      {/* ── BLOCO 3: PERFORMANCE ── */}
      <SectionLabel>Bloco 3 — Performance dos ativos</SectionLabel>
      <div style={g3}>
        <KPI label="Receita por unidade" value={formatCurrency(receita / (totalUnidades || 1))} sub={`${formatCurrency(receita)} / ${totalUnidades} unidades`} />
        <KPI label="Lucro por unidade" value={formatCurrency(lucroLiquido / (totalUnidades || 1))} color={t.green} sub={`${formatCurrency(lucroLiquido)} / ${totalUnidades} unidades`} />
        <KPI label="Custo por unidade" value={formatCurrency(custosTotal / (totalUnidades || 1))} color={t.red} sub={`${formatCurrency(custosTotal)} / ${totalUnidades} unidades`} />
      </div>

      {/* Ranking */}
      <CardWrap>
        <div style={{ fontSize: 12, fontWeight: 500, color: dark ? "#F0F4F8" : "#1A202C", marginBottom: 12, paddingBottom: 10, borderBottom: dark ? "1px solid #1C2333" : "1px solid #E2E8F0" }}>
          Ranking de performance — {formatMonth(month)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, fontSize: 10, color: dark ? "#4A5568" : "#94A3B8", paddingBottom: 6, borderBottom: dark ? "1px solid #1C2333" : "1px solid #E2E8F0", marginBottom: 4 }}>
          <span>Unidade</span><span>Inquilino</span><span style={{ textAlign: "right" }}>Receita</span><span style={{ textAlign: "right" }}>Status</span>
        </div>
        {ranking.map(r => (
          <div key={r.code} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, fontSize: 12, padding: "6px 0", borderBottom: dark ? "1px solid #0D1117" : "1px solid #E2E8F0" }}>
            <span style={{ color: dark ? "#94A3B8" : "#64748B", fontFamily: "var(--font-mono)" }}>{r.code}</span>
            <span style={{ color: dark ? "#CBD5E1" : "#1A202C" }}>{r.tenant}</span>
            <span style={{ textAlign: "right", color: r.receita > 0 ? t.gold : t.red, fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {r.receita > 0 ? formatCurrency(r.receita) : "—"}
            </span>
            <span style={{ textAlign: "right" }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 500, background: r.status === "fechado" ? (dark ? "rgba(16,185,129,0.15)" : "#ECFDF5") : r.status === "aguardando" ? (dark ? "rgba(245,158,11,0.15)" : "#FFFBEB") : (dark ? "rgba(244,63,94,0.15)" : "#FEF2F2"), color: r.status === "fechado" ? t.green : r.status === "aguardando" ? t.gold : t.red }}>
                {r.status === "fechado" ? "Fechado" : r.status === "aguardando" ? "Aguardando" : "Vaga"}
              </span>
            </span>
          </div>
        ))}
      </CardWrap>

      {/* ── BLOCO 4: RESULTADO + COMPARATIVO ── */}
      <SectionLabel>Bloco 4 — Resultado do mês</SectionLabel>
      <div style={g2}>
        <CardWrap style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: dark ? "#F0F4F8" : "#1A202C", marginBottom: 12, paddingBottom: 8, borderBottom: dark ? "1px solid #1C2333" : "1px solid #E2E8F0" }}>Demonstrativo</div>
          <Row label="Recebido líquido (s/ ADM)" value={formatCurrency(receita)} color={t.gold} />
          <Row label={`Taxa ADM (informativo)`} value={formatCurrency(admInfo)} color={"#2D3748"} />
          <div style={t.divider} />
          {celescCusto > 0 && <Row label="Energia CELESC" value={`— ${formatCurrency(celescCusto)}`} color={t.red} />}
          {semasa > 0 && <Row label="Água SEMASA" value={`— ${formatCurrency(semasa)}`} color={t.red} />}
          {iptu > 0 && <Row label="IPTU" value={`— ${formatCurrency(iptu)}`} color={t.red} />}
          {ambiental > 0 && <Row label="Ambiental" value={`— ${formatCurrency(ambiental)}`} color={t.red} />}
          {internet > 0 && <Row label="Internet" value={`— ${formatCurrency(internet)}`} color={t.red} />}
          {manutencao > 0 && <Row label="Manutenção" value={`— ${formatCurrency(manutencao)}`} color={t.red} />}
          {custosTotal === 0 && <Row label="Sem despesas categorizadas" value="—" color={"#2D3748"} />}
          <div style={t.divider} />
          <div style={{ ...t.row, borderBottom: "none" }}>
            <span style={{ ...t.rl, fontWeight: 500, color: dark ? "#F0F4F8" : "#1A202C", fontSize: 13 }}>Resultado líquido</span>
            <span style={{ fontSize: 17, fontWeight: 500, color: t.green }}>{formatCurrency(lucroLiquido)}</span>
          </div>
        </CardWrap>

        {/* Comparativo RWT02 vs RWT03 (só no consolidado) — 100% dinâmico */}
        {complex === "total" ? (
          <ComparativoCard dark={dark} t={t} kitnets={kitnets} entries={entries} energyReadings={energyReadings} celescMonth={celescMonth} INVESTIMENTO={INVESTIMENTO} META_MENSAL={META_MENSAL} LUCRO_HISTORICO={LUCRO_HISTORICO} CDI_TAXA={CDI_TAXA} />

        ) : (
          <CardWrap style={{ marginBottom: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: dark ? "#F0F4F8" : "#1A202C", marginBottom: 12, paddingBottom: 8, borderBottom: dark ? "1px solid #1C2333" : "1px solid #E2E8F0" }}>Capital — {complex}</div>
            <Row label="Investimento total" value={formatCurrency(investimento)} color={t.gold} />
            <Row label="ROI acumulado jan/24" value={`${roiPct.toFixed(1)}%`} color={t.purple} />
            <Row label="Yield anual" value={`${yieldAnual.toFixed(1)}%`} color={t.purple} />
            <Row label="Payback estimado" value={`${paybackAnos.toFixed(1)} anos`} />
            <Row label="Lucro anual projetado" value={formatCurrency(lucroAnualProj)} color={t.green} />
            <Row label="Recuperado até hoje" value={formatCurrency(investimento * roiPct / 100)} color={t.blue} />
          </CardWrap>
        )}
      </div>

      {/* ── BLOCO 5: GRÁFICO + ANUAL ── */}
      <SectionLabel>Bloco 5 — Performance anual {year}</SectionLabel>
      <CardWrap>
        <div style={{ fontSize: 12, fontWeight: 500, color: dark ? "#F0F4F8" : "#1A202C", marginBottom: 4 }}>Meta vs recebido mensal</div>
        <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
          {[{ label: "Meta", color: t.gold }, { label: "Recebido", color: t.green }].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: dark ? "#4A5568" : "#94A3B8" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />{l.label}
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.gridColor} />
            <XAxis dataKey="mes" stroke={dark ? "#2D3748" : "#888780"} tick={{ fontSize: 11, fill: dark ? "#4A5568" : "#888780" }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} stroke={dark ? "#2D3748" : "#888780"} tick={{ fontSize: 11, fill: dark ? "#4A5568" : "#888780" }} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={t.tooltipStyle} />
            <Bar dataKey="meta" name="Meta" fill={dark ? "rgba(201,168,76,0.25)" : "rgba(186,117,23,0.2)"} stroke={t.gold} strokeWidth={1} radius={[4, 4, 0, 0]} />
            <Bar dataKey="recebido" name="Recebido" fill={t.green} opacity={dark ? 1 : 0.8} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
          {[
            { label: `Meta anual ${year}`, value: formatCurrency(metaAnual), color: t.gold },
            { label: `Acumulado ${year}`, value: formatCurrency(anoLiquido), color: t.green },
            { label: "Eficiência", value: `${metaAnual > 0 ? ((anoLiquido / metaAnual) * 100).toFixed(1) : 0}%`, color: t.blue },
          ].map(k => (
            <div key={k.label} style={{ ...t.kpi, textAlign: "center" }}>
              <div style={t.label}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: k.color, marginTop: 4 }}>{k.value}</div>
            </div>
          ))}
        </div>
      </CardWrap>

      {/* ── BLOCO 6: ENERGIA ── */}
      <SectionLabel>Bloco 6 — Energia solar (diferencial)</SectionLabel>
      <div style={g4}>
        <div
          style={{ ...t.kpi, cursor: "pointer", border: dark ? "1px solid rgba(16,185,129,0.3)" : "0.5px solid rgba(59,109,17,0.3)" }}
          onClick={() => setSolarOpen(o => !o)}
        >
          <div style={t.label}>Saldo solar</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: t.green, lineHeight: 1 }}>+ {formatCurrency(saldoSolar)}</div>
          <div style={{ fontSize: 10, color: t.green, marginTop: 4 }}>{solarOpen ? "▲ fechar" : "▼ mês a mês"}</div>
          {solarOpen && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: dark ? "1px solid #1C2333" : "1px solid #E2E8F0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", fontSize: 10, color: dark ? "#4A5568" : "#94A3B8", paddingBottom: 4 }}>
                <span>Mês</span><span style={{ textAlign: "right" }}>Cobrado</span><span style={{ textAlign: "right" }}>CELESC</span><span style={{ textAlign: "right" }}>Saldo</span>
              </div>
              {solarMeses.filter(s => s.cobrado > 0 || s.fatura > 0).map(s => (
                <div key={s.mes} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", fontSize: 11, padding: "3px 0", borderBottom: dark ? "1px solid #080C10" : "1px solid #E2E8F0" }}>
                  <span style={{ color: dark ? "#94A3B8" : "#64748B" }}>{s.mes}</span>
                  <span style={{ textAlign: "right", color: dark ? "#F0F4F8" : "#1A202C", fontWeight: 500 }}>{formatCurrency(s.cobrado)}</span>
                  <span style={{ textAlign: "right", color: t.red }}>{formatCurrency(s.fatura)}</span>
                  <span style={{ textAlign: "right", color: t.green, fontWeight: 500 }}>{formatCurrency(s.saldo)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <KPI label="Margem energia" value={`${margemEnergia.toFixed(1)}%`} color={t.green} sub={`${formatCurrency(saldoSolar)} / ${formatCurrency(cobradoInquilinos)}`} />
        <KPI label="% do lucro total" value={`${pctLucro.toFixed(1)}%`} color={t.green} sub={`${formatCurrency(saldoSolar)} / ${formatCurrency(lucroLiquido)}`} />
        <KPI label="Saldo solar anual proj." value={formatCurrency(saldoSolar * 12)} color={t.green} sub="Base mês atual × 12" />
      </div>

      {/* ── BLOCO 7: CAPITAL ── */}
      <SectionLabel>Bloco 7 — Capital (holding)</SectionLabel>
      <div style={g4}>
        <KPI label="Investimento total" value={formatCurrency(investimento)} color={t.gold} sub={complex === "total" ? `RWT02 ${formatCurrency(INVESTIMENTO.RWT02)} + RWT03 ${formatCurrency(INVESTIMENTO.RWT03)}` : `${complex}`} accent />
        <KPI label="ROI acumulado" value={`${roiPct.toFixed(1)}%`} color={t.purple} sub={`${formatCurrency(investimento * roiPct / 100)} recuperado`} accent />
        <KPI label="Payback estimado" value={`${paybackAnos.toFixed(1)} anos`} color={t.blue} sub={`~${Math.round(paybackAnos * 12)} meses`} accent />
        <KPI label="Yield anual" value={`${yieldAnual.toFixed(1)}%`} color={t.purple} sub={`vs CDI ~${CDI_TAXA}% · +${(yieldAnual - CDI_TAXA).toFixed(1)}pp`} accent />
      </div>

      {/* Barra payback */}
      <CardWrap>
        <div style={{ fontSize: 12, fontWeight: 500, color: dark ? "#F0F4F8" : "#1A202C", marginBottom: 14 }}>Evolução da recuperação do investimento</div>
        {[
          { label: "Recuperado até hoje", pct: roiPct, color: t.green, value: formatCurrency(investimento * roiPct / 100) },
          { label: `Projeção final ${year}`, pct: Math.min(roiPct + yieldAnual / 2, 100), color: t.blue, value: formatCurrency(investimento * (roiPct + yieldAnual / 2) / 100) },
          { label: "Payback completo", pct: 100, color: t.gold, value: `~${new Date().getFullYear() + Math.round(paybackAnos)} · ${paybackAnos.toFixed(1)} anos` },
        ].map(b => (
          <div key={b.label} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: dark ? "#4A5568" : "#94A3B8", marginBottom: 4 }}>
              <span>{b.label}</span><span style={{ color: b.color, fontWeight: 500 }}>{b.value}</span>
            </div>
            <div style={{ height: 10, background: dark ? "#0D1117" : "#F1F5F9", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(b.pct, 100)}%`, background: b.color, borderRadius: 5 }} />
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: dark ? "#2D3748" : "#94A3B8", marginTop: 4 }}>
          * Com 28 unidades em 2026, o payback pode ser antecipado para ~4,5 anos
        </div>
      </CardWrap>

      {/* Projeção crescimento */}
      <SectionLabel>Crescimento projetado — unidades e lucro</SectionLabel>
      <div style={g4}>
        {crescimentoData.map(c => (
          <div key={c.ano} style={t.kpi}>
            <div style={t.label}>{c.ano}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: t.blue, lineHeight: 1 }}>{c.unidades} unid.</div>
            <div style={{ ...t.sub, color: t.green }}>{formatCurrency(c.lucroAnual)}/ano proj.</div>
          </div>
        ))}
      </div>

    </div>
  );
}
