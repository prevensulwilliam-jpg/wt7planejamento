import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { DatePicker } from "@/components/wt7/DatePicker";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GoldButton } from "@/components/wt7/GoldButton";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { WT7Logo } from "@/components/wt7/WT7Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrevensulBilling, useBillingSummary, useCreateBilling, useUpdateBilling, useDeleteBilling, useImportHistory, useCreateImportHistory } from "@/hooks/useBilling";
import { formatCurrency, formatMonth, getCurrentMonth, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Upload, Trash2, FileSpreadsheet, Pencil } from "lucide-react";
import * as XLSX from "xlsx";

const statusOptions = [
  { value: "Pendente", label: "Pendente" },
  { value: "Pago", label: "Pago" },
  { value: "Parcial", label: "Parcial" },
  { value: "Inadimplente", label: "Inadimplente" },
];

const statusBadge: Record<string, "green" | "gold" | "red" | "cyan" | "gray"> = {
  Pago: "green",
  Parcial: "gold",
  Pendente: "cyan",
  Inadimplente: "red",
};

export default function FinancialBillingPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [month, setMonth] = useState(getCurrentMonth());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login", { replace: true }); return; }
      setUserId(user.id);
      const { data: isFin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "financial" });
      if (!isFin) {
        const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (!isAdmin) { navigate("/login", { replace: true }); return; }
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
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold" style={{ color: '#F0F4F8' }}>
            Faturamento — {formatMonth(month)}
          </h1>
          <MonthPicker value={month} onChange={v => setMonth(v)} className="w-44" />
        </div>
        <KPISection month={month} />
        <BillingForm month={month} userId={userId} />
        <ExcelImport month={month} userId={userId} />
        <BillingHistory month={month} />
        <ImportHistorySection />
      </main>
    </div>
  );
}

