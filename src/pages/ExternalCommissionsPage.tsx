import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { DatePicker } from "@/components/wt7/DatePicker";
import { GoldButton } from "@/components/wt7/GoldButton";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOtherCommissions, useOtherCommissionsSummary,
  useCreateOtherCommission, useDeleteOtherCommission,
  useUpdateOtherCommission, useToggleInstallmentPaid,
  type OtherCommission, type Installment,
} from "@/hooks/useOtherCommissions";
import { formatCurrency, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Pencil, ChevronDown, ChevronRight, Plus, X, Check } from "lucide-react";

const sourceOptions = [
  { value: "Brava Comex", label: "Brava Comex" },
  { value: "Solar Q7", label: "Solar Q7" },
  { value: "Olga", label: "Projeto Olga" },
  { value: "Imobiliário", label: "Imobiliário" },
  { value: "Consultoria", label: "Consultoria" },
  { value: "Outro", label: "Outro" },
];

const inputStyle = { background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' } as const;

// ───────── helpers ─────────
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
}
function displayBR(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function generateInstallments(total: number, count: number, firstDate: string) {
  if (count <= 0 || !firstDate) return [];
  const each = Math.round((total / count) * 100) / 100;
  const arr = Array.from({ length: count }, (_, i) => ({
    due_date: addMonths(firstDate, i),
    amount: each,
  }));
  // ajusta arredondamento na última parcela
  const sum = arr.reduce((s, p) => s + p.amount, 0);
  const diff = Math.round((total - sum) * 100) / 100;
  if (arr.length > 0) arr[arr.length - 1].amount = Math.round((arr[arr.length - 1].amount + diff) * 100) / 100;
  return arr;
}

// ─────────────────────────────────────────────────────────
export default function ExternalCommissionsPage() {
  const [month, setMonth] = useState(getCurrentMonth());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
          Comissões Externas
        </h1>
        <MonthPicker value={month} onChange={v => setMonth(v)} className="w-44" />
      </div>
      <p className="text-sm" style={{ color: '#94A3B8' }}>
        Comissões de negociações fora da Prevensul — Brava Comex, Solar, Imobiliário, Consultoria, etc.
      </p>
      <KPIs month={month} />
      <FormSection month={month} />
      <HistorySection month={month} />
    </div>
  );
}

// ─────────── KPIs ───────────
function KPIs({ month }: { month: string }) {
  const { totalCommission, totalReceived, totalRecords, isLoading } = useOtherCommissionsSummary(month);
  if (isLoading) return <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KpiCard label="Comissões Geradas" value={totalCommission} color="gold" compact />
      <KpiCard label="Comissões Recebidas" value={totalReceived} color="green" compact />
      <KpiCard label="Registros" value={totalRecords} color="cyan" formatAs="number" />
    </div>
  );
}

