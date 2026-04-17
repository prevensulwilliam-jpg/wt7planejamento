import { useState } from "react";
import { DraggableGrid } from "@/components/wt7/DraggableGrid";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/wt7/DatePicker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useConsortiums, useCreateConsortium,
  useUpdateConsortium, useDeleteConsortium,
} from "@/hooks/useConstructions";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Plus, Pencil, Trash2, GripVertical, Upload, FileText, Loader2 } from "lucide-react";
import { parseConsortiumExtrato, type ConsortiumExtratoData } from "@/lib/parseConsortiumExtrato";

const inputStyle = { background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' };

function ConfirmDelete({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog open onOpenChange={o => !o && onCancel()}>
      <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
        <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Excluir "{name}"?</DialogTitle></DialogHeader>
        <p className="text-sm" style={{ color: '#94A3B8' }}>Esta ação não pode ser desfeita.</p>
        <DialogFooter className="gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #1A2535', color: '#94A3B8' }}>Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', color: '#F43F5E' }}>Excluir</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1 ml-auto">
      <button onClick={e => { e.stopPropagation(); onEdit(); }} className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: '#E8C97A' }} title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
      <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10" style={{ color: '#F43F5E' }} title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
      <GripVertical className="w-4 h-4 ml-1" style={{ color: '#4A5568' }} />
    </div>
  );
}

