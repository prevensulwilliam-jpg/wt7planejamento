import { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { GoldButton } from "@/components/wt7/GoldButton";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { WT7Logo } from "@/components/wt7/WT7Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrevensulBilling, useBillingSummary, useCreateBilling, useUpdateBilling, useDeleteBilling, useDeleteAllBillingByMonth, useReplicateMonth, useImportHistory, useCreateImportHistory, useUpsertBillingSchedule, exportCSV } from "@/hooks/useBilling";
import type { KpiDrillType } from "@/hooks/useBilling";
import { KpiDrillDownDialog } from "@/components/wt7/KpiDrillDownDialog";
import { formatCurrency, formatMonth, getCurrentMonth, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Upload, Trash2, FileSpreadsheet, Download, ArrowLeft, Pencil, Check, X, Copy, RotateCcw, FileText, Plus, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { DatePicker } from "@/components/wt7/DatePicker";
import { exportPDF } from "@/lib/relatorioComissoes";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import * as XLSX from "xlsx";

const statusOptions = [
  { value: "Pendente", label: "Pendente" },
  { value: "Pago", label: "Pago" },
  { value: "Parcial", label: "Parcial" },
  { value: "Inadimplente", label: "Inadimplente" },
];

const statusBadge: Record<string, "green" | "gold" | "red" | "cyan" | "gray"> = {
  Pago: "green", Parcial: "gold", Pendente: "cyan", Inadimplente: "red", Quitado: "green",
};

export default function CommissionsPortalPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState("");
  const navigate = useNavigate();
  const [month, setMonth] = useState(getCurrentMonth());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login", { replace: true }); return; }
      setUserId(user.id);

      // Admin always has access
      const { data: admin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (admin) { setIsAdmin(true); setAuthorized(true); return; }

      // Commissions role
      const { data: commRole } = await (supabase as any)
        .from("user_roles")
        .select("status")
        .eq("user_id", user.id)
        .eq("role", "commissions")
        .maybeSingle();

      if (!commRole || commRole.status !== "active") {
        navigate("/login", { replace: true }); return;
      }
      setAuthorized(true);
    })();
  }, [navigate]);

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080C10' }}>
        <Skeleton className="w-16 h-16 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#080C10' }}>
      <Header isAdmin={isAdmin} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold" style={{ color: '#F0F4F8' }}>
            Comissões — {formatMonth(month)}
          </h1>
          <MonthPicker value={month} onChange={v => setMonth(v)} className="w-44" />
        </div>

        <PrevensulTab month={month} userId={userId} />
      </main>
    </div>
  );
}

// ─── HEADER ───
function Header({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-14" style={{ background: '#080C10', borderBottom: '1px solid #1A2535' }}>
      <div className="flex items-center gap-3">
        {isAdmin && (
          <button
            onClick={() => navigate("/hoje")}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
            style={{ color: '#94A3B8', border: '1px solid #1A2535' }}
          >
            <ArrowLeft className="w-3 h-3" /> Hoje
          </button>
        )}
        <WT7Logo size="sm" />
        <span className="font-display font-semibold text-lg" style={{ color: '#F59E0B' }}>
          Portal Comissões Prevensul
        </span>
      </div>
      <button
        onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}
        className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors"
        style={{ color: '#94A3B8', border: '1px solid #1A2535' }}
      >
        <LogOut className="w-4 h-4" /> Sair
      </button>
    </header>
  );
}

// ═══════════════════════════════════════
//   ABA COMISSÕES PREVENSUL
// ═══════════════════════════════════════

function PrevensulTab({ month, userId }: { month: string; userId: string }) {
  const [editRecord, setEditRecord] = useState<any | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const handleLoadRecord = (r: any) => {
    setEditRecord(r);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="space-y-6 mt-4">
      <PrevensulKPIs month={month} />
      <div ref={formRef}>
        <PrevensulForm month={month} userId={userId} editRecord={editRecord} onClearEdit={() => setEditRecord(null)} />
      </div>
      <PrevensulExcelImport month={month} userId={userId} />
      <PrevensulHistory month={month} userId={userId} onLoadRecord={handleLoadRecord} />
    </div>
  );
}

function PrevensulKPIs({ month }: { month: string }) {
  const summary = useBillingSummary(month);
  const { totalBilled, totalNew, totalForecast, totalReceived, totalCommission, total2026, billedDetail, newDetail, forecastDetail, receivedDetail, commissionDetail, ytdDetail, isLoading } = summary;
  const [drillType, setDrillType] = useState<KpiDrillType | null>(null);

  if (isLoading) return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
    </div>
  );
  return (
    <>
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard label="Faturamento Total" value={totalBilled} color="cyan" compact onClick={() => setDrillType("totalBilled")} />
          <KpiCard label="Faturamentos Novos" value={totalNew} color="cyan" compact onClick={() => setDrillType("totalNew")} />
          <KpiCard label="Previsão" value={totalForecast} color="cyan" compact onClick={() => setDrillType("totalForecast")} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard label="Recebidos" value={totalReceived} color="green" compact onClick={() => setDrillType("totalReceived")} />
          <KpiCard label="Comissões" value={totalCommission} color="gold" compact onClick={() => setDrillType("totalCommission")} />
          <KpiCard label="Faturamento 2026" value={total2026} color="gold" compact onClick={() => setDrillType("total2026")} />
        </div>
      </div>
      <KpiDrillDownDialog
        open={drillType !== null}
        onOpenChange={(v) => { if (!v) setDrillType(null); }}
        drillType={drillType}
        month={month}
        billedDetail={billedDetail}
        newDetail={newDetail}
        forecastDetail={forecastDetail}
        receivedDetail={receivedDetail}
        commissionDetail={commissionDetail}
        ytdDetail={ytdDetail}
      />
    </>
  );
}

