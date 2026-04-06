import { useState, useEffect, useMemo, useRef } from "react";
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
import { usePrevensulBilling, useBillingSummary, useCreateBilling, useUpdateBilling, useDeleteBilling, useReplicateMonth, useImportHistory, useCreateImportHistory, exportCSV } from "@/hooks/useBilling";
import { formatCurrency, formatMonth, getCurrentMonth, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Upload, Trash2, FileSpreadsheet, Download, ArrowLeft, Pencil, Check, X, Copy, RotateCcw } from "lucide-react";
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
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
            style={{ color: '#94A3B8', border: '1px solid #1A2535' }}
          >
            <ArrowLeft className="w-3 h-3" /> Dashboard
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
  const { totalBilled, totalReceived, totalCommission, totalRecords, isLoading } = useBillingSummary(month);
  if (isLoading) return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Total Faturado" value={totalBilled} color="cyan" compact />
      <KpiCard label="Total Recebido" value={totalReceived} color="green" compact />
      <KpiCard label="Comissão Total" value={totalCommission} color="gold" compact />
      <KpiCard label="NFs Lançadas" value={totalRecords} color="cyan" compact />
    </div>
  );
}

const EMPTY_FORM = { client_name: "", contract_total: "", balance_remaining: "", contract_nf: "", installment_current: "", installment_total: "", closing_date: "", amount_paid: "", status: "Pendente", notes: "" };