export default function ConsortiumsPage() {
  const { data: consortiums, isLoading } = useConsortiums();
  const { toast } = useToast();
  const createConsortium = useCreateConsortium();
  const updateConsortium = useUpdateConsortium();
  const deleteConsortium = useDeleteConsortium();

  const emptyCons = { name: "", total_value: "", monthly_payment: "", installments_total: "", installments_paid: "", status: "ativo", group_number: "", quota: "", contract_number: "", admin_fee_pct: "", fund_pct: "", insurance_pct: "", asset_type: "IMOVEIS", credit_value: "", adhesion_date: "", end_date: "", total_paid: "", fund_paid: "", admin_fee_paid: "", insurance_paid: "", total_pending: "", installments_remaining: "", notes: "", ownership_pct: "100", partner_name: "" };
  const [consOpen, setConsOpen] = useState(false);
  const [editCons, setEditCons] = useState<any | null>(null);
  const [delCons, setDelCons] = useState<any | null>(null);
  const [consForm, setConsForm] = useState(emptyCons);

  // Upload extrato
  const [extratoTarget, setExtratoTarget] = useState<any | null>(null);
  const [extratoData, setExtratoData] = useState<ConsortiumExtratoData | null>(null);
  const [extratoLoading, setExtratoLoading] = useState(false);
  const [extratoFileName, setExtratoFileName] = useState("");

  const consPayload = () => ({
    name: consForm.name, total_value: parseFloat(consForm.total_value) || null,
    monthly_payment: parseFloat(consForm.monthly_payment) || null,
    installments_total: parseInt(consForm.installments_total) || null,
    installments_paid: parseInt(consForm.installments_paid) || 0,
    status: consForm.status,
    group_number: consForm.group_number || null, quota: consForm.quota || null,
    contract_number: consForm.contract_number || null,
    admin_fee_pct: parseFloat(consForm.admin_fee_pct) || null,
    fund_pct: parseFloat(consForm.fund_pct) || null,
    insurance_pct: parseFloat(consForm.insurance_pct) || null,
    asset_type: consForm.asset_type || null,
    credit_value: parseFloat(consForm.credit_value) || null,
    adhesion_date: consForm.adhesion_date || null, end_date: consForm.end_date || null,
    total_paid: parseFloat(consForm.total_paid) || 0,
    fund_paid: parseFloat(consForm.fund_paid) || 0,
    admin_fee_paid: parseFloat(consForm.admin_fee_paid) || 0,
    insurance_paid: parseFloat(consForm.insurance_paid) || 0,
    total_pending: parseFloat(consForm.total_pending) || 0,
    installments_remaining: parseInt(consForm.installments_remaining) || 0,
    notes: consForm.notes || null,
    ownership_pct: parseFloat(consForm.ownership_pct) || 100,
    partner_name: consForm.partner_name || null,
  });

  const handleCreate = async () => {
    if (!consForm.name) return;
    try {
      await createConsortium.mutateAsync(consPayload() as any);
      toast({ title: "Consórcio registrado!" }); setConsOpen(false); setConsForm(emptyCons);
    } catch (e: any) { toast({ title: "Erro: " + (e?.message || ""), variant: "destructive" }); }
  };
  const handleUpdate = async () => {
    if (!editCons) return;
    try {
      await updateConsortium.mutateAsync({ id: editCons.id, ...consPayload() } as any);
      toast({ title: "Consórcio atualizado!" }); setEditCons(null);
    } catch (e: any) { toast({ title: "Erro: " + (e?.message || ""), variant: "destructive" }); }
  };
  const handleDelete = async () => {
    if (!delCons) return;
    try { await deleteConsortium.mutateAsync(delCons.id); toast({ title: "Consórcio excluído" }); setDelCons(null); }
    catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleExtratoFile = async (e: React.ChangeEvent<HTMLInputElement>, consortium: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtratoTarget(consortium);
    setExtratoFileName(file.name);
    setExtratoLoading(true);
    try {
      const data = await parseConsortiumExtrato(file);
      setExtratoData(data);
    } catch (err: any) {
      toast({ title: "Erro ao processar PDF: " + (err?.message || ""), variant: "destructive" });
      setExtratoTarget(null);
    } finally {
      setExtratoLoading(false);
    }
    e.target.value = "";
  };

  const handleApplyExtrato = async () => {
    if (!extratoTarget || !extratoData) return;
    try {
      const updates: any = { extrato_file_name: extratoFileName, extrato_updated_at: new Date().toISOString() };
      const fields = ["group_number", "quota", "contract_number", "admin_fee_pct", "asset_type", "credit_value", "adhesion_date", "end_date", "installments_total", "installments_paid", "installments_remaining", "total_paid", "total_pending", "fund_paid", "admin_fee_paid", "insurance_paid", "monthly_payment", "total_value"];
      for (const f of fields) {
        if ((extratoData as any)[f]) updates[f] = (extratoData as any)[f];
      }
      await updateConsortium.mutateAsync({ id: extratoTarget.id, ...updates });
      toast({ title: `Extrato aplicado! ${extratoData.installments_paid ?? 0} parcelas detectadas.` });
      setExtratoTarget(null); setExtratoData(null);
    } catch (err: any) {
      toast({ title: "Erro: " + (err?.message || ""), variant: "destructive" });
    }
  };

  const fillForm = (c: any) => setConsForm({
    name: c.name ?? "", total_value: String(c.total_value ?? ""), monthly_payment: String(c.monthly_payment ?? ""),
    installments_total: String(c.installments_total ?? ""), installments_paid: String(c.installments_paid ?? ""),
    status: c.status ?? "ativo", group_number: c.group_number ?? "", quota: c.quota ?? "",
    contract_number: c.contract_number ?? "", admin_fee_pct: String(c.admin_fee_pct ?? ""),
    fund_pct: String(c.fund_pct ?? ""), insurance_pct: String(c.insurance_pct ?? ""),
    asset_type: c.asset_type ?? "IMOVEIS", credit_value: String(c.credit_value ?? ""),
    adhesion_date: c.adhesion_date ?? "", end_date: c.end_date ?? "",
    total_paid: String(c.total_paid ?? ""), fund_paid: String(c.fund_paid ?? ""),
    admin_fee_paid: String(c.admin_fee_paid ?? ""), insurance_paid: String(c.insurance_paid ?? ""),
    total_pending: String(c.total_pending ?? ""), installments_remaining: String(c.installments_remaining ?? ""),
    notes: c.notes ?? "", ownership_pct: String(c.ownership_pct ?? "100"), partner_name: c.partner_name ?? "",
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
        <RefreshCw className="inline w-6 h-6 mr-2" style={{ color: '#C9A84C' }} />
        Consórcios
      </h1>

      <div className="flex justify-end">
        <GoldButton onClick={() => { setConsForm(emptyCons); setConsOpen(true); }}><Plus className="w-4 h-4" />Novo Consórcio</GoldButton>
      </div>

      {isLoading ? <Skeleton className="h-32 rounded-2xl" /> : (consortiums ?? []).length === 0 ? (
        <PremiumCard><p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum consórcio</p></PremiumCard>
      ) : (
        <DraggableGrid
          storageKey="wt7_consortiums_order"
          items={(consortiums ?? []) as any[]}
          columns="grid-cols-1 md:grid-cols-2"
          renderCard={(c: any) => {
            const own = (c.ownership_pct ?? 100) / 100;
            const pct = c.installments_total ? ((c.installments_paid ?? 0) / c.installments_total) * 100 : 0;
            const totalPaidFull = c.total_paid || ((c.installments_paid ?? 0) * (c.monthly_payment ?? 0));
            const planTotal = c.total_value || (c.credit_value ? c.credit_value * (1 + (c.admin_fee_pct ?? 0) / 100) : 0);
            const totalPendingFull = c.total_pending > 0 ? c.total_pending : Math.max(0, planTotal - totalPaidFull);
            const totalPaid = totalPaidFull * own;
            const totalPending = totalPendingFull * own;
            const creditDisplay = (c.credit_value || c.total_value || 0) * own;
            const monthlyDisplay = (c.monthly_payment ?? 0) * own;
            const fundPctVal = c.fund_pct ? totalPaidFull * (c.fund_pct / 100) : (c.fund_paid ?? 0);
            const admPctVal = c.admin_fee_pct ? totalPaidFull * (c.admin_fee_pct / 100) : (c.admin_fee_paid ?? 0);
            const insPctVal = c.insurance_pct ? totalPaidFull * (c.insurance_pct / 100) : (c.insurance_paid ?? 0);
            const fundPaid = fundPctVal * own;
            const admPaid = admPctVal * own;
            const insPaid = insPctVal * own;
            return (
              <PremiumCard className="space-y-2 h-full">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold" style={{ color: '#F0F4F8' }}>{c.name}</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>
                      {c.group_number ? `Grupo ${c.group_number}` : ""}{c.quota ? ` · Cota ${c.quota}` : ""}{c.asset_type ? ` · ${c.asset_type}` : ""}
                      {own < 1 && <span style={{ color: '#818CF8' }}> · {c.ownership_pct}% minha parte{c.partner_name ? ` · Sócio: ${c.partner_name}` : ""}</span>}
                    </p>
                  </div>
                  <WtBadge variant={c.status === "contemplado" ? "green" : c.status === "ativo" ? "gold" : "gray"}>{c.status === "ativo" ? "Ativo" : c.status === "contemplado" ? "Contemplado" : c.status === "encerrado" ? "Encerrado" : c.status}</WtBadge>
                  <CardActions onEdit={() => { fillForm(c); setEditCons(c); }} onDelete={() => setDelCons(c)} />
                </div>

                <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(232,201,122,0.05)', border: '1px solid rgba(232,201,122,0.15)' }}>
                  <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>{own < 1 ? `Crédito (${c.ownership_pct}%)` : "Crédito Total"}</p>
                  <p className="font-mono font-bold text-xl" style={{ color: '#E8C97A' }}>{formatCurrency(creditDisplay)}</p>
                  {own < 1 && <p className="font-mono text-xs mt-0.5" style={{ color: '#4A5568' }}>Total da carta: {formatCurrency(c.credit_value || c.total_value || 0)}</p>}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs" style={{ color: '#64748B' }}>Parcela Atual</p>
                    <p className="font-mono font-bold text-sm" style={{ color: '#F0F4F8' }}>{formatCurrency(monthlyDisplay)}</p>
                    {own < 1 && <p className="font-mono text-[10px]" style={{ color: '#4A5568' }}>/ {formatCurrency(c.monthly_payment ?? 0)}</p>}
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: '#64748B' }}>Total Pago</p>
                    <p className="font-mono font-bold text-sm" style={{ color: '#10B981' }}>{formatCurrency(totalPaid)}</p>
                    {own < 1 && <p className="font-mono text-[10px]" style={{ color: '#4A5568' }}>/ {formatCurrency(totalPaidFull)}</p>}
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: '#64748B' }}>A Pagar</p>
                    <p className="font-mono font-bold text-sm" style={{ color: '#F43F5E' }}>{formatCurrency(totalPending)}</p>
                    {own < 1 && <p className="font-mono text-[10px]" style={{ color: '#4A5568' }}>/ {formatCurrency(totalPendingFull)}</p>}
                  </div>
                </div>

                {(fundPaid > 0 || admPaid > 0) && (
                  <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(45,212,191,0.04)', border: '1px solid rgba(45,212,191,0.15)' }}>
                    <div className="flex gap-3 text-xs flex-wrap">
                      {fundPaid > 0 && <span style={{ color: '#2DD4BF' }}>FC: {formatCurrency(fundPaid)}{own < 1 && <span style={{ color: '#4A5568' }}> / {formatCurrency(fundPctVal)}</span>}{c.fund_pct && <span style={{ color: '#4A5568' }}> ({c.fund_pct}%)</span>}</span>}
                      {admPaid > 0 && <span style={{ color: '#94A3B8' }}>ADM: {formatCurrency(admPaid)}{own < 1 && <span style={{ color: '#4A5568' }}> / {formatCurrency(admPctVal)}</span>}{c.admin_fee_pct && <span style={{ color: '#4A5568' }}> ({c.admin_fee_pct}%)</span>}</span>}
                      {insPaid > 0 && <span style={{ color: '#94A3B8' }}>Seguro: {formatCurrency(insPaid)}{own < 1 && <span style={{ color: '#4A5568' }}> / {formatCurrency(insPctVal)}</span>}{c.insurance_pct && <span style={{ color: '#4A5568' }}> ({c.insurance_pct}%)</span>}</span>}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex justify-between text-xs" style={{ color: '#94A3B8' }}>
                    <span>{c.installments_paid ?? 0}/{c.installments_total ?? 0} parcelas</span>
                    <span>{pct.toFixed(1)}% pago</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>

                <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: '#64748B' }}>
                  {c.adhesion_date && <span>Adesão: {formatDate(c.adhesion_date)}</span>}
                  {c.end_date && <span>Encerramento: {formatDate(c.end_date)}</span>}
                  <label className="ml-auto flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg transition-colors hover:bg-white/5" style={{ color: '#818CF8', border: '1px solid rgba(129,140,248,0.2)' }}>
                    <Upload className="w-3 h-3" /><span>Extrato</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,image/*" className="hidden" onChange={e => handleExtratoFile(e, c)} />
                  </label>
                </div>
                {c.extrato_file_name && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#4A5568' }}>
                    <FileText className="w-3 h-3" /><span>{c.extrato_file_name}</span>
                    {c.extrato_updated_at && <span>· {formatDate(c.extrato_updated_at)}</span>}
                  </div>
                )}
              </PremiumCard>
            );
          }}
        />
      )}

      {/* ─── DIALOG CRIAR/EDITAR ─── */}
      {(consOpen || !!editCons) && (
        <Dialog open onOpenChange={o => { if (!o) { setConsOpen(false); setEditCons(null); } }}>
          <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535', maxHeight: '90vh', overflowY: 'auto' }}>
            <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>{editCons ? "Editar Consórcio" : "Novo Consórcio"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label style={{ color: '#94A3B8' }}>Administradora</Label><Input value={consForm.name} onChange={e => setConsForm({ ...consForm, name: e.target.value })} style={inputStyle} placeholder="ex: Ademicon" /></div>
                <div><Label style={{ color: '#94A3B8' }}>Status</Label>
                  <Select value={consForm.status} onValueChange={v => setConsForm({ ...consForm, status: v })}>
                    <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                    <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="contemplado">Contemplado</SelectItem>
                      <SelectItem value="encerrado">Encerrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Participação */}
              <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)' }}>
                <p className="text-xs font-semibold" style={{ color: '#818CF8' }}>Participação</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label style={{ color: '#94A3B8' }}>Minha parte %</Label><Input type="number" value={consForm.ownership_pct} onChange={e => setConsForm({ ...consForm, ownership_pct: e.target.value })} style={{ ...inputStyle, borderColor: 'rgba(129,140,248,0.3)' }} placeholder="100" /></div>
                  <div><Label style={{ color: '#94A3B8' }}>Sócio</Label><Input value={consForm.partner_name} onChange={e => setConsForm({ ...consForm, partner_name: e.target.value })} style={inputStyle} placeholder="Nome do sócio (se houver)" /></div>
                </div>
              </div>

              <div className="pt-1"><p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#4A5568' }}>Dados do Plano</p></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label style={{ color: '#94A3B8' }}>Grupo</Label><Input value={consForm.group_number} onChange={e => setConsForm({ ...consForm, group_number: e.target.value })} style={inputStyle} placeholder="000580" /></div>
                <div><Label style={{ color: '#94A3B8' }}>Cota</Label><Input value={consForm.quota} onChange={e => setConsForm({ ...consForm, quota: e.target.value })} style={inputStyle} placeholder="0434-00" /></div>
                <div><Label style={{ color: '#94A3B8' }}>Contrato</Label><Input value={consForm.contract_number} onChange={e => setConsForm({ ...consForm, contract_number: e.target.value })} style={inputStyle} placeholder="0090065342" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label style={{ color: '#E8C97A' }}>Crédito (R$)</Label><Input type="number" value={consForm.credit_value} onChange={e => setConsForm({ ...consForm, credit_value: e.target.value })} style={{ ...inputStyle, borderColor: 'rgba(232,201,122,0.3)' }} placeholder="428132.79" /></div>
                <div><Label style={{ color: '#94A3B8' }}>Bem</Label><Input value={consForm.asset_type} onChange={e => setConsForm({ ...consForm, asset_type: e.target.value })} style={inputStyle} placeholder="IMOVEIS" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label style={{ color: '#2DD4BF' }}>Fundo Comum %</Label><Input type="number" value={consForm.fund_pct} onChange={e => setConsForm({ ...consForm, fund_pct: e.target.value })} style={{ ...inputStyle, borderColor: 'rgba(45,212,191,0.3)' }} placeholder="75.10" /></div>
                <div><Label style={{ color: '#94A3B8' }}>Taxa ADM %</Label><Input type="number" value={consForm.admin_fee_pct} onChange={e => setConsForm({ ...consForm, admin_fee_pct: e.target.value })} style={inputStyle} placeholder="22" /></div>
                <div><Label style={{ color: '#94A3B8' }}>Seguro/Reserva %</Label><Input type="number" value={consForm.insurance_pct} onChange={e => setConsForm({ ...consForm, insurance_pct: e.target.value })} style={inputStyle} placeholder="2" /></div>
              </div>

              <div className="pt-1"><p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#4A5568' }}>Parcelas</p></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label style={{ color: '#94A3B8' }}>Valor Total Plano</Label><Input type="number" value={consForm.total_value} onChange={e => setConsForm({ ...consForm, total_value: e.target.value })} style={inputStyle} /></div>
                <div><Label style={{ color: '#94A3B8' }}>Parcela Mensal</Label><Input type="number" value={consForm.monthly_payment} onChange={e => setConsForm({ ...consForm, monthly_payment: e.target.value })} style={inputStyle} /></div>
                <div><Label style={{ color: '#94A3B8' }}>Total Parcelas</Label><Input type="number" value={consForm.installments_total} onChange={e => setConsForm({ ...consForm, installments_total: e.target.value })} style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label style={{ color: '#10B981' }}>Pagas</Label><Input type="number" value={consForm.installments_paid} onChange={e => setConsForm({ ...consForm, installments_paid: e.target.value })} style={{ ...inputStyle, borderColor: 'rgba(16,185,129,0.3)' }} /></div>
                <div><Label style={{ color: '#94A3B8' }}>Restantes</Label><Input type="number" value={consForm.installments_remaining} onChange={e => setConsForm({ ...consForm, installments_remaining: e.target.value })} style={inputStyle} /></div>
                <div><Label style={{ color: '#10B981' }}>Total Pago (R$)</Label><Input type="number" value={consForm.total_paid} onChange={e => setConsForm({ ...consForm, total_paid: e.target.value })} style={{ ...inputStyle, borderColor: 'rgba(16,185,129,0.3)' }} /></div>
              </div>

              <div><Label style={{ color: '#F43F5E' }}>Total a Pagar (R$)</Label><Input type="number" value={consForm.total_pending} onChange={e => setConsForm({ ...consForm, total_pending: e.target.value })} style={{ ...inputStyle, borderColor: 'rgba(244,63,94,0.3)' }} /></div>

              <div className="grid grid-cols-2 gap-2">
                <div><Label style={{ color: '#94A3B8' }}>Data Adesão</Label><DatePicker value={consForm.adhesion_date} onChange={v => setConsForm({ ...consForm, adhesion_date: v })} placeholder="Data da adesão" /></div>
                <div><Label style={{ color: '#94A3B8' }}>Encerramento Previsto</Label><DatePicker value={consForm.end_date} onChange={v => setConsForm({ ...consForm, end_date: v })} placeholder="Data prevista" /></div>
              </div>

              <div><Label style={{ color: '#94A3B8' }}>Observações</Label><Input value={consForm.notes} onChange={e => setConsForm({ ...consForm, notes: e.target.value })} style={inputStyle} /></div>
            </div>
            <DialogFooter>
              <GoldButton onClick={editCons ? handleUpdate : handleCreate}>
                {editCons ? "Salvar" : "Registrar"}
              </GoldButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── DIALOG UPLOAD EXTRATO ─── */}
      {(extratoTarget || extratoLoading) && (
        <Dialog open onOpenChange={o => { if (!o) { setExtratoTarget(null); setExtratoData(null); } }}>
          <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535', maxHeight: '90vh', overflowY: 'auto', maxWidth: '600px' }}>
            <DialogHeader>
              <DialogTitle style={{ color: '#F0F4F8' }}>
                <FileText className="inline w-5 h-5 mr-2" style={{ color: '#818CF8' }} />
                Upload Extrato — {extratoTarget?.name}
              </DialogTitle>
            </DialogHeader>
            {extratoLoading ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#E8C97A' }} />
                <span style={{ color: '#94A3B8' }}>Processando...</span>
              </div>
            ) : extratoData ? (
              <div className="space-y-3">
                <p className="text-xs" style={{ color: '#94A3B8' }}>Arquivo: <span style={{ color: '#F0F4F8' }}>{extratoFileName}</span></p>
                <div className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#818CF8' }}>Identificação</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {extratoData.group_number && <div><span style={{ color: '#64748B' }}>Grupo: </span><span style={{ color: '#F0F4F8' }}>{extratoData.group_number}</span></div>}
                    {extratoData.quota && <div><span style={{ color: '#64748B' }}>Cota: </span><span style={{ color: '#F0F4F8' }}>{extratoData.quota}</span></div>}
                    {extratoData.contract_number && <div><span style={{ color: '#64748B' }}>Contrato: </span><span style={{ color: '#F0F4F8' }}>{extratoData.contract_number}</span></div>}
                  </div>
                </div>
                <div className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(232,201,122,0.06)', border: '1px solid rgba(232,201,122,0.2)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#E8C97A' }}>Valores</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {extratoData.credit_value && <div><span style={{ color: '#64748B' }}>Crédito: </span><span className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(extratoData.credit_value)}</span></div>}
                    {extratoData.total_paid && <div><span style={{ color: '#64748B' }}>Total Pago: </span><span className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(extratoData.total_paid)}</span></div>}
                    {extratoData.total_pending && <div><span style={{ color: '#64748B' }}>A Pagar: </span><span className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(extratoData.total_pending)}</span></div>}
                    {extratoData.monthly_payment && <div><span style={{ color: '#64748B' }}>Parcela: </span><span className="font-mono" style={{ color: '#F0F4F8' }}>{formatCurrency(extratoData.monthly_payment)}</span></div>}
                    {extratoData.installments_paid && <div><span style={{ color: '#64748B' }}>Pagas: </span><span style={{ color: '#10B981' }}>{extratoData.installments_paid}</span></div>}
                    {extratoData.installments_total && <div><span style={{ color: '#64748B' }}>Total: </span><span style={{ color: '#F0F4F8' }}>{extratoData.installments_total}</span></div>}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-sm" style={{ color: '#94A3B8' }}>Nenhum dado extraído.</p>
            )}
            <DialogFooter className="gap-2">
              <button onClick={() => { setExtratoTarget(null); setExtratoData(null); }} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #1A2535', color: '#94A3B8' }}>Cancelar</button>
              {extratoData && <GoldButton onClick={handleApplyExtrato} disabled={updateConsortium.isPending}>{updateConsortium.isPending ? "Salvando..." : "Aplicar Dados"}</GoldButton>}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {delCons && <ConfirmDelete name={delCons.name ?? ""} onConfirm={handleDelete} onCancel={() => setDelCons(null)} />}
    </div>
  );
}
