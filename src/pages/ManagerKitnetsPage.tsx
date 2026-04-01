import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GoldButton } from "@/components/wt7/GoldButton";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { WT7Logo } from "@/components/wt7/WT7Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useKitnets, useKitnetEntries, useKitnetSummary, useCreateKitnetEntry } from "@/hooks/useKitnets";
import { formatCurrency, formatMonth, getCurrentMonth, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { LogOut } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const statusLabels: Record<string, { label: string; variant: "green" | "gold" | "red" }> = {
  occupied: { label: "Ocupada", variant: "green" },
  maintenance: { label: "Manutenção", variant: "gold" },
  vacant: { label: "Vaga", variant: "red" },
};

export default function ManagerKitnetsPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login", { replace: true }); return; }
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "kitnet_manager" });
      if (!data) {
        const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (!isAdmin) { navigate("/login", { replace: true }); return; }
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
  const { data: kitnets, isLoading } = useKitnets();
  const summary = useKitnetSummary(month);
  const { data: entries } = useKitnetEntries(month);
  const [selected, setSelected] = useState<Tables<"kitnets"> | null>(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 border-b border-border" style={{ background: '#080C10' }}>
        <div className="flex items-center gap-3">
          <WT7Logo size="sm" />
          <span className="text-sm text-muted-foreground hidden sm:inline">Portal Administração Kitnets</span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Month selector */}
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-44 bg-background border-border text-foreground font-mono" />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Recebido" value={summary.totalReceived} color="gold" compact />
          <KpiCard label="Ocupadas" value={summary.occupied} color="green" compact formatAs="number" />
          <KpiCard label="Manutenção" value={summary.maintenance} color="cyan" compact formatAs="number" />
          <KpiCard label="Vacâncias" value={summary.vacant} color="red" compact formatAs="number" />
        </div>

        {/* Kitnets Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 13 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {(kitnets ?? []).map(k => {
              const s = statusLabels[k.status ?? "vacant"] ?? statusLabels.vacant;
              return (
                <PremiumCard key={k.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium text-foreground">{k.code}</span>
                    <WtBadge variant={s.variant}>{s.label}</WtBadge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{k.tenant_name || "—"}</p>
                  <p className="font-mono text-lg text-foreground">{formatCurrency(k.rent_value ?? 0)}</p>
                  <GoldButton className="w-full text-xs justify-center" onClick={() => setSelected(k)}>
                    Lançar Repasse
                  </GoldButton>
                </PremiumCard>
              );
            })}
          </div>
        )}

        {/* Recent entries table */}
        {entries?.length ? (
          <div>
            <h2 className="font-display font-bold text-lg text-foreground mb-3">Lançamentos de {formatMonth(month)}</h2>
            <div className="rounded-xl overflow-hidden border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Kitnet</TableHead>
                    <TableHead className="text-muted-foreground">Bruto</TableHead>
                    <TableHead className="text-muted-foreground">ADM</TableHead>
                    <TableHead className="text-muted-foreground">Líquido</TableHead>
                    <TableHead className="text-muted-foreground">Período</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e: any) => (
                    <TableRow key={e.id} className="border-border">
                      <TableCell className="font-mono text-foreground">{e.kitnets?.code}</TableCell>
                      <TableCell className="font-mono text-foreground">{formatCurrency(e.rent_gross ?? 0)}</TableCell>
                      <TableCell className="font-mono text-foreground">{formatCurrency(e.adm_fee ?? 0)}</TableCell>
                      <TableCell className="font-mono text-foreground">{formatCurrency(e.total_liquid ?? 0)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {e.period_start ? formatDate(e.period_start) : "—"} → {e.period_end ? formatDate(e.period_end) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </div>

      {/* Repasse Dialog */}
      {selected && (
        <RepasseDialog kitnet={selected} month={month} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function RepasseDialog({ kitnet, month, onClose }: { kitnet: Tables<"kitnets">; month: string; onClose: () => void }) {
  const { toast } = useToast();
  const createMut = useCreateKitnetEntry();
  const [form, setForm] = useState({
    period_start: "",
    period_end: "",
    rent_gross: String(kitnet.rent_value ?? 0),
    iptu_taxa: "0",
    celesc: "0",
    semasa: "0",
    adm_fee: String(((kitnet.rent_value ?? 0) * 0.1).toFixed(2)),
    broker_name: "",
    broker_creci: "",
  });

  const rentGross = Number(form.rent_gross) || 0;
  const iptu = Number(form.iptu_taxa) || 0;
  const celesc = Number(form.celesc) || 0;
  const semasa = Number(form.semasa) || 0;
  const adm = Number(form.adm_fee) || 0;
  const totalLiquid = rentGross + iptu + celesc + semasa - adm;

  // Auto-update ADM when rent changes
  useEffect(() => {
    setForm(f => ({ ...f, adm_fee: (rentGross * 0.1).toFixed(2) }));
  }, [rentGross]);

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await createMut.mutateAsync({
        kitnet_id: kitnet.id,
        reference_month: month,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        rent_gross: rentGross,
        iptu_taxa: iptu,
        celesc: celesc,
        semasa: semasa,
        adm_fee: adm,
        total_liquid: totalLiquid,
        broker_name: form.broker_name || null,
        broker_creci: form.broker_creci || null,
        created_by: user?.id,
      });
      toast({ title: "Repasse salvo!" });
      onClose();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Lançar Repasse — {kitnet.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Período Início</label>
              <Input type="date" value={form.period_start} onChange={e => set("period_start", e.target.value)} className="bg-background border-border text-foreground" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Período Fim</label>
              <Input type="date" value={form.period_end} onChange={e => set("period_end", e.target.value)} className="bg-background border-border text-foreground" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aluguel Bruto (R$)</label>
            <Input type="number" value={form.rent_gross} onChange={e => set("rent_gross", e.target.value)} className="bg-background border-border text-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">IPTU + Taxa Lixo</label>
              <Input type="number" value={form.iptu_taxa} onChange={e => set("iptu_taxa", e.target.value)} className="bg-background border-border text-foreground" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">CELESC</label>
              <Input type="number" value={form.celesc} onChange={e => set("celesc", e.target.value)} className="bg-background border-border text-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">SEMASA</label>
              <Input type="number" value={form.semasa} onChange={e => set("semasa", e.target.value)} className="bg-background border-border text-foreground" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Taxa ADM (10%)</label>
              <Input type="number" value={form.adm_fee} onChange={e => set("adm_fee", e.target.value)} className="bg-background border-border text-foreground" />
            </div>
          </div>

          {/* Total Líquido card */}
          <PremiumCard glowColor="hsl(43 52% 54%)" className="text-center py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Líquido</p>
            <p className="font-mono text-3xl font-bold mt-1" style={{ color: '#E8C97A' }}>{formatCurrency(totalLiquid)}</p>
          </PremiumCard>

          {/* Bank info (pre-filled) */}
          {(kitnet.deposit_bank || kitnet.deposit_agency || kitnet.deposit_account) && (
            <div className="rounded-lg p-3 bg-secondary/30 space-y-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Dados Bancários</p>
              <p className="text-sm text-foreground">
                {kitnet.deposit_bank} | Ag: {kitnet.deposit_agency} | Cc: {kitnet.deposit_account}
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Corretor</label>
            <Input value={form.broker_name} onChange={e => set("broker_name", e.target.value)} placeholder="Nome" className="bg-background border-border text-foreground" />
          </div>
        </div>
        <DialogFooter>
          <GoldButton onClick={handleSave} disabled={createMut.isPending} className="w-full justify-center">
            {createMut.isPending ? "Salvando..." : "Salvar Repasse"}
          </GoldButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
