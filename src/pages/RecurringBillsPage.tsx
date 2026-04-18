import { useState, useEffect, useMemo } from "react";
import { useCategories } from "@/hooks/useCategories";
import { CalendarClock, Plus, Pencil, Trash2, Clock, AlertTriangle, ChevronLeft, ChevronRight, Link2, Unlink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, getCurrentMonth, formatMonth } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import {
  useRecurringBills,
  useCreateRecurringBill,
  useUpdateRecurringBill,
  useDeleteRecurringBill,
  useBillInstances,
  useBillsSummary,
  useLinkTransactionManually,
  useUnlinkTransactionManually,
  useMonthDebits,
  useManualMatchesForMonth,
  type RecurringBill,
  type BillInstance,
} from "@/hooks/useRecurringBills";
import { useQueryClient } from "@tanstack/react-query";

const inputStyle = { background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" };

// Slug helper — mesmo padrão usado em ExpensesPage
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
   .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function navigateMonth(current: string, delta: number): string {
  const [y, m] = current.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Confirm delete ─────────────────────────────────────────────────────────
function ConfirmDelete({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#F0F4F8" }}>Excluir "{name}"?</DialogTitle>
        </DialogHeader>
        <p className="text-sm" style={{ color: "#94A3B8" }}>Também excluirá as instâncias mensais vinculadas.</p>
        <DialogFooter className="gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ border: "1px solid #1A2535", color: "#94A3B8" }}>Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", color: "#F43F5E" }}>Excluir</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function RecurringBillsPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const { toast } = useToast();

  // Categorias dinâmicas (mesma fonte que /expenses)
  const { data: categories = [] } = useCategories("despesa");
  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string; emoji: string }[] = [];
    (categories as any[]).forEach((c) => {
      const value = slugify(c.name);
      if (seen.has(value)) return;
      seen.add(value);
      opts.push({ value, label: c.name, emoji: c.emoji ?? "" });
    });
    return opts;
  }, [categories]);
  const CAT_LABELS = useMemo(
    () => Object.fromEntries(categoryOptions.map((o) => [o.value, o.label])) as Record<string, string>,
    [categoryOptions],
  );

  // Data
  const { data: bills, isLoading: billsLoading } = useRecurringBills();
  const { data: instances, isLoading: instancesLoading } = useBillInstances(month);
  const { data: summary } = useBillsSummary(month);
  const createBill = useCreateRecurringBill();
  const updateBill = useUpdateRecurringBill();
  const deleteBill = useDeleteRecurringBill();
  const queryClient = useQueryClient();

  // ─── Bill form state ────────────────────────────────────────────────────
  const emptyForm = { name: "", alias: "", category: "outros", amount: "", due_day: "", is_fixed: "true", notes: "" };
  const [formOpen, setFormOpen] = useState(false);
  const [editBill, setEditBill] = useState<RecurringBill | null>(null);
  const [delBill, setDelBill] = useState<RecurringBill | null>(null);
  const [form, setForm] = useState(emptyForm);

  // ─── Manual Match state ─────────────────────────────────────────────────
  const [linkBill, setLinkBill] = useState<RecurringBill | null>(null);
  const { data: manualMatches } = useManualMatchesForMonth(month);
  const linkTx = useLinkTransactionManually();
  const unlinkTx = useUnlinkTransactionManually();

  const handleCreate = async () => {
    if (!form.name || !form.due_day) return;
    try {
      await createBill.mutateAsync({
        name: form.name,
        alias: form.alias?.trim() || null,
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        due_day: parseInt(form.due_day) || 1,
        is_fixed: form.is_fixed === "true",
        notes: form.notes || null,
      } as any);
      toast({ title: "Despesa recorrente criada!" });
      setFormOpen(false);
      setForm(emptyForm);
    } catch {
      toast({ title: "Erro ao criar", variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    if (!editBill) return;
    try {
      await updateBill.mutateAsync({
        id: editBill.id,
        name: form.name,
        alias: form.alias?.trim() || null,
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        due_day: parseInt(form.due_day) || 1,
        is_fixed: form.is_fixed === "true",
        notes: form.notes || null,
      } as any);
      toast({ title: "Despesa atualizada!" });
      setEditBill(null);
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!delBill) return;
    try {
      await deleteBill.mutateAsync(delBill.id);
      toast({ title: "Despesa excluída" });
      setDelBill(null);
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["bill_instances", month] });
    queryClient.invalidateQueries({ queryKey: ["bills_summary", month] });
    toast({ title: "↻ Atualizado a partir do extrato" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl" style={{ color: "#F0F4F8" }}>
          <CalendarClock className="inline w-6 h-6 mr-2" style={{ color: "#C9A84C" }} />
          Despesas Recorrentes
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "#C9A84C40", color: "#E8C97A" }}
            title="Recarregar status a partir do extrato"
          >
            ↻ Atualizar
          </button>
          <button onClick={() => setMonth((m) => navigateMonth(m, -1))} className="text-wt-text-muted hover:text-wt-text-secondary">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-display font-bold text-lg" style={{ color: "#F0F4F8" }}>{formatMonth(month)}</span>
          <button onClick={() => setMonth((m) => navigateMonth(m, 1))} className="text-wt-text-muted hover:text-wt-text-secondary">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          label="Orçado"
          value={summary?.totalExpected ?? 0}
          color="gold"
          tooltip="Soma do que você esperava gastar (valor cadastrado em cada card)"
        />
        <KpiCard
          label="Realizado"
          value={summary?.totalPaid ?? 0}
          color="green"
          tooltip="Soma efetivamente debitada nas contas (valor real do extrato)"
        />
        <KpiCard
          label={(summary?.totalDelta ?? 0) < 0 ? "Economia" : "Excesso"}
          value={Math.abs(summary?.totalDelta ?? 0)}
          color={(summary?.totalDelta ?? 0) <= 0 ? "green" : "red"}
          tooltip={
            (summary?.totalDelta ?? 0) === 0
              ? "Tudo saiu exato como orçado"
              : (summary?.totalDelta ?? 0) < 0
              ? "Gastou menos que o orçado (bom)"
              : "Gastou mais que o orçado (atenção)"
          }
        />
        <KpiCard
          label="A Pagar"
          value={summary?.totalPending ?? 0}
          color="red"
          tooltip={
            (summary?.overdueCount ?? 0) > 0
              ? `${summary?.overdueCount} vencido${(summary?.overdueCount ?? 0) > 1 ? "s" : ""}: ${formatCurrency(summary?.overdueAmount ?? 0)}`
              : "Nenhum vencido"
          }
        />
        <KpiCard
          label="Vencidos"
          value={summary?.overdueCount ?? 0}
          color="red"
          formatAs="number"
          tooltip={summary?.overdueAmount ? `Total: ${formatCurrency(summary.overdueAmount)}` : "Nenhum"}
        />
      </div>

      {/* Próximos 7 dias alert */}
      {(summary?.upcoming7dCount ?? 0) > 0 && (
        <div
          className="flex items-center gap-3 px-5 py-3 rounded-xl"
          style={{ background: "rgba(232,201,122,0.08)", border: "1px solid rgba(232,201,122,0.35)" }}
        >
          <AlertTriangle className="w-5 h-5" style={{ color: "#E8C97A" }} />
          <span className="text-sm" style={{ color: "#E8C97A" }}>
            <strong>{summary!.upcoming7dCount}</strong> vencimento{summary!.upcoming7dCount > 1 ? "s" : ""} nos próximos 7 dias — total{" "}
            <strong>{formatCurrency(summary!.upcoming7dAmount)}</strong>
          </span>
        </div>
      )}

      <Tabs defaultValue="calendario">
        <TabsList style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
          <TabsTrigger value="calendario">Calendário do Mês</TabsTrigger>
          <TabsTrigger value="cadastro">Despesas Cadastradas</TabsTrigger>
        </TabsList>

        {/* ─── ABA: CALENDÁRIO DO MÊS ─── */}
        <TabsContent value="calendario" className="space-y-4">
          {instancesLoading ? (
            <Skeleton className="h-32 rounded-2xl" />
          ) : !instances?.length ? (
            <PremiumCard>
              <p className="text-center py-8" style={{ color: "#94A3B8" }}>
                Nenhuma despesa recorrente para {formatMonth(month)}.
                <br />
                <span className="text-xs">Cadastre despesas na aba "Despesas Cadastradas".</span>
              </p>
            </PremiumCard>
          ) : (
            <div className="space-y-2">
              {instances.map((inst) => {
                const bill = inst.recurring_bill as any as RecurringBill | undefined;
                const isOverdue = inst.status === "pending" && inst.due_date < today;
                const isPaid = inst.status === "paid";
                const dueDay = inst.due_date.split("-")[2];

                return (
                  <div
                    key={inst.id}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all"
                    style={{
                      background: isPaid
                        ? "rgba(16,185,129,0.04)"
                        : isOverdue
                        ? "rgba(244,63,94,0.06)"
                        : "#0D1318",
                      border: `1px solid ${isPaid ? "rgba(16,185,129,0.2)" : isOverdue ? "rgba(244,63,94,0.3)" : "#1A2535"}`,
                    }}
                  >
                    {/* Dia */}
                    <div
                      className="w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0"
                      style={{
                        background: isPaid
                          ? "rgba(16,185,129,0.1)"
                          : isOverdue
                          ? "rgba(244,63,94,0.1)"
                          : "rgba(232,201,122,0.08)",
                      }}
                    >
                      <span className="font-mono font-bold text-lg" style={{ color: isPaid ? "#10B981" : isOverdue ? "#F43F5E" : "#E8C97A" }}>
                        {dueDay}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-display font-bold text-sm truncate" style={{ color: "#F0F4F8" }}>
                          {bill?.alias || bill?.name || "—"}
                        </p>
                        {bill?.auto_promoted && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.15)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.3)" }}>
                            auto
                          </span>
                        )}
                        {bill && manualMatches?.[bill.id] && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(232,201,122,0.15)", color: "#E8C97A", border: "1px solid rgba(232,201,122,0.3)" }}>
                            manual
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: "#64748B" }}>
                        {CAT_LABELS[bill?.category ?? ""] ?? bill?.category ?? ""}
                        {bill?.is_fixed ? " · Fixo" : " · Variável"}
                      </p>
                    </div>

                    {/* Valor */}
                    <div className="text-right">
                      {(() => {
                        const expected = inst.expected_amount;
                        const actual = inst.actual_amount;
                        const hasDiff = isPaid && actual != null && Math.abs(actual - expected) >= 0.01;
                        const diff = hasDiff ? (actual as number) - expected : 0;
                        const diffPct = hasDiff && expected > 0 ? (diff / expected) * 100 : 0;

                        if (hasDiff) {
                          return (
                            <>
                              <p className="font-mono font-bold text-sm" style={{ color: "#10B981" }}>
                                {formatCurrency(actual as number)}
                              </p>
                              <p className="text-[10px] font-mono" style={{ color: "#64748B" }}>
                                esperado: <span className="line-through">{formatCurrency(expected)}</span>
                              </p>
                              <p
                                className="text-[10px] font-mono font-semibold"
                                style={{ color: diff < 0 ? "#10B981" : "#EF4444" }}
                              >
                                {diff > 0 ? "+" : ""}{formatCurrency(diff)} ({diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%)
                              </p>
                            </>
                          );
                        }

                        return (
                          <>
                            <p className="font-mono font-bold text-sm" style={{ color: isPaid ? "#10B981" : "#F0F4F8" }}>
                              {formatCurrency(isPaid ? actual ?? expected : expected)}
                            </p>
                            {isPaid && inst.paid_at && (
                              <p className="text-[10px]" style={{ color: "#4A5568" }}>
                                Pago {inst.paid_at.split("-")[2]}/{inst.paid_at.split("-")[1]}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* Status + ações manuais */}
                    <div className="shrink-0 flex items-center gap-2">
                      {isPaid ? (
                        <WtBadge variant="green">Pago</WtBadge>
                      ) : isOverdue ? (
                        <WtBadge variant="red">Atrasado</WtBadge>
                      ) : (
                        <WtBadge variant="gold">A pagar</WtBadge>
                      )}
                      {bill && manualMatches?.[bill.id] ? (
                        <button
                          title="Desvincular transação manual"
                          className="p-1.5 rounded hover:bg-violet-500/10 transition"
                          style={{ color: "#A78BFA" }}
                          onClick={() =>
                            unlinkTx.mutate({ billId: bill.id, referenceMonth: month })
                          }
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      ) : bill && !isPaid ? (
                        <button
                          title="Vincular transação manualmente"
                          className="p-1.5 rounded hover:bg-amber-500/10 transition"
                          style={{ color: "#E8C97A" }}
                          onClick={() => setLinkBill(bill)}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── ABA: DESPESAS CADASTRADAS ─── */}
        <TabsContent value="cadastro" className="space-y-4">
          <div className="flex justify-end">
            <GoldButton onClick={() => { setForm(emptyForm); setFormOpen(true); }}>
              <Plus className="w-4 h-4" /> Nova Despesa Recorrente
            </GoldButton>
          </div>

          {billsLoading ? (
            <Skeleton className="h-32 rounded-2xl" />
          ) : !bills?.length ? (
            <PremiumCard>
              <p className="text-center py-8" style={{ color: "#94A3B8" }}>Nenhuma despesa recorrente cadastrada</p>
            </PremiumCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bills.map((b) => (
                <PremiumCard key={b.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold" style={{ color: "#F0F4F8" }}>{b.alias || b.name}</p>
                      {b.alias && (
                        <p className="text-[10px] italic" style={{ color: "#4A5568" }}>extrato: {b.name}</p>
                      )}
                      <p className="text-xs" style={{ color: "#94A3B8" }}>
                        Dia {b.due_day} · {CAT_LABELS[b.category ?? ""] ?? b.category}
                        {b.auto_promoted && <span style={{ color: "#A78BFA" }}> · Auto-promovido</span>}
                      </p>
                    </div>
                    <WtBadge variant={b.active ? (b.is_fixed ? "gold" : "green") : "red"}>
                      {b.active ? (b.is_fixed ? "Fixo" : "Variável") : "Inativo"}
                    </WtBadge>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setForm({
                            name: b.name,
                            alias: b.alias ?? "",
                            category: b.category ?? "outros",
                            amount: String(b.amount),
                            due_day: String(b.due_day),
                            is_fixed: String(b.is_fixed),
                            notes: b.notes ?? "",
                          });
                          setEditBill(b);
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/5"
                        style={{ color: "#E8C97A" }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDelBill(b)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10"
                        style={{ color: "#F43F5E" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="font-mono text-xl" style={{ color: "#E8C97A" }}>{formatCurrency(b.amount)}</p>
                  {b.notes && <p className="text-xs" style={{ color: "#4A5568" }}>{b.notes}</p>}
                </PremiumCard>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── DIALOG CRIAR/EDITAR ─── */}
      {(formOpen || !!editBill) && (
        <Dialog open onOpenChange={(o) => { if (!o) { setFormOpen(false); setEditBill(null); } }}>
          <DialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
            <DialogHeader>
              <DialogTitle style={{ color: "#F0F4F8" }}>{editBill ? "Editar Despesa" : "Nova Despesa Recorrente"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label style={{ color: "#94A3B8" }}>Nome (como aparece no extrato)</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="ex: PJBank" />
                <p className="text-[10px] mt-1" style={{ color: "#4A5568" }}>Usado pra casar com transações do banco. Use palavra-chave que aparece no extrato.</p>
              </div>
              <div>
                <Label style={{ color: "#94A3B8" }}>Apelido (opcional)</Label>
                <Input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} style={inputStyle} placeholder="ex: Aluguel Apt Aloha" />
                <p className="text-[10px] mt-1" style={{ color: "#4A5568" }}>Nome exibido pra você. Se vazio, mostra o nome real.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label style={{ color: "#94A3B8" }}>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                    <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.emoji ? `${c.emoji} ` : ""}{c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label style={{ color: "#94A3B8" }}>Tipo</Label>
                  <Select value={form.is_fixed} onValueChange={(v) => setForm({ ...form, is_fixed: v })}>
                    <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                    <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                      <SelectItem value="true">Fixo</SelectItem>
                      <SelectItem value="false">Variável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label style={{ color: "#E8C97A" }}>Valor Esperado (R$)</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={{ ...inputStyle, borderColor: "rgba(232,201,122,0.3)" }} placeholder="1200.00" />
                </div>
                <div>
                  <Label style={{ color: "#E8C97A" }}>Dia do Vencimento</Label>
                  <Input type="number" min={1} max={31} value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} style={{ ...inputStyle, borderColor: "rgba(232,201,122,0.3)" }} placeholder="10" />
                </div>
              </div>
              <div>
                <Label style={{ color: "#94A3B8" }}>Observações</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={inputStyle} placeholder="Detalhes opcionais" />
              </div>
            </div>
            <DialogFooter>
              <GoldButton onClick={editBill ? handleUpdate : handleCreate}>
                {editBill ? "Salvar" : "Cadastrar"}
              </GoldButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm delete */}
      {delBill && <ConfirmDelete name={delBill.name} onConfirm={handleDelete} onCancel={() => setDelBill(null)} />}

      {/* Link transação manual */}
      {linkBill && (
        <LinkTransactionDialog
          bill={linkBill}
          month={month}
          onCancel={() => setLinkBill(null)}
          onConfirm={async (txId) => {
            await linkTx.mutateAsync({ billId: linkBill.id, referenceMonth: month, transactionId: txId });
            toast({ title: "Transação vinculada", description: `${linkBill.alias || linkBill.name}` });
            setLinkBill(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Dialog: vincular transação manual ────────────────────────────────────
function LinkTransactionDialog({
  bill,
  month,
  onCancel,
  onConfirm,
}: {
  bill: RecurringBill;
  month: string;
  onCancel: () => void;
  onConfirm: (txId: string) => void;
}) {
  const { data: debits, isLoading } = useMonthDebits(month);
  const { data: instances } = useBillInstances(month);
  const { data: manualMatches } = useManualMatchesForMonth(month);
  const { data: allBills } = useRecurringBills();
  const [search, setSearch] = useState("");

  // Mapa tx_id → { billId, billName, isManual } das txs já usadas em OUTROS bills
  const txUsage = useMemo(() => {
    const map: Record<string, { billId: string; billName: string; isManual: boolean }> = {};
    // 1. Manual matches (exceto deste bill)
    Object.entries(manualMatches || {}).forEach(([billId, txId]) => {
      if (billId === bill.id) return;
      const b = allBills?.find((x) => x.id === billId);
      map[txId as string] = {
        billId,
        billName: b?.alias || b?.name || "desconhecido",
        isManual: true,
      };
    });
    // 2. Auto-matches vindos de deriveInstances (exceto deste bill)
    instances?.forEach((inst) => {
      if (inst.recurring_bill_id === bill.id) return;
      if (!inst.matched_transaction_id) return;
      if (map[inst.matched_transaction_id]) return; // já é manual
      const b = allBills?.find((x) => x.id === inst.recurring_bill_id);
      map[inst.matched_transaction_id] = {
        billId: inst.recurring_bill_id,
        billName: b?.alias || b?.name || "desconhecido",
        isManual: false,
      };
    });
    return map;
  }, [manualMatches, instances, allBills, bill.id]);

  const filtered = useMemo(() => {
    if (!debits) return [];
    const q = search.trim().toLowerCase();
    const expected = Number(bill.amount);
    return debits
      .filter((t: any) => {
        if (!q) return true;
        return (t.description || "").toLowerCase().includes(q);
      })
      .map((t: any) => ({
        ...t,
        _dev: expected > 0 ? Math.abs(Math.abs(Number(t.amount)) - expected) / expected : 999,
        _used: txUsage[t.id],
      }))
      .sort((a: any, b: any) => {
        // Não-usadas primeiro, depois por proximidade de valor
        if (!!a._used !== !!b._used) return a._used ? 1 : -1;
        return a._dev - b._dev;
      });
  }, [debits, search, bill.amount, txUsage]);

  const handleClick = (tx: any) => {
    const used = txUsage[tx.id];
    if (used) {
      const kind = used.isManual ? "manualmente" : "automaticamente";
      const ok = window.confirm(
        `⚠️ Essa transação já está vinculada ${kind} a "${used.billName}".\n\n` +
          `Se continuar, ${used.isManual ? "o vínculo anterior será substituído" : "o matcher automático vai buscar outra tx para " + used.billName}.\n\n` +
          `Deseja continuar?`
      );
      if (!ok) return;
    }
    onConfirm(tx.id);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl" style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#E8C97A" }}>
            Vincular transação — {bill.alias || bill.name}
          </DialogTitle>
          <p className="text-xs" style={{ color: "#64748B" }}>
            Esperado: {formatCurrency(Number(bill.amount))} · {formatMonth(month)}
          </p>
        </DialogHeader>

        <Input
          placeholder="Buscar por descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
          className="mb-2"
        />

        {isLoading ? (
          <Skeleton className="h-40 rounded" />
        ) : !filtered.length ? (
          <p className="text-center py-8 text-sm" style={{ color: "#64748B" }}>
            Nenhuma transação encontrada
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-1.5">
            {filtered.slice(0, 50).map((t: any) => {
              const expected = Number(bill.amount);
              const devPct = expected > 0 ? (t._dev * 100).toFixed(1) : "—";
              const devColor = t._dev <= 0.1 ? "#10B981" : t._dev <= 0.5 ? "#E8C97A" : "#64748B";
              const used = t._used as { billName: string; isManual: boolean } | undefined;
              return (
                <button
                  key={t.id}
                  onClick={() => handleClick(t)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition"
                  style={{
                    background: used ? "rgba(244,63,94,0.04)" : "#080C10",
                    border: `1px solid ${used ? "rgba(244,63,94,0.25)" : "#1A2535"}`,
                    opacity: used ? 0.7 : 1,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs truncate" style={{ color: "#F0F4F8" }}>
                        {t.description}
                      </p>
                      {used && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            background: "rgba(244,63,94,0.15)",
                            color: "#F87171",
                            border: "1px solid rgba(244,63,94,0.3)",
                          }}
                        >
                          já em: {used.billName}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px]" style={{ color: "#64748B" }}>
                      {t.date}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-bold" style={{ color: "#F0F4F8" }}>
                      {formatCurrency(Math.abs(Number(t.amount)))}
                    </p>
                    <p className="text-[10px] font-mono" style={{ color: devColor }}>
                      Δ {devPct}%
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded text-sm"
            style={{ background: "#1A2535", color: "#F0F4F8" }}
          >
            Cancelar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
