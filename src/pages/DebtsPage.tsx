import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/wt7/DatePicker";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import {
  useDebts,
  useDebtInstallments,
  useMarkInstallmentPaid,
  useUnmarkInstallment,
  useCreateInstallment,
  useDeleteInstallment,
  type DebtInstallment,
} from "@/hooks/useDebts";
import { Calendar, CheckCircle2, Clock, AlertTriangle, Trash2, Plus, RotateCcw } from "lucide-react";

const inputStyle = {
  background: "#0F1620",
  border: "1px solid #1A2535",
  color: "#F0F4F8",
} as const;

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DebtsPage() {
  const { data: debts = [], isLoading } = useDebts();
  const { data: allInstallments = [] } = useDebtInstallments(undefined, true);
  const [installmentsFor, setInstallmentsFor] = useState<any>(null);

  const installmentsByDebt = new Map<string, DebtInstallment[]>();
  for (const i of allInstallments) {
    const arr = installmentsByDebt.get(i.debt_id) ?? [];
    arr.push(i);
    installmentsByDebt.set(i.debt_id, arr);
  }

  const today = new Date();

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="font-display font-bold text-2xl" style={{ color: "#F0F4F8" }}>
          Dívidas
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#94A3B8" }}>
          Cronograma de pagamentos. Auto-vincula com extrato bancário quando débito bate por valor + data.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : debts.length === 0 ? (
        <p className="text-sm" style={{ color: "#94A3B8" }}>Nenhuma dívida ativa.</p>
      ) : (
        <div className="space-y-3">
          {debts.map((d) => {
            const insts = installmentsByDebt.get(d.id) ?? [];
            const hasSchedule = insts.length > 0;
            const paid = insts.filter((i) => i.paid_at);
            const pending = insts.filter((i) => !i.paid_at);
            const overdue = pending.filter((i) => new Date(i.due_date) < today);
            const nextDue = pending[0];

            return (
              <PremiumCard key={d.id} className="p-4 space-y-3">
                {/* Header */}
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold text-base" style={{ color: "#F0F4F8" }}>
                      {d.name}
                    </p>
                    {d.creditor && (
                      <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                        Credor: {d.creditor}
                      </p>
                    )}
                  </div>
                  {overdue.length > 0 && (
                    <WtBadge variant="red">{overdue.length} atrasada{overdue.length > 1 ? "s" : ""}</WtBadge>
                  )}
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg px-3 py-2" style={{ background: "rgba(244,63,94,0.05)" }}>
                    <p style={{ color: "#64748B" }}>Restante</p>
                    <p className="font-mono font-semibold mt-0.5" style={{ color: "#F87171" }}>
                      {formatCurrency(Number(d.remaining_amount ?? 0))}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ background: "#0F1620", border: "1px solid #1A2535" }}>
                    <p style={{ color: "#64748B" }}>Total contratado</p>
                    <p className="font-mono mt-0.5" style={{ color: "#CBD5E1" }}>
                      {formatCurrency(Number(d.total_amount ?? 0))}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ background: "#0F1620", border: "1px solid #1A2535" }}>
                    <p style={{ color: "#64748B" }}>Mensal</p>
                    <p className="font-mono mt-0.5" style={{ color: "#CBD5E1" }}>
                      {formatCurrency(Number(d.monthly_payment ?? 0))}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ background: "#0F1620", border: "1px solid #1A2535" }}>
                    <p style={{ color: "#64748B" }}>Próx. vencimento</p>
                    <p className="font-mono mt-0.5" style={{ color: "#E8C97A" }}>
                      {hasSchedule && nextDue
                        ? formatDate(nextDue.due_date)
                        : d.due_date
                          ? formatDate(d.due_date)
                          : "—"}
                    </p>
                  </div>
                </div>

                {/* Schedule preview ou aviso */}
                {hasSchedule ? (
                  <div className="rounded-lg p-3" style={{ background: "rgba(232,201,122,0.04)", border: "1px solid rgba(232,201,122,0.15)" }}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold" style={{ color: "#E8C97A" }}>
                        📅 Cronograma ({paid.length}/{insts.length} pagas)
                      </span>
                      <button
                        onClick={() => setInstallmentsFor(d)}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: "rgba(232,201,122,0.1)", color: "#E8C97A", border: "1px solid rgba(232,201,122,0.3)" }}
                      >
                        Gerenciar
                      </button>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {insts.slice(0, 12).map((i) => {
                        const isPaid = !!i.paid_at;
                        const isOverdue = !isPaid && new Date(i.due_date) < today;
                        return (
                          <div
                            key={i.id}
                            className="text-[10px] px-2 py-1 rounded flex items-center gap-1"
                            style={{
                              background: isPaid
                                ? "rgba(34,197,94,0.1)"
                                : isOverdue
                                  ? "rgba(244,63,94,0.1)"
                                  : "rgba(100,116,139,0.1)",
                              color: isPaid ? "#22C55E" : isOverdue ? "#F87171" : "#94A3B8",
                              border: `1px solid ${
                                isPaid ? "rgba(34,197,94,0.3)" : isOverdue ? "rgba(244,63,94,0.3)" : "rgba(100,116,139,0.2)"
                              }`,
                            }}
                          >
                            {isPaid ? "✓" : isOverdue ? "⚠" : "○"} #{i.sequence_number} {formatDate(i.due_date)}
                          </div>
                        );
                      })}
                      {insts.length > 12 && (
                        <div className="text-[10px] px-2 py-1" style={{ color: "#64748B" }}>
                          +{insts.length - 12} mais
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center px-3 py-2 rounded" style={{ background: "#0F1620", border: "1px dashed #1A2535" }}>
                    <span className="text-xs" style={{ color: "#64748B" }}>
                      Sem cronograma de parcelas. Naval deriva mensal de monthly_payment.
                    </span>
                    <button
                      onClick={() => setInstallmentsFor(d)}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: "rgba(232,201,122,0.1)", color: "#E8C97A", border: "1px solid rgba(232,201,122,0.3)" }}
                    >
                      + Cadastrar
                    </button>
                  </div>
                )}
              </PremiumCard>
            );
          })}
        </div>
      )}

      {installmentsFor && (
        <InstallmentsModal debt={installmentsFor} onClose={() => setInstallmentsFor(null)} />
      )}
    </div>
  );
}

