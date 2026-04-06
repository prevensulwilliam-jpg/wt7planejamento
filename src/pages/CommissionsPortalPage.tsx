import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { DatePicker } from "@/components/wt7/DatePicker";
import { GoldButton } from "@/components/wt7/GoldButton";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { WT7Logo } from "@/components/wt7/WT7Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrevensulBilling, useBillingSummary, useCreateBilling, useDeleteBilling, useImportHistory, useCreateImportHistory, exportCSV } from "@/hooks/useBilling";
import { formatCurrency, formatMonth, getCurrentMonth, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Upload, Trash2, FileSpreadsheet, Download, ArrowLeft } from "lucide-react";
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
  return (
    <div className="space-y-6 mt-4">
      <PrevensulKPIs month={month} />
      <PrevensulForm month={month} userId={userId} />
      <PrevensulExcelImport month={month} userId={userId} />
      <PrevensulHistory month={month} />
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

function PrevensulForm({ month, userId }: { month: string; userId: string }) {
  const { toast } = useToast();
  const createBilling = useCreateBilling();
  const [form, setForm] = useState({
    client_name: "", contract_total: "", contract_nf: "",
    installment_current: "", installment_total: "",
    closing_date: "", amount_paid: "", status: "Pendente", notes: "",
  });

  const commission = useMemo(() => (parseFloat(form.amount_paid) || 0) * 0.03, [form.amount_paid]);

  const handleSubmit = async () => {
    if (!form.client_name || !form.amount_paid) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" }); return;
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
        commission_value: paid * 0.03,
        balance_remaining: contractTotal - paid > 0 ? contractTotal - paid : 0,
        status: form.status,
        reference_month: month,
        notes: form.notes || null,
        created_by: userId,
      });
      toast({ title: "Faturamento registrado!" });
      setForm({ client_name: "", contract_total: "", contract_nf: "", installment_current: "", installment_total: "", closing_date: "", amount_paid: "", status: "Pendente", notes: "" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const inputStyle = { background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' };

  return (
    <PremiumCard>
      <h2 className="font-display font-semibold text-lg mb-4" style={{ color: '#F0F4F8' }}>Registrar Faturamento</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Cliente *</label>
          <Input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} style={inputStyle} placeholder="Nome do cliente" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Valor total contrato (R$)</label>
          <Input type="number" value={form.contract_total} onChange={e => setForm(p => ({ ...p, contract_total: e.target.value }))} style={inputStyle} placeholder="0,00" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Contrato / NF</label>
          <Input value={form.contract_nf} onChange={e => setForm(p => ({ ...p, contract_nf: e.target.value }))} style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Parcela atual</label>
            <Input type="number" value={form.installment_current} onChange={e => setForm(p => ({ ...p, installment_current: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Total parcelas</label>
            <Input type="number" value={form.installment_total} onChange={e => setForm(p => ({ ...p, installment_total: e.target.value }))} style={inputStyle} />
          </div>
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Data fechamento</label>
          <DatePicker value={form.closing_date} onChange={v => setForm(p => ({ ...p, closing_date: v }))} />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Valor recebido (R$) *</label>
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
        <div className="md:col-span-2">
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Observações</label>
          <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} rows={2} />
        </div>
      </div>
      <div className="mt-4 rounded-xl p-4 flex items-center justify-between" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
        <span className="font-mono text-sm" style={{ color: '#E8C97A' }}>Comissão William (3%)</span>
        <span className="font-mono text-xl font-bold" style={{ color: '#C9A84C' }}>{formatCurrency(commission)}</span>
      </div>
      <div className="mt-4 flex justify-end">
        <GoldButton onClick={handleSubmit} disabled={createBilling.isPending}>
          {createBilling.isPending ? "Salvando..." : "Registrar Faturamento"}
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
        const commValue = row.commission_value || row.amount_paid * 0.03;
        await createBilling.mutateAsync({ ...row, commission_rate: 0.03, commission_value: commValue, reference_month: month, created_by: userId });
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

function PrevensulHistory({ month }: { month: string }) {
  const { data = [], isLoading } = usePrevensulBilling(month);
  const deleteBilling = useDeleteBilling();
  const { toast } = useToast();

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (data.length === 0) return (
    <PremiumCard><p className="text-center py-8 font-mono text-sm" style={{ color: '#4A5568' }}>Nenhum faturamento neste mês</p></PremiumCard>
  );

  return (
    <PremiumCard>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-lg" style={{ color: '#F0F4F8' }}>Histórico do Mês</h2>
        <button onClick={() => exportCSV(data, `comissoes_${month}.csv`)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(201,168,76,0.15)', color: '#E8C97A' }}>
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>
      <div className="overflow-auto rounded-xl" style={{ border: '1px solid #1A2535' }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: '#1A2535' }}>
              <TableHead style={{ color: '#94A3B8' }}>Cliente</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>NF</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Parcela</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Contrato</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Recebido</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Comissão</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Status</TableHead>
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
                <TableCell className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(r.amount_paid ?? 0)}</TableCell>
                <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(r.commission_value ?? 0)}</TableCell>
                <TableCell><WtBadge variant={statusBadge[r.status ?? ""] || "gray"}>{r.status}</WtBadge></TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PremiumCard>
  );
}