function PrevensulForm({ month, userId, editRecord, onClearEdit }: { month: string; userId: string; editRecord: any | null; onClearEdit: () => void }) {
  const { toast } = useToast();
  const createBilling = useCreateBilling();
  const updateBillingForm = useUpdateBilling();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

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
    setEditingRecordId(editRecord.id);
  }, [editRecord]);

  const commission = useMemo(() => (parseFloat(form.amount_paid) || 0) * 0.03, [form.amount_paid]);
  const isEditing = editingRecordId !== null;

  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setEditingRecordId(null);
    onClearEdit();
  };

  const handleSubmit = async () => {
    if (!form.client_name || !form.amount_paid) {
      toast({ title: "Preencha Cliente e Pago", variant: "destructive" }); return;
    }
    const paid = parseFloat(form.amount_paid) || 0;
    const payload = {
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
    };
    try {
      if (isEditing) {
        await updateBillingForm.mutateAsync({ id: editingRecordId!, ...payload });
        toast({ title: "Registro atualizado!" });
      } else {
        await createBilling.mutateAsync({ ...payload, reference_month: month, created_by: userId });
        toast({ title: "Faturamento registrado!" });
      }
      handleCancel();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const isPending = createBilling.isPending || updateBillingForm.isPending;
  const inputStyle = { background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' };

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

        {/* Linha 2: Saldo + Contr/NF + Parcela */}
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Saldo (R$)</label>
          <Input type="number" value={form.balance_remaining} onChange={e => setForm(p => ({ ...p, balance_remaining: e.target.value }))} style={inputStyle} placeholder="0,00" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Contr/NF</label>
          <Input value={form.contract_nf} onChange={e => setForm(p => ({ ...p, contract_nf: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Parcela</label>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" value={form.installment_current} onChange={e => setForm(p => ({ ...p, installment_current: e.target.value }))} style={inputStyle} placeholder="Atual" />
            <Input type="number" value={form.installment_total} onChange={e => setForm(p => ({ ...p, installment_total: e.target.value }))} style={inputStyle} placeholder="Total" />
          </div>
        </div>

        {/* Linha 3: Data Fech. + Pago + Status */}
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Data Fech.</label>
          <Input value={form.closing_date} onChange={e => setForm(p => ({ ...p, closing_date: e.target.value }))} style={inputStyle} placeholder="ex: mar/26, MENSAL" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Pago (R$) *</label>
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

        {/* Linha 4: Observações — full width */}
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

      {/* Comissão + Botão */}
      <div className="mt-4 flex items-center justify-between">
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
          <span className="font-mono text-sm" style={{ color: '#E8C97A' }}>Comissão (3%)</span>
          <span className="font-mono text-xl font-bold" style={{ color: '#C9A84C' }}>{formatCurrency(commission)}</span>
        </div>
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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "array" });
      setWorkbookRef(wb);
      setSheetNames(wb.SheetNames);
      const [y, m] = month.split("-");
      const target = `${m}${y}`;
      const found = wb.SheetNames.find(n => n.includes(target)) || wb.SheetNames[0];
      setSelectedSheet(found);
      parseSheet(wb, found);
    };
    reader.readAsArrayBuffer(file);
  };

  const parseSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
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
    setPreview(rows);
  };

  const parseExcelDate = (val: any): string | null => {
    if (typeof val === "number") {
      const d = XLSX.SSF.parse_date_code(val);
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    if (typeof val === "string") {
      const parts = val.split("/");
      if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return null;
  };

  const handleSheetChange = (name: string) => {
    setSelectedSheet(name);
    if (workbookRef) parseSheet(workbookRef, name);
  };

  const handleConfirm = async () => {
    setImporting(true);
    let imported = 0, totalPaid = 0, totalComm = 0;
    try {
      for (const row of preview) {
        const isDuplicate = existing.some(e => e.client_name === row.client_name && e.installment_current === row.installment_current);
        if (isDuplicate) continue;
        const { commission_value: _cv, ...rowWithoutCommission } = row;
        await createBilling.mutateAsync({ ...rowWithoutCommission, commission_rate: 0.03, reference_month: month, created_by: userId });
        imported++;
        totalPaid += row.amount_paid;
        totalComm += commValue;
      }
      await createImport.mutateAsync({ file_name: fileName, reference_month: month, records_imported: imported, total_paid: totalPaid, total_commission: totalComm, imported_by: userId });
      toast({ title: `${imported} registros importados!` });
      setPreview([]); setFileName("");
    } catch (e: any) {
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  return (
    <PremiumCard>
      <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: '#F0F4F8' }}>
        <FileSpreadsheet className="w-5 h-5" style={{ color: '#F59E0B' }} /> Importar Planilha Excel
      </h2>
      <div className="flex items-center gap-4 flex-wrap">
        <label className="cursor-pointer px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2" style={{ background: '#F59E0B', color: '#080C10' }}>
          <Upload className="w-4 h-4" /> Selecionar .xlsx
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        </label>
        {fileName && <span className="text-sm font-mono" style={{ color: '#94A3B8' }}>{fileName}</span>}
        {sheetNames.length > 1 && (
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
          <GoldButton onClick={handleConfirm} disabled={importing}>
            {importing ? "Importando..." : "Confirmar Import"}
          </GoldButton>
        </div>
      )}
    </PremiumCard>
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
  const updateBilling = useUpdateBilling();
  const replicateMonth = useReplicateMonth();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const totalPago = useMemo(() => data.reduce((s, r) => s + (r.amount_paid ?? 0), 0), [data]);
  const totalComissao = useMemo(() => data.reduce((s, r) => s + (r.commission_value ?? 0), 0), [data]);

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
    const paid = parseFloat(editForm.amount_paid) || 0;
    try {
      await updateBilling.mutateAsync({
        id: editingId,
        client_name: editForm.client_name,
        contract_total: parseFloat(editForm.contract_total) || 0,
        balance_remaining: parseFloat(editForm.balance_remaining) || 0,
        contract_nf: editForm.contract_nf || null,
        installment_current: parseInt(editForm.installment_current) || null,
        installment_total: parseInt(editForm.installment_total) || null,
        closing_date: editForm.closing_date || null,
        amount_paid: paid,
        status: editForm.status,
      });
      toast({ title: "Atualizado!" });
      cancelEdit();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
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
        <button onClick={() => exportCSV(data, `comissoes_${month}.csv`)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(201,168,76,0.15)', color: '#E8C97A' }}>
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #1A2535' }}>
        <Table style={{ minWidth: 980 }}>
          <TableHeader>
            <TableRow style={{ borderColor: '#1A2535' }}>
              <TableHead className="whitespace-nowrap" style={{ color: '#94A3B8', width: 180 }}>Cliente</TableHead>
              <TableHead className="whitespace-nowrap" style={{ color: '#94A3B8', width: 110 }}>Valor</TableHead>
              <TableHead className="whitespace-nowrap" style={{ color: '#94A3B8', width: 110 }}>Saldo</TableHead>
              <TableHead className="whitespace-nowrap" style={{ color: '#94A3B8', width: 90 }}>Contr/NF</TableHead>
              <TableHead className="whitespace-nowrap" style={{ color: '#94A3B8', width: 80 }}>Parcela</TableHead>
              <TableHead className="whitespace-nowrap" style={{ color: '#94A3B8', width: 90 }}>Data Fech.</TableHead>
              <TableHead className="whitespace-nowrap" style={{ color: '#94A3B8', width: 110 }}>Pago</TableHead>
              <TableHead className="whitespace-nowrap" style={{ color: '#94A3B8', width: 110 }}>Comissão</TableHead>
              <TableHead className="whitespace-nowrap" style={{ color: '#94A3B8', width: 105 }}>Status</TableHead>
              <TableHead className="whitespace-nowrap" style={{ color: '#94A3B8', width: 72 }}>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(r => {
              const isEditing = editingId === r.id;
              if (isEditing) {
                const editCommission = (parseFloat(editForm.amount_paid) || 0) * 0.03;
                return (
                  <TableRow key={r.id} style={{ borderColor: '#1A2535', background: 'rgba(245,158,11,0.04)' }}>
                    <TableCell><input value={editForm.client_name} onChange={e => setEditForm(p => ({ ...p, client_name: e.target.value }))} style={{ ...inputStyle, width: '100%' }} /></TableCell>
                    <TableCell><input type="number" value={editForm.contract_total} onChange={e => setEditForm(p => ({ ...p, contract_total: e.target.value }))} style={{ ...inputStyle, width: '100%' }} /></TableCell>
                    <TableCell><input type="number" value={editForm.balance_remaining} onChange={e => setEditForm(p => ({ ...p, balance_remaining: e.target.value }))} style={{ ...inputStyle, width: '100%' }} /></TableCell>
                    <TableCell><input value={editForm.contract_nf} onChange={e => setEditForm(p => ({ ...p, contract_nf: e.target.value }))} style={{ ...inputStyle, width: '100%' }} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <input type="number" value={editForm.installment_current} onChange={e => setEditForm(p => ({ ...p, installment_current: e.target.value }))} style={{ ...inputStyle, width: 36, textAlign: 'center', padding: '4px 2px' }} />
                        <span style={{ color: '#4A5568' }}>/</span>
                        <input type="number" value={editForm.installment_total} onChange={e => setEditForm(p => ({ ...p, installment_total: e.target.value }))} style={{ ...inputStyle, width: 36, textAlign: 'center', padding: '4px 2px' }} />
                      </div>
                    </TableCell>
                    <TableCell><input value={editForm.closing_date} onChange={e => setEditForm(p => ({ ...p, closing_date: e.target.value }))} style={{ ...inputStyle, width: '100%' }} /></TableCell>
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
                          onClick={() => onLoadRecord(r)}
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
                  <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: '#F43F5E' }}>{formatCurrency(r.balance_remaining ?? 0)}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>{r.contract_nf || "—"}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>{r.installment_current ?? "—"}/{r.installment_total ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>{r.closing_date || "—"}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: '#10B981' }}>{formatCurrency(r.amount_paid ?? 0)}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: '#E8C97A' }}>{formatCurrency(r.commission_value ?? 0)}</TableCell>
                  <TableCell><WtBadge variant={statusBadge[r.status ?? ""] || "gray"}>{r.status ?? "—"}</WtBadge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(r)} className="p-1.5 rounded-lg transition-colors hover:bg-amber-500/10"><Pencil className="w-4 h-4" style={{ color: '#F59E0B' }} /></button>
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
              <TableCell colSpan={6} className="font-semibold whitespace-nowrap" style={{ color: '#E8C97A' }}>TOTAL</TableCell>
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