// ─── Modal: gerenciar parcelas de uma debt ────────────────────────────────────

function InstallmentsModal({ debt, onClose }: { debt: any; onClose: () => void }) {
  const { data: installments = [] } = useDebtInstallments(debt.id);
  const markPaid = useMarkInstallmentPaid();
  const unmark = useUnmarkInstallment();
  const createIns = useCreateInstallment();
  const deleteIns = useDeleteInstallment();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    sequence_number: String((installments[installments.length - 1]?.sequence_number ?? 0) + 1),
    due_date: "",
    amount: "",
    notes: "",
  });

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({
    paid_at: new Date().toISOString().slice(0, 10),
    paid_amount: "",
  });

  const today = new Date();
  const totalPaid = installments.filter((i) => i.paid_at).reduce((s, i) => s + Number(i.paid_amount ?? i.amount ?? 0), 0);
  const totalPending = installments.filter((i) => !i.paid_at).reduce((s, i) => s + Number(i.amount ?? 0), 0);

  const onMarkPaid = async (i: DebtInstallment) => {
    if (!payForm.paid_at) {
      toast({ title: "Informe a data", variant: "destructive" });
      return;
    }
    const amt = parseFloat(payForm.paid_amount) || Number(i.amount);
    try {
      await markPaid.mutateAsync({
        id: i.id,
        paid_at: payForm.paid_at,
        paid_amount: amt,
      });
      toast({ title: `Parcela ${i.sequence_number} marcada como paga` });
      setPayingId(null);
      setPayForm({ paid_at: new Date().toISOString().slice(0, 10), paid_amount: "" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const onCreate = async () => {
    const seq = parseInt(createForm.sequence_number);
    const amt = parseFloat(createForm.amount);
    if (!seq || !amt || !createForm.due_date) {
      toast({ title: "Preencha sequência, data e valor", variant: "destructive" });
      return;
    }
    try {
      await createIns.mutateAsync({
        debt_id: debt.id,
        sequence_number: seq,
        due_date: createForm.due_date,
        amount: amt,
        notes: createForm.notes || null,
      });
      toast({ title: "Parcela criada" });
      setCreateForm({
        sequence_number: String(seq + 1),
        due_date: "",
        amount: "",
        notes: "",
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#F0F4F8" }}>📅 {debt.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg px-3 py-2" style={{ background: "rgba(34,197,94,0.05)" }}>
              <p style={{ color: "#64748B" }}>Pago</p>
              <p className="font-mono font-semibold mt-0.5" style={{ color: "#22C55E" }}>
                {formatCurrency(totalPaid)}
              </p>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: "rgba(244,63,94,0.05)" }}>
              <p style={{ color: "#64748B" }}>Pendente</p>
              <p className="font-mono font-semibold mt-0.5" style={{ color: "#F87171" }}>
                {formatCurrency(totalPending)}
              </p>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: "#0F1620", border: "1px solid #1A2535" }}>
              <p style={{ color: "#64748B" }}>Parcelas</p>
              <p className="font-mono mt-0.5" style={{ color: "#CBD5E1" }}>
                {installments.filter((i) => i.paid_at).length} / {installments.length}
              </p>
            </div>
          </div>

          {/* Lista de parcelas */}
          <div className="space-y-1">
            {installments.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "#64748B" }}>
                Nenhuma parcela cadastrada. Use o botão abaixo pra criar.
              </p>
            ) : (
              installments.map((i) => {
                const isPaid = !!i.paid_at;
                const isOverdue = !isPaid && new Date(i.due_date) < today;
                const isPaying = payingId === i.id;

                return (
                  <div
                    key={i.id}
                    className="rounded-lg p-3"
                    style={{
                      background: isPaid ? "rgba(34,197,94,0.04)" : isOverdue ? "rgba(244,63,94,0.04)" : "#0F1620",
                      border: `1px solid ${
                        isPaid ? "rgba(34,197,94,0.2)" : isOverdue ? "rgba(244,63,94,0.2)" : "#1A2535"
                      }`,
                    }}
                  >
                    <div className="flex justify-between items-center gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isPaid ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#22C55E" }} />
                        ) : isOverdue ? (
                          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#F87171" }} />
                        ) : (
                          <Clock className="w-4 h-4 shrink-0" style={{ color: "#94A3B8" }} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm" style={{ color: isPaid ? "#22C55E" : "#F0F4F8" }}>
                            #{i.sequence_number} · {formatDate(i.due_date)}
                            {isPaid && ` · paga em ${formatDate(i.paid_at!)}`}
                          </p>
                          {i.notes && <p className="text-[10px] truncate" style={{ color: "#64748B" }}>{i.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm" style={{ color: isPaid ? "#22C55E" : "#F0F4F8" }}>
                          {formatCurrency(Number(i.paid_amount ?? i.amount ?? 0))}
                        </span>
                        {isPaid ? (
                          <button
                            onClick={() => unmark.mutate(i.id)}
                            className="p-1 rounded hover:bg-amber-500/10"
                            title="Desfazer"
                          >
                            <RotateCcw className="w-3 h-3" style={{ color: "#F59E0B" }} />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setPayingId(i.id);
                              setPayForm({
                                paid_at: new Date().toISOString().slice(0, 10),
                                paid_amount: String(i.amount),
                              });
                            }}
                            className="text-[11px] px-2 py-1 rounded"
                            style={{
                              background: "rgba(34,197,94,0.1)",
                              color: "#22C55E",
                              border: "1px solid rgba(34,197,94,0.3)",
                            }}
                          >
                            Marcar paga
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`Excluir parcela #${i.sequence_number}?`)) deleteIns.mutate(i.id);
                          }}
                          className="p-1 rounded hover:bg-red-500/10"
                          title="Excluir"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Form pagar inline */}
                    {isPaying && (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: "#1A2535" }}>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <Label style={{ color: "#94A3B8" }}>Data do pagamento</Label>
                            <DatePicker
                              value={payForm.paid_at}
                              onChange={(v) => setPayForm({ ...payForm, paid_at: v })}
                              placeholder="Data"
                            />
                          </div>
                          <div>
                            <Label style={{ color: "#94A3B8" }}>Valor pago</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={payForm.paid_amount}
                              onChange={(e) => setPayForm({ ...payForm, paid_amount: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <GoldButton onClick={() => onMarkPaid(i)} disabled={markPaid.isPending}>
                            {markPaid.isPending ? "Salvando..." : "Confirmar pagamento"}
                          </GoldButton>
                          <button
                            onClick={() => setPayingId(null)}
                            className="px-3 py-2 rounded text-sm"
                            style={{ border: "1px solid #1A2535", color: "#94A3B8" }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Form criar nova parcela */}
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full py-2 rounded text-sm flex items-center justify-center gap-2"
              style={{ background: "rgba(232,201,122,0.05)", color: "#E8C97A", border: "1px dashed rgba(232,201,122,0.3)" }}
            >
              <Plus className="w-4 h-4" /> Adicionar parcela
            </button>
          ) : (
            <PremiumCard className="p-3 space-y-2">
              <p className="text-xs font-semibold" style={{ color: "#F0F4F8" }}>+ Nova parcela</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label style={{ color: "#94A3B8" }}>Seq #</Label>
                  <Input
                    type="number"
                    value={createForm.sequence_number}
                    onChange={(e) => setCreateForm({ ...createForm, sequence_number: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <Label style={{ color: "#94A3B8" }}>Vencimento</Label>
                  <DatePicker
                    value={createForm.due_date}
                    onChange={(v) => setCreateForm({ ...createForm, due_date: v })}
                    placeholder="Data"
                  />
                </div>
                <div>
                  <Label style={{ color: "#94A3B8" }}>Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={createForm.amount}
                    onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                    style={inputStyle}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div>
                <Label style={{ color: "#94A3B8" }}>Observações</Label>
                <Input
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  style={inputStyle}
                  placeholder="ex: cheque BB nº 1234"
                />
              </div>
              <div className="flex gap-2">
                <GoldButton onClick={onCreate} disabled={createIns.isPending}>
                  {createIns.isPending ? "Salvando..." : "Criar"}
                </GoldButton>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-2 rounded text-sm"
                  style={{ border: "1px solid #1A2535", color: "#94A3B8" }}
                >
                  Cancelar
                </button>
              </div>
            </PremiumCard>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
