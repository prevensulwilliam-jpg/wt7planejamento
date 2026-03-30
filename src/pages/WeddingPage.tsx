import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWeddingInstallments, useUpdateWeddingInstallment, useWeddingVendors, useCreateWeddingVendor, useUpdateWeddingVendor, useDeleteWeddingVendor, useCreateVendorPayment, useUpdateVendorPayment, useDeleteVendorPayment, uploadWeddingFile } from "@/hooks/useConstructions";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, Check, Clock, Plus, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const WEDDING_DATE = new Date("2027-12-11");
const TOTAL_CONTRACTED = 98110;
const TOTAL_BUDGET = 170000;
const RESERVA = 19622;

const milestones = [
  { done: true, label: "Reserva data", date: "31/12/2025" },
  { done: false, label: "Degustação cardápio", date: "até jun/2027" },
  { done: false, label: "Definir decoração", date: "até ago/2027" },
  { done: false, label: "Contratar fotógrafo", date: "até dez/2026" },
  { done: false, label: "Contratar banda/DJ extras", date: "até dez/2026" },
  { done: false, label: "Confirmar lista convidados", date: "até out/2027" },
  { done: false, label: "Início parcelas", date: "jan/2027" },
  { done: false, label: "Casamento", date: "11/12/2027", highlight: true },
];

// ─── Vendors Tab ───────────────────────────────────────────────────────────────