// ─────────── Form de criação ───────────
function FormSection({ month }: { month: string }) {
  const { toast } = useToast();
  const createMut = useCreateOtherCommission();

  const [form, setForm] = useState({
    description: "", source: "", amount: "", notes: "",
    issued_at: todayISO(),
    mode: "single" as "single" | "installments",
    installments_count: "3",
    first_due: todayISO(),
  });
  const [installments, setInstallments] = useState<Array<{ due_date: string; amount: number }>>([]);

  const amount = parseFloat(form.amount) || 0;
  const commissionValue = Math.round(amount * 100) / 100;

  // regenerar parcelas quando o usuário mexe nos inputs principais
  const regen = (next: Partial<typeof form>) => {
    const merged = { ...form, ...next };
    const cv = parseFloat(merged.amount) || 0;
    if (merged.mode === "single") {
      setInstallments([{ due_date: merged.first_due, amount: Math.round(cv * 100) / 100 }]);
    } else {
      const n = Math.max(1, parseInt(merged.installments_count) || 1);
      setInstallments(generateInstallments(cv, n, merged.first_due));
    }
  };

  useMemo(() => {
    regen({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.amount, form.mode, form.installments_count, form.first_due]);

  const updateInstallment = (idx: number, patch: Partial<{ due_date: string; amount: number }>) => {
    setInstallments(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  };

  const handleSubmit = async () => {
    if (!form.description || !form.amount) {
      toast({ title: "Preencha descrição e valor", variant: "destructive" }); return;
    }
    if (!form.issued_at) {
      toast({ title: "Informe a data de lançamento", variant: "destructive" }); return;
    }
    if (installments.length === 0) {
      toast({ title: "Configure ao menos 1 parcela", variant: "destructive" }); return;
    }
    try {
      const { data: { user } } = await (await import("@/integrations/supabase/client")).supabase.auth.getUser();
      await createMut.mutateAsync({
        description: form.description,
        source: form.source || null,
        reference_month: month,
        amount,
        commission_rate: 1,
        commission_value: commissionValue,
        notes: form.notes || null,
        created_by: user?.id ?? null,
        issued_at: form.issued_at,
        installments,
      });
      toast({ title: "Comissão registrada!" });
      setForm({
        description: "", source: "", amount: "", notes: "",
        issued_at: todayISO(), mode: "single", installments_count: "3", first_due: todayISO(),
      });
      setInstallments([]);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <PremiumCard>
      <h2 className="font-display font-semibold text-lg mb-4" style={{ color: '#F0F4F8' }}>Registrar Comissão</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Descrição *</label>
          <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inputStyle} placeholder="Ex: Comissão venda solar residencial" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Origem</label>
          <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
            <SelectTrigger style={inputStyle}><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>{sourceOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Valor (R$) *</label>
          <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} placeholder="0,00" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Data de lançamento *</label>
          <DatePicker value={form.issued_at} onChange={v => setForm(p => ({ ...p, issued_at: v }))} />
        </div>

        <div className="md:col-span-3">
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Observações</label>
          <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} rows={2} />
        </div>
      </div>

      {/* Bloco de parcelamento */}
      <div className="mt-4 rounded-xl p-4" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
        <div className="flex flex-wrap items-end gap-4 mb-3">
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Forma de pagamento</label>
            <Select value={form.mode} onValueChange={v => setForm(p => ({ ...p, mode: v as any }))}>
              <SelectTrigger style={{ ...inputStyle, width: 180 }}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">À vista</SelectItem>
                <SelectItem value="installments">Parcelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.mode === "installments" && (
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Nº de parcelas</label>
              <Input type="number" min={1} value={form.installments_count} onChange={e => setForm(p => ({ ...p, installments_count: e.target.value }))} style={{ ...inputStyle, width: 100 }} />
            </div>
          )}
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>
              {form.mode === "single" ? "Data prevista" : "Data 1ª parcela"}
            </label>
            <div style={{ width: 200 }}>
              <DatePicker value={form.first_due} onChange={v => setForm(p => ({ ...p, first_due: v }))} />
            </div>
          </div>
        </div>

        {installments.length > 0 && (
          <div className="overflow-auto rounded-lg" style={{ border: '1px solid #1A2535' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: '#1A2535' }}>
                  <TableHead style={{ color: '#94A3B8' }}>#</TableHead>
                  <TableHead style={{ color: '#94A3B8' }}>Data prevista</TableHead>
                  <TableHead style={{ color: '#94A3B8' }}>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map((p, i) => (
                  <TableRow key={i} style={{ borderColor: '#1A2535' }}>
                    <TableCell style={{ color: '#94A3B8' }}>{i + 1}</TableCell>
                    <TableCell style={{ width: 220 }}>
                      <DatePicker value={p.due_date} onChange={v => updateInstallment(i, { due_date: v })} />
                    </TableCell>
                    <TableCell style={{ width: 180 }}>
                      <Input
                        type="number"
                        value={p.amount}
                        onChange={e => updateInstallment(i, { amount: parseFloat(e.target.value) || 0 })}
                        style={inputStyle}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <GoldButton onClick={handleSubmit} disabled={createMut.isPending}>
          {createMut.isPending ? "Salvando..." : "Registrar Comissão"}
        </GoldButton>
      </div>
    </PremiumCard>
  );
}

// ─────────── Histórico ───────────
function HistorySection({ month }: { month: string }) {
  const { data = [], isLoading } = useOtherCommissions(month);
  const deleteMut = useDeleteOtherCommission();
  const toggleMut = useToggleInstallmentPaid();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<OtherCommission | null>(null);

  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />;
  if (data.length === 0) return (
    <PremiumCard><p className="text-center py-8 font-mono text-sm" style={{ color: '#4A5568' }}>Nenhuma comissão externa em {formatMonth(month)}</p></PremiumCard>
  );

  const totalGen = data.reduce((s, r) => s + (r.commission_value ?? 0), 0);
  const totalRec = data.reduce(
    (s, r) => s + r.installments.filter(i => !!i.paid_at).reduce((ss, i) => ss + Number(i.paid_amount ?? i.amount), 0),
    0,
  );

  const toggleRow = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const handleTogglePaid = async (inst: Installment) => {
    try {
      if (inst.paid_at) {
        await toggleMut.mutateAsync({ id: inst.id, paid_at: null, paid_amount: null });
      } else {
        await toggleMut.mutateAsync({ id: inst.id, paid_at: todayISO(), paid_amount: inst.amount });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <PremiumCard>
      <h2 className="font-display font-semibold text-lg mb-4" style={{ color: '#F0F4F8' }}>Histórico — {formatMonth(month)}</h2>
      <div className="overflow-auto rounded-xl" style={{ border: '1px solid #1A2535' }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: '#1A2535' }}>
              <TableHead style={{ width: 36 }} />
              <TableHead style={{ color: '#94A3B8' }}>Descrição</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Origem</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Lançamento</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Valor</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Comissão</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Parcelas</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(r => {
              const paid = r.installments.filter(i => !!i.paid_at).length;
              const total = r.installments.length;
              const isOpen = !!expanded[r.id];
              return (
                <>
                  <TableRow key={r.id} style={{ borderColor: '#1A2535' }}>
                    <TableCell>
                      <button onClick={() => toggleRow(r.id)} className="p-1 rounded hover:bg-white/5">
                        {isOpen ? <ChevronDown className="w-4 h-4" style={{ color: '#94A3B8' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#94A3B8' }} />}
                      </button>
                    </TableCell>
                    <TableCell style={{ color: '#F0F4F8' }}>{r.description}</TableCell>
                    <TableCell style={{ color: '#94A3B8' }}>{r.source || "—"}</TableCell>
                    <TableCell className="font-mono text-xs" style={{ color: '#94A3B8' }}>{displayBR(r.issued_at)}</TableCell>
                    <TableCell className="font-mono" style={{ color: '#94A3B8' }}>{formatCurrency(r.amount)}</TableCell>
                    <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(r.commission_value)}</TableCell>
                    <TableCell className="font-mono text-xs" style={{ color: paid === total && total > 0 ? '#10B981' : '#94A3B8' }}>
                      {paid}/{total}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditing(r)} className="p-1.5 rounded-lg hover:bg-white/5" title="Editar">
                          <Pencil className="w-4 h-4" style={{ color: '#E8C97A' }} />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-red-500/10"><Trash2 className="w-4 h-4" style={{ color: '#F43F5E' }} /></button>
                          </AlertDialogTrigger>
                          <AlertDialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                            <AlertDialogHeader>
                              <AlertDialogTitle style={{ color: '#F0F4F8' }}>Excluir comissão?</AlertDialogTitle>
                              <AlertDialogDescription style={{ color: '#94A3B8' }}>"{r.description}" e suas parcelas serão removidas permanentemente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel style={{ background: '#1A2535', color: '#F0F4F8', border: 'none' }}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={async () => { try { await deleteMut.mutateAsync(r.id); toast({ title: "Excluído" }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); } }} style={{ background: '#F43F5E', color: '#fff' }}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow style={{ borderColor: '#1A2535', background: '#080C10' }}>
                      <TableCell />
                      <TableCell colSpan={7}>
                        <div className="py-2">
                          <div className="text-xs font-mono uppercase mb-2" style={{ color: '#64748B' }}>Parcelas</div>
                          <div className="rounded-lg" style={{ border: '1px solid #1A2535' }}>
                            <Table>
                              <TableHeader>
                                <TableRow style={{ borderColor: '#1A2535' }}>
                                  <TableHead style={{ color: '#94A3B8' }}>#</TableHead>
                                  <TableHead style={{ color: '#94A3B8' }}>Data prevista</TableHead>
                                  <TableHead style={{ color: '#94A3B8' }}>Valor</TableHead>
                                  <TableHead style={{ color: '#94A3B8' }}>Pago em</TableHead>
                                  <TableHead style={{ color: '#94A3B8' }}>Status</TableHead>
                                  <TableHead style={{ color: '#94A3B8' }}>Ação</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {r.installments.map(inst => (
                                  <TableRow key={inst.id} style={{ borderColor: '#1A2535' }}>
                                    <TableCell style={{ color: '#94A3B8' }}>{inst.installment_number}</TableCell>
                                    <TableCell className="font-mono text-xs" style={{ color: '#94A3B8' }}>{displayBR(inst.due_date)}</TableCell>
                                    <TableCell className="font-mono" style={{ color: '#E0E7EF' }}>{formatCurrency(inst.amount)}</TableCell>
                                    <TableCell className="font-mono text-xs" style={{ color: '#10B981' }}>{displayBR(inst.paid_at)}</TableCell>
                                    <TableCell>
                                      {inst.paid_at
                                        ? <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>Paga</span>
                                        : <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>Pendente</span>}
                                    </TableCell>
                                    <TableCell>
                                      <button
                                        onClick={() => handleTogglePaid(inst)}
                                        className="p-1.5 rounded-lg hover:bg-white/5"
                                        title={inst.paid_at ? "Desfazer pagamento" : "Marcar como paga (hoje)"}
                                      >
                                        {inst.paid_at
                                          ? <X className="w-4 h-4" style={{ color: '#F43F5E' }} />
                                          : <Check className="w-4 h-4" style={{ color: '#10B981' }} />}
                                      </button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex justify-end gap-6">
        <div className="text-right">
          <span className="text-xs uppercase tracking-wider" style={{ color: '#64748B' }}>Geradas: </span>
          <span className="font-mono font-bold text-lg" style={{ color: '#E8C97A' }}>{formatCurrency(totalGen)}</span>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase tracking-wider" style={{ color: '#64748B' }}>Recebidas: </span>
          <span className="font-mono font-bold text-lg" style={{ color: '#10B981' }}>{formatCurrency(totalRec)}</span>
        </div>
      </div>

      {editing && <EditDialog commission={editing} onClose={() => setEditing(null)} />}
    </PremiumCard>
  );
}

// ─────────── Edit Dialog ───────────
function EditDialog({ commission, onClose }: { commission: OtherCommission; onClose: () => void }) {
  const { toast } = useToast();
  const updateMut = useUpdateOtherCommission();

  const [form, setForm] = useState({
    description: commission.description,
    source: commission.source ?? "",
    amount: String(commission.amount ?? 0),
    notes: commission.notes ?? "",
    issued_at: commission.issued_at ?? todayISO(),
    reference_month: commission.reference_month,
  });
  type EditInst = {
    id?: string;
    installment_number: number;
    due_date: string;
    amount: number;
    paid_at: string | null;
    paid_amount: number | null;
  };
  const [installments, setInstallments] = useState<EditInst[]>(
    commission.installments.map(i => ({
      id: i.id,
      installment_number: i.installment_number,
      due_date: i.due_date,
      amount: Number(i.amount),
      paid_at: i.paid_at,
      paid_amount: i.paid_amount,
    }))
  );

  const amount = parseFloat(form.amount) || 0;
  const commissionValue = Math.round(amount * 100) / 100;

  const updateInst = (idx: number, patch: Partial<typeof installments[number]>) => {
    setInstallments(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  };
  const addInst = () => {
    setInstallments(prev => [
      ...prev,
      { installment_number: prev.length + 1, due_date: todayISO(), amount: 0, paid_at: null, paid_amount: null }
    ]);
  };
  const removeInst = (idx: number) => {
    setInstallments(prev => prev.filter((_, i) => i !== idx));
  };
  const togglePaid = (idx: number) => {
    setInstallments(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      return p.paid_at
        ? { ...p, paid_at: null, paid_amount: null }
        : { ...p, paid_at: todayISO(), paid_amount: p.amount };
    }));
  };

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({
        id: commission.id,
        description: form.description,
        source: form.source || null,
        reference_month: form.reference_month,
        amount,
        commission_rate: 1,
        commission_value: commissionValue,
        notes: form.notes || null,
        issued_at: form.issued_at,
        installments,
      });
      toast({ title: "Comissão atualizada!" });
      onClose();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535', maxWidth: 900 }} className="max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle style={{ color: '#F0F4F8' }}>Editar Comissão</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Descrição *</label>
            <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Origem</label>
            <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
              <SelectTrigger style={inputStyle}><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>{sourceOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Valor (R$) *</label>
            <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Taxa (%)</label>
            <Input type="number" value={form.commission_rate} onChange={e => setForm(p => ({ ...p, commission_rate: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Data lançamento</label>
            <DatePicker value={form.issued_at} onChange={v => setForm(p => ({ ...p, issued_at: v }))} />
          </div>
          <div className="md:col-span-3">
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Observações</label>
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} rows={2} />
          </div>
        </div>

        <div className="rounded-xl p-4 flex items-center justify-between mt-3" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
          <span className="font-mono text-sm" style={{ color: '#E8C97A' }}>Comissão ({form.commission_rate}%)</span>
          <span className="font-mono text-xl font-bold" style={{ color: '#C9A84C' }}>{formatCurrency(commissionValue)}</span>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-semibold" style={{ color: '#F0F4F8' }}>Parcelas</h3>
            <button onClick={addInst} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(201,168,76,0.15)', color: '#E8C97A' }}>
              <Plus className="w-3 h-3" /> Adicionar
            </button>
          </div>
          <div className="rounded-lg overflow-auto" style={{ border: '1px solid #1A2535' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: '#1A2535' }}>
                  <TableHead style={{ color: '#94A3B8' }}>#</TableHead>
                  <TableHead style={{ color: '#94A3B8' }}>Data prevista</TableHead>
                  <TableHead style={{ color: '#94A3B8' }}>Valor</TableHead>
                  <TableHead style={{ color: '#94A3B8' }}>Pago em</TableHead>
                  <TableHead style={{ color: '#94A3B8' }}>Status</TableHead>
                  <TableHead style={{ color: '#94A3B8' }}>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map((p, i) => (
                  <TableRow key={i} style={{ borderColor: '#1A2535' }}>
                    <TableCell style={{ color: '#94A3B8' }}>{i + 1}</TableCell>
                    <TableCell style={{ width: 220 }}>
                      <DatePicker value={p.due_date} onChange={v => updateInst(i, { due_date: v })} />
                    </TableCell>
                    <TableCell style={{ width: 160 }}>
                      <Input type="number" value={p.amount} onChange={e => updateInst(i, { amount: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                    </TableCell>
                    <TableCell style={{ width: 220 }}>
                      <DatePicker value={p.paid_at ?? ""} onChange={v => updateInst(i, { paid_at: v || null, paid_amount: v ? p.amount : null })} placeholder="—" />
                    </TableCell>
                    <TableCell>
                      {p.paid_at
                        ? <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>Paga</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>Pendente</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button onClick={() => togglePaid(i)} className="p-1.5 rounded-lg hover:bg-white/5" title={p.paid_at ? "Desfazer" : "Marcar paga"}>
                          {p.paid_at ? <X className="w-4 h-4" style={{ color: '#F43F5E' }} /> : <Check className="w-4 h-4" style={{ color: '#10B981' }} />}
                        </button>
                        <button onClick={() => removeInst(i)} className="p-1.5 rounded-lg hover:bg-red-500/10" title="Remover">
                          <Trash2 className="w-4 h-4" style={{ color: '#F43F5E' }} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-lg" style={{ background: '#1A2535', color: '#F0F4F8' }}>Cancelar</button>
          <GoldButton onClick={handleSave} disabled={updateMut.isPending}>
            {updateMut.isPending ? "Salvando..." : "Salvar alterações"}
          </GoldButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
