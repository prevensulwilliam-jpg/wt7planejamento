import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/wt7/DatePicker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { DraggableGrid } from "@/components/wt7/DraggableGrid";
import {
  useConstructions, useCreateConstruction, useUpdateConstruction, useDeleteConstruction,
  useConstructionExpenses, useCreateConstructionExpense,
  useConstructionStages, useCreateStage, useUpdateStage, useDeleteStage,
} from "@/hooks/useConstructions";
import { useAssets } from "@/hooks/useFinances";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, MapPin, Users, Plus, Pencil, Trash2,
  CheckCircle2, Clock, Circle, Layers, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; variant: "gold" | "cyan" | "green" | "gray" | "red" }> = {
  planejada:       { label: "Planejada",       variant: "gray"  },
  em_obra:         { label: "Em Obra",          variant: "cyan"  },
  concluida:       { label: "Concluída",        variant: "green" },
  pausada:         { label: "Pausada",          variant: "red"   },
  gerando_renda:   { label: "Gerando Renda",    variant: "green" },
};

const STAGE_STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pendente:      { label: "Pendente",     icon: <Circle className="w-3.5 h-3.5" />,      color: "#94A3B8" },
  em_andamento:  { label: "Em andamento", icon: <Clock className="w-3.5 h-3.5" />,       color: "#2DD4BF" },
  concluida:     { label: "Concluída",    icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "#10B981" },
};

const DEFAULT_STAGES = [
  "Fundação", "Estrutura", "Alvenaria", "Cobertura",
  "Instalações Elétricas", "Instalações Hidráulicas", "Acabamento", "Pintura",
];

const EXPENSE_CATEGORIES = [
  "Terreno", "Terraplenagem", "Materiais", "Mão de Obra",
  "Instalações", "Acabamento", "Taxas/Cartório", "Outros",
];

