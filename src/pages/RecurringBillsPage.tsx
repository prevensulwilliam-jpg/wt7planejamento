import { useState, useEffect } from "react";
import { CalendarClock, Plus, Pencil, Trash2, Check, Clock, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
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
  useGenerateMonthInstances,
  useMarkBillPaid,
  useBillsSummary,
  type RecurringBill,
  type BillInstance,
} from "@/hooks/useRecurringBills";

const inputStyle = { background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" };

const CATEGORIES = [
  "moradia", "energia", "agua", "internet", "telefone", "seguro",
  "consorcio", "financiamento", "educacao", "saude", "personal",
  "alimentacao", "transporte", "lazer", "assinatura", "impostos", "outros",
];

const CAT_LABELS: Record<string, string> = {
  moradia: "Moradia", energia: "Energia", agua: "Água/SEMASA", internet: "Internet",
  telefone: "Telefone", seguro: "Seguro", consorcio: "Consórcio",
  financiamento: "Financiamento", educacao: "Educação", saude: "Saúde",
  personal: "Personal/Academia", alimentacao: "Alimentação", transporte: "Transporte",
  lazer: "Lazer", assinatura: "Assinatura", impostos: "Impostos", outros: "Outros",
};

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

  // Data
  const { data: bills, isLoading: billsLoading } = useRecurringBills();
  const { data: instances, isLoading: instancesLoading } = useBillInstances(month);
  const { data: summary } = useBillsSummary(month);
  const generateInstances = useGenerateMonthInstances();
  const createBill = useCreateRecurringBill();
  const updateBill = useUpdateRecurringBill();
  const deleteBill = useDeleteRecurringBill();
  const markPaid = useMarkBillPaid();

  // Auto-generate instances when month changes
  useEffect(() => {
    generateInstances.mutate(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // ─── Bill form state ────────────────────────────────────────────────────
  const emptyForm = { name: "", category: "outros", amount: "", due_day: "", is_fixed: "true", notes: "" };
  const [formOpen, setFormOpen] = useState(false);
  const [editBill, setEditBill] = useState<RecurringBill | null>(null);
  const [delBill, setDelBill] = useState<RecurringBill | null>(null);
  const [form, setForm] = useState(emptyForm);

  const handleCreate = async () => {
    if (!form.name || !form.due_day) return;
    try {
      await createBill.mutateAsync({
        name: form.name,
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        due_day: parseInt(form.due_day) || 1,
        is_fixed: form.is_fixed === "true",
        notes: form.notes || null,
      } as any);
      toast({ title: "Despesa recorrente criada!" });
      setFormOpen(false);
      setForm(emptyForm);
      // Re-generate instances para incluir a nova
      generateInstances.mutate(month);
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

  const handleMarkPaid = async (inst: BillInstance) => {
    try {
      await markPaid.mutateAsync({ id: inst.id, actual_amount: inst.expected_amount });
      toast({ title: `✅ ${(inst.recurring_bill as any)?.name ?? "Conta"} paga!` });
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl" style={{ color: "#F0F4F8" }}>
          <CalendarClock className="inline w-6 h-6 mr-2" style={{ color: "#C9A84C" }} />
          Despesas Recorrentes
        </h1>
        <div className="flex items-center gap-3">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Comprometido" value={summary?.totalExpected ?? 0} color="gold" />
        <KpiCard label="Pago" value={summary?.totalPaid ?? 0} color="green" />
        <KpiCard label="A Pagar" value={summary?.totalPending ?? 0} color="red" />
        <KpiCard
          label="Vencidos"
          value={summary?.overdueCount ?? 0}
          color="red"
          formatAs="number"
          tooltip={summary?.overdueAmount ? `Total: ${formatCurrency(summary.overdueAmount)}` : undefined}
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
                          {bill?.name ?? "—"}
                        </p>
                        {bill?.auto_promoted && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.15)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.3)" }}>
                            auto
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
                      <p className="font-mono font-bold text-sm" style={{ color: isPaid ? "#10B981" : "#F0F4F8" }}>
                        {formatCurrency(isPaid ? inst.actual_amount ?? inst.expected_amount : inst.expected_amount)}
                      </p>
                      {isPaid && inst.paid_at && (
                        <p className="text-[10px]" style={{ color: "#4A5568" }}>
                          Pago {inst.paid_at.split("-")[2]}/{inst.paid_at.split("-")[1]}
                        </p>
                      )}
                    </div>

                    {/* Status / Action */}
                    <div className="shrink-0">
                      {isPaid ? (
                        <WtBadge variant="green">Pago</WtBadge>
                      ) : inst.status === "skipped" ? (
                        <WtBadge variant="gold">Pulado</WtBadge>
                      ) : (
                        <button
                          onClick={() => handleMarkPaid(inst)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110"
                          style={{
                            background: isOverdue ? "rgba(244,63,94,0.15)" : "rgba(16,185,129,0.15)",
                            color: isOverdue ? "#F43F5E" : "#10B981",
                            border: `1px solid ${isOverdue ? "rgba(244,63,94,0.3)" : "rgba(16,185,129,0.3)"}`,
                          }}
                        >
                          <Check className="w-3 h-3" />
                          {isOverdue ? "Pagar (atrasado)" : "Pagar"}
                        </button>
                      )}
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
                      <p className="font-display font-bold" style={{ color: "#F0F4F8" }}>{b.name}</p>
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
                <Label style={{ color: "#94A3B8" }}>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="ex: CELESC RWT02" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label style={{ color: "#94A3B8" }}>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                    <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>
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
    </div>
  );
}
