import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GoldButton } from "@/components/wt7/GoldButton";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { WT7Logo } from "@/components/wt7/WT7Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { KitnetModal } from "@/components/wt7/KitnetModal";
import {
  useKitnets,
  useKitnetSummary,
  useKitnetEntries,
  useEnergyReadings,
  useCelescInvoices,
  useSaveEnergyReadings,
  useEnergyConfig,
  usePrevMonth,
} from "@/hooks/useKitnets";
import { formatCurrency, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { DEFAULT_ENERGY_TARIFF } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Home, Zap, Save, ArrowLeft, Download, Printer } from "lucide-react";
import { abrirReciboConsolidado } from "@/lib/relatorioFechamento";
import type { Tables } from "@/integrations/supabase/types";

const statusLabels: Record<string, { label: string; variant: "green" | "gold" | "red" }> = {
  occupied: { label: "Ocupada", variant: "green" },
  maintenance: { label: "Manutenção", variant: "gold" },
  vacant: { label: "Vaga", variant: "red" },
};

export default function ManagerKitnetsPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login", { replace: true }); return; }

      // Admin sempre tem acesso
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (isAdmin) { setAuthorized(true); return; }

      // Manager: verifica role + status = active
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("status")
        .eq("user_id", user.id)
        .eq("role", "kitnet_manager")
        .maybeSingle();

      if (!roleData || (roleData as any).status !== "active") {
        navigate("/login", { replace: true }); return;
      }
      setAuthorized(true);
    })();
  }, [navigate]);

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Skeleton className="w-16 h-16 rounded-2xl" />
      </div>
    );
  }

  return <ManagerContent />;
}

function ManagerContent() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { data: entriesForReport } = useKitnetEntries(month);

  const handleRelatorio = () => {
    if (!entriesForReport?.length) return;
    const data = (entriesForReport as any[])
      .filter(e => e.kitnets)
      .map(e => ({ kitnet: e.kitnets, fechamento: e }));
    abrirReciboConsolidado(data, month);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(!!data);
    })();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 border-b border-border" style={{ background: '#080C10' }}>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mr-2"
            >
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </button>
          )}
          <WT7Logo size="sm" />
          <span className="text-sm text-muted-foreground hidden sm:inline">Portal Administração</span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <MonthPicker value={month} onChange={v => setMonth(v)} className="w-44" />
          <span className="text-sm text-muted-foreground">{formatMonth(month)}</span>
        </div>

        <Tabs defaultValue="kitnets">
          <div className="flex items-center justify-between gap-3">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="kitnets" className="gap-2">
                <Home className="w-4 h-4" /> Kitnets
              </TabsTrigger>
              <TabsTrigger value="energia" className="gap-2">
                <Zap className="w-4 h-4" /> Energia Solar
              </TabsTrigger>
            </TabsList>
            <button
              onClick={handleRelatorio}
              disabled={!entriesForReport?.length}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: 'rgba(232,201,122,0.1)', color: '#E8C97A', border: '1px solid rgba(232,201,122,0.3)' }}
              title={entriesForReport?.length ? `Gerar relatório com ${entriesForReport.length} fechamentos` : "Nenhum fechamento neste mês"}
            >
              <Printer className="w-4 h-4" />
              Relatório do Mês
            </button>
          </div>
          <TabsContent value="kitnets"><KitnetsTab month={month} /></TabsContent>
          <TabsContent value="energia"><EnergiaTab month={month} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  ABA KITNETS
