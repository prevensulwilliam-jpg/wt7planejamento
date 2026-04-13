import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Dialog/Select/Input used in EntriesTab
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { GoldButton } from "@/components/wt7/GoldButton";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { KitnetModal } from "@/components/wt7/KitnetModal";
import { useKitnets, useKitnetEntries, useKitnetSummary, useCreateKitnetEntry, useEnergyReadings, useCelescInvoices, useSaveEnergyReadings, useUnreconciledEntries, usePrevMonth, useDeleteKitnetEntry, useReconcileWithTransactions, useLockedMonth, useLockMonth, useUnlockMonth, useKitnetAlertsForMonth } from "@/hooks/useKitnets";
import { formatCurrency, formatMonth, getCurrentMonth, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Download, Save, Printer, CheckCircle, XCircle, AlertCircle, ArrowLeftRight, Zap, Trash2, Lock, Unlock } from "lucide-react";
import { abrirReciboConsolidado } from "@/lib/relatorioFechamento";
import type { Tables } from "@/integrations/supabase/types";

import { useSearchParams } from "react-router-dom";
import { useBankTransactions } from "@/hooks/useBankReconciliation";

const statusLabels: Record<string, { label: string; variant: "green" | "gold" | "red" }> = {
  occupied: { label: "Ocupada", variant: "green" },
  maintenance: { label: "Manutenção", variant: "gold" },
  vacant: { label: "Vaga", variant: "red" },
};