function Header() {
  const navigate = useNavigate();
  return (
    <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1A2535' }}>
      <div className="flex items-center gap-3">
        <WT7Logo size="sm" />
        <span className="font-display font-semibold text-lg" style={{ color: '#2DD4BF' }}>
          Portal Financeiro Prevensul
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

function KPISection({ month }: { month: string }) {
  const { totalBilled, totalReceived, totalCommission, totalRecords, isLoading } = useBillingSummary(month);
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Total Faturado" value={totalBilled} color="cyan" compact />
      <KpiCard label="Total Recebido" value={totalReceived} color="green" compact />
      <KpiCard label="Comissão William" value={totalCommission} color="gold" compact />
      <KpiCard label="NFs Lançadas" value={totalRecords} color="cyan" compact />
    </div>
  );
}

function BillingForm({ month, userId }: { month: string; userId: string }) {
  const { toast } = useToast();
  const createBilling = useCreateBilling();
  const [form, setForm] = useState({
    client_name: "", contract_total: "", balance_remaining: "", contract_nf: "",
    installment_current: "", installment_total: "",
    closing_date: "", amount_paid: "", status: "Pendente",
    notes: "",
  });

  const { commission, newBalance } = useMemo(() => {
    const paid = parseFloat(form.amount_paid) || 0;
    const saldo = parseFloat(form.balance_remaining) || parseFloat(form.contract_total) || 0;
    return {
      commission: paid * 0.03,
      newBalance: Math.max(0, saldo - paid),
    };
  }, [form.amount_paid, form.balance_remaining, form.contract_total]);

  const handleSubmit = async () => {
    if (!form.client_name || !form.amount_paid) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    const paid = parseFloat(form.amount_paid) || 0;
    const contractTotal = parseFloat(form.contract_total) || 0;
    try {
      await createBilling.mutateAsync({
        client_name: form.client_name,
        contract_total: contractTotal,
        contract_nf: form.contract_nf || null,
        installment_current: parseInt(form.installment_current) || null,
        installment_total: parseInt(form.installment_total) || null,
        closing_date: form.closing_date || null,
        amount_paid: paid,
        commission_rate: 0.03,
        balance_remaining: parseFloat(form.balance_remaining) || contractTotal,
        status: form.status,
        reference_month: month,
        notes: form.notes || null,
        created_by: userId,
      });
      toast({ title: "Faturamento registrado com sucesso!" });
      setForm({ client_name: "", contract_total: "", balance_remaining: "", contract_nf: "", installment_current: "", installment_total: "", closing_date: "", amount_paid: "", status: "Pendente", notes: "" });
    } catch (e: any) {
      toast({ title: "Erro ao registrar", description: e.message, variant: "destructive" });
    }
  };

  const inputStyle = { background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' };

  return (
    <PremiumCard>
      <h2 className="font-display font-semibold text-lg mb-4" style={{ color: '#F0F4F8' }}>
        Registrar Faturamento
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Cliente *</label>
          <Input value={form.client_name} onChange={(e) => setForm(p => ({ ...p, client_name: e.target.value }))} style={inputStyle} placeholder="Nome do cliente" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Valor total contrato (R$)</label>
          <Input type="number" value={form.contract_total} onChange={(e) => setForm(p => ({ ...p, contract_total: e.target.value }))} style={inputStyle} placeholder="0,00" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Saldo atual (R$)</label>
          <Input type="number" value={form.balance_remaining} onChange={(e) => setForm(p => ({ ...p, balance_remaining: e.target.value }))} style={inputStyle} placeholder="Deixe vazio para usar valor total" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Contrato / NF</label>
          <Input value={form.contract_nf} onChange={(e) => setForm(p => ({ ...p, contract_nf: e.target.value }))} style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Parcela atual</label>
            <Input type="number" value={form.installment_current} onChange={(e) => setForm(p => ({ ...p, installment_current: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Total parcelas</label>
            <Input type="number" value={form.installment_total} onChange={(e) => setForm(p => ({ ...p, installment_total: e.target.value }))} style={inputStyle} />
          </div>
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Data fechamento</label>
          <DatePicker value={form.closing_date} onChange={v => setForm(p => ({ ...p, closing_date: v }))} />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Valor recebido (R$) *</label>
          <Input type="number" value={form.amount_paid} onChange={(e) => setForm(p => ({ ...p, amount_paid: e.target.value }))} style={inputStyle} placeholder="0,00" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Saldo após pagamento</label>
          <div className="px-3 py-2 rounded-md font-mono text-sm" style={{ background: '#0D1318', border: '1px solid #1A2535', color: '#F43F5E' }}>
            {formatCurrency(newBalance)}
          </div>
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Status</label>
          <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v }))}>
            <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Observações</label>
          <Textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} rows={2} />
        </div>
      </div>

      {/* Commission card */}
      <div className="mt-4 rounded-xl p-4 flex items-center justify-between" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
        <span className="font-mono text-sm" style={{ color: '#E8C97A' }}>Comissão William (3%)</span>
        <span className="font-mono text-xl font-bold" style={{ color: '#C9A84C' }}>{formatCurrency(commission)}</span>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={createBilling.isPending}
          className="px-6 py-2.5 rounded-xl font-medium text-sm transition-all"
          style={{ background: '#2DD4BF', color: '#080C10' }}
        >
          {createBilling.isPending ? "Salvando..." : "Registrar Faturamento"}
        </button>
      </div>
    </PremiumCard>
  );
}

function ExcelImport({ month, userId }: { month: string; userId: string }) {
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
      // Try to find sheet matching current month MMYYYY
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
    let imported = 0;
    let totalPaid = 0;
    let totalComm = 0;
    try {
      for (const row of preview) {
        const isDuplicate = existing.some(
          e => e.client_name === row.client_name && e.installment_current === row.installment_current
        );
        if (isDuplicate) continue;
        const commValue = row.commission_value || row.amount_paid * 0.03;
        await createBilling.mutateAsync({
          ...row,
          commission_rate: 0.03,
          commission_value: commValue,
          reference_month: month,
          created_by: userId,
        });
        imported++;
        totalPaid += row.amount_paid;
        totalComm += commValue;
      }
      await createImport.mutateAsync({
        file_name: fileName,
        reference_month: month,
        records_imported: imported,
        total_paid: totalPaid,
        total_commission: totalComm,
        imported_by: userId,
      });
      toast({ title: `${imported} registros importados com sucesso!` });
      setPreview([]);
      setFileName("");
    } catch (e: any) {
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <PremiumCard>
      <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: '#F0F4F8' }}>
        <FileSpreadsheet className="w-5 h-5" style={{ color: '#2DD4BF' }} />
        Importar Planilha Excel
      </h2>
      <div className="flex items-center gap-4 flex-wrap">
        <label className="cursor-pointer px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2" style={{ background: '#2DD4BF', color: '#080C10' }}>
          <Upload className="w-4 h-4" /> Selecionar arquivo .xlsx
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        </label>
        {fileName && <span className="text-sm font-mono" style={{ color: '#94A3B8' }}>{fileName}</span>}
        {sheetNames.length > 1 && (
          <Select value={selectedSheet} onValueChange={handleSheetChange}>
            <SelectTrigger className="w-40" style={{ background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sheetNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
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
                  <TableHead style={{ color: '#94A3B8' }}>Comissão (3%)</TableHead>
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
          <button
            onClick={handleConfirm}
            disabled={importing}
            className="px-6 py-2.5 rounded-xl font-medium text-sm transition-all"
            style={{ background: '#2DD4BF', color: '#080C10' }}
          >
            {importing ? "Importando..." : "Confirmar Import"}
          </button>
        </div>
      )}
    </PremiumCard>
  );
}

function BillingHistory({ month }: { month: string }) {
  const { data = [], isLoading } = usePrevensulBilling(month);
  const deleteBilling = useDeleteBilling();
  const updateBilling = useUpdateBilling();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editRow, setEditRow] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ amount_paid: "", status: "", notes: "" });

  const openEdit = (r: any) => {
    setEditRow(r);
    setEditForm({
      amount_paid: String(r.amount_paid ?? ""),
      status: r.status ?? "Pendente",
      notes: r.notes ?? "",
    });
  };

  // Saldo exibido = balance_remaining (base) - amount_paid (calculado na UI, não no banco)
  const editSaldoAtual = useMemo(() => {
    if (!editRow) return 0;
    const base = editRow.balance_remaining ?? 0;
    const paid = parseFloat(editForm.amount_paid) || 0;
    return Math.max(0, base - paid);
  }, [editRow, editForm.amount_paid]);

  const handleUpdate = async () => {
    if (!editRow) return;
    const newPaid = parseFloat(editForm.amount_paid) || 0;
    // Só atualiza amount_paid — balance_remaining é o saldo base e não muda
    const { error } = await supabase
      .from("prevensul_billing")
      .update({ amount_paid: newPaid, status: editForm.status, notes: editForm.notes || null })
      .eq("id", editRow.id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message + " | code: " + error.code, variant: "destructive" });
      return;
    }
    await qc.invalidateQueries({ queryKey: ["prevensul_billing"] });
    toast({ title: "Registro atualizado!" });
    setEditRow(null);
  };

  const inputStyle = { background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' };

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (data.length === 0) {
    return (
      <PremiumCard>
        <p className="text-center py-8 font-mono text-sm" style={{ color: '#4A5568' }}>
          Nenhum faturamento registrado neste mês
        </p>
      </PremiumCard>
    );
  }

  return (
    <>
    <Dialog open={!!editRow} onOpenChange={(open) => { if (!open) setEditRow(null); }}>
      <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
        <DialogHeader>
          <DialogTitle style={{ color: '#F0F4F8' }}>Editar — {editRow?.client_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Valor recebido (R$)</label>
            <Input
              type="number"
              value={editForm.amount_paid}
              onChange={(e) => setEditForm(p => ({ ...p, amount_paid: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Saldo devedor</label>
            <div className="px-3 py-2 rounded-md font-mono text-sm font-bold" style={{ background: '#0D1318', border: '1px solid #1A2535', color: '#F43F5E' }}>
              {formatCurrency(editSaldoAtual)}
            </div>
            <p className="text-xs mt-1 font-mono" style={{ color: '#4A5568' }}>Saldo base: {formatCurrency(editRow?.balance_remaining ?? 0)} − Pago: {formatCurrency(parseFloat(editForm.amount_paid) || 0)}</p>
          </div>
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Status</label>
            <Select value={editForm.status} onValueChange={(v) => setEditForm(p => ({ ...p, status: v }))}>
              <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Observações</label>
            <Textarea value={editForm.notes} onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => setEditRow(null)} className="px-4 py-2 rounded-lg text-sm" style={{ background: '#1A2535', color: '#F0F4F8' }}>Cancelar</button>
          <button onClick={handleUpdate} disabled={updateBilling.isPending} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#2DD4BF', color: '#080C10' }}>
            {updateBilling.isPending ? "Salvando..." : "Salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <PremiumCard>
      <h2 className="font-display font-semibold text-lg mb-4" style={{ color: '#F0F4F8' }}>
        Histórico do Mês
      </h2>
      <div className="overflow-auto rounded-xl" style={{ border: '1px solid #1A2535' }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: '#1A2535' }}>
              <TableHead style={{ color: '#94A3B8' }}>Cliente</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Contrato/NF</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Parcela</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Valor Contrato</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Saldo</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Recebido</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Comissão</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Status</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Data</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(r => (
              <TableRow key={r.id} style={{ borderColor: '#1A2535' }}>
                <TableCell style={{ color: '#F0F4F8' }}>{r.client_name}</TableCell>
                <TableCell className="font-mono" style={{ color: '#94A3B8' }}>{r.contract_nf || "—"}</TableCell>
                <TableCell className="font-mono" style={{ color: '#94A3B8' }}>{r.installment_current ?? "—"}/{r.installment_total ?? "—"}</TableCell>
                <TableCell className="font-mono" style={{ color: '#94A3B8' }}>{formatCurrency(r.contract_total ?? 0)}</TableCell>
                <TableCell className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(Math.max(0, (r.balance_remaining ?? 0) - (r.amount_paid ?? 0)))}</TableCell>
                <TableCell className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(r.amount_paid ?? 0)}</TableCell>
                <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(r.commission_value ?? 0)}</TableCell>
                <TableCell><WtBadge variant={statusBadge[r.status ?? ""] || "gray"}>{r.status}</WtBadge></TableCell>
                <TableCell className="font-mono text-xs" style={{ color: '#94A3B8' }}>{r.closing_date ? formatDate(r.closing_date) : "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg transition-colors hover:bg-teal-500/10">
                      <Pencil className="w-4 h-4" style={{ color: '#E8C97A' }} />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" style={{ color: '#F43F5E' }} />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                        <AlertDialogHeader>
                          <AlertDialogTitle style={{ color: '#F0F4F8' }}>Excluir registro?</AlertDialogTitle>
                          <AlertDialogDescription style={{ color: '#94A3B8' }}>
                            Essa ação não pode ser desfeita. O registro de {r.client_name} será removido permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel style={{ background: '#1A2535', color: '#F0F4F8', border: 'none' }}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              try {
                                await deleteBilling.mutateAsync(r.id);
                                toast({ title: "Registro excluído" });
                              } catch (e: any) {
                                toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
                              }
                            }}
                            style={{ background: '#F43F5E', color: '#fff' }}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PremiumCard>
    </>
  );
}

function ImportHistorySection() {
  const { data = [], isLoading } = useImportHistory();
  if (isLoading) return <Skeleton className="h-32 rounded-2xl" />;
  if (data.length === 0) return null;

  return (
    <PremiumCard>
      <h2 className="font-display font-semibold text-lg mb-4" style={{ color: '#F0F4F8' }}>
        Histórico de Imports
      </h2>
      <div className="overflow-auto rounded-xl" style={{ border: '1px solid #1A2535' }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: '#1A2535' }}>
              <TableHead style={{ color: '#94A3B8' }}>Arquivo</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Mês</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Registros</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Total Recebido</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Comissão Total</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Data Import</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(r => (
              <TableRow key={r.id} style={{ borderColor: '#1A2535' }}>
                <TableCell className="font-mono text-xs" style={{ color: '#F0F4F8' }}>{r.file_name}</TableCell>
                <TableCell style={{ color: '#94A3B8' }}>{r.reference_month ? formatMonth(r.reference_month) : "—"}</TableCell>
                <TableCell className="font-mono" style={{ color: '#2DD4BF' }}>{r.records_imported}</TableCell>
                <TableCell className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(r.total_paid ?? 0)}</TableCell>
                <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(r.total_commission ?? 0)}</TableCell>
                <TableCell className="font-mono text-xs" style={{ color: '#94A3B8' }}>{r.imported_at ? formatDate(r.imported_at) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PremiumCard>
  );
}