const EMPTY_FORM = { client_name: "", contract_total: "", balance_remaining: "", contract_nf: "", installment_current: "", installment_total: "", closing_date: "", amount_paid: "", status: "Pendente", notes: "" };

type ScheduleItem = { installment_number: number; due_date: string; amount: string };

function PrevensulForm({ month, userId, editRecord, onClearEdit }: { month: string; userId: string; editRecord: any | null; onClearEdit: () => void }) {
  const { toast } = useToast();
  const createBilling = useCreateBilling();
  const updateBillingForm = useUpdateBilling();
  const upsertSchedule = useUpsertBillingSchedule();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<"equal" | "custom">("equal");
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([
    { installment_number: 0, due_date: "", amount: "" }, // entrada
    { installment_number: 1, due_date: "", amount: "" }, // parcela 1
  ]);

  useEffect(() => {
    if (!editRecord) return;
    setForm({
      client_name: editRecord.client_name ?? "",
      contract_total: String(editRecord.contract_total ?? ""),
      balance_remaining: String(editRecord.balance_remaining ?? ""),
      contract_nf: editRecord.contract_nf ?? "",
      installment_current: String(editRecord.installment_current ?? ""),
      installment_total: String(editRecord.installment_total ?? ""),
      closing_date: editRecord.closing_date ?? "",
      amount_paid: String(editRecord.amount_paid ?? ""),
      status: editRecord.status ?? "Pendente",
      notes: editRecord.notes ?? "",
    });
    setPaymentType(editRecord.payment_type === "custom" ? "custom" : "equal");
    setEditingRecordId(editRecord.id);
  }, [editRecord]);

  const estimatedInstallment = useMemo(() => {
    const total = parseFloat(form.contract_total) || 0;
    const qty = parseInt(form.installment_total) || 1;
    return total / qty;
  }, [form.contract_total, form.installment_total]);

  const isEditing = editingRecordId !== null;

  const addScheduleItem = () => {
    setScheduleItems(prev => [...prev, { installment_number: prev.length, due_date: "", amount: "" }]);
  };

  const removeScheduleItem = (idx: number) => {
    setScheduleItems(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, installment_number: i })));
  };

  const updateScheduleItem = (idx: number, field: keyof ScheduleItem, value: string) => {
    setScheduleItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setEditingRecordId(null);
    setPaymentType("equal");
    setScheduleItems([
      { installment_number: 0, due_date: "", amount: "" },
      { installment_number: 1, due_date: "", amount: "" },
    ]);
    onClearEdit();
  };

  const handleSubmit = async () => {
    if (!form.client_name) {
      toast({ title: "Preencha o Cliente", variant: "destructive" }); return;
    }
    const paid = parseFloat(form.amount_paid) || 0;
    const payload: any = {
      client_name: form.client_name,
      contract_total: parseFloat(form.contract_total) || 0,
      balance_remaining: parseFloat(form.balance_remaining) || 0,
      contract_nf: form.contract_nf || null,
      installment_current: parseInt(form.installment_current) || null,
      installment_total: parseInt(form.installment_total) || null,
      closing_date: form.closing_date || null,
      amount_paid: paid,
      commission_rate: 0.03,
      status: form.status,
      notes: form.notes || null,
      payment_type: paymentType,
    };
    try {
      let billingId = editingRecordId;
      if (isEditing) {
        await updateBillingForm.mutateAsync({ id: editingRecordId!, ...payload });
        toast({ title: "Registro atualizado!" });
      } else {
        // Need the new ID to save schedule — use direct insert
        const { data: inserted, error } = await (await import("@/integrations/supabase/client")).supabase
          .from("prevensul_billing")
          .insert({ ...payload, reference_month: month, created_by: userId })
          .select("id")
          .single();
        if (error) throw error;
        billingId = inserted.id;
        toast({ title: "Faturamento registrado!" });
      }

      // Save schedule if custom
      if (paymentType === "custom" && billingId) {
        const validItems = scheduleItems
          .filter(s => s.due_date && s.amount)
          .map(s => ({
            installment_number: s.installment_number,
            due_date: s.due_date,
            amount: parseFloat(s.amount) || 0,
          }));
        await upsertSchedule.mutateAsync({ billingId, items: validItems });
      }

      handleCancel();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const isPending = createBilling.isPending || updateBillingForm.isPending || upsertSchedule.isPending;
  const inputStyle = { background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' };
  const btnBase = "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors";

  return (
    <PremiumCard glowColor={isEditing ? "rgba(245,158,11,0.15)" : undefined}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display font-semibold text-lg" style={{ color: '#F0F4F8' }}>
            {isEditing ? `Editar — ${form.client_name || "cliente"}` : "Registrar Faturamento"}
          </h2>
          {isEditing && (
            <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
              modo edição
            </span>
          )}
        </div>
        {isEditing && (
          <button onClick={handleCancel} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors" style={{ color: '#94A3B8', border: '1px solid #1A2535' }}>
            <RotateCcw className="w-3 h-3" /> Cancelar
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Linha 1: Cliente (2 cols) + Valor */}
        <div className="md:col-span-2">
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Cliente *</label>
          <Input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} style={inputStyle} placeholder="Nome do cliente" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Valor (R$)</label>
          <Input type="number" value={form.contract_total} onChange={e => setForm(p => ({ ...p, contract_total: e.target.value }))} style={inputStyle} placeholder="0,00" />
        </div>

        {/* Linha 2: Saldo + Parcela */}
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Saldo (R$)</label>
          <Input type="number" value={form.balance_remaining} onChange={e => setForm(p => ({ ...p, balance_remaining: e.target.value }))} style={inputStyle} placeholder="0,00" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Parcela</label>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" value={form.installment_current} onChange={e => setForm(p => ({ ...p, installment_current: e.target.value }))} style={inputStyle} placeholder="Atual" />
            <Input type="number" value={form.installment_total} onChange={e => setForm(p => ({ ...p, installment_total: e.target.value }))} style={inputStyle} placeholder="Total" />
          </div>
        </div>

        {/* Linha 3: Data Fech. + Pago + Status */}
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Data Fech.</label>
          <DatePicker value={form.closing_date} onChange={v => setForm(p => ({ ...p, closing_date: v }))} placeholder="Data de fechamento" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Pago (R$)</label>
          <Input type="number" value={form.amount_paid} onChange={e => setForm(p => ({ ...p, amount_paid: e.target.value }))} style={inputStyle} placeholder="0,00" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Status</label>
          <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
            <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Forma de Pagamento — full width */}
        <div className="md:col-span-3 rounded-xl p-4 space-y-3" style={{ background: 'rgba(13,19,24,0.6)', border: '1px solid #1A2535' }}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono uppercase" style={{ color: '#94A3B8' }}>Forma de Pagamento</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentType("equal")}
                className={btnBase}
                style={paymentType === "equal"
                  ? { background: 'rgba(6,182,212,0.15)', color: '#22D3EE', border: '1px solid rgba(6,182,212,0.4)' }
                  : { background: 'transparent', color: '#64748B', border: '1px solid #1A2535' }}
              >
                Parcelas Iguais
              </button>
              <button
                type="button"
                onClick={() => setPaymentType("custom")}
                className={btnBase}
                style={paymentType === "custom"
                  ? { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.4)' }
                  : { background: 'transparent', color: '#64748B', border: '1px solid #1A2535' }}
              >
                Parcelamento Personalizado
              </button>
            </div>
          </div>

          {paymentType === "equal" && (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#94A3B8' }}>
              <span>Parcela estimada:</span>
              <span className="font-mono font-semibold" style={{ color: '#22D3EE' }}>
                {estimatedInstallment > 0
                  ? `R$ ${estimatedInstallment.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "—"}
              </span>
              <span className="text-xs" style={{ color: '#4A5568' }}>(Valor ÷ Nº Parcelas)</span>
            </div>
          )}

          {paymentType === "custom" && (
            <div className="space-y-2">
              {scheduleItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <span className="text-xs font-mono" style={{ color: '#94A3B8' }}>
                      {idx === 0 ? "Entrada" : `Parcela ${idx}`}
                    </span>
                  </div>
                  <div className="col-span-4">
                    <DatePicker
                      value={item.due_date}
                      onChange={v => updateScheduleItem(idx, "due_date", v)}
                      placeholder="Vencimento"
                    />
                  </div>
                  <div className="col-span-4">
                    <Input
                      type="number"
                      value={item.amount}
                      onChange={e => updateScheduleItem(idx, "amount", e.target.value)}
                      style={inputStyle}
                      placeholder="Valor (R$)"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {scheduleItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeScheduleItem(idx)}
                        className="p-1 rounded transition-colors"
                        style={{ color: '#F43F5E' }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addScheduleItem}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors mt-1"
                style={{ color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}
              >
                <Plus className="w-3 h-3" /> Adicionar Parcela
              </button>
            </div>
          )}
        </div>

        {/* Observações — full width */}
        <div className="md:col-span-3">
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Observações <span style={{ color: '#4A5568', textTransform: 'none', fontStyle: 'italic' }}>(Shift+Enter para nova linha)</span></label>
          <textarea
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) e.preventDefault(); }}
            rows={3}
            placeholder="Observações opcionais sobre este cliente..."
            style={{ ...inputStyle, width: '100%', resize: 'vertical', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', lineHeight: 1.5 }}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <GoldButton onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Salvando..." : isEditing ? "Atualizar Faturamento" : "Registrar Faturamento"}
        </GoldButton>
      </div>
    </PremiumCard>
  );
}

function PrevensulExcelImport({ month, userId }: { month: string; userId: string }) {
  const { toast } = useToast();
  const createBilling = useCreateBilling();
  const createImport = useCreateImportHistory();
  const { data: existing = [] } = usePrevensulBilling(month);
  const [preview, setPreview] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [workbookRef, setWorkbookRef] = useState<XLSX.WorkBook | null>(null);
  const [inputKey, setInputKey] = useState(0);
  // Multi-sheet state
  const [allSheetsData, setAllSheetsData] = useState<{ sheetName: string; refMonth: string; rows: any[] }[]>([]);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [existingMonthsSet, setExistingMonthsSet] = useState<Set<string>>(new Set());

  const detectMonthFromSheet = (name: string): string | null => {
    const n = name.toLowerCase().trim();
    const ptMonths: Record<string, string> = {
      jan: "01", janeiro: "01",
      fev: "02", fevereiro: "02",
      mar: "03", marco: "03",
      abr: "04", abril: "04",
      mai: "05", maio: "05",
      jun: "06", junho: "06",
      jul: "07", julho: "07",
      ago: "08", agosto: "08",
      set: "09", setembro: "09",
      out: "10", outubro: "10",
      nov: "11", novembro: "11",
      dez: "12", dezembro: "12",
    };
    // MMYYYY e.g. "012026"
    const m1 = n.match(/^(\d{2})(\d{4})$/);
    if (m1) return `${m1[2]}-${m1[1]}`;
    // MM/YYYY or MM-YYYY
    const m2 = n.match(/(\d{1,2})[\/\-](\d{4})/);
    if (m2) return `${m2[2]}-${m2[1].padStart(2, "0")}`;
    // Portuguese month name + year
    const yearMatch = n.match(/(\d{4})/);
    const year = yearMatch ? yearMatch[1] : month.split("-")[0];
    // Check "março" with ç separately
    if (n.includes("mar\u00e7o") || n.includes("marco")) return `${year}-03`;
    for (const [key, val] of Object.entries(ptMonths)) {
      if (n.includes(key)) return `${year}-${val}`;
    }
    return null;
  };

  const parseExcelDate = (val: any): string | null => {
    if (typeof val === "number") {
      const utc = (val - 25569) * 86400 * 1000;
      const date = new Date(utc);
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      if (y > 2000 && y < 2100) return `${y}-${m}-${d}`;
      return null;
    }
    if (typeof val === "string") {
      const full = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(val.trim());
      if (full) return `${full[3]}-${full[2].padStart(2, '0')}-${full[1].padStart(2, '0')}`;
      const short = /^(\d{1,2})\/(\d{1,2})$/.exec(val.trim());
      if (short) {
        const year = new Date().getFullYear();
        return `${year}-${short[2].padStart(2, '0')}-${short[1].padStart(2, '0')}`;
      }
    }
    return null;
  };

  const parseSheetToRows = (wb: XLSX.WorkBook, sheetName: string): any[] => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const rows: any[] = [];
    for (let i = 2; i < raw.length; i++) {
      const row = raw[i];
      if (!row || !row[0] || String(row[0]).trim() === "") continue;
      const parcela = String(row[4] ?? "");
      const [ic, it] = parcela.includes("/") ? parcela.split("/").map(Number) : [null, null];
      const paid = parseFloat(row[6]) || 0;
      rows.push({
        client_name: String(row[0]).trim(),
        contract_total: parseFloat(row[1]) || 0,
        balance_remaining: parseFloat(row[2]) || 0,
        contract_nf: row[3] ? String(row[3]).trim() : null,
        installment_current: ic,
        installment_total: it,
        closing_date: row[5] ? parseExcelDate(row[5]) : null,
        amount_paid: paid,
        commission_value: parseFloat(row[7]) || paid * 0.03,
        status: row[8] ? String(row[8]).trim() : "Pendente",
      });
    }
    return rows;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "array" });
      setWorkbookRef(wb);
      setSheetNames(wb.SheetNames);

      const parsed = wb.SheetNames
        .map(sheetName => ({
          sheetName,
          refMonth: detectMonthFromSheet(sheetName) ?? month,
          rows: parseSheetToRows(wb, sheetName),
        }))
        .filter(s => s.rows.length > 0);

      const detectable = parsed.filter(s => detectMonthFromSheet(s.sheetName) !== null);

      if (detectable.length > 1) {
        setAllSheetsData(parsed);
        const months = [...new Set(parsed.map(s => s.refMonth))];
        const { data: existingData } = await supabase
          .from("prevensul_billing")
          .select("reference_month")
          .in("reference_month", months);
        setExistingMonthsSet(new Set(existingData?.map(r => r.reference_month) ?? []));
        const currentSheetData = parsed.find(s => s.refMonth === month) ?? parsed[parsed.length - 1];
        setSelectedSheet(currentSheetData.sheetName);
        setPreview(currentSheetData.rows);
        setShowModeDialog(true);
      } else {
        const [y, m] = month.split("-");
        const target = `${m}${y}`;
        const found = wb.SheetNames.find(n => n.includes(target)) || wb.SheetNames[0];
        setSelectedSheet(found);
        setAllSheetsData([]);
        setPreview(parseSheetToRows(wb, found));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSheetChange = (name: string) => {
    setSelectedSheet(name);
    if (workbookRef) setPreview(parseSheetToRows(workbookRef, name));
  };

  const cancelImport = () => {
    setShowModeDialog(false);
    setPreview([]);
    setFileName("");
    setAllSheetsData([]);
    setInputKey(k => k + 1);
  };

  const doImport = async (mode: "current" | "all") => {
    setImporting(true);
    setShowModeDialog(false);
    let totalImported = 0;

    const sheetsToProcess = mode === "all" && allSheetsData.length > 0
      ? allSheetsData
      : [{ sheetName: selectedSheet, refMonth: month, rows: preview }];

    try {
      for (const sheet of sheetsToProcess) {
        if (mode === "all" && existingMonthsSet.has(sheet.refMonth)) {
          const { error: delErr } = await supabase
            .from("prevensul_billing")
            .delete()
            .eq("reference_month", sheet.refMonth);
          if (delErr) throw delErr;
        }

        let sheetImported = 0, sheetPaid = 0, sheetComm = 0;

        for (const row of sheet.rows) {
          if (mode === "current") {
            const isDuplicate = existing.some(
              e => e.client_name === row.client_name && e.installment_current === row.installment_current
            );
            if (isDuplicate) continue;
          }
          const { commission_value: _cv, ...rowWithoutCommission } = row;
          await createBilling.mutateAsync({
            ...rowWithoutCommission,
            commission_rate: 0.03,
            reference_month: sheet.refMonth,
            created_by: userId,
          });
          sheetImported++;
          sheetPaid += row.amount_paid ?? 0;
          sheetComm += row.commission_value ?? (row.amount_paid ?? 0) * 0.03;
        }

        if (sheetImported > 0) {
          await createImport.mutateAsync({
            file_name: fileName,
            reference_month: sheet.refMonth,
            records_imported: sheetImported,
            total_paid: sheetPaid,
            total_commission: sheetComm,
            imported_by: userId,
          });
        }
        totalImported += sheetImported;
      }

      toast({
        title: mode === "all" && sheetsToProcess.length > 1
          ? `${sheetsToProcess.length} meses importados — ${totalImported} registros no total!`
          : `${totalImported} registros importados!`,
      });
      setPreview([]);
      setFileName("");
      setAllSheetsData([]);
      setInputKey(k => k + 1);
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <PremiumCard>
      <AlertDialog open={showModeDialog}>
        <AlertDialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: '#F0F4F8' }}>
              {allSheetsData.length} abas detectadas no arquivo
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p style={{ color: '#94A3B8' }}>O arquivo contém dados para os seguintes meses:</p>
                <ul className="space-y-2">
                  {allSheetsData.map(s => (
                    <li key={s.sheetName} className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold" style={{ color: s.refMonth === month ? '#E8C97A' : '#F0F4F8' }}>
                        {formatMonth(s.refMonth)}
                      </span>
                      <span style={{ color: '#64748B' }}>{s.rows.length} registros</span>
                      {s.refMonth === month && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(232,201,122,0.15)', color: '#E8C97A' }}>
                          mês atual
                        </span>
                      )}
                      {existingMonthsSet.has(s.refMonth) && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5' }}>
                          já tem dados — será substituído
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {allSheetsData.some(s => s.refMonth !== month && existingMonthsSet.has(s.refMonth)) && (
                  <p className="text-xs p-2 rounded" style={{ background: 'rgba(239,68,68,0.08)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}>
                    ⚠️ Meses anteriores com dados existentes serão completamente substituídos.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={cancelImport}
              style={{ background: 'transparent', border: '1px solid #1A2535', color: '#94A3B8' }}
            >
              Cancelar
            </AlertDialogCancel>
            <button
              onClick={() => doImport("current")}
              disabled={importing}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'rgba(232,201,122,0.12)', color: '#E8C97A', border: '1px solid rgba(232,201,122,0.25)' }}
            >
              Apenas {formatMonth(month)}
            </button>
            <GoldButton onClick={() => doImport("all")} disabled={importing} className="flex-1">
              Todos os {allSheetsData.length} meses
            </GoldButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: '#F0F4F8' }}>
        <FileSpreadsheet className="w-5 h-5" style={{ color: '#F59E0B' }} /> Importar Planilha Excel
      </h2>
      <div className="flex items-center gap-4 flex-wrap">
        <label className="cursor-pointer px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2" style={{ background: '#F59E0B', color: '#080C10' }}>
          <Upload className="w-4 h-4" /> Selecionar .xlsx
          <input key={inputKey} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        </label>
        {fileName && <span className="text-sm font-mono" style={{ color: '#94A3B8' }}>{fileName}</span>}
        {sheetNames.length > 1 && !showModeDialog && (
          <Select value={selectedSheet} onValueChange={handleSheetChange}>
            <SelectTrigger className="w-40" style={{ background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' }}><SelectValue /></SelectTrigger>
            <SelectContent>{sheetNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      {preview.length > 0 && (
        <div className="mt-4 space-y-4">
          <p className="text-sm font-mono" style={{ color: '#94A3B8' }}>{preview.length} registros encontrados</p>
          <div className="overflow-auto max-h-80 rounded-xl" style={{ border: '1px solid #1A2535' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: '#1A2535' }}>
                  <TableHead style={{ color: '#94A3B8' }}>Cliente</TableHead>
                  <TableHead style={{ color: '#94A3B8' }}>Valor Contrato</TableHead>
                  <TableHead style={{ color: '#94A3B8' }}>Pago</TableHead>
                  <TableHead style={{ color: '#94A3B8' }}>Comissão</TableHead>
                  <TableHead style={{ color: '#94A3B8' }}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((r, i) => (
                  <TableRow key={i} style={{ borderColor: '#1A2535' }}>
                    <TableCell style={{ color: '#F0F4F8' }}>{r.client_name}</TableCell>
                    <TableCell className="font-mono" style={{ color: '#94A3B8' }}>{formatCurrency(r.contract_total)}</TableCell>
                    <TableCell className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(r.amount_paid)}</TableCell>
                    <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(r.commission_value || r.amount_paid * 0.03)}</TableCell>
                    <TableCell><WtBadge variant={statusBadge[r.status] || "gray"}>{r.status}</WtBadge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <GoldButton onClick={() => doImport("current")} disabled={importing}>
            {importing ? "Importando..." : "Confirmar Import"}
          </GoldButton>
        </div>
      )}
    </PremiumCard>
  );
}

function SortHeader({ label, field, sortField, sortDir, onSort }: {
  label: string;
  field: string;
  sortField: string | null;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
}) {
  const active = sortField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-white transition-colors whitespace-nowrap"
      style={{ color: active ? '#E8C97A' : '#94A3B8', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}
    >
      {label}
      {active
        ? sortDir === 'asc'
          ? <ArrowUp className="w-3 h-3" />
          : <ArrowDown className="w-3 h-3" />
        : <ArrowUpDown className="w-3 h-3 opacity-40" />
      }
    </button>
  );
}

function getPreviousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function PrevensulHistory({ month, userId, onLoadRecord }: { month: string; userId: string; onLoadRecord: (r: any) => void }) {
  const { data = [], isLoading } = usePrevensulBilling(month);
  const deleteBilling = useDeleteBilling();
  const deleteAllByMonth = useDeleteAllBillingByMonth();
  const updateBilling = useUpdateBilling();
  const replicateMonth = useReplicateMonth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const displayData = useMemo(() => {
    let rows = [...data];
    if (statusFilter !== 'all') {
      rows = rows.filter(r => r.status === statusFilter);
    }
    if (sortField) {
      rows.sort((a, b) => {
        if (sortField === 'client_name') {
          const va = (a.client_name ?? '').toLowerCase();
          const vb = (b.client_name ?? '').toLowerCase();
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        let va: number, vb: number;
        if (sortField === 'saldo') {
          va = Math.max(0, (a.balance_remaining ?? 0) - (a.amount_paid ?? 0));
          vb = Math.max(0, (b.balance_remaining ?? 0) - (b.amount_paid ?? 0));
        } else if (sortField === 'closing_date') {
          va = a.closing_date ? new Date(a.closing_date).getTime() : 0;
          vb = b.closing_date ? new Date(b.closing_date).getTime() : 0;
        } else {
          va = (a as any)[sortField] ?? 0;
          vb = (b as any)[sortField] ?? 0;
        }
        return sortDir === 'asc' ? va - vb : vb - va;
      });
    }
    return rows;
  }, [data, sortField, sortDir, statusFilter]);

  const totalPago = useMemo(() => displayData.reduce((s, r) => s + (r.amount_paid ?? 0), 0), [displayData]);
  const totalComissao = useMemo(() => displayData.reduce((s, r) => s + (r.commission_value ?? 0), 0), [displayData]);
  const totalValor = useMemo(() => displayData.reduce((s, r) => s + (r.contract_total ?? 0), 0), [displayData]);
  const totalSaldo = useMemo(
    () => displayData.reduce((s, r) => s + Math.max(0, (r.balance_remaining ?? 0) - (r.amount_paid ?? 0)), 0),
    [displayData]
  );

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setEditForm({
      client_name: r.client_name ?? "",
      contract_total: r.contract_total ?? "",
      balance_remaining: r.balance_remaining ?? "",
      contract_nf: r.contract_nf ?? "",
      installment_current: r.installment_current ?? "",
      installment_total: r.installment_total ?? "",
      closing_date: r.closing_date ?? "",
      amount_paid: r.amount_paid ?? "",
      status: r.status ?? "Pendente",
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async () => {
    if (!editingId) return;
    const paid = parseFloat(String(editForm.amount_paid)) || 0;
    const { error } = await supabase
      .from("prevensul_billing")
      .update({
        client_name: editForm.client_name,
        contract_total: parseFloat(String(editForm.contract_total)) || 0,
        contract_nf: editForm.contract_nf || null,
        installment_current: parseInt(String(editForm.installment_current)) || null,
        installment_total: parseInt(String(editForm.installment_total)) || null,
        closing_date: editForm.closing_date || null,
        amount_paid: paid,
        status: editForm.status,
      })
      .eq("id", editingId);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message + " | " + error.code, variant: "destructive" });
      return;
    }
    await qc.invalidateQueries({ queryKey: ["prevensul_billing"] });
    toast({ title: "Atualizado!" });
    cancelEdit();
  };

  const prevMonth = getPreviousMonth(month);

  const handleReplicate = async () => {
    try {
      const count = await replicateMonth.mutateAsync({ sourceMonth: prevMonth, targetMonth: month, userId });
      toast({ title: `${count} registros copiados de ${formatMonth(prevMonth)}!` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAllByMonth.mutateAsync(month);
      toast({ title: `Histórico de ${formatMonth(month)} apagado!` });
      setShowDeleteAll(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const inputStyle: React.CSSProperties = { background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8', padding: '4px 8px', height: '32px', fontSize: '13px' };

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;

  if (data.length === 0) return (
    <PremiumCard>
      <div className="text-center py-8 space-y-4">
        <p className="font-mono text-sm" style={{ color: '#4A5568' }}>Nenhum faturamento neste mês</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-colors" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
              <Copy className="w-4 h-4" /> Replicar Mês Anterior ({formatMonth(prevMonth)})
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
            <AlertDialogHeader>
              <AlertDialogTitle style={{ color: '#F0F4F8' }}>Replicar mês anterior?</AlertDialogTitle>
              <AlertDialogDescription style={{ color: '#94A3B8' }}>
                Todos os registros de {formatMonth(prevMonth)} serão copiados para {formatMonth(month)}. A parcela será incrementada automaticamente (+1). Você poderá editar os valores depois.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel style={{ background: '#1A2535', color: '#F0F4F8', border: 'none' }}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleReplicate} style={{ background: '#F59E0B', color: '#080C10' }}>
                {replicateMonth.isPending ? "Copiando..." : "Replicar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PremiumCard>
  );

  return (
    <PremiumCard>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-lg" style={{ color: '#F0F4F8' }}>Histórico do Mês</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeleteAll(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Apagar Histórico
          </button>
          <button onClick={() => exportPDF(data, month)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)' }}>
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={() => exportCSV(data, `comissoes_${month}.csv`)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(201,168,76,0.15)', color: '#E8C97A' }}>
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Dialog apagar histórico */}
      <AlertDialog open={showDeleteAll} onOpenChange={setShowDeleteAll}>
        <AlertDialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: '#F0F4F8' }}>Certeza que deseja apagar o histórico?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: '#94A3B8' }}>
              Todos os <strong style={{ color: '#FCA5A5' }}>{data.length} registros</strong> de <strong style={{ color: '#E8C97A' }}>{formatMonth(month)}</strong> serão removidos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ background: '#1A2535', color: '#F0F4F8', border: 'none' }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deleteAllByMonth.isPending}
              style={{ background: '#F43F5E', color: '#fff' }}
            >
              {deleteAllByMonth.isPending ? "Apagando..." : "Apagar Tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #1A2535' }}>
        <Table style={{ minWidth: 880 }}>
          <TableHeader>
            <TableRow style={{ borderColor: '#1A2535' }}>
              <TableHead style={{ width: 180 }}>
                <SortHeader label="Cliente" field="client_name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead style={{ width: 110 }}>
                <SortHeader label="Valor" field="contract_total" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead style={{ width: 110 }}>
                <SortHeader label="Saldo" field="saldo" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead className="whitespace-nowrap" style={{ color: '#94A3B8', width: 80 }}>Parcela</TableHead>
              <TableHead style={{ width: 90 }}>
                <SortHeader label="Data Fech." field="closing_date" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead style={{ width: 110 }}>
                <SortHeader label="Pago" field="amount_paid" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead style={{ width: 110 }}>
                <SortHeader label="Comissão" field="commission_value" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead style={{ width: 105 }}>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ background: '#0D1318', border: 'none', color: statusFilter !== 'all' ? '#E8C97A' : '#94A3B8', cursor: 'pointer', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                >
                  <option value="all">Status ▾</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                  <option value="Parcial">Parcial</option>
                  <option value="Inadimplente">Inadimplente</option>
                </select>
              </TableHead>
              <TableHead className="whitespace-nowrap" style={{ color: '#94A3B8', width: 72 }}>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map(r => {
              const isEditing = editingId === r.id;
              if (isEditing) {
                const editCommission = (parseFloat(editForm.amount_paid) || 0) * 0.03;
                return (
                  <TableRow key={r.id} style={{ borderColor: '#1A2535', background: 'rgba(245,158,11,0.04)' }}>
                    <TableCell><input value={editForm.client_name} onChange={e => setEditForm(p => ({ ...p, client_name: e.target.value }))} style={{ ...inputStyle, width: '100%' }} /></TableCell>
                    <TableCell><input type="number" value={editForm.contract_total} onChange={e => setEditForm(p => ({ ...p, contract_total: e.target.value }))} style={{ ...inputStyle, width: '100%' }} /></TableCell>
                    <TableCell className="font-mono text-xs" style={{ color: '#F43F5E', fontWeight: 600 }}>{formatCurrency(Math.max(0, (parseFloat(String(editForm.balance_remaining)) || 0) - (parseFloat(String(editForm.amount_paid)) || 0)))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <input type="number" value={editForm.installment_current} onChange={e => setEditForm(p => ({ ...p, installment_current: e.target.value }))} style={{ ...inputStyle, width: 36, textAlign: 'center', padding: '4px 2px' }} />
                        <span style={{ color: '#4A5568' }}>/</span>
                        <input type="number" value={editForm.installment_total} onChange={e => setEditForm(p => ({ ...p, installment_total: e.target.value }))} style={{ ...inputStyle, width: 36, textAlign: 'center', padding: '4px 2px' }} />
                      </div>
                    </TableCell>
                    <TableCell><DatePicker value={editForm.closing_date} onChange={v => setEditForm(p => ({ ...p, closing_date: v }))} /></TableCell>
                    <TableCell><input type="number" value={editForm.amount_paid} onChange={e => setEditForm(p => ({ ...p, amount_paid: e.target.value }))} style={{ ...inputStyle, width: '100%' }} /></TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: '#E8C97A' }}>{formatCurrency(editCommission)}</TableCell>
                    <TableCell>
                      <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                        <SelectTrigger style={{ ...inputStyle, width: '100%' }}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button onClick={saveEdit} disabled={updateBilling.isPending} className="p-1.5 rounded-lg transition-colors hover:bg-green-500/10"><Check className="w-4 h-4" style={{ color: '#10B981' }} /></button>
                        <button onClick={cancelEdit} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"><X className="w-4 h-4" style={{ color: '#F43F5E' }} /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }
              return (
                <TableRow key={r.id} style={{ borderColor: '#1A2535' }}>
                  <TableCell style={{ maxWidth: 180, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => { onLoadRecord(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className="font-medium text-left w-full truncate transition-colors hover:underline"
                          style={{ color: '#F0F4F8', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          title={r.client_name}
                        >
                          {r.client_name}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs" style={{ background: '#0D1318', border: '1px solid #1A2535', padding: '10px 12px' }}>
                        <p className="font-semibold text-sm mb-1" style={{ color: '#F0F4F8' }}>{r.client_name}</p>
                        {r.notes && (
                          <p className="text-xs mb-1" style={{ color: '#94A3B8', whiteSpace: 'pre-wrap' }}>{r.notes}</p>
                        )}
                        <p className="text-xs" style={{ color: '#4A5568' }}>Clique para editar no formulário</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>{formatCurrency(r.contract_total ?? 0)}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: '#F43F5E' }}>{formatCurrency(Math.max(0, (r.balance_remaining ?? 0) - (r.amount_paid ?? 0)))}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>{r.installment_current ?? "—"}/{r.installment_total ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>{r.closing_date ? formatDate(r.closing_date) : "—"}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: '#10B981' }}>{formatCurrency(r.amount_paid ?? 0)}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: '#E8C97A' }}>{formatCurrency(r.commission_value ?? 0)}</TableCell>
                  <TableCell><WtBadge variant={statusBadge[r.status ?? ""] || "gray"}>{r.status ?? "—"}</WtBadge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { onLoadRecord(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-1.5 rounded-lg transition-colors hover:bg-amber-500/10"><Pencil className="w-4 h-4" style={{ color: '#F59E0B' }} /></button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"><Trash2 className="w-4 h-4" style={{ color: '#F43F5E' }} /></button>
                        </AlertDialogTrigger>
                        <AlertDialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                          <AlertDialogHeader>
                            <AlertDialogTitle style={{ color: '#F0F4F8' }}>Excluir registro?</AlertDialogTitle>
                            <AlertDialogDescription style={{ color: '#94A3B8' }}>Registro de {r.client_name} será removido permanentemente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel style={{ background: '#1A2535', color: '#F0F4F8', border: 'none' }}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => { try { await deleteBilling.mutateAsync(r.id); toast({ title: "Excluído" }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); } }} style={{ background: '#F43F5E', color: '#fff' }}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow style={{ borderColor: '#1A2535', background: 'rgba(201,168,76,0.05)' }}>
              <TableCell className="font-semibold whitespace-nowrap" style={{ color: '#E8C97A' }}>TOTAL</TableCell>
              <TableCell className="font-mono text-xs font-semibold whitespace-nowrap" style={{ color: '#94A3B8' }}>{formatCurrency(totalValor)}</TableCell>
              <TableCell className="font-mono text-xs font-semibold whitespace-nowrap" style={{ color: '#F43F5E' }}>{formatCurrency(totalSaldo)}</TableCell>
              <TableCell colSpan={2} />
              <TableCell className="font-mono text-xs font-semibold whitespace-nowrap" style={{ color: '#10B981' }}>{formatCurrency(totalPago)}</TableCell>
              <TableCell className="font-mono text-xs font-semibold whitespace-nowrap" style={{ color: '#E8C97A' }}>{formatCurrency(totalComissao)}</TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </PremiumCard>
  );
}