export default function KitnetsPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") ?? "overview";
  const { toast } = useToast();

  const { data: lockData, isLoading: lockLoading } = useLockedMonth(month);
  const lockMut = useLockMonth();
  const unlockMut = useUnlockMonth();
  const isLocked = !!lockData;

  const [lockDialogOpen, setLockDialogOpen] = useState(false);

  const handleLockClick = () => {
    if (isLocked) {
      setLockDialogOpen(true);
    } else {
      setLockDialogOpen(true);
    }
  };

  const handleConfirmLock = async () => {
    try {
      await lockMut.mutateAsync(month);
      toast({ title: "🔒 Mês fechado", description: `${formatMonth(month)} bloqueado com sucesso.` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLockDialogOpen(false);
    }
  };

  const handleConfirmUnlock = async () => {
    try {
      await unlockMut.mutateAsync(month);
      toast({ title: "🔓 Mês reaberto", description: `${formatMonth(month)} desbloqueado.` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLockDialogOpen(false);
    }
  };

  const handleLockedTabClick = () => {
    toast({ title: "🔒 Cadeado Fechado", description: `${formatMonth(month)} está bloqueado. Clique no cadeado para reabrir.` });
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl text-foreground">Kitnets</h1>
      <Tabs defaultValue={defaultTab}>
        <div className="flex items-center gap-3 flex-wrap">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger
              value="entries"
              onClick={isLocked ? (e) => { e.preventDefault(); handleLockedTabClick(); } : undefined}
              style={isLocked ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            >Lançamentos</TabsTrigger>
            <TabsTrigger
              value="report"
              onClick={isLocked ? (e) => { e.preventDefault(); handleLockedTabClick(); } : undefined}
              style={isLocked ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            >Relatório Mensal</TabsTrigger>
            <TabsTrigger
              value="energia"
              onClick={isLocked ? (e) => { e.preventDefault(); handleLockedTabClick(); } : undefined}
              style={isLocked ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            >Energia Solar</TabsTrigger>
          </TabsList>

          {/* Lock button — sempre visível, ao lado direito */}
          <button
            onClick={handleLockClick}
            disabled={lockLoading || lockMut.isPending || unlockMut.isPending}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={isLocked
              ? { background: 'rgba(247,201,72,0.12)', color: '#F7C948', border: '1px solid rgba(247,201,72,0.4)' }
              : { background: 'rgba(74,85,104,0.15)', color: '#718096', border: '1px solid rgba(74,85,104,0.3)' }
            }
            title={isLocked ? "Mês fechado — clique para reabrir" : "Fechar mês"}
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {isLocked ? `🔒 ${formatMonth(month)}` : "Fechar Mês"}
          </button>
        </div>

        <TabsContent value="overview"><OverviewTab month={month} setMonth={setMonth} /></TabsContent>
        <TabsContent value="entries"><EntriesTab month={month} setMonth={setMonth} /></TabsContent>
        <TabsContent value="report"><ReportTab month={month} setMonth={setMonth} /></TabsContent>
        <TabsContent value="energia"><EnergiaTab month={month} /></TabsContent>
      </Tabs>

      {/* Dialog lock/unlock */}
      <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {isLocked ? "🔓 Reabrir mês?" : "🔒 Fechar mês?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isLocked
              ? `${formatMonth(month)} está fechado. Reabrir permitirá edições nos lançamentos. Esta ação ficará registrada no histórico.`
              : `Fechar ${formatMonth(month)} bloqueará as abas Lançamentos, Relatório Mensal e Energia Solar. Apenas a Visão Geral e a troca de mês continuarão funcionando.`
            }
          </p>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setLockDialogOpen(false)}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: '#1A2332', border: '1px solid #2D3748', color: '#90A0B7' }}
            >Cancelar</button>
            {isLocked ? (
              <button
                onClick={handleConfirmUnlock}
                disabled={unlockMut.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.35)', color: '#F87171' }}
              >{unlockMut.isPending ? "Reabrindo..." : "🔓 Reabrir mesmo assim"}</button>
            ) : (
              <button
                onClick={handleConfirmLock}
                disabled={lockMut.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(247,201,72,0.15)', border: '1px solid rgba(247,201,72,0.4)', color: '#F7C948' }}
              >{lockMut.isPending ? "Fechando..." : "🔒 Fechar Mês"}</button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Overview Tab ───
function OverviewTab({ month, setMonth }: { month: string; setMonth: (v: string) => void }) {
  const { data: kitnets, isLoading, refetch } = useKitnets();
  const summary = useKitnetSummary(month);
  const { data: entries } = useKitnetEntries(month);
  const [selected, setSelected] = useState<Tables<"kitnets"> | null>(null);

  const handleRelatorioConsolidado = () => {
    if (!entries?.length) return;
    const data = entries
      .filter((e: any) => e.kitnets)
      .map((e: any) => ({ kitnet: e.kitnets, fechamento: e }));
    abrirReciboConsolidado(data, month);
  };

  const prevMonth = usePrevMonth(month);
  const { data: prevEntries } = useKitnetEntries(prevMonth);
  const rwt02 = (kitnets ?? []).filter(k => k.residencial_code === "RWT02");
  const rwt03 = (kitnets ?? []).filter(k => k.residencial_code === "RWT03");

  if (isLoading) {
    return (
      <div className="space-y-4 mt-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Seletor de mês + botão relatório */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-mono uppercase tracking-widest" style={{ color: '#4A5568' }}>Mês de referência</span>
        <MonthPicker value={month} onChange={setMonth} className="w-40" />
        <button
          onClick={handleRelatorioConsolidado}
          disabled={!entries?.length}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
          style={{ background: 'rgba(232,201,122,0.1)', color: '#E8C97A', border: '1px solid rgba(232,201,122,0.3)' }}
          title={entries?.length ? `Gerar relatório com ${entries.length} fechamentos` : "Nenhum fechamento neste mês"}
        >
          <Printer className="w-4 h-4" />
          Relatório do Mês
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Recebido" value={summary.totalReceived} color="gold" compact />
        <div className="rounded-2xl p-4 space-y-1" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <p className="text-xs uppercase font-mono tracking-widest" style={{ color: '#94A3B8' }}>Ocupadas</p>
          <p className="font-mono text-2xl font-bold" style={{ color: '#10B981' }}>
            {summary.occupied}<span className="text-sm font-normal" style={{ color: '#4A5568' }}>/{summary.total}</span>
          </p>
        </div>
        <div className="rounded-2xl p-4 space-y-1" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <p className="text-xs uppercase font-mono tracking-widest" style={{ color: '#94A3B8' }}>Conciliados</p>
          <p className="font-mono text-2xl font-bold" style={{ color: '#2DD4BF' }}>
            {summary.received}<span className="text-sm font-normal" style={{ color: '#4A5568' }}>/{summary.totalEntries}</span>
          </p>
          <p className="text-xs" style={{ color: '#4A5568' }}>conciliados / lançamentos</p>
        </div>
        <KpiCard label="Vacâncias" value={summary.vacant} color="red" compact formatAs="number" />
      </div>

      {/* RWT02 */}
      <div>
        <h2 className="font-display font-bold text-lg text-foreground mb-3">RWT02 — Rua Amauri de Souza, 08</h2>
        <KitnetGrid kitnets={rwt02} onManage={setSelected} entries={entries ?? []} prevEntries={prevEntries ?? []} />
      </div>

      {/* RWT03 */}
      <div>
        <h2 className="font-display font-bold text-lg text-foreground mb-3">RWT03 — Rua Manoel Corrêa, 125</h2>
        <KitnetGrid kitnets={rwt03} onManage={setSelected} entries={entries ?? []} prevEntries={prevEntries ?? []} />
      </div>

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

function KitnetGrid({ kitnets, onManage, entries, prevEntries }: { kitnets: Tables<"kitnets">[]; onManage: (k: Tables<"kitnets">) => void; entries: any[]; prevEntries: any[] }) {
  if (!kitnets.length) {
    return <p className="text-muted-foreground text-sm">Nenhuma kitnet cadastrada.</p>;
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {kitnets.map(k => {
        const fechamento = entries.find(e => e.kitnet_id === k.id);
        // Status do BANCO é a fonte de verdade — fechamento NÃO muda o status
        const isOccupied = k.status === "occupied" || k.status === "maintenance";
        const hasEntry = !!fechamento;
        const isReconciled = !!fechamento?.reconciled;
        // Badge: status real do banco
        const s = isOccupied
          ? (hasEntry ? statusLabels.occupied : { label: "Aguardando", variant: "gold" as const })
          : statusLabels[k.status ?? "vacant"] ?? statusLabels.vacant;
        // Nome: só mostra se kitnet está occupied/maintenance
        const tenantName = isOccupied ? (k.tenant_name || null) : null;
        // Valor: total_liquid se tem fechamento, senão rent_value do contrato
        const displayValue = isOccupied
          ? (fechamento?.total_liquid ?? k.rent_value ?? 0)
          : (k.rent_value ?? 0);
        return (
          <PremiumCard key={k.id} className="relative p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-sm font-medium text-foreground">{k.code}</span>
              <WtBadge variant={s.variant}>{s.label}</WtBadge>
            </div>
            <p className="text-sm text-muted-foreground truncate">{tenantName || "—"}</p>
            {k.tenant_phone && isOccupied && <p className="text-xs text-muted-foreground">{k.tenant_phone}</p>}
            <p className="font-mono text-lg mt-1" style={{ color: (!isOccupied || !hasEntry) ? '#4A5568' : '#E2E8F0' }}>{formatCurrency(displayValue)}</p>

            {/* Sub-badge: conciliado / lançado / aguardando / vaga */}
            {isOccupied && isReconciled ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span className="text-xs font-medium" style={{ color: '#10B981' }}>
                  Conciliado · {formatCurrency(fechamento.total_liquid ?? 0)}
                </span>
              </div>
            ) : isOccupied && hasEntry ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
                <span className="text-xs font-medium" style={{ color: '#FBB724' }}>⏳ Lançado · {formatCurrency(fechamento.total_liquid ?? 0)}</span>
              </div>
            ) : isOccupied ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
                <span className="text-xs font-medium" style={{ color: '#C9A84C' }}>⏳ Aguardando fechamento</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <span className="text-xs" style={{ color: '#F43F5E' }}>— Vaga</span>
              </div>
            )}

            <GoldButton className="w-full text-xs justify-center mt-2" onClick={() => onManage(k)}>
              Gerenciar
            </GoldButton>
          </PremiumCard>
        );
      })}
    </div>
  );
}

// ─── Entries Tab ───
function EntriesTab({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const { data: entries, isLoading } = useKitnetEntries(month);
  const { data: kitnets } = useKitnets();
  const { data: alerts = [] } = useKitnetAlertsForMonth(month);
  const [open, setOpen] = useState(false);
  const [conciliarOpen, setConciliarOpen] = useState(false);
  const [form, setForm] = useState({ kitnet_id: "", rent_gross: "", reference_month: month, period_start: "", period_end: "" });
  const createMut = useCreateKitnetEntry();
  const deleteMut = useDeleteKitnetEntry();
  const { toast } = useToast();

  const handleCreate = async () => {
    try {
      const { data: { user } } = await (await import("@/integrations/supabase/client")).supabase.auth.getUser();
      await createMut.mutateAsync({
        kitnet_id: form.kitnet_id,
        rent_gross: Number(form.rent_gross),
        reference_month: form.reference_month,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        created_by: user?.id,
      });
      toast({ title: "Lançamento criado!" });
      setOpen(false);
      setForm({ kitnet_id: "", rent_gross: "", reference_month: month, period_start: "", period_end: "" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (entryId: string, code: string) => {
    if (!confirm(`Remover lançamento ${code}?`)) return;
    try {
      await deleteMut.mutateAsync(entryId);
      toast({ title: "Lançamento removido" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const pendentes = (entries ?? []).filter((e: any) => !e.reconciled).length;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-3 flex-wrap">
        <MonthPicker value={month} onChange={v => setMonth(v)} className="w-44" />
        <div className="flex items-center gap-2 ml-auto">
          {pendentes > 0 && (
            <button
              onClick={() => setConciliarOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}
            >
              <Zap className="w-4 h-4" />
              Conciliar com Extratos ({pendentes})
            </button>
          )}
          <GoldButton onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Novo Lançamento</GoldButton>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded" />)}</div>
      ) : !entries?.length ? (
        <PremiumCard className="text-center py-12">
          <p className="text-muted-foreground">Nenhum lançamento em {formatMonth(month)}</p>
        </PremiumCard>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Kitnet</TableHead>
                <TableHead className="text-muted-foreground">Inquilino</TableHead>
                <TableHead className="text-muted-foreground">Aluguel Bruto</TableHead>
                <TableHead className="text-muted-foreground">Taxa ADM</TableHead>
                <TableHead className="text-muted-foreground">Total Líquido</TableHead>
                <TableHead className="text-muted-foreground">Período</TableHead>
                <TableHead className="text-muted-foreground">Conciliação</TableHead>
                <TableHead className="text-muted-foreground w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e: any) => (
                <TableRow key={e.id} className="border-border">
                  <TableCell className="font-mono text-foreground">{e.kitnets?.code ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.kitnets?.tenant_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-foreground">{formatCurrency(e.rent_gross ?? 0)}</TableCell>
                  <TableCell className="font-mono text-foreground">{formatCurrency(e.adm_fee ?? 0)}</TableCell>
                  <TableCell className="font-mono text-foreground">
                    <div>{formatCurrency(e.total_liquid ?? 0)}</div>
                    {(() => {
                      const alert = alerts.find(a => a.kitnet_id === e.kitnet_id);
                      if (!alert) return null;
                      const srcMonth = alert.source_month ? alert.source_month.slice(5, 7) + '/' + alert.source_month.slice(2, 4) : '';
                      return (
                        <div className="flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-xs font-semibold"
                          style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', color: '#F87171', width: 'fit-content' }}>
                          ⚠️ Pendente contr.: {formatCurrency(alert.pending_amount)} · {srcMonth}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {e.period_start ? formatDate(e.period_start) : "—"} → {e.period_end ? formatDate(e.period_end) : "—"}
                  </TableCell>
                  <TableCell>
                    {e.reconciled ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#10B981' }} />
                        <span className="font-mono text-xs" style={{ color: (e as any).reconciled_at ? '#4A5568' : '#2D3748' }}>
                          {(e as any).reconciled_at
                            ? new Date((e as any).reconciled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                            : 'sem data'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#F59E0B' }} />
                        <span className="text-xs" style={{ color: '#F59E0B' }}>Pendente</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleDelete(e.id, e.kitnets?.code ?? e.id)}
                      disabled={deleteMut.isPending}
                      className="p-1 rounded hover:bg-red-950 transition-colors"
                      title="Remover lançamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" style={{ color: '#4A5568' }} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog: Novo Lançamento */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Novo Lançamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Kitnet</label>
              <Select value={form.kitnet_id} onValueChange={v => setForm({ ...form, kitnet_id: v })}>
                <SelectTrigger className="bg-background border-border text-foreground"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(kitnets ?? []).map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.code} — {k.tenant_name || "Vaga"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aluguel Bruto (R$)</label>
              <Input type="number" value={form.rent_gross} onChange={e => setForm({ ...form, rent_gross: e.target.value })} className="bg-background border-border text-foreground" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mês Referência</label>
              <MonthPicker value={form.reference_month} onChange={v => setForm({ ...form, reference_month: v })} />
            </div>
          </div>
          <DialogFooter>
            <GoldButton onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? "Salvando..." : "Salvar"}
            </GoldButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Conciliar Extrato */}
      <ConciliacaoDialog open={conciliarOpen} onClose={() => setConciliarOpen(false)} month={month} />
    </div>
  );
}

// ─── Dialog de Conciliação com suporte a múltiplos extratos ───
function ConciliacaoDialog({ open, onClose, month }: { open: boolean; onClose: () => void; month: string }) {
  const { data: entries = [], isLoading } = useUnreconciledEntries(month);
  const { data: txRaw = [] } = useBankTransactions({ month });
  const reconcileMut = useReconcileWithTransactions();
  const { toast } = useToast();

  // Apenas créditos não ignorados do extrato
  const credits = useMemo(
    () => (txRaw as any[]).filter(t => t.type === "credit" && t.status !== "ignored"),
    [txRaw]
  );

  // Sugestão automática por valor exato (1 transação = total)
  const suggestions = useMemo(() => {
    const map: Record<string, string | null> = {};
    entries.forEach((e: any) => {
      const match = credits.find(t => Math.abs(Number(t.amount) - Number(e.total_liquid)) < 0.02);
      map[e.id] = match?.id ?? null;
    });
    return map;
  }, [entries, credits]);

  // selectedTxIds: lista de IDs de transações vinculadas a cada fechamento
  const [selectedTxIds, setSelectedTxIds] = useState<Record<string, string[]>>({});

  // Inicializa com sugestão automática quando entries/suggestions carregam
  useEffect(() => {
    if (!entries.length) return;
    setSelectedTxIds(prev => {
      const next = { ...prev };
      entries.forEach((e: any) => {
        if (next[e.id] === undefined) {
          next[e.id] = suggestions[e.id] ? [suggestions[e.id]!] : [];
        }
      });
      return next;
    });
  }, [suggestions]);

  const getTxIds = (entryId: string) => selectedTxIds[entryId] ?? [];

  const addTx = (entryId: string, txId: string) => {
    setSelectedTxIds(prev => ({ ...prev, [entryId]: [...(prev[entryId] ?? []), txId] }));
  };

  const removeTx = (entryId: string, txId: string) => {
    setSelectedTxIds(prev => ({ ...prev, [entryId]: (prev[entryId] ?? []).filter(id => id !== txId) }));
  };

  const getSum = (entryId: string) =>
    getTxIds(entryId).reduce((sum, txId) => {
      const tx = credits.find(t => t.id === txId);
      return sum + (tx ? Number(tx.amount) : 0);
    }, 0);

  const handleReconcile = async (entry: any) => {
    try {
      await reconcileMut.mutateAsync({ entryId: entry.id, transactionIds: getTxIds(entry.id) });
      toast({ title: `${entry.kitnets?.code} conciliado!` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleSemExtrato = async (entry: any) => {
    try {
      await reconcileMut.mutateAsync({ entryId: entry.id, transactionIds: [] });
      toast({ title: `${entry.kitnets?.code} marcado sem extrato` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleConciliarTodosExatos = async () => {
    const exatos = entries.filter((e: any) => {
      const ids = getTxIds(e.id);
      if (ids.length !== 1) return false;
      const tx = credits.find(t => t.id === ids[0]);
      return tx && Math.abs(Number(tx.amount) - Number(e.total_liquid)) < 0.02;
    });
    for (const entry of exatos) {
      await reconcileMut.mutateAsync({ entryId: entry.id, transactionIds: getTxIds(entry.id) });
    }
    toast({ title: `${exatos.length} lançamento(s) conciliado(s) automaticamente` });
  };

  if (!open) return null;

  const exactCount = entries.filter((e: any) => {
    const ids = getTxIds(e.id);
    if (ids.length !== 1) return false;
    const tx = credits.find(t => t.id === ids[0]);
    return tx && Math.abs(Number(tx.amount) - Number(e.total_liquid)) < 0.02;
  }).length;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" style={{ color: '#10B981' }} />
            Conciliar com Extratos — {formatMonth(month)}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10">
            <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#10B981' }} />
            <p className="font-medium text-foreground">Todos os lançamentos estão conciliados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exactCount > 0 && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <span className="text-sm" style={{ color: '#10B981' }}>
                  {exactCount} match{exactCount > 1 ? 'es' : ''} exato{exactCount > 1 ? 's' : ''} encontrado{exactCount > 1 ? 's' : ''}
                </span>
                <button
                  onClick={handleConciliarTodosExatos}
                  disabled={reconcileMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}
                >
                  <Zap className="w-3.5 h-3.5" /> Conciliar todos exatos
                </button>
              </div>
            )}

            {entries.map((entry: any) => {
              const txIds = getTxIds(entry.id);
              const soma = getSum(entry.id);
              const expected = Number(entry.total_liquid ?? 0);
              const diff = soma - expected;
              const isExact = Math.abs(diff) < 0.02;
              const isOver = diff > 0.02;
              const isPartial = soma > 0 && !isExact && !isOver;
              const isEmpty = soma === 0;

              // Transações disponíveis para adicionar (exclui as já selecionadas)
              const availableTx = credits.filter(t => !txIds.includes(t.id));

              const somaColor = isExact ? '#10B981' : isOver ? '#F43F5E' : isPartial ? '#F59E0B' : '#4A5568';
              const canConfirm = txIds.length > 0;

              return (
                <PremiumCard key={entry.id} className="p-4 space-y-3">
                  {/* Cabeçalho */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-sm" style={{ color: '#E8C97A' }}>{entry.kitnets?.code}</span>
                      <span className="text-xs text-muted-foreground ml-2">{entry.kitnets?.tenant_name ?? "—"}</span>
                    </div>
                    <span className="font-mono font-bold text-lg text-foreground">{formatCurrency(expected)}</span>
                  </div>

                  {/* Bloco de extrato */}
                  <div className="rounded-lg p-3 space-y-2" style={{ background: '#080C10', border: '1px solid #1A2535' }}>
                    <p className="text-xs font-mono uppercase tracking-wider" style={{ color: '#4A5568' }}>
                      Transações do extrato vinculadas
                    </p>

                    {/* Lista de transações selecionadas */}
                    {txIds.length > 0 ? (
                      <div className="space-y-1.5">
                        {txIds.map(txId => {
                          const tx = credits.find(t => t.id === txId);
                          if (!tx) return null;
                          return (
                            <div key={txId} className="flex items-center gap-2 px-2 py-1.5 rounded-md" style={{ background: '#0D1117', border: '1px solid #1C2333' }}>
                              <span className="text-xs text-muted-foreground flex-1 truncate">{tx.description}</span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{tx.date ? formatDate(tx.date) : "—"}</span>
                              <span className="font-mono text-sm font-medium whitespace-nowrap" style={{ color: '#10B981' }}>{formatCurrency(tx.amount)}</span>
                              <button
                                onClick={() => removeTx(entry.id, txId)}
                                className="text-xs rounded px-1 transition-colors"
                                style={{ color: '#2D3748' }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#F43F5E')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#2D3748')}
                                title="Remover"
                              >×</button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs italic" style={{ color: '#2D3748' }}>Nenhuma transação selecionada</p>
                    )}

                    {/* Dropdown para adicionar transação */}
                    {availableTx.length > 0 && (
                      <Select value="" onValueChange={v => { if (v) addTx(entry.id, v); }}>
                        <SelectTrigger className="w-full text-xs bg-background border-border text-muted-foreground h-8 border-dashed">
                          <SelectValue placeholder="+ Adicionar transação do extrato..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTx.map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.date ? formatDate(t.date) : "?"} · {formatCurrency(t.amount)} · {t.description?.slice(0, 40)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Barra de soma */}
                    <div className="pt-2 border-t" style={{ borderColor: '#1C2333' }}>
                      <div className="flex items-center justify-between text-xs">
                        <span style={{ color: '#4A5568' }}>Soma selecionada</span>
                        <span className="font-mono font-semibold" style={{ color: somaColor }}>{formatCurrency(soma)}</span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: somaColor }}>
                        {isEmpty && '— Selecione ao menos uma transação'}
                        {isExact && `✓ Valor exato — R$ 0,00 de diferença`}
                        {isPartial && `⚠ Faltam ${formatCurrency(Math.abs(diff))} para completar`}
                        {isOver && `⚠ Excede em ${formatCurrency(diff)} — verifique os valores`}
                      </div>
                      <div className="h-1 rounded-full mt-2" style={{ background: '#1C2333', overflow: 'hidden' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: expected > 0 ? `${Math.min(100, (soma / expected) * 100).toFixed(1)}%` : '0%',
                            background: somaColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleSemExtrato(entry)}
                      disabled={reconcileMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                      style={{ color: '#64748B', border: '1px solid #1A2535' }}
                    >
                      <XCircle className="w-3.5 h-3.5" /> Sem extrato
                    </button>
                    <button
                      onClick={() => handleReconcile(entry)}
                      disabled={reconcileMut.isPending || !canConfirm}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                      style={isExact
                        ? { background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.4)' }
                        : { background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.35)' }
                      }
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {isExact ? 'Confirmar Conciliação' : canConfirm ? 'Confirmar mesmo assim' : 'Confirmar Conciliação'}
                    </button>
                  </div>
                </PremiumCard>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Report Tab ───
function ReportTab({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const { data: entries, isLoading } = useKitnetEntries(month);

  const grouped = (entries ?? []).reduce((acc: any, e: any) => {
    const code = e.kitnets?.residencial_code ?? "Outro";
    if (!acc[code]) acc[code] = [];
    acc[code].push(e);
    return acc;
  }, {});

  const grandTotal = (entries ?? []).reduce((s: number, e: any) => s + (e.total_liquid ?? 0), 0);

  const handleExportCSV = () => {
    if (!entries?.length) return;
    const rows = [["Kitnet","Inquilino","Aluguel Bruto","IPTU","CELESC","SEMASA","Taxa ADM","Total Líquido"]];
    entries.forEach((e: any) => {
      rows.push([
        e.kitnets?.code ?? "",
        e.kitnets?.tenant_name ?? "",
        String(e.rent_gross ?? 0),
        String(e.iptu_taxa ?? 0),
        String(e.celesc ?? 0),
        String(e.semasa ?? 0),
        String(e.adm_fee ?? 0),
        String(e.total_liquid ?? 0),
      ]);
    });
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-kitnets-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <MonthPicker value={month} onChange={v => setMonth(v)} className="w-44" />
        <GoldButton onClick={handleExportCSV} disabled={!entries?.length}><Download className="w-4 h-4 mr-1" />Exportar CSV</GoldButton>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded" />)}</div>
      ) : !entries?.length ? (
        <PremiumCard className="text-center py-12">
          <p className="text-muted-foreground">Nenhum dado em {formatMonth(month)}</p>
        </PremiumCard>
      ) : (
        Object.entries(grouped).map(([code, items]: [string, any]) => {
          const subtotal = items.reduce((s: number, e: any) => s + (e.total_liquid ?? 0), 0);
          return (
            <div key={code} className="space-y-2">
              <h3 className="font-display font-bold text-foreground">{code}</h3>
              <div className="rounded-xl overflow-hidden border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Unidade</TableHead>
                      <TableHead className="text-muted-foreground">Inquilino</TableHead>
                      <TableHead className="text-muted-foreground">Bruto</TableHead>
                      <TableHead className="text-muted-foreground">IPTU</TableHead>
                      <TableHead className="text-muted-foreground">CELESC</TableHead>
                      <TableHead className="text-muted-foreground">SEMASA</TableHead>
                      <TableHead className="text-muted-foreground">ADM</TableHead>
                      <TableHead className="text-muted-foreground">Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((e: any) => (
                      <TableRow key={e.id} className="border-border">
                        <TableCell className="font-mono text-foreground">{e.kitnets?.code}</TableCell>
                        <TableCell className="text-muted-foreground">{e.kitnets?.tenant_name ?? "—"}</TableCell>
                        <TableCell className="font-mono text-foreground">{formatCurrency(e.rent_gross ?? 0)}</TableCell>
                        <TableCell className="font-mono text-foreground">{formatCurrency(e.iptu_taxa ?? 0)}</TableCell>
                        <TableCell className="font-mono text-foreground">{formatCurrency(e.celesc ?? 0)}</TableCell>
                        <TableCell className="font-mono text-foreground">{formatCurrency(e.semasa ?? 0)}</TableCell>
                        <TableCell className="font-mono text-foreground">{formatCurrency(e.adm_fee ?? 0)}</TableCell>
                        <TableCell className="font-mono text-foreground font-medium">{formatCurrency(e.total_liquid ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="border-border bg-card">
                      <TableCell colSpan={7} className="text-right font-medium text-muted-foreground">Subtotal {code}</TableCell>
                      <TableCell className="font-mono font-bold text-foreground">{formatCurrency(subtotal)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          );
        })
      )}

      {entries?.length ? (
        <PremiumCard glowColor="hsl(43 52% 54%)" className="text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Geral</p>
          <p className="font-mono text-3xl font-bold mt-1" style={{ color: '#E8C97A' }}>{formatCurrency(grandTotal)}</p>
        </PremiumCard>
      ) : null}
    </div>
  );
}

// ─── Energia Solar Tab ───
function EnergiaTab({ month }: { month: string }) {
  const [complex, setComplex] = useState("RWT02");
  const { data: kitnets } = useKitnets();
  const { data: invoices } = useCelescInvoices(month);
  const { data: existingReadings } = useEnergyReadings(month, complex);
  const saveMut = useSaveEnergyReadings();
  const { toast } = useToast();

  const tariff = useMemo(() => {
    const inv = (invoices ?? []).find(i => i.residencial_code === complex);
    return inv?.tariff_per_kwh ?? 0;
  }, [invoices, complex]);

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
    return { previous, kwh, amount: kwh * tariff };
  };

  const totals = useMemo(() => {
    let totalCharged = 0;
    units.forEach(u => { totalCharged += calcRow(u.id).amount; });
    const invoicePaid = (invoices ?? []).find(i => i.residencial_code === complex)?.amount_paid ?? 0;
    return { totalCharged, invoicePaid, margin: totalCharged - invoicePaid };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, readings, invoices, complex, tariff]);

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const invoiceId = (invoices ?? []).find(i => i.residencial_code === complex)?.id;
      const toSave = units.map(u => {
        const current = Number(readings[u.id]) || 0;
        const previous = getPrevReading(u.id);
        const kwh = Math.max(0, current - previous);
        const amount = kwh * tariff;
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
        <div className="ml-auto">
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
          <p className="text-xs text-muted-foreground mt-1">Cadastre a fatura em Energia Solar → Faturas CELESC.</p>
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

      {tariff > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard label="Total Cobrado Inquilinos" value={totals.totalCharged} color="gold" />
          <KpiCard label="Fatura CELESC Paga" value={totals.invoicePaid} color="red" />
          <KpiCard label="Margem Solar" value={totals.margin} color="green" />
        </div>
      )}
    </div>
  );
}