function VendorsTab() {
  const { data: vendors = [], isLoading } = useWeddingVendors();
  const createVendor = useCreateWeddingVendor();
  const { toast } = useToast();

  const [newOpen, setNewOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [newForm, setNewForm] = useState({
    service: "", vendor_name: "", status: "a_contratar",
    estimated_value: "", contracted_value: "", notes: ""
  });

  const totalEstimado = vendors.reduce((s: number, v: any) => s + (v.estimated_value ?? 0), 0);
  const totalContratado = vendors.filter((v: any) => v.contracted_value).reduce((s: number, v: any) => s + (v.contracted_value ?? 0), 0);
  const totalPago = vendors.flatMap((v: any) => v.wedding_vendor_payments ?? [])
    .filter((p: any) => p.status === "paid")
    .reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
  const aPagar = totalContratado - totalPago;

  const statusConfig: Record<string, { label: string; color: string; badge: string }> = {
    incluido_pacote: { label: "No Pacote", color: "#10B981", badge: "green" },
    contratado: { label: "Contratado", color: "#2DD4BF", badge: "cyan" },
    a_contratar: { label: "A Contratar", color: "#C9A84C", badge: "gold" },
    noivos_trazem: { label: "Noivos", color: "#94A3B8", badge: "gray" },
  };

  const handleCreate = async () => {
    if (!newForm.service) return;
    try {
      await createVendor.mutateAsync({
        service: newForm.service,
        vendor_name: newForm.vendor_name || null,
        status: newForm.status,
        estimated_value: parseFloat(newForm.estimated_value) || 0,
        contracted_value: newForm.contracted_value ? parseFloat(newForm.contracted_value) : null,
        notes: newForm.notes || null,
      });
      toast({ title: "Fornecedor adicionado!" });
      setNewOpen(false);
      setNewForm({ service: "", vendor_name: "", status: "a_contratar", estimated_value: "", contracted_value: "", notes: "" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  if (isLoading) return <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Estimado Total", value: totalEstimado, color: "gray" as const },
          { label: "Contratado", value: totalContratado, color: "cyan" as const },
          { label: "Já Pago", value: totalPago, color: "green" as const },
          { label: "A Pagar", value: aPagar, color: "gold" as const },
        ].map(({ label, value, color }) => (
          <KpiCard key={label} label={label} value={value} color={color} compact />
        ))}
      </div>

      {/* Botão novo */}
      <div className="flex justify-end">
        <GoldButton onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Fornecedor
        </GoldButton>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {vendors.map((vendor: any) => {
          const cfg = statusConfig[vendor.status] ?? statusConfig.a_contratar;
          const payments = vendor.wedding_vendor_payments ?? [];
          const pago = payments.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + p.amount, 0);
          const pendente = payments.filter((p: any) => p.status !== "paid").reduce((s: number, p: any) => s + p.amount, 0);
          const hasContract = !!vendor.contract_file_url;

          return (
            <PremiumCard key={vendor.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <WtBadge variant={cfg.badge as any}>{cfg.label}</WtBadge>
                    {hasContract && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}>📄 Contrato</span>
                    )}
                  </div>
                  <p className="font-display font-bold text-sm truncate" style={{ color: "#F0F4F8" }}>{vendor.service}</p>
                  {vendor.vendor_name && <p className="text-xs" style={{ color: "#94A3B8" }}>{vendor.vendor_name}</p>}
                  {payments.length > 0 && (
                    <div className="flex gap-3 mt-1 text-xs font-mono">
                      {pago > 0 && <span style={{ color: "#10B981" }}>✓ Pago: {formatCurrency(pago)}</span>}
                      {pendente > 0 && <span style={{ color: "#F59E0B" }}>⏳ Pendente: {formatCurrency(pendente)}</span>}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  {vendor.contracted_value ? (
                    <p className="font-mono text-sm font-bold" style={{ color: "#2DD4BF" }}>{formatCurrency(vendor.contracted_value)}</p>
                  ) : vendor.estimated_value > 0 ? (
                    <p className="font-mono text-sm" style={{ color: "#94A3B8" }}>~{formatCurrency(vendor.estimated_value)}</p>
                  ) : null}
                  <button onClick={() => { setSelectedVendor(vendor); setDetailOpen(true); }}
                    className="text-xs mt-2 px-3 py-1 rounded-lg transition-all"
                    style={{ background: "rgba(201,168,76,0.15)", color: "#E8C97A", border: "1px solid rgba(201,168,76,0.3)" }}>
                    Gerenciar →
                  </button>
                </div>
              </div>
            </PremiumCard>
          );
        })}
      </div>

      {/* Modal novo fornecedor */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#E8C97A" }}>💍 Novo Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Serviço *</label>
              <Input value={newForm.service} onChange={e => setNewForm(f => ({ ...f, service: e.target.value }))}
                placeholder="Ex: Fotógrafo, Buffet, Decoração"
                style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
            </div>
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Nome do Fornecedor</label>
              <Input value={newForm.vendor_name} onChange={e => setNewForm(f => ({ ...f, vendor_name: e.target.value }))}
                placeholder="Ex: João Silva Fotografia"
                style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
            </div>
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Status</label>
              <Select value={newForm.status} onValueChange={v => setNewForm(f => ({ ...f, status: v }))}>
                <SelectTrigger style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0D1318", borderColor: "#1A2535" }}>
                  <SelectItem value="a_contratar" style={{ color: "#F0F4F8" }}>A Contratar</SelectItem>
                  <SelectItem value="contratado" style={{ color: "#F0F4F8" }}>Contratado</SelectItem>
                  <SelectItem value="incluido_pacote" style={{ color: "#F0F4F8" }}>Incluso no Pacote</SelectItem>
                  <SelectItem value="noivos_trazem" style={{ color: "#F0F4F8" }}>Noivos Providenciam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Valor Estimado</label>
                <Input type="number" value={newForm.estimated_value} onChange={e => setNewForm(f => ({ ...f, estimated_value: e.target.value }))}
                  placeholder="0,00" style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
              </div>
              <div>
                <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Valor Contratado</label>
                <Input type="number" value={newForm.contracted_value} onChange={e => setNewForm(f => ({ ...f, contracted_value: e.target.value }))}
                  placeholder="0,00" style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Observações</label>
              <textarea value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Detalhes do serviço, contato..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }} />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setNewOpen(false)} className="px-4 py-2 text-sm rounded-lg" style={{ color: "#94A3B8" }}>Cancelar</button>
            <GoldButton onClick={handleCreate} disabled={createVendor.isPending}>Adicionar</GoldButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de detalhe */}
      {selectedVendor && (
        <VendorDetailModal
          vendor={selectedVendor}
          open={detailOpen}
          onClose={() => { setDetailOpen(false); setSelectedVendor(null); }}
        />
      )}
    </div>
  );
}

// ─── Vendor Detail Modal ────────────────────────────────────────────────────────