const inputStyle = { background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assetLabel(asset: any) {
  if (!asset) return "—";
  const addr = [asset.cidade, asset.estado].filter(Boolean).join("/");
  return `${asset.name}${addr ? ` · ${addr}` : ""}`;
}

function assetAddress(asset: any) {
  if (!asset) return null;
  const parts = [asset.logradouro, asset.numero, asset.bairro, asset.cidade, asset.estado].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

// ─── Stages Modal ─────────────────────────────────────────────────────────────

function StagesModal({ construction, onClose }: { construction: any; onClose: () => void }) {
  const { data: stages = [], isLoading } = useConstructionStages(construction.id);
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editStage, setEditStage] = useState<any>(null);
  const [form, setForm] = useState({ name: "", status: "pendente", pct_complete: 0, start_date: "", end_date: "", notes: "" });

  const resetForm = () => setForm({ name: "", status: "pendente", pct_complete: 0, start_date: "", end_date: "", notes: "" });

  const handleAdd = async () => {
    if (!form.name) return;
    try {
      await createStage.mutateAsync({
        construction_id: construction.id,
        ...form,
        order_index: stages.length,
      });
      toast({ title: "Etapa adicionada!" });
      setAddOpen(false);
      resetForm();
    } catch { toast({ title: "Erro ao adicionar etapa", variant: "destructive" }); }
  };

  const handleEdit = async () => {
    if (!editStage) return;
    try {
      await updateStage.mutateAsync({ id: editStage.id, ...form });
      toast({ title: "Etapa atualizada!" });
      setEditStage(null);
      resetForm();
    } catch { toast({ title: "Erro ao atualizar", variant: "destructive" }); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStage.mutateAsync(id);
      toast({ title: "Etapa removida" });
    } catch { toast({ title: "Erro ao remover", variant: "destructive" }); }
  };

  const openEdit = (s: any) => {
    setForm({ name: s.name, status: s.status, pct_complete: s.pct_complete ?? 0, start_date: s.start_date ?? "", end_date: s.end_date ?? "", notes: s.notes ?? "" });
    setEditStage(s);
  };

  const overallPct = stages.length > 0 ? stages.reduce((acc, s) => acc + (s.pct_complete ?? 0), 0) / stages.length : 0;

  const StageForm = ({ onSave, onCancel, isPending }: { onSave: () => void; onCancel: () => void; isPending: boolean }) => (
    <div className="space-y-3">
      <div>
        <Label style={{ color: '#94A3B8' }}>Nome</Label>
        <div className="flex gap-2">
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="ex: Fundação" />
          <Select value={form.name} onValueChange={v => setForm({ ...form, name: v })}>
            <SelectTrigger className="w-40" style={inputStyle}><SelectValue placeholder="Sugestão" /></SelectTrigger>
            <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
              {DEFAULT_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label style={{ color: '#94A3B8' }}>Status</Label>
          <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
            <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
            <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
              {Object.entries(STAGE_STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label style={{ color: '#94A3B8' }}>Conclusão: {Math.round(form.pct_complete)}%</Label>
          <div className="pt-3">
            <Slider
              min={0} max={100} step={5}
              value={[form.pct_complete]}
              onValueChange={([v]) => setForm({ ...form, pct_complete: v })}
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label style={{ color: '#94A3B8' }}>Início</Label><DatePicker value={form.start_date} onChange={v => setForm({ ...form, start_date: v })} placeholder="Data início" /></div>
        <div><Label style={{ color: '#94A3B8' }}>Fim</Label><DatePicker value={form.end_date} onChange={v => setForm({ ...form, end_date: v })} placeholder="Data fim" /></div>
      </div>
      <div>
        <Label style={{ color: '#94A3B8' }}>Observações</Label>
        <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={inputStyle} rows={2} />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #1A2535', color: '#94A3B8' }}>Cancelar</button>
        <GoldButton onClick={onSave} disabled={isPending}>Salvar</GoldButton>
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
        <DialogHeader>
          <DialogTitle style={{ color: '#F0F4F8' }}>
            <Layers className="inline w-4 h-4 mr-2" style={{ color: '#C9A84C' }} />
            Etapas — {construction.name}
          </DialogTitle>
        </DialogHeader>

        {/* Overall progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs" style={{ color: '#94A3B8' }}>
            <span>{stages.length} etapa{stages.length !== 1 ? "s" : ""}</span>
            <span style={{ color: '#C9A84C' }}>{overallPct.toFixed(0)}% concluído</span>
          </div>
          <Progress value={overallPct} className="h-2" />
        </div>

        {/* Stage list */}
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : stages.length === 0 ? (
          <p className="text-center py-4 text-sm" style={{ color: '#94A3B8' }}>Nenhuma etapa cadastrada</p>
        ) : (
          <div className="space-y-2">
            {stages.map(s => {
              const st = STAGE_STATUS_MAP[s.status] ?? STAGE_STATUS_MAP.pendente;
              return (
                <PremiumCard key={s.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span style={{ color: st.color }}>{st.icon}</span>
                        <span className="font-medium text-sm" style={{ color: '#F0F4F8' }}>{s.name}</span>
                        <span className="text-xs font-mono ml-auto" style={{ color: '#C9A84C' }}>{s.pct_complete ?? 0}%</span>
                      </div>
                      <Progress value={s.pct_complete ?? 0} className="h-1 mt-1.5" />
                      {(s.start_date || s.end_date) && (
                        <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                          {s.start_date ? formatDate(s.start_date) : "—"} → {s.end_date ? formatDate(s.end_date) : "—"}
                        </p>
                      )}
                      {s.notes && <p className="text-xs mt-1" style={{ color: '#64748B' }}>{s.notes}</p>}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg" style={{ background: 'rgba(200,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(200,168,76,0.2)' }}><Pencil className="w-3 h-3" /></button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg" style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.2)' }}><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                  {editStage?.id === s.id && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1A2535' }}>
                      <StageForm onSave={handleEdit} onCancel={() => { setEditStage(null); resetForm(); }} isPending={updateStage.isPending} />
                    </div>
                  )}
                </PremiumCard>
              );
            })}
          </div>
        )}

        {/* Add stage */}
        {addOpen ? (
          <PremiumCard className="p-3">
            <p className="text-sm font-medium mb-3" style={{ color: '#C9A84C' }}>Nova etapa</p>
            <StageForm onSave={handleAdd} onCancel={() => { setAddOpen(false); resetForm(); }} isPending={createStage.isPending} />
          </PremiumCard>
        ) : (
          <GoldButton className="w-full" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" />Adicionar Etapa
          </GoldButton>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Construction Form ────────────────────────────────────────────────────────

const emptyForm = {
  asset_id: "", name: "", status: "planejada",
  start_date: "", estimated_completion: "", end_date: "",
  total_units_planned: "", estimated_rent_per_unit: "",
  estimated_value_ready: "", ownership_pct: "100",
  partner_name: "", partner_pct: "", notes: "",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConstructionsPage() {
  const { data: constructions = [], isLoading } = useConstructions();
  const { data: assets = [] }                   = useAssets();
  const createConstruction = useCreateConstruction();
  const updateConstruction = useUpdateConstruction();
  const deleteConstruction = useDeleteConstruction();
  const createExpense      = useCreateConstructionExpense();
  const { toast } = useToast();

  const [selectedId, setSelectedId]   = useState<string>("");
  const [stagesFor, setStagesFor]     = useState<any>(null);
  const [newOpen, setNewOpen]         = useState(false);
  const [editItem, setEditItem]       = useState<any>(null);
  const [delItem, setDelItem]         = useState<any>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [form, setForm]               = useState({ ...emptyForm });
  const [expForm, setExpForm]         = useState({
    description: "", category: "", total_amount: "", paid_by: "william",
    payment_type: "avista", installments_total: "", installments_paid: "",
    next_due_date: "", expense_date: "",
  });

  const { data: expenses = [] } = useConstructionExpenses(selectedId || undefined);
  const selectedConstruction   = constructions.find(c => c.id === selectedId);

  // KPIs globais
  const totalUnitsPlanned = constructions.filter(c => ["em_obra","planejada"].includes(c.status))
    .reduce((s, c) => s + (c.total_units_planned ?? 0), 0);
  const totalRentProjection = constructions
    .filter(c => c.status !== "patrimonial")
    .reduce((s, c) => s + (c.total_units_planned ?? 0) * (c.estimated_rent_per_unit ?? 0) * ((c.ownership_pct ?? 100) / 100), 0);
  const totalValueReady = constructions
    .reduce((s, c) => s + (c.estimated_value_ready ?? 0), 0);

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSaveConstruction = async () => {
    if (!form.name) return;
    const payload: any = {
      asset_id:               form.asset_id || null,
      name:                   form.name,
      status:                 form.status,
      start_date:             form.start_date || null,
      estimated_completion:   form.estimated_completion || null,
      end_date:               form.end_date || null,
      total_units_planned:    parseInt(form.total_units_planned) || 0,
      estimated_rent_per_unit: parseFloat(form.estimated_rent_per_unit) || 0,
      estimated_value_ready:  form.estimated_value_ready ? parseFloat(form.estimated_value_ready) : null,
      ownership_pct:          parseFloat(form.ownership_pct) || 100,
      partner_name:           form.partner_name || null,
      partner_pct:            form.partner_pct ? parseFloat(form.partner_pct) : null,
      notes:                  form.notes || null,
    };
    try {
      if (editItem) {
        await updateConstruction.mutateAsync({ id: editItem.id, ...payload });
        toast({ title: "Obra atualizada!" });
        setEditItem(null);
      } else {
        await createConstruction.mutateAsync(payload);
        toast({ title: "Obra criada!" });
        setNewOpen(false);
      }
      setForm({ ...emptyForm });
    } catch (e: any) { toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }); }
  };

  const openEdit = (c: any) => {
    setForm({
      asset_id:               c.asset_id ?? "",
      name:                   c.name ?? "",
      status:                 c.status ?? "planejada",
      start_date:             c.start_date ?? "",
      estimated_completion:   c.estimated_completion ?? "",
      end_date:               c.end_date ?? "",
      total_units_planned:    String(c.total_units_planned ?? ""),
      estimated_rent_per_unit: String(c.estimated_rent_per_unit ?? ""),
      estimated_value_ready:  String(c.estimated_value_ready ?? ""),
      ownership_pct:          String(c.ownership_pct ?? 100),
      partner_name:           c.partner_name ?? "",
      partner_pct:            String(c.partner_pct ?? ""),
      notes:                  c.notes ?? "",
    });
    setEditItem(c);
  };

  const handleDelete = async () => {
    if (!delItem) return;
    try {
      await deleteConstruction.mutateAsync(delItem.id);
      toast({ title: "Obra excluída" });
      setDelItem(null);
    } catch { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const handleCreateExpense = async () => {
    if (!expForm.description || !expForm.total_amount || !selectedId) return;
    const total     = parseFloat(expForm.total_amount);
    const c         = constructions.find(x => x.id === selectedId);
    const wPct      = (c?.ownership_pct ?? 100) / 100;
    try {
      await createExpense.mutateAsync({
        property_id:        selectedId,          // compat legacy
        construction_id:    selectedId as any,
        property_code:      c?.name ?? null,
        description:        expForm.description,
        category:           expForm.category,
        total_amount:       total,
        william_amount:     expForm.paid_by === "william" ? total : expForm.paid_by === "ambos" ? total * wPct : 0,
        partner_amount:     expForm.paid_by === "socio"   ? total : expForm.paid_by === "ambos" ? total * (1 - wPct) : 0,
        paid_by:            expForm.paid_by,
        payment_type:       expForm.payment_type,
        expense_date:       expForm.expense_date || null,
        installments_total: expForm.payment_type === "parcelado" ? parseInt(expForm.installments_total) || null : null,
        installments_paid:  expForm.payment_type === "parcelado" ? parseInt(expForm.installments_paid) || 0  : null,
        next_due_date:      expForm.next_due_date || null,
      } as any);
      toast({ title: "Despesa registrada!" });
      setExpenseOpen(false);
      setExpForm({ description: "", category: "", total_amount: "", paid_by: "william", payment_type: "avista", installments_total: "", installments_paid: "", next_due_date: "", expense_date: "" });
    } catch { toast({ title: "Erro ao criar despesa", variant: "destructive" }); }
  };

  const expKPIs = {
    total:   expenses.reduce((s, e) => s + (e.total_amount   ?? 0), 0),
    william: expenses.reduce((s, e) => s + (e.william_amount ?? 0), 0),
    partner: expenses.reduce((s, e) => s + (e.partner_amount ?? 0), 0),
  };

  // ─── Construction Card ──────────────────────────────────────────────────────
  const renderCard = (c: any) => {
    const s        = STATUS_MAP[c.status ?? ""] ?? { label: c.status, variant: "gray" as const };
    const progress = c.total_units_planned ? ((c.total_units_built ?? 0) / c.total_units_planned) * 100 : 0;
    const rentProj = (c.total_units_planned ?? 0) * (c.estimated_rent_per_unit ?? 0) * ((c.ownership_pct ?? 100) / 100);
    const addr     = assetAddress(c.assets);

    return (
      <PremiumCard className="space-y-3 h-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-base leading-tight" style={{ color: '#F0F4F8' }}>{c.name}</p>
            {c.assets && (
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#C9A84C' }}>
                <Building2 className="w-3 h-3 shrink-0" />
                {c.assets.name}
              </p>
            )}
            {addr && (
              <p className="text-xs flex items-center gap-1" style={{ color: '#94A3B8' }}>
                <MapPin className="w-3 h-3 shrink-0" />{addr}
              </p>
            )}
          </div>
          <WtBadge variant={s.variant}>{s.label}</WtBadge>
        </div>

        {/* Dates */}
        <div className="flex gap-4 text-xs" style={{ color: '#64748B' }}>
          {c.start_date && <span>▶ {formatDate(c.start_date)}</span>}
          {c.estimated_completion && <span>🏁 {formatDate(c.estimated_completion)}</span>}
          {c.end_date && <span style={{ color: '#10B981' }}>✓ {formatDate(c.end_date)}</span>}
        </div>

        {/* Units progress */}
        {(c.total_units_planned ?? 0) > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs" style={{ color: '#94A3B8' }}>
              <span>
                {c.total_units_built ?? 0}/{c.total_units_planned} construídas
                {(c.total_units_rented ?? 0) > 0 && ` · ${c.total_units_rented} alugadas`}
              </span>
              <span style={{ color: '#C9A84C' }}>{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {/* Financial projections */}
        <div className="space-y-0.5">
          {rentProj > 0 && (
            <p className="text-xs font-mono" style={{ color: '#E8C97A' }}>
              Renda projetada: {formatCurrency(rentProj)}/mês
              {(c.ownership_pct ?? 100) < 100 && <span style={{ color: '#64748B' }}> ({c.ownership_pct}% sua)</span>}
            </p>
          )}
          {(c.estimated_value_ready ?? 0) > 0 && (
            <p className="text-xs font-mono" style={{ color: '#10B981' }}>
              Valor pronto: {formatCurrency(c.estimated_value_ready)}
            </p>
          )}
        </div>

        {/* Partner */}
        {c.partner_name && (
          <p className="text-xs" style={{ color: '#2DD4BF' }}>
            <Users className="inline w-3 h-3 mr-1" />{c.partner_pct}% {c.partner_name}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1 flex-wrap">
          <GoldButton
            variant="outline" className="text-xs py-1.5 px-3"
            onClick={() => { setSelectedId(c.id); document.querySelector<HTMLButtonElement>('[data-value="despesas"]')?.click(); }}
          >Despesas</GoldButton>
          <GoldButton
            variant="outline" className="text-xs py-1.5 px-3"
            onClick={() => setStagesFor(c)}
          ><Layers className="w-3 h-3" />Etapas</GoldButton>
          <GoldButton
            variant="outline" className="text-xs py-1.5 px-3"
            onClick={() => openEdit(c)}
          ><Pencil className="w-3 h-3" /></GoldButton>
          <button
            onClick={() => setDelItem(c)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}
          ><Trash2 className="w-3 h-3" /></button>
        </div>
      </PremiumCard>
    );
  };

  // ─── Construction Form Modal ─────────────────────────────────────────────────
  const ConstructionFormModal = ({ title, onClose }: { title: string; onClose: () => void }) => (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
        <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {/* Asset link */}
          <div>
            <Label style={{ color: '#94A3B8' }}>Patrimônio (opcional)</Label>
            <Select value={form.asset_id} onValueChange={v => setF("asset_id", v)}>
              <SelectTrigger style={inputStyle}><SelectValue placeholder="Selecionar imóvel/terreno..." /></SelectTrigger>
              <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                <SelectItem value="none">— Sem vínculo —</SelectItem>
                {(assets ?? [])
                  .filter((a: any) => ["imovel","terreno"].includes(a.type ?? ""))
                  .map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{assetLabel(a)}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label style={{ color: '#94A3B8' }}>Nome da obra *</Label>
            <Input value={form.name} onChange={e => setF("name", e.target.value)} style={inputStyle} placeholder="ex: Residencial W. Tavares 4" />
          </div>

          <div>
            <Label style={{ color: '#94A3B8' }}>Status</Label>
            <Select value={form.status} onValueChange={v => setF("status", v)}>
              <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
              <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div><Label style={{ color: '#94A3B8' }}>Início</Label><DatePicker value={form.start_date} onChange={v => setF("start_date", v)} placeholder="Data início" /></div>
            <div><Label style={{ color: '#94A3B8' }}>Previsão término</Label><DatePicker value={form.estimated_completion} onChange={v => setF("estimated_completion", v)} placeholder="Previsão" /></div>
            <div><Label style={{ color: '#94A3B8' }}>Conclusão real</Label><DatePicker value={form.end_date} onChange={v => setF("end_date", v)} placeholder="Concluído em" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label style={{ color: '#94A3B8' }}>Kitnets/Unidades</Label><Input type="number" value={form.total_units_planned} onChange={e => setF("total_units_planned", e.target.value)} style={inputStyle} placeholder="0" /></div>
            <div><Label style={{ color: '#94A3B8' }}>Aluguel projetado/unidade</Label><Input type="number" value={form.estimated_rent_per_unit} onChange={e => setF("estimated_rent_per_unit", e.target.value)} style={inputStyle} placeholder="0,00" /></div>
          </div>

          <div>
            <Label style={{ color: '#94A3B8' }}>Valor projetado do bem pronto (R$)</Label>
            <Input type="number" value={form.estimated_value_ready} onChange={e => setF("estimated_value_ready", e.target.value)} style={inputStyle} placeholder="0,00" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div><Label style={{ color: '#94A3B8' }}>% William</Label><Input type="number" value={form.ownership_pct} onChange={e => setF("ownership_pct", e.target.value)} style={inputStyle} placeholder="100" /></div>
            <div><Label style={{ color: '#94A3B8' }}>Sócio</Label><Input value={form.partner_name} onChange={e => setF("partner_name", e.target.value)} style={inputStyle} placeholder="Nome" /></div>
            <div><Label style={{ color: '#94A3B8' }}>% Sócio</Label><Input type="number" value={form.partner_pct} onChange={e => setF("partner_pct", e.target.value)} style={inputStyle} placeholder="0" /></div>
          </div>

          <div>
            <Label style={{ color: '#94A3B8' }}>Observações</Label>
            <Textarea value={form.notes} onChange={e => setF("notes", e.target.value)} style={inputStyle} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #1A2535', color: '#94A3B8' }}>Cancelar</button>
          <GoldButton onClick={handleSaveConstruction} disabled={createConstruction.isPending || updateConstruction.isPending}>
            Salvar
          </GoldButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
          <Building2 className="inline w-6 h-6 mr-2" style={{ color: '#C9A84C' }} />
          Obras & Terrenos
        </h1>
        <GoldButton onClick={() => { setForm({ ...emptyForm }); setNewOpen(true); }}>
          <Plus className="w-4 h-4" />Nova Obra
        </GoldButton>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Unidades em Desenvolvimento" value={totalUnitsPlanned} color="cyan" compact />
        <KpiCard label="Renda Futura Projetada" value={totalRentProjection} color="gold" />
        <KpiCard label="Valor Projetado (Bens Prontos)" value={totalValueReady} color="green" />
      </div>

      <Tabs defaultValue="projetos">
        <TabsList style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <TabsTrigger value="projetos">Projetos ({constructions.length})</TabsTrigger>
          <TabsTrigger value="despesas" data-value="despesas">Despesas</TabsTrigger>
        </TabsList>

        {/* ── Projetos ── */}
        <TabsContent value="projetos" className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
          ) : constructions.length === 0 ? (
            <PremiumCard>
              <div className="text-center py-10 space-y-3">
                <Building2 className="w-10 h-10 mx-auto" style={{ color: '#1A2535' }} />
                <p style={{ color: '#94A3B8' }}>Nenhuma obra cadastrada</p>
                <p className="text-sm" style={{ color: '#64748B' }}>Adicione um imóvel/terreno em Patrimônio, depois crie uma obra aqui.</p>
                <GoldButton onClick={() => { setForm({ ...emptyForm }); setNewOpen(true); }}><Plus className="w-4 h-4" />Nova Obra</GoldButton>
              </div>
            </PremiumCard>
          ) : (
            <DraggableGrid
              storageKey="wt7_constructions_order"
              items={constructions}
              columns="grid-cols-1 md:grid-cols-2"
              renderCard={renderCard}
            />
          )}
        </TabsContent>

        {/* ── Despesas ── */}
        <TabsContent value="despesas" className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-72" style={{ background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' }}>
                <SelectValue placeholder="Selecione uma obra" />
              </SelectTrigger>
              <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                {constructions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedId && (
              <GoldButton onClick={() => setExpenseOpen(true)}>
                <Plus className="w-4 h-4" />Nova Despesa
              </GoldButton>
            )}
          </div>

          {selectedId && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard label="Total Investido" value={expKPIs.total} color="gold" />
                <KpiCard label="Parte William" value={expKPIs.william} color="cyan" />
                <KpiCard label="Parte Sócio" value={expKPIs.partner} color="green" />
              </div>
              <PremiumCard>
                <Table>
                  <TableHeader>
                    <TableRow style={{ borderColor: '#1A2535' }}>
                      {["Data","Descrição","Categoria","Total","William","Sócio","Tipo"].map(h => (
                        <TableHead key={h} style={{ color: '#94A3B8' }}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhuma despesa registrada</TableCell></TableRow>
                    ) : expenses.map(e => (
                      <TableRow key={e.id} style={{ borderColor: '#1A2535' }}>
                        <TableCell style={{ color: '#CBD5E1' }}>{e.expense_date ? formatDate(e.expense_date) : "—"}</TableCell>
                        <TableCell style={{ color: '#F0F4F8' }}>{e.description}</TableCell>
                        <TableCell><WtBadge variant="cyan">{e.category}</WtBadge></TableCell>
                        <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(e.total_amount ?? 0)}</TableCell>
                        <TableCell className="font-mono" style={{ color: '#2DD4BF' }}>{formatCurrency(e.william_amount ?? 0)}</TableCell>
                        <TableCell className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(e.partner_amount ?? 0)}</TableCell>
                        <TableCell>
                          <WtBadge variant={e.payment_type === "parcelado" ? "gold" : "gray"}>
                            {e.payment_type === "parcelado" ? `${e.installments_paid}/${e.installments_total}x` : "À vista"}
                          </WtBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </PremiumCard>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Modals ── */}
      {newOpen && <ConstructionFormModal title="Nova Obra" onClose={() => { setNewOpen(false); setForm({ ...emptyForm }); }} />}
      {editItem && <ConstructionFormModal title="Editar Obra" onClose={() => { setEditItem(null); setForm({ ...emptyForm }); }} />}
      {stagesFor && <StagesModal construction={stagesFor} onClose={() => setStagesFor(null)} />}

      {/* Delete confirm */}
      {delItem && (
        <Dialog open onOpenChange={o => !o && setDelItem(null)}>
          <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
            <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Excluir "{delItem.name}"?</DialogTitle></DialogHeader>
            <p className="text-sm" style={{ color: '#94A3B8' }}>Todas as despesas e etapas desta obra serão excluídas. Ação irreversível.</p>
            <DialogFooter className="gap-2">
              <button onClick={() => setDelItem(null)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #1A2535', color: '#94A3B8' }}>Cancelar</button>
              <button onClick={handleDelete} disabled={deleteConstruction.isPending} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', color: '#F43F5E' }}>
                {deleteConstruction.isPending ? "Excluindo..." : "Excluir Obra"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* New expense modal */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Nova Despesa — {selectedConstruction?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label style={{ color: '#94A3B8' }}>Data</Label><DatePicker value={expForm.expense_date} onChange={v => setExpForm(f => ({ ...f, expense_date: v }))} /></div>
            <div><Label style={{ color: '#94A3B8' }}>Descrição</Label><Input value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} /></div>
            <div>
              <Label style={{ color: '#94A3B8' }}>Categoria</Label>
              <Select value={expForm.category} onValueChange={v => setExpForm(f => ({ ...f, category: v }))}>
                <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label style={{ color: '#94A3B8' }}>Valor Total (R$)</Label><Input type="number" value={expForm.total_amount} onChange={e => setExpForm(f => ({ ...f, total_amount: e.target.value }))} style={inputStyle} /></div>
            <div>
              <Label style={{ color: '#94A3B8' }}>Pago por</Label>
              <Select value={expForm.paid_by} onValueChange={v => setExpForm(f => ({ ...f, paid_by: v }))}>
                <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                  <SelectItem value="william">William</SelectItem>
                  <SelectItem value="socio">Sócio</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label style={{ color: '#94A3B8' }}>Tipo</Label>
              <Select value={expForm.payment_type} onValueChange={v => setExpForm(f => ({ ...f, payment_type: v }))}>
                <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                  <SelectItem value="avista">À vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {expForm.payment_type === "parcelado" && (
              <div className="grid grid-cols-2 gap-2">
                <div><Label style={{ color: '#94A3B8' }}>Total parcelas</Label><Input type="number" value={expForm.installments_total} onChange={e => setExpForm(f => ({ ...f, installments_total: e.target.value }))} style={inputStyle} /></div>
                <div><Label style={{ color: '#94A3B8' }}>Pagas</Label><Input type="number" value={expForm.installments_paid} onChange={e => setExpForm(f => ({ ...f, installments_paid: e.target.value }))} style={inputStyle} /></div>
              </div>
            )}
          </div>
          <DialogFooter><GoldButton onClick={handleCreateExpense}>Registrar</GoldButton></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