// ═══════════════════════════════════════════════════
function KitnetsTab({ month }: { month: string }) {
  const { data: kitnets, isLoading, refetch } = useKitnets();
  const summary = useKitnetSummary(month);
  const { data: entries } = useKitnetEntries(month);
  const prevMonth = usePrevMonth(month);
  const { data: prevEntries } = useKitnetEntries(prevMonth);
  const [selected, setSelected] = useState<Tables<"kitnets"> | null>(null);

  const rwt02 = (kitnets ?? []).filter(k => k.residencial_code === "RWT02");
  const rwt03 = (kitnets ?? []).filter(k => k.residencial_code === "RWT03");

  const complexos = [
    { code: "RWT02", label: "RWT02 — Rua Amauri de Souza, 08", units: rwt02 },
    { code: "RWT03", label: "RWT03 — Rua Manoel Corrêa, 125", units: rwt03 },
  ].filter(c => c.units.length > 0);

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Recebido" value={summary.totalReceived} color="gold" compact />
        <KpiCard label="Ocupadas" value={summary.occupied} color="green" compact formatAs="number" />
        <div className="rounded-2xl p-4 space-y-1" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <p className="text-xs uppercase font-mono tracking-widest" style={{ color: '#94A3B8' }}>Recebidos</p>
          <p className="font-mono text-2xl font-bold" style={{ color: '#2DD4BF' }}>
            {summary.received}<span className="text-sm font-normal" style={{ color: '#4A5568' }}>/{summary.occupied}</span>
          </p>
          <p className="text-xs" style={{ color: '#4A5568' }}>fechamentos no mês</p>
        </div>
        <KpiCard label="Vacâncias" value={summary.vacant} color="red" compact formatAs="number" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 13 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : (
        complexos.map(({ label, units }) => (
          <div key={label}>
            <h2 className="font-display font-bold text-lg text-foreground mb-3">{label}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {units.map(k => {
                const fechamento = (entries as any[] ?? []).find(e => e.kitnet_id === k.id);
                const prevFechamento = (prevEntries as any[] ?? []).find(e => e.kitnet_id === k.id);
                const isOccupied = k.status === "occupied" || k.status === "maintenance";
                const isReceived = !!fechamento;
                const s = isReceived ? statusLabels.occupied : isOccupied ? { label: "Aguardando", variant: "gold" as const } : statusLabels.vacant;
                const tenantName = isOccupied || isReceived ? (k.tenant_name || null) : null;
                const displayValue = fechamento?.total_liquid ?? k.rent_value ?? 0;
                return (
                  <PremiumCard key={k.id} className="relative p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-medium text-foreground">{k.code}</span>
                      <WtBadge variant={s.variant}>{s.label}</WtBadge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{tenantName || "—"}</p>
                    {k.tenant_phone && isOccupied && <p className="text-xs text-muted-foreground">{k.tenant_phone}</p>}
                    <p className="font-mono text-lg text-foreground mt-1">{formatCurrency(displayValue)}</p>

                    {fechamento ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                        <span style={{ color: '#10B981' }}>✓</span>
                        <span className="text-xs font-medium" style={{ color: '#10B981' }}>
                          Fechado · {formatCurrency(fechamento.total_liquid ?? 0)}
                        </span>
                      </div>
                    ) : isOccupied ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
                        <span className="text-xs font-medium" style={{ color: '#C9A84C' }}>⏳ Aguardando fechamento</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                        <span className="text-xs" style={{ color: '#F43F5E' }}>— Vaga</span>
                      </div>
                    )}

                    <GoldButton className="w-full text-xs justify-center mt-2" onClick={() => setSelected(k)}>
                      Gerenciar
                    </GoldButton>
                  </PremiumCard>
                );
              })}
            </div>
          </div>
        ))
      )}

      {selected && (
        <KitnetModal
          kitnet={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => refetch()}
          defaultMonth={month}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  ABA ENERGIA SOLAR
// ═══════════════════════════════════════════════════
function EnergiaTab({ month }: { month: string }) {
  const [complex, setComplex] = useState("RWT02");
  const { data: kitnets } = useKitnets();
  const { data: invoices } = useCelescInvoices(month);
  const { data: existingReadings } = useEnergyReadings(month, complex);
  const { data: energyConfig } = useEnergyConfig();
  const saveMut = useSaveEnergyReadings();
  const { toast } = useToast();

  // Tarifa fixa da config (padrão 1.06) — manager só lê, não edita
  const tariff = useMemo(() => {
    const cfg = (energyConfig ?? []).find(c => c.residencial_code === complex);
    return cfg?.tariff_kwh ?? DEFAULT_ENERGY_TARIFF;
  }, [energyConfig, complex]);

  const units = useMemo(
    () => (kitnets ?? []).filter(k => k.residencial_code === complex),
    [kitnets, complex]
  );

  const [readings, setReadings] = useState<Record<string, string>>({});

  useMemo(() => {
    const map: Record<string, string> = {};
    (existingReadings ?? []).forEach((r: any) => {
      if (r.kitnet_id) map[r.kitnet_id] = String(r.reading_current ?? "");
    });
    setReadings(map);
  }, [existingReadings]);

  const getPrevReading = (kitnetId: string) =>
    (existingReadings ?? []).find((r: any) => r.kitnet_id === kitnetId)?.reading_previous ?? 0;

  const calcRow = (kitnetId: string) => {
    const current = Number(readings[kitnetId]) || 0;
    const previous = getPrevReading(kitnetId);
    const kwh = Math.max(0, current - previous);
    return { current, previous, kwh, amount: kwh * tariff };
  };

  const totals = useMemo(() => {
    let totalCharged = 0;
    units.forEach(u => { totalCharged += calcRow(u.id).amount; });
    const invoicePaid = (invoices ?? []).find(i => i.residencial_code === complex)?.amount_paid ?? 0;
    return { totalCharged, invoicePaid, margin: totalCharged - invoicePaid };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, readings, invoices, complex, tariff]);

  const handleDownload = () => {
    const monthLabel = formatMonth(month);
    const rows: string[][] = [
      [`Relatório de Energia Solar — ${complex} — ${monthLabel}`],
      [`Tarifa: R$ ${tariff.toFixed(4)}/kWh`],
      [],
      ["Unidade", "Inquilino", "Ant. (kWh)", "Atual (kWh)", "Consumo (kWh)", "Valor (R$)"],
    ];

    units.forEach(u => {
      const { current, previous, kwh, amount } = calcRow(u.id);
      rows.push([
        u.code ?? "",
        u.tenant_name ?? "—",
        String(previous),
        String(current),
        kwh.toFixed(2),
        amount.toFixed(2),
      ]);
    });

    const csv = rows.map(r => r.map(c => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `energia_${complex}_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const invoiceId = (invoices ?? []).find(i => i.residencial_code === complex)?.id;
      const toSave = units.map(u => {
        const { current, previous, kwh, amount } = calcRow(u.id);
        const existing = (existingReadings ?? []).find((r: any) => r.kitnet_id === u.id);
        return {
          ...(existing?.id ? { id: existing.id } : {}),
          kitnet_id: u.id,
          reference_month: month,
          reading_current: current,
          reading_previous: previous,
          consumption_kwh: kwh,
          amount_to_charge: Number(amount.toFixed(2)),
          tariff_per_kwh: tariff,
          celesc_invoice_id: invoiceId ?? null,
          created_by: user?.id,
        };
      });
      await saveMut.mutateAsync(toSave as any);
      toast({ title: "Leituras salvas!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-3">
        <Select value={complex} onValueChange={setComplex}>
          <SelectTrigger className="w-40 bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="RWT02">RWT02</SelectItem>
            <SelectItem value="RWT03">RWT03</SelectItem>
          </SelectContent>
        </Select>
        {tariff > 0 && (
          <span className="text-xs text-muted-foreground">
            Tarifa: <span className="font-mono text-foreground">R$ {tariff.toFixed(4)}/kWh</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'rgba(45,212,191,0.1)', color: '#2DD4BF', border: '1px solid rgba(45,212,191,0.3)' }}
          >
            <Download className="w-4 h-4" />
            Baixar CSV
          </button>
          <GoldButton onClick={handleSave} disabled={saveMut.isPending}>
            <Save className="w-4 h-4 mr-1" />
            {saveMut.isPending ? "Salvando..." : "Salvar Leituras"}
          </GoldButton>
        </div>
      </div>

      {tariff === 0 ? (
        <PremiumCard className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            Nenhuma fatura CELESC registrada para {complex} em {formatMonth(month)}.
          </p>
          <p className="text-xs text-muted-foreground mt-1">Contate o administrador para cadastrar a fatura do mês.</p>
        </PremiumCard>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Unidade</TableHead>
                <TableHead className="text-muted-foreground">Inquilino</TableHead>
                <TableHead className="text-muted-foreground">Ant. (kWh)</TableHead>
                <TableHead className="text-muted-foreground">Atual (kWh)</TableHead>
                <TableHead className="text-muted-foreground">Consumo</TableHead>
                <TableHead className="text-muted-foreground">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map(u => {
                const { previous, kwh, amount } = calcRow(u.id);
                return (
                  <TableRow key={u.id} className="border-border">
                    <TableCell className="font-mono text-foreground">{u.code}</TableCell>
                    <TableCell className="text-muted-foreground">{u.tenant_name || "—"}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{previous}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={readings[u.id] ?? ""}
                        onChange={e => setReadings(r => ({ ...r, [u.id]: e.target.value }))}
                        className="w-28 bg-background border-border text-foreground font-mono"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-foreground">{kwh.toFixed(2)}</TableCell>
                    <TableCell className="font-mono font-medium" style={{ color: '#E8C97A' }}>{formatCurrency(amount)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

    </div>
  );
}