function VendorDetailModal({ vendor, open, onClose }: { vendor: any; open: boolean; onClose: () => void }) {
  const updateVendor = useUpdateWeddingVendor();
  const deleteVendor = useDeleteWeddingVendor();
  const createPayment = useCreateVendorPayment();
  const updatePayment = useUpdateVendorPayment();
  const deletePayment = useDeleteVendorPayment();
  const { toast } = useToast();

  const [uploading, setUploading] = useState(false);
  const [editForm, setEditForm] = useState({
    vendor_name: vendor.vendor_name ?? "",
    status: vendor.status,
    contracted_value: vendor.contracted_value ?? "",
    notes: vendor.notes ?? "",
  });

  const [paymentForm, setPaymentForm] = useState({
    description: "", amount: "", due_date: "", payment_method: "", notes: ""
  });

  const payments = vendor.wedding_vendor_payments ?? [];
  const totalPago = payments.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + p.amount, 0);
  const totalPendente = payments.filter((p: any) => p.status !== "paid").reduce((s: number, p: any) => s + p.amount, 0);

  const handleContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `contracts/${vendor.id}-${Date.now()}-${file.name}`;
      const url = await uploadWeddingFile(file, path);
      await updateVendor.mutateAsync({
        id: vendor.id,
        contract_file_url: url,
        contract_file_name: file.name,
      });
      toast({ title: "Contrato enviado!" });
    } catch { toast({ title: "Erro no upload", variant: "destructive" }); }
    finally { setUploading(false); }
  };

  const handleReceiptUpload = async (paymentId: string, file: File) => {
    try {
      const path = `receipts/${paymentId}-${Date.now()}-${file.name}`;
      const url = await uploadWeddingFile(file, path);
      await updatePayment.mutateAsync({
        id: paymentId,
        receipt_url: url,
        receipt_file_name: file.name,
      });
      toast({ title: "Comprovante enviado!" });
    } catch { toast({ title: "Erro no upload", variant: "destructive" }); }
  };

  const handleSaveEdit = async () => {
    try {
      await updateVendor.mutateAsync({
        id: vendor.id,
        vendor_name: editForm.vendor_name || null,
        status: editForm.status,
        contracted_value: editForm.contracted_value ? parseFloat(String(editForm.contracted_value)) : null,
        notes: editForm.notes || null,
      });
      toast({ title: "Fornecedor atualizado!" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleAddPayment = async () => {
    if (!paymentForm.description || !paymentForm.amount) return;
    try {
      await createPayment.mutateAsync({
        vendor_id: vendor.id,
        description: paymentForm.description,
        amount: parseFloat(paymentForm.amount),
        due_date: paymentForm.due_date || null,
        payment_method: paymentForm.payment_method || null,
        notes: paymentForm.notes || null,
        status: "pending",
      });
      toast({ title: "Pagamento adicionado!" });
      setPaymentForm({ description: "", amount: "", due_date: "", payment_method: "", notes: "" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleMarkPaid = async (paymentId: string) => {
    await updatePayment.mutateAsync({
      id: paymentId,
      status: "paid",
      paid_at: new Date().toISOString().split("T")[0],
    });
    toast({ title: "Pagamento confirmado!" });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }} className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ color: "#E8C97A" }}>💍 {vendor.service}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Dados do fornecedor */}
          <PremiumCard>
            <h3 className="font-display font-bold text-sm mb-4" style={{ color: "#F0F4F8" }}>Dados do Fornecedor</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Nome</label>
                <Input value={editForm.vendor_name} onChange={e => setEditForm(f => ({ ...f, vendor_name: e.target.value }))}
                  placeholder="Nome do fornecedor"
                  style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
              </div>
              <div>
                <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Status</label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#0D1318", borderColor: "#1A2535" }}>
                    <SelectItem value="a_contratar" style={{ color: "#F0F4F8" }}>A Contratar</SelectItem>
                    <SelectItem value="contratado" style={{ color: "#F0F4F8" }}>Contratado</SelectItem>
                    <SelectItem value="incluido_pacote" style={{ color: "#F0F4F8" }}>Incluso no Pacote</SelectItem>
                    <SelectItem value="noivos_trazem" style={{ color: "#F0F4F8" }}>Noivos Providenciam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Valor Contratado (R$)</label>
                <Input type="number" value={editForm.contracted_value} onChange={e => setEditForm(f => ({ ...f, contracted_value: e.target.value }))}
                  placeholder="0,00" style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Observações</label>
              <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }} />
            </div>
            <GoldButton onClick={handleSaveEdit} disabled={updateVendor.isPending}>Salvar alterações</GoldButton>
          </PremiumCard>

          {/* Contrato */}
          <PremiumCard>
            <h3 className="font-display font-bold text-sm mb-4" style={{ color: "#F0F4F8" }}>📄 Contrato</h3>
            {vendor.contract_file_url ? (
              <div className="flex items-center gap-3 p-3 rounded-xl mb-3" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <span>📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#F0F4F8" }}>{vendor.contract_file_name}</p>
                  <p className="text-xs" style={{ color: "#64748B" }}>Contrato enviado</p>
                </div>
                <a href={vendor.contract_file_url} target="_blank" rel="noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(16,185,129,0.2)", color: "#10B981" }}>
                  Abrir
                </a>
              </div>
            ) : (
              <p className="text-sm mb-3" style={{ color: "#64748B" }}>Nenhum contrato anexado ainda.</p>
            )}
            <label className="cursor-pointer">
              <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" onChange={handleContractUpload} className="hidden" />
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: "rgba(201,168,76,0.15)", color: "#E8C97A", border: "1px solid rgba(201,168,76,0.3)", cursor: "pointer" }}>
                {uploading ? "Enviando..." : vendor.contract_file_url ? "🔄 Substituir contrato" : "📎 Anexar contrato"}
              </span>
            </label>
            <p className="text-xs mt-2" style={{ color: "#4A5568" }}>PDF, Word ou imagem. Máx 10MB.</p>
          </PremiumCard>

          {/* Pagamentos */}
          <PremiumCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-sm" style={{ color: "#F0F4F8" }}>💳 Pagamentos</h3>
              <div className="flex gap-4 text-xs font-mono">
                <span style={{ color: "#10B981" }}>Pago: {formatCurrency(totalPago)}</span>
                <span style={{ color: "#F59E0B" }}>Pendente: {formatCurrency(totalPendente)}</span>
              </div>
            </div>

            {payments.length > 0 && (
              <div className="space-y-2 mb-4">
                {payments.map((payment: any) => (
                  <div key={payment.id} className="rounded-xl p-3 flex items-center gap-3"
                    style={{
                      background: payment.status === "paid" ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.06)",
                      border: `1px solid ${payment.status === "paid" ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
                    }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: "#F0F4F8" }}>{payment.description}</span>
                        {payment.status === "paid"
                          ? <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(16,185,129,0.2)", color: "#10B981" }}>✓ Pago</span>
                          : <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.2)", color: "#F59E0B" }}>⏳ Pendente</span>
                        }
                      </div>
                      <div className="flex gap-3 mt-1">
                        <span className="font-mono text-sm font-bold" style={{ color: payment.status === "paid" ? "#10B981" : "#F59E0B" }}>
                          {formatCurrency(payment.amount)}
                        </span>
                        {payment.due_date && <span className="text-xs" style={{ color: "#64748B" }}>Vence: {formatDate(payment.due_date)}</span>}
                        {payment.paid_at && <span className="text-xs" style={{ color: "#64748B" }}>Pago em: {formatDate(payment.paid_at)}</span>}
                      </div>
                      {payment.receipt_url ? (
                        <a href={payment.receipt_url} target="_blank" rel="noreferrer" className="text-xs mt-1 inline-block" style={{ color: "#2DD4BF" }}>
                          📎 {payment.receipt_file_name}
                        </a>
                      ) : (
                        <label className="cursor-pointer">
                          <input type="file" accept=".pdf,.jpg,.png" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(payment.id, f); }} />
                          <span className="text-xs mt-1 inline-block" style={{ color: "#4A5568", cursor: "pointer" }}>+ Anexar comprovante</span>
                        </label>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {payment.status !== "paid" && (
                        <button onClick={() => handleMarkPaid(payment.id)}
                          className="text-xs px-2.5 py-1 rounded-lg"
                          style={{ background: "rgba(16,185,129,0.2)", color: "#10B981" }}>
                          ✓ Pago
                        </button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-1.5 rounded-lg" style={{ background: "rgba(244,63,94,0.1)" }}>
                            <Trash2 className="w-3.5 h-3.5" style={{ color: "#F43F5E" }} />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                          <AlertDialogHeader>
                            <AlertDialogTitle style={{ color: "#F0F4F8" }}>Remover pagamento?</AlertDialogTitle>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel style={{ background: "#1A2535", color: "#94A3B8", border: "none" }}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deletePayment.mutate(payment.id)}
                              style={{ background: "#F43F5E", color: "white" }}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Formulário novo pagamento */}
            <div className="rounded-xl p-3 space-y-3" style={{ background: "#080C10", border: "1px solid #1A2535" }}>
              <p className="text-xs font-mono uppercase" style={{ color: "#64748B" }}>+ Adicionar parcela/pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                <Input value={paymentForm.description} onChange={e => setPaymentForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descrição (ex: Sinal, Parcela 1...)"
                  style={{ background: "#0D1318", borderColor: "#1A2535", color: "#F0F4F8", fontSize: "13px" }} />
                <Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="Valor R$"
                  style={{ background: "#0D1318", borderColor: "#1A2535", color: "#F0F4F8", fontSize: "13px" }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#94A3B8" }}>Vencimento</label>
                  <Input type="date" value={paymentForm.due_date} onChange={e => setPaymentForm(f => ({ ...f, due_date: e.target.value }))}
                    style={{ background: "#0D1318", borderColor: "#1A2535", color: "#F0F4F8", fontSize: "13px" }} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#94A3B8" }}>Forma de pagamento</label>
                  <Input value={paymentForm.payment_method} onChange={e => setPaymentForm(f => ({ ...f, payment_method: e.target.value }))}
                    placeholder="PIX, Cartão, Boleto..."
                    style={{ background: "#0D1318", borderColor: "#1A2535", color: "#F0F4F8", fontSize: "13px" }} />
                </div>
              </div>
              <button onClick={handleAddPayment} disabled={createPayment.isPending || !paymentForm.description || !paymentForm.amount}
                className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
                style={{ background: "rgba(201,168,76,0.2)", color: "#E8C97A", border: "1px solid rgba(201,168,76,0.3)" }}>
                {createPayment.isPending ? "Salvando..." : "+ Adicionar Pagamento"}
              </button>
            </div>
          </PremiumCard>

          {/* Excluir fornecedor */}
          {vendor.status !== "incluido_pacote" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="text-xs flex items-center gap-1.5 transition-all" style={{ color: "#4A5568" }}>
                  <Trash2 className="w-3 h-3" /> Remover fornecedor
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                <AlertDialogHeader>
                  <AlertDialogTitle style={{ color: "#F0F4F8" }}>Remover "{vendor.service}"?</AlertDialogTitle>
                  <AlertDialogDescription style={{ color: "#94A3B8" }}>
                    Todos os pagamentos e arquivos associados serão removidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel style={{ background: "#1A2535", color: "#94A3B8", border: "none" }}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { deleteVendor.mutate(vendor.id); onClose(); }}
                    style={{ background: "#F43F5E", color: "white" }}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function WeddingPage() {
  const { data: installments, isLoading } = useWeddingInstallments();
  const updateInstallment = useUpdateWeddingInstallment();
  const { toast } = useToast();

  const daysUntil = Math.ceil((WEDDING_DATE.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const totalPaid = (installments ?? []).filter(i => i.status === "pago").reduce((s, i) => s + (i.amount ?? 0), 0);
  const totalPending = TOTAL_CONTRACTED - totalPaid;
  const aContratar = TOTAL_BUDGET - TOTAL_CONTRACTED;

  const chartData = [
    { name: "Villa Sonali (Pago)", value: totalPaid, color: "#10B981" },
    { name: "Villa Sonali (Pendente)", value: totalPending, color: "#C9A84C" },
    { name: "Extras a Contratar", value: aContratar, color: "#2DD4BF" },
  ];

  const handleMarkPaid = async (id: string) => {
    try {
      await updateInstallment.mutateAsync({ id, status: "pago", paid_at: new Date().toISOString().split("T")[0] });
      toast({ title: "Pagamento registrado!" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
          <Heart className="inline w-6 h-6 mr-2" style={{ color: '#EC4899' }} />
          Casamento 2027
        </h1>
        <PremiumCard glowColor="#EC4899" className="px-4 py-2">
          <p className="font-mono text-sm" style={{ color: '#EC4899' }}>🎉 Faltam <strong>{daysUntil}</strong> dias!</p>
        </PremiumCard>
      </div>

      <Tabs defaultValue="financeiro">
        <TabsList style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard label="Total Pago" value={totalPaid} color="green" />
            <KpiCard label="Pendente (Villa)" value={totalPending} color="gold" />
            <KpiCard label="A Contratar (extras)" value={aContratar} color="cyan" />
            <KpiCard label="Orçamento Total" value={TOTAL_BUDGET} color="gold" />
          </div>

          <PremiumCard className="space-y-3">
            <h3 className="font-display font-bold" style={{ color: '#F0F4F8' }}>Villa Sonali — Contrato</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs" style={{ color: '#94A3B8' }}>Total Contratado</p><p className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(TOTAL_CONTRACTED)}</p></div>
              <div><p className="text-xs" style={{ color: '#94A3B8' }}>Reserva (31/12/2025)</p><p className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(RESERVA)} ✅</p></div>
              <div><p className="text-xs" style={{ color: '#94A3B8' }}>Parcelas</p><p className="font-mono" style={{ color: '#F0F4F8' }}>10x R$ 7.848,80</p></div>
              <div><p className="text-xs" style={{ color: '#94A3B8' }}>Período</p><p className="font-mono" style={{ color: '#F0F4F8' }}>jan/27 a out/27</p></div>
            </div>
          </PremiumCard>

          <PremiumCard>
            <h3 className="font-display font-bold mb-3" style={{ color: '#F0F4F8' }}>Distribuição do Orçamento</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} stroke="#4A5568" />
                <YAxis type="category" dataKey="name" width={180} stroke="#94A3B8" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: '#0D1318', border: '1px solid #1A2535' }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </PremiumCard>

          <PremiumCard>
            <h3 className="font-display font-bold mb-3" style={{ color: '#F0F4F8' }}>Parcelas</h3>
            {isLoading ? <Skeleton className="h-32" /> : (
              <div className="space-y-2">
                {(installments ?? []).map(inst => (
                  <div key={inst.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: inst.status === "pago" ? 'rgba(16,185,129,0.08)' : 'rgba(201,168,76,0.05)', border: '1px solid #1A2535' }}>
                    <div className="flex items-center gap-3">
                      {inst.status === "pago" ? <Check className="w-4 h-4" style={{ color: '#10B981' }} /> : <Clock className="w-4 h-4" style={{ color: '#C9A84C' }} />}
                      <span style={{ color: '#F0F4F8' }} className="text-sm">{inst.description}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm" style={{ color: '#E8C97A' }}>{formatCurrency(inst.amount ?? 0)}</span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>{inst.due_date ? formatDate(inst.due_date) : ""}</span>
                      {inst.status !== "pago" && <GoldButton className="text-xs py-1 px-2" onClick={() => handleMarkPaid(inst.id)}>Pagar</GoldButton>}
                    </div>
                  </div>
                ))}
                {(installments ?? []).length === 0 && <p className="text-center py-4 text-sm" style={{ color: '#94A3B8' }}>Nenhuma parcela cadastrada. Adicione via banco de dados.</p>}
              </div>
            )}
          </PremiumCard>
        </TabsContent>

        <TabsContent value="fornecedores" className="space-y-4">
          <VendorsTab />
        </TabsContent>

        <TabsContent value="cronograma" className="space-y-4">
          <PremiumCard className="space-y-4">
            <h3 className="font-display font-bold" style={{ color: '#F0F4F8' }}>Timeline</h3>
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-2 top-0 bottom-0 w-px" style={{ background: '#1A2535' }} />
              {milestones.map((m, i) => (
                <div key={i} className="relative flex items-start gap-3">
                  <div className="absolute -left-4 w-3 h-3 rounded-full mt-1" style={{ background: m.done ? '#10B981' : m.highlight ? '#EC4899' : '#C9A84C', border: '2px solid #080C10' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: m.highlight ? '#EC4899' : '#F0F4F8' }}>
                      {m.done ? '✅' : m.highlight ? '🎉' : '⏳'} {m.label}
                    </p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>{m.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </PremiumCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
