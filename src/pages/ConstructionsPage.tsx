import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/wt7/DatePicker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { DraggableGrid } from "@/components/wt7/DraggableGrid";
import {
  useConstructions, useCreateConstruction, useUpdateConstruction, useDeleteConstruction,
  useConstructionExpenses, useCreateConstructionExpense, useUpdateConstructionExpense, useDeleteConstructionExpense,
  useConstructionStages, useCreateStage, useUpdateStage, useDeleteStage,
} from "@/hooks/useConstructions";
import { useAssets } from "@/hooks/useFinances";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
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
  "Instalações", "Acabamento", "Taxas/Cartório", "Amortização", "Outros",
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

// ─── Stage helpers ────────────────────────────────────────────────────────────

/**
 * Retorna o percentual efetivo de conclusão de uma etapa:
 * - Se pct_complete_auto = true (padrão): calcula spent/budget × 100 (clamp 0-100)
 * - Se pct_complete_auto = false: usa o valor manual em pct_complete
 * - Sem budget → sempre manual (auto não faz sentido)
 */
function getStagePct(stage: any, expenses: any[]): number {
  const budget = Number(stage.budget_estimated ?? 0);
  const auto = stage.pct_complete_auto ?? true;
  if (!auto || budget <= 0) return Math.round(Number(stage.pct_complete ?? 0));
  const spent = (expenses ?? [])
    .filter((e: any) => e.stage_id === stage.id)
    .reduce((acc: number, e: any) => acc + Number(e.total_amount ?? 0), 0);
  return Math.min(100, Math.max(0, Math.round((spent / budget) * 100)));
}

// ─── Stage Form (nível de módulo — evita remount) ────────────────────────────

type StageFormData = { name: string; status: string; pct_complete: number; pct_complete_auto: boolean; budget_estimated: number; start_date: string; end_date: string; notes: string };

function StageForm({ form, setForm, onSave, onCancel, isPending }: {
  form: StageFormData;
  setForm: (f: StageFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
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
          <div className="flex items-center justify-between">
            <Label style={{ color: '#94A3B8' }}>
              Conclusão{form.pct_complete_auto ? ' (auto)' : ': ' + Math.round(form.pct_complete) + '%'}
            </Label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: form.pct_complete_auto ? '#C9A84C' : '#64748B' }}>auto</span>
              <Switch
                checked={form.pct_complete_auto}
                onCheckedChange={(v) => setForm({ ...form, pct_complete_auto: v })}
              />
            </div>
          </div>
          {form.pct_complete_auto ? (
            <p className="text-xs pt-2" style={{ color: '#64748B' }}>
              Calculado automaticamente por gasto ÷ orçamento.
            </p>
          ) : (
            <div className="pt-3">
              <Slider min={0} max={100} step={5} value={[form.pct_complete]} onValueChange={([v]) => setForm({ ...form, pct_complete: v })} />
            </div>
          )}
        </div>
      </div>
      <div>
        <Label style={{ color: '#A78BFA' }}>Orçamento previsto (R$)</Label>
        <Input
          type="number"
          value={form.budget_estimated || ""}
          onChange={e => setForm({ ...form, budget_estimated: parseFloat(e.target.value) || 0 })}
          style={{ ...inputStyle, borderColor: 'rgba(167,139,250,0.4)' }}
          placeholder="ex: 20.000,00"
        />
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
}

// ─── Stages Modal ─────────────────────────────────────────────────────────────

function StagesModal({ construction, onClose }: { construction: any; onClose: () => void }) {
  const { data: stages = [], isLoading } = useConstructionStages(construction.id);
  const { data: expenses = [] }          = useConstructionExpenses(construction.id);
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();
  const { toast } = useToast();

  const [addOpen, setAddOpen]   = useState(false);
  const [editStage, setEditStage] = useState<any>(null);
  const [form, setForm] = useState({ name: "", status: "pendente", pct_complete: 0, pct_complete_auto: true, budget_estimated: 0, start_date: "", end_date: "", notes: "" });
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const dragId   = useRef<string | null>(null);
  const overIdRef= useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // sync localOrder quando stages chega do servidor
  const prevStageIds = useRef<string>("");
  const stageIds = stages.map((s: any) => s.id).join(",");
  if (stageIds !== prevStageIds.current) {
    prevStageIds.current = stageIds;
    setLocalOrder(stages.map((s: any) => s.id));
  }

  const orderedStages = localOrder
    .map(id => stages.find((s: any) => s.id === id))
    .filter(Boolean) as any[];

  // persist nova ordem no banco
  const persistOrder = async (ids: string[]) => {
    await Promise.all(ids.map((id, idx) => updateStage.mutateAsync({ id, order_index: idx })));
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (["input","textarea","select","button"].includes(tag)) { e.preventDefault(); return; }
    dragId.current = id; overIdRef.current = id; setDraggingId(id);
  };
  const onDragOver  = (e: React.DragEvent, id: string) => { e.preventDefault(); overIdRef.current = id; };
  const onDragEnd   = async () => {
    const from = dragId.current; const to = overIdRef.current;
    if (from && to && from !== to) {
      const next = [...localOrder];
      const fi = next.indexOf(from); const ti = next.indexOf(to);
      if (fi !== -1 && ti !== -1) { next.splice(fi, 1); next.splice(ti, 0, from); }
      setLocalOrder(next);
      try { await persistOrder(next); }
      catch { toast({ title: "Erro ao reordenar", variant: "destructive" }); }
    }
    dragId.current = null; overIdRef.current = null; setDraggingId(null);
  };

  const handleReorganizar = async () => {
    const sorted = [...stages].sort((a: any, b: any) => {
      const da = a.start_date ?? "9999"; const db = b.start_date ?? "9999";
      return da.localeCompare(db);
    });
    const ids = sorted.map((s: any) => s.id);
    setLocalOrder(ids);
    try { await persistOrder(ids); toast({ title: "Etapas reorganizadas por data de início" }); }
    catch { toast({ title: "Erro ao reorganizar", variant: "destructive" }); }
  };

  const resetForm = () => setForm({ name: "", status: "pendente", pct_complete: 0, pct_complete_auto: true, budget_estimated: 0, start_date: "", end_date: "", notes: "" });

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
    setForm({ name: s.name, status: s.status, pct_complete: s.pct_complete ?? 0, pct_complete_auto: s.pct_complete_auto ?? true, budget_estimated: s.budget_estimated ?? 0, start_date: s.start_date ?? "", end_date: s.end_date ?? "", notes: s.notes ?? "" });
    setEditStage(s);
  };

  const overallPct = stages.length > 0 ? stages.reduce((acc: number, s: any) => acc + getStagePct(s, expenses), 0) / stages.length : 0;

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
          <div className="flex justify-between items-center text-xs" style={{ color: '#94A3B8' }}>
            <span>{stages.length} etapa{stages.length !== 1 ? "s" : ""}</span>
            <div className="flex items-center gap-3">
              {stages.length > 1 && (
                <button
                  onClick={handleReorganizar}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ background: 'rgba(45,212,191,0.08)', color: '#2DD4BF', border: '1px solid rgba(45,212,191,0.2)', fontSize: 10 }}
                >
                  ↕ reorganizar
                </button>
              )}
              <span style={{ color: '#C9A84C' }}>{overallPct.toFixed(0)}% concluído</span>
            </div>
          </div>
          <Progress value={overallPct} className="h-2" />
        </div>

        {/* Stage list */}
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : orderedStages.length === 0 ? (
          <p className="text-center py-4 text-sm" style={{ color: '#94A3B8' }}>Nenhuma etapa cadastrada</p>
        ) : (
          <div className="space-y-2">
            {orderedStages.map((s: any) => {
              const st = STAGE_STATUS_MAP[s.status] ?? STAGE_STATUS_MAP.pendente;
              return (
                <div
                  key={s.id}
                  draggable={editStage?.id !== s.id && addOpen === false}
                  onDragStart={e => onDragStart(e, s.id)}
                  onDragOver={e => onDragOver(e, s.id)}
                  onDragEnd={onDragEnd}
                  style={{ opacity: draggingId === s.id ? 0.4 : 1, transition: 'opacity 0.15s', cursor: editStage?.id === s.id ? 'default' : 'grab' }}
                >
                <PremiumCard className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span style={{ color: '#1A2535', fontSize: 12, userSelect: 'none' }}>⠿</span>
                        <span style={{ color: st.color }}>{st.icon}</span>
                        <span className="font-medium text-sm" style={{ color: '#F0F4F8' }}>{s.name}</span>
                        {(() => {
                          const pct = getStagePct(s, expenses);
                          const isManual = s.pct_complete_auto === false;
                          const budget = Number(s.budget_estimated ?? 0);
                          const spent = (expenses ?? []).filter((e: any) => e.stage_id === s.id).reduce((acc: number, e: any) => acc + Number(e.total_amount ?? 0), 0);
                          const autoSemBudget = !isManual && budget <= 0 && spent > 0;
                          return (
                            <span className="text-xs font-mono ml-auto flex items-center gap-1" style={{ color: '#C9A84C' }}>
                              {isManual && (
                                <span className="text-[9px] px-1 rounded" style={{ background: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)' }}>manual</span>
                              )}
                              {autoSemBudget && (
                                <span
                                  className="text-[9px] px-1 rounded"
                                  style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.4)' }}
                                  title={`R$ ${spent.toFixed(2)} gasto sem orçamento definido. Clique ✏ e preencha "Orçamento previsto" para calcular %.`}
                                >
                                  ⚠ sem orçamento
                                </span>
                              )}
                              {pct}%
                            </span>
                          );
                        })()}
                      </div>
                      <Progress value={getStagePct(s, expenses)} className="h-1 mt-1.5" />
                      {(s.budget_estimated ?? 0) > 0 && (() => {
                        const est = s.budget_estimated ?? 0;
                        const spent = (expenses ?? []).filter((e: any) => e.stage_id === s.id).reduce((acc: number, e: any) => acc + (e.total_amount ?? 0), 0);
                        const pct = Math.min((spent / est) * 100, 100);
                        const isOver = spent > est;
                        const color = isOver ? '#F59E0B' : '#10B981';
                        return (
                          <div className="mt-1.5 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span style={{ color: '#64748B' }}>Orçamento</span>
                              <span style={{ color, fontFamily: 'monospace' }}>
                                {formatCurrency(spent)} / {formatCurrency(est)} previsto
                                {isOver ? ' ⚠ acima' : spent > 0 ? ' ✓' : ''}
                              </span>
                            </div>
                            <div style={{ height: 3, background: '#1A2535', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
                            </div>
                          </div>
                        );
                      })()}
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
                      <StageForm form={form} setForm={setForm} onSave={handleEdit} onCancel={() => { setEditStage(null); resetForm(); }} isPending={updateStage.isPending} />
                    </div>
                  )}
                </PremiumCard>
                </div>
              );
            })}
          </div>
        )}

        {/* Add stage */}
        {addOpen ? (
          <PremiumCard className="p-3">
            <p className="text-sm font-medium mb-3" style={{ color: '#C9A84C' }}>Nova etapa</p>
            <StageForm form={form} setForm={setForm} onSave={handleAdd} onCancel={() => { setAddOpen(false); resetForm(); }} isPending={createStage.isPending} />
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
  total_units_planned: "", total_units_built: "", total_units_rented: "",
  estimated_rent_per_unit: "",
  total_budget: "",
  land_total_amount: "",
  estimated_value_ready: "", ownership_pct: "100",
  partner_name: "", partner_pct: "", notes: "",
  debt_to_partner: "", debt_partner_name: "", debt_target_date: "",
};

// ─── Construction Form Modal (nível de módulo — evita remount por re-render) ──

interface ConstructionFormModalProps {
  title: string;
  form: typeof emptyForm;
  setF: (k: string, v: string) => void;
  assets: any[];
  onSave: () => void;
  onClose: () => void;
  isPending: boolean;
}

function ConstructionFormModal({ title, form, setF, assets, onSave, onClose, isPending }: ConstructionFormModalProps) {
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
        <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
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

          <div className="grid grid-cols-3 gap-2">
            <div><Label style={{ color: '#94A3B8' }}>Total planejadas</Label><Input type="number" value={form.total_units_planned} onChange={e => setF("total_units_planned", e.target.value)} style={inputStyle} placeholder="0" /></div>
            <div><Label style={{ color: '#2DD4BF' }}>Construídas</Label><Input type="number" value={form.total_units_built} onChange={e => setF("total_units_built", e.target.value)} style={{ ...inputStyle, borderColor: 'rgba(45,212,191,0.3)' }} placeholder="0" /></div>
            <div><Label style={{ color: '#E8C97A' }}>Alugadas</Label><Input type="number" value={form.total_units_rented} onChange={e => setF("total_units_rented", e.target.value)} style={{ ...inputStyle, borderColor: 'rgba(232,201,122,0.3)' }} placeholder="0" /></div>
          </div>
          <div>
            <Label style={{ color: '#94A3B8' }}>Aluguel projetado/unidade</Label>
            <Input type="number" value={form.estimated_rent_per_unit} onChange={e => setF("estimated_rent_per_unit", e.target.value)} style={inputStyle} placeholder="0,00" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label style={{ color: '#A78BFA' }}>🏗️ Orçamento da obra (R$)</Label>
              <Input type="number" value={form.total_budget} onChange={e => setF("total_budget", e.target.value)} style={{ ...inputStyle, borderColor: 'rgba(167,139,250,0.4)', background: 'rgba(167,139,250,0.03)' }} placeholder="ex: 180.000,00" />
              <p className="text-[10px] mt-1" style={{ color: '#64748B' }}>Execução: mão de obra + materiais</p>
            </div>
            <div>
              <Label style={{ color: '#E8C97A' }}>📍 Total contratado terreno (R$)</Label>
              <Input type="number" value={form.land_total_amount} onChange={e => setF("land_total_amount", e.target.value)} style={{ ...inputStyle, borderColor: 'rgba(232,201,122,0.4)', background: 'rgba(232,201,122,0.03)' }} placeholder="ex: 140.000,00" />
              <p className="text-[10px] mt-1" style={{ color: '#64748B' }}>Aquisição (entrada + parcelas)</p>
            </div>
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

          {/* Dívida com sócio */}
          <div className="rounded-lg p-3 space-y-3" style={{ background: 'rgba(244,63,94,0.04)', border: '1px solid rgba(244,63,94,0.15)' }}>
            <p className="text-xs font-semibold" style={{ color: '#F87171' }}>Dívida com sócio (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label style={{ color: '#94A3B8' }}>Valor da dívida (R$)</Label>
                <Input type="number" value={form.debt_to_partner} onChange={e => setF("debt_to_partner", e.target.value)} style={{ ...inputStyle, borderColor: 'rgba(244,63,94,0.3)' }} placeholder="ex: 85.000,00" />
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Credor</Label>
                <Input value={form.debt_partner_name} onChange={e => setF("debt_partner_name", e.target.value)} style={inputStyle} placeholder="ex: Jairo" />
              </div>
            </div>
            <div>
              <Label style={{ color: '#94A3B8' }}>Meta de quitação</Label>
              <DatePicker value={form.debt_target_date} onChange={v => setF("debt_target_date", v)} placeholder="Data limite" />
            </div>
          </div>

          <div>
            <Label style={{ color: '#94A3B8' }}>Observações</Label>
            <Textarea value={form.notes} onChange={e => setF("notes", e.target.value)} style={inputStyle} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #1A2535', color: '#94A3B8' }}>Cancelar</button>
          <GoldButton onClick={onSave} disabled={isPending}>Salvar</GoldButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Expense Form (nível de módulo — evita remount) ─────────────────────────

function ExpenseForm({ expForm, setExpForm, stages }: { expForm: any; setExpForm: (fn: (f: any) => any) => void; stages: any[] }) {
  const isTerreno = expForm.expense_kind === "terreno";
  return (
    <div className="space-y-3">
      {/* Tipo do gasto: obra (execução) × terreno (aquisição) */}
      <div>
        <Label style={{ color: '#94A3B8' }}>Tipo do gasto</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {[
            { val: "obra",    lbl: "🏗️ Obra",     hint: "Execução: mão de obra, materiais" },
            { val: "terreno", lbl: "📍 Terreno", hint: "Aquisição do lote" },
          ].map(opt => {
            const active = (expForm.expense_kind ?? "obra") === opt.val;
            return (
              <button key={opt.val} type="button"
                onClick={() => setExpForm(f => ({ ...f, expense_kind: opt.val }))}
                className="rounded-lg px-3 py-2 text-left transition-colors"
                style={{
                  background: active ? "rgba(232,201,122,0.08)" : "#080C10",
                  border: active ? "1px solid rgba(232,201,122,0.4)" : "1px solid #1A2535",
                  color: active ? "#E8C97A" : "#94A3B8",
                }}>
                <p className="text-xs font-bold">{opt.lbl}</p>
                <p className="text-[10px] mt-0.5" style={{ color: active ? "#94A3B8" : "#64748B" }}>{opt.hint}</p>
              </button>
            );
          })}
        </div>
      </div>
      <div><Label style={{ color: '#94A3B8' }}>Data</Label><DatePicker value={expForm.expense_date} onChange={v => setExpForm(f => ({ ...f, expense_date: v }))} /></div>
      <div><Label style={{ color: '#94A3B8' }}>Descrição</Label><Input value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label style={{ color: '#94A3B8' }}>Categoria</Label>
          <Select value={expForm.category} onValueChange={v => setExpForm(f => ({ ...f, category: v }))}>
            <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
            <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
              {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label style={{ color: '#A78BFA' }}>Etapa (opcional)</Label>
          <Select value={expForm.stage_id || "none"} onValueChange={v => setExpForm(f => ({ ...f, stage_id: v === "none" ? "" : v }))}>
            <SelectTrigger style={{ ...inputStyle, borderColor: 'rgba(167,139,250,0.4)' }}><SelectValue placeholder="— Sem etapa —" /></SelectTrigger>
            <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
              <SelectItem value="none">— Sem etapa —</SelectItem>
              {stages.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
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
  );
}

// ─── Despesas Modal (por card) ───────────────────────────────────────────────

const emptyExpForm = {
  description: "", category: "", total_amount: "", paid_by: "william",
  payment_type: "avista", installments_total: "", installments_paid: "",
  next_due_date: "", expense_date: "", stage_id: "",
  expense_kind: "obra",
};

function DespesasView({ construction, onClose }: { construction: any; onClose: () => void }) {
  const { data: allExpenses = [] } = useConstructionExpenses(construction.id);
  const { data: stages   = [] } = useConstructionStages(construction.id);
  const createExpense = useCreateConstructionExpense();
  const updateExpense = useUpdateConstructionExpense();
  const deleteExpense = useDeleteConstructionExpense();
  const { toast }     = useToast();
  const [addOpen, setAddOpen]   = useState(false);
  const [editExp, setEditExp]   = useState<any>(null);
  const [expForm, setExpForm]   = useState({ ...emptyExpForm });
  const [sortCol, setSortCol]   = useState<string>("expense_date");
  const [sortDir, setSortDir]   = useState<"desc" | "asc">("desc");
  const [kindFilter, setKindFilter] = useState<"obra" | "terreno">("obra");

  // Filtra por aba ativa. Lançamentos sem expense_kind (legado) contam como "obra".
  const expenses = (allExpenses as any[]).filter((e: any) => (e.expense_kind ?? "obra") === kindFilter);
  const obraCount    = (allExpenses as any[]).filter(e => (e.expense_kind ?? "obra") === "obra").length;
  const terrenoCount = (allExpenses as any[]).filter(e => e.expense_kind === "terreno").length;

  const totalBudget = construction.total_budget ?? 0;
  const expKPIs = {
    total:   expenses.reduce((s: number, e: any) => s + (e.total_amount   ?? 0), 0),
    william: expenses.reduce((s: number, e: any) => s + (e.william_amount ?? 0), 0),
    partner: expenses.reduce((s: number, e: any) => s + (e.partner_amount ?? 0), 0),
  };
  // % Orçamento só faz sentido na aba Obra (orçamento da construção é da execução).
  const budgetPct = kindFilter === "obra" && totalBudget > 0 ? (expKPIs.total / totalBudget) * 100 : null;

  // mapa stageId → order_index para ordenar por ordem de etapa
  const stageOrder: Record<string, number> = {};
  (stages as any[]).forEach((s: any) => { stageOrder[s.id] = s.order_index ?? 0; });

  const TYPE_ORDER: Record<string, number> = { avista: 0, parcelado: 1 };

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sortedExpenses = [...(expenses as any[])].sort((a, b) => {
    let va: any, vb: any;
    switch (sortCol) {
      case "expense_date":  va = a.expense_date ?? ""; vb = b.expense_date ?? ""; break;
      case "category":      va = a.category ?? "";     vb = b.category ?? "";     break;
      case "total_amount":  va = a.total_amount ?? 0;  vb = b.total_amount ?? 0;  break;
      case "william_amount":va = a.william_amount ?? 0;vb = b.william_amount ?? 0;break;
      case "partner_amount":va = a.partner_amount ?? 0;vb = b.partner_amount ?? 0;break;
      case "payment_type":  va = TYPE_ORDER[a.payment_type] ?? 99; vb = TYPE_ORDER[b.payment_type] ?? 99; break;
      case "stage_order":   va = a.stage_id ? (stageOrder[a.stage_id] ?? 999) : 999;
                            vb = b.stage_id ? (stageOrder[b.stage_id] ?? 999) : 999; break;
      default: va = ""; vb = "";
    }
    const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortBtn = ({ col, label, style: extraStyle }: { col: string; label: string; style?: React.CSSProperties }) => (
    <button
      onClick={() => toggleSort(col)}
      className="flex items-center gap-1 text-xs font-medium whitespace-nowrap"
      style={{ color: sortCol === col ? '#E8C97A' : '#94A3B8', ...extraStyle }}
    >
      {label}
      <span style={{ fontSize: 10, opacity: sortCol === col ? 1 : 0.4 }}>
        {sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );

  const handleCreate = async () => {
    if (!expForm.description || !expForm.total_amount) return;
    const total = parseFloat(expForm.total_amount);
    const wPct  = (construction.ownership_pct ?? 100) / 100;
    try {
      await createExpense.mutateAsync({
        property_id:        null,               // legado — não usar para novas construções
        construction_id:    construction.id,
        property_code:      construction.name ?? null,
        description:        expForm.description,
        category:           expForm.category,
        total_amount:       total,
        william_amount:     expForm.paid_by === "william" ? total : expForm.paid_by === "ambos" ? total * wPct : 0,
        partner_amount:     expForm.paid_by === "socio"   ? total : expForm.paid_by === "ambos" ? total * (1 - wPct) : 0,
        paid_by:            expForm.paid_by,
        payment_type:       expForm.payment_type,
        expense_date:       expForm.expense_date || null,
        stage_id:           expForm.expense_kind === "terreno" ? null : (expForm.stage_id || null),
        installments_total: expForm.payment_type === "parcelado" ? parseInt(expForm.installments_total) || null : null,
        installments_paid:  expForm.payment_type === "parcelado" ? parseInt(expForm.installments_paid) || 0  : null,
        next_due_date:      expForm.next_due_date || null,
        expense_kind:       expForm.expense_kind || "obra",
      } as any);
      toast({ title: "Despesa registrada!" });
      setAddOpen(false);
      setExpForm({ ...emptyExpForm });
    } catch { toast({ title: "Erro ao criar despesa", variant: "destructive" }); }
  };

  const openEditExp = (e: any) => {
    setExpForm({
      description: e.description ?? "",
      category: e.category ?? "",
      total_amount: String(e.total_amount ?? ""),
      paid_by: e.paid_by ?? "william",
      payment_type: e.payment_type ?? "avista",
      installments_total: String(e.installments_total ?? ""),
      installments_paid: String(e.installments_paid ?? ""),
      next_due_date: e.next_due_date ?? "",
      expense_date: e.expense_date ?? "",
      stage_id: e.stage_id ?? "",
      expense_kind: e.expense_kind ?? "obra",
    });
    setEditExp(e);
    setAddOpen(false);
  };

  const handleUpdate = async () => {
    if (!editExp) return;
    const total = parseFloat(expForm.total_amount);
    const wPct  = (construction.ownership_pct ?? 100) / 100;
    try {
      await updateExpense.mutateAsync({
        id: editExp.id,
        description:        expForm.description,
        category:           expForm.category,
        total_amount:       total,
        william_amount:     expForm.paid_by === "william" ? total : expForm.paid_by === "ambos" ? total * wPct : 0,
        partner_amount:     expForm.paid_by === "socio"   ? total : expForm.paid_by === "ambos" ? total * (1 - wPct) : 0,
        paid_by:            expForm.paid_by,
        payment_type:       expForm.payment_type,
        expense_date:       expForm.expense_date || null,
        stage_id:           expForm.expense_kind === "terreno" ? null : (expForm.stage_id || null),
        installments_total: expForm.payment_type === "parcelado" ? parseInt(expForm.installments_total) || null : null,
        installments_paid:  expForm.payment_type === "parcelado" ? parseInt(expForm.installments_paid) || 0  : null,
        next_due_date:      expForm.next_due_date || null,
        expense_kind:       expForm.expense_kind || "obra",
      });
      toast({ title: "Despesa atualizada!" });
      setEditExp(null);
      setExpForm({ ...emptyExpForm });
    } catch { toast({ title: "Erro ao atualizar", variant: "destructive" }); }
  };

  const handleDeleteExp = async (id: string) => {
    try {
      await deleteExpense.mutateAsync(id);
      toast({ title: "Despesa removida" });
    } catch { toast({ title: "Erro ao remover", variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: '#94A3B8' }}
        >
          <ChevronUp className="w-4 h-4 rotate-[-90deg]" />
          Obras
        </button>
        <span style={{ color: '#1A2535' }}>/</span>
        <h1 className="font-display font-bold text-xl" style={{ color: '#F0F4F8' }}>
          Despesas — {construction.name}
        </h1>
      </div>

      {/* Card de dívida com sócio */}
      {(construction.debt_to_partner ?? 0) > 0 && (() => {
        const debtOrig  = construction.debt_to_partner as number;
        const pago      = (expenses as any[])
          .filter((e: any) => e.category === "Amortização")
          .reduce((s: number, e: any) => s + (e.william_amount ?? 0), 0);
        const saldo     = Math.max(debtOrig - pago, 0);
        const pct       = debtOrig > 0 ? Math.min((pago / debtOrig) * 100, 100) : 0;
        const creditor  = construction.debt_partner_name ?? "Sócio";
        const targetStr = construction.debt_target_date ? formatDate(construction.debt_target_date) : null;
        return (
          <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.2)' }}>
            <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
              <p className="font-semibold text-sm" style={{ color: '#F87171' }}>Dívida com {creditor}</p>
              {targetStr && <span className="text-xs" style={{ color: '#64748B' }}>Meta de quitação: <span style={{ color: '#94A3B8' }}>{targetStr}</span></span>}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>ORIGINAL</p>
                <p className="font-mono font-bold text-sm" style={{ color: '#F87171' }}>{formatCurrency(debtOrig)}</p>
              </div>
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>AMORTIZADO</p>
                <p className="font-mono font-bold text-sm" style={{ color: '#10B981' }}>{formatCurrency(pago)}</p>
                <p className="text-xs" style={{ color: '#64748B' }}>via cat. Amortização</p>
              </div>
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>SALDO DEVEDOR</p>
                <p className="font-mono font-bold text-sm" style={{ color: saldo === 0 ? '#10B981' : '#E8C97A' }}>{formatCurrency(saldo)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <div style={{ height: 6, background: '#1A2535', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#10B981', borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
              <p className="text-right text-xs" style={{ color: '#64748B' }}>{pct.toFixed(1)}% quitado</p>
            </div>
          </div>
        );
      })()}

      {/* Abas: Obra (execução) × Terreno (aquisição) */}
      <div style={{ borderBottom: '1px solid #1A2535', display: 'flex', gap: 4 }}>
        {[
          { id: "obra",    lbl: "🏗️ Obra",     hint: "Mão de obra, materiais, execução", count: obraCount },
          { id: "terreno", lbl: "📍 Terreno", hint: "Aquisição do lote, parcelas",        count: terrenoCount },
        ].map(t => {
          const active = kindFilter === t.id;
          return (
            <button key={t.id} onClick={() => setKindFilter(t.id as "obra" | "terreno")}
              className="px-4 py-2.5 transition-colors"
              style={{
                background: active ? "rgba(232,201,122,0.08)" : "transparent",
                color: active ? "#E8C97A" : "#64748B",
                borderBottom: `2px solid ${active ? "#E8C97A" : "transparent"}`,
                borderRadius: "8px 8px 0 0",
                fontSize: 13, fontWeight: 600,
              }}>
              <div className="flex items-center gap-2">
                <span>{t.lbl}</span>
                <span className="text-xs px-1.5 rounded" style={{
                  background: active ? "rgba(232,201,122,0.15)" : "rgba(100,116,139,0.15)",
                  color: active ? "#E8C97A" : "#94A3B8",
                }}>{t.count}</span>
              </div>
              <p className="text-[10px] mt-0.5 font-normal" style={{ color: active ? "#94A3B8" : "#4A5568" }}>{t.hint}</p>
            </button>
          );
        })}
      </div>

      {/* KPIs */}
      <div className={`grid gap-3 ${budgetPct !== null ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <KpiCard label={kindFilter === "terreno" ? "Total em Terreno" : "Total Investido"} value={expKPIs.total} color="gold" />
          <KpiCard label="Parte William"   value={expKPIs.william} color="cyan" />
          <KpiCard label="Parte Sócio"     value={expKPIs.partner} color="green" />
          {budgetPct !== null && (
            <div className="rounded-xl p-3" style={{ background: '#080C10', border: '1px solid rgba(167,139,250,0.25)' }}>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#94A3B8', fontSize: 9, letterSpacing: 2 }}>% Orçamento</p>
              <p className="text-lg font-mono font-bold" style={{ color: '#A78BFA' }}>{budgetPct.toFixed(1)}%</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>de {formatCurrency(totalBudget)}</p>
            </div>
          )}
        </div>
        {kindFilter === "terreno" && terrenoCount === 0 && (
          <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(232,201,122,0.04)', border: '1px solid rgba(232,201,122,0.2)', color: '#94A3B8' }}>
            💡 Aba <span style={{ color: '#E8C97A' }}>Terreno</span> isola pagamentos de aquisição (entrada + cheques + parcelas) das despesas de execução, evitando inflar o "% Orçamento" da obra. Adicione o 1º lançamento clicando em <span style={{ color: '#E8C97A' }}>+ Despesa</span> e marcando <span style={{ color: '#E8C97A' }}>📍 Terreno</span>.
          </div>
        )}

        {/* Tabela */}
        <PremiumCard className="overflow-hidden">
          <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow style={{ borderColor: '#1A2535' }}>
                <TableHead className="px-2"><SortBtn col="expense_date"   label="Data" /></TableHead>
                <TableHead className="px-2"><SortBtn col="stage_order"    label="Descrição" /></TableHead>
                <TableHead className="px-2"><SortBtn col="category"       label="Cat." /></TableHead>
                <TableHead className="px-2"><SortBtn col="total_amount"   label="Total" /></TableHead>
                <TableHead className="px-2"><SortBtn col="william_amount" label="William" /></TableHead>
                <TableHead className="px-2"><SortBtn col="partner_amount" label="Sócio" /></TableHead>
                <TableHead className="px-2"><SortBtn col="payment_type"   label="Tipo" /></TableHead>
                <TableHead className="px-2"><SortBtn col="stage_order"    label="Etapa" style={{ color: sortCol === 'stage_order' ? '#E8C97A' : '#A78BFA' }} /></TableHead>
                <TableHead className="px-2" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedExpenses.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhuma despesa registrada</TableCell></TableRow>
              ) : sortedExpenses.map((e: any) => {
                const stageName = e.stage_id ? (stages.find((s: any) => s.id === e.stage_id)?.name ?? "—") : null;
                return (
                  <TableRow key={e.id} style={{ borderColor: '#1A2535' }}>
                    <TableCell className="whitespace-nowrap px-2" style={{ color: '#CBD5E1' }}>{e.expense_date ? formatDate(e.expense_date) : "—"}</TableCell>
                    <TableCell className="px-2 max-w-[140px] truncate" style={{ color: '#F0F4F8' }}>{e.description}</TableCell>
                    <TableCell className="px-2"><WtBadge variant="cyan">{e.category}</WtBadge></TableCell>
                    <TableCell className="font-mono whitespace-nowrap px-2" style={{ color: '#E8C97A' }}>{formatCurrency(e.total_amount ?? 0)}</TableCell>
                    <TableCell className="font-mono whitespace-nowrap px-2" style={{ color: '#2DD4BF' }}>{formatCurrency(e.william_amount ?? 0)}</TableCell>
                    <TableCell className="font-mono whitespace-nowrap px-2" style={{ color: '#10B981' }}>{formatCurrency(e.partner_amount ?? 0)}</TableCell>
                    <TableCell className="px-2">
                      <WtBadge variant={e.payment_type === "parcelado" ? "gold" : "gray"}>
                        {e.payment_type === "parcelado" ? `${e.installments_paid}/${e.installments_total}x` : "À vista"}
                      </WtBadge>
                    </TableCell>
                    <TableCell className="px-2">
                      {stageName
                        ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)' }}>{stageName}</span>
                        : <span style={{ color: '#4A5568', fontSize: 11 }}>—</span>}
                    </TableCell>
                    <TableCell className="px-2">
                      <div className="flex gap-1">
                        <button onClick={() => openEditExp(e)} className="p-1 rounded" style={{ background: 'rgba(200,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(200,168,76,0.2)' }}>
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDeleteExp(e.id)} className="p-1 rounded" style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.2)' }}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </PremiumCard>

        {/* Editar despesa — Dialog */}
        {editExp && (
          <Dialog open onOpenChange={o => { if (!o) { setEditExp(null); setExpForm({ ...emptyExpForm }); } }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: '#0D1318', border: '1px solid rgba(200,168,76,0.3)' }}>
              <DialogHeader><DialogTitle style={{ color: '#C9A84C' }}>Editar Despesa</DialogTitle></DialogHeader>
              <ExpenseForm expForm={expForm} setExpForm={setExpForm} stages={stages} />
              <DialogFooter className="gap-2 pt-1">
                <button onClick={() => { setEditExp(null); setExpForm({ ...emptyExpForm }); }} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #1A2535', color: '#94A3B8' }}>Cancelar</button>
                <GoldButton onClick={handleUpdate} disabled={updateExpense.isPending}>Salvar</GoldButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Nova despesa — Dialog */}
        {!editExp && addOpen && (
          <Dialog open onOpenChange={o => { if (!o) { setAddOpen(false); setExpForm({ ...emptyExpForm }); } }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
              <DialogHeader><DialogTitle style={{ color: '#C9A84C' }}>Nova Despesa</DialogTitle></DialogHeader>
              <ExpenseForm expForm={expForm} setExpForm={setExpForm} stages={stages} />
              <DialogFooter className="gap-2 pt-1">
                <button onClick={() => { setAddOpen(false); setExpForm({ ...emptyExpForm }); }} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #1A2535', color: '#94A3B8' }}>Cancelar</button>
                <GoldButton onClick={handleCreate} disabled={createExpense.isPending}>Registrar</GoldButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {!editExp && !addOpen && (
          <GoldButton onClick={() => { setExpForm({ ...emptyExpForm, expense_kind: kindFilter }); setAddOpen(true); }}>
            <Plus className="w-4 h-4" />Nova {kindFilter === "terreno" ? "Parcela do Terreno" : "Despesa"}
          </GoldButton>
        )}
    </div>
  );
}

// ─── Import PDF Modal ────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // remove data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isoFromBR(date: string): string | null {
  if (!date) return null;
  const [d, m, y] = date.split("/");
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
}

const IMPORT_CATEGORIES = [
  "Terreno","Terraplenagem","Materiais","Mão de Obra",
  "Instalações","Acabamento","Taxas/Cartório","Amortização","Outros",
];

function ImportPdfModal({ construction, onClose }: { construction: any; onClose: () => void }) {
  const [step, setStep]         = useState<"upload"|"parsing"|"preview"|"importing"|"done">("upload");
  const [activeTab, setActiveTab] = useState<"expenses"|"stages">("expenses");
  const [expenses, setExpenses] = useState<any[]>([]);
  const [stages, setStages]     = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const { toast }               = useToast();
  const createExpense           = useCreateConstructionExpense();
  const createStage             = useCreateStage();

  const wPct = (construction.ownership_pct ?? 100) / 100;

  const handleFile = async (file: File) => {
    const name = file.name.toLowerCase();
    const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");
    const isPdf  = name.endsWith(".pdf");
    if (!isPdf && !isXlsx) {
      toast({ title: "Formato não suportado", description: "Use PDF ou XLSX", variant: "destructive" }); return;
    }
    setFileName(file.name);
    setStep("parsing");
    try {
      let body: Record<string, unknown>;

      // Extrai texto do arquivo (XLSX via SheetJS, PDF via FileReader texto)
      let extractedText = "";
      if (isXlsx) {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const csvParts: string[] = wb.SheetNames.map(sheetName => {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
          return `=== Aba: ${sheetName} ===\n${csv}`;
        });
        extractedText = csvParts.join("\n\n");
      } else {
        // PDF: envia como base64 via image_url (Gemini lê PDF nativamente)
        const fileBase64 = await fileToBase64(file);
        extractedText = `__PDF_BASE64__${fileBase64}`;
      }

      const today = new Date().toISOString().slice(0, 10);
      const prompt = `Você é um extrator de dados de planilhas de custos de construção civil brasileira.

Analise este relatório e retorne APENAS JSON puro, sem markdown, sem explicação.

{
  "expenses": [
    { "date": "DD/MM/YYYY", "description": "descrição", "value": 1234.56, "category": "Terreno|Terraplenagem|Materiais|Mão de Obra|Instalações|Acabamento|Taxas/Cartório|Outros", "is_future": false }
  ],
  "stages": [
    { "name": "nome da etapa", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD ou null", "status": "pendente|em_andamento|concluida", "pct_complete": 0 }
  ]
}

REGRAS EXPENSES: Use a seção "Resumo" se existir (evita duplicatas). is_future=true apenas para datas após ${today}. Categorias: aterro/trator/máquina→Terraplenagem | pedreiro/mão de obra→Mão de Obra | blocos/ferragens/cimento/material→Materiais | poste/elétrica→Instalações | pintura/reboco→Acabamento | terreno→Terreno | IPTU/cartório→Taxas/Cartório.
REGRAS STAGES: Infira fases agrupando despesas por tipo e período. Máximo 6 etapas. Status: concluida se tudo pago, pendente se tudo futuro, em_andamento se misto. Retorne APENAS o JSON.`;

      let messageContent: any[];
      if (extractedText.startsWith("__PDF_BASE64__")) {
        const b64 = extractedText.replace("__PDF_BASE64__", "");
        messageContent = [
          { type: "image_url", image_url: { url: `data:application/pdf;base64,${b64}` } },
          { type: "text", text: prompt },
        ];
      } else {
        messageContent = [{ type: "text", text: `${prompt}\n\nDados da planilha:\n${extractedText}` }];
      }

      const { data, error } = await supabase.functions.invoke("wisely-ai", {
        body: { messages: [{ role: "user", content: messageContent }] },
      });
      if (error) throw new Error(error?.message ?? "Erro na extração");

      // Modo chat retorna { text }, parseamos o JSON da resposta
      const rawText: string = data?.text ?? "";
      let parsed: any = {};
      try {
        parsed = JSON.parse(rawText.trim());
      } catch {
        const m = rawText.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
        else throw new Error("Não foi possível extrair dados do arquivo");
      }

      setExpenses(((parsed.expenses ?? []) as any[]).map((e: any) => ({ ...e, checked: !e.is_future })));
      setStages(((parsed.stages ?? []) as any[]).map((s: any) => ({ ...s, checked: true })));
      setStep("preview");
    } catch (e: any) {
      toast({ title: "Erro ao processar PDF", description: e.message, variant: "destructive" });
      setStep("upload");
    }
  };

  const handleImport = async () => {
    setStep("importing");
    const selExp = expenses.filter(e => e.checked);
    const selStg = stages.filter(s => s.checked);
    try {
      await Promise.all([
        ...selExp.map((e: any) => createExpense.mutateAsync({
          construction_id:    construction.id,
          property_id:        null,
          property_code:      construction.name ?? null,
          description:        e.description,
          category:           e.category,
          total_amount:       e.value,
          william_amount:     e.value * wPct,
          partner_amount:     e.value * (1 - wPct),
          paid_by:            "ambos",
          payment_type:       "avista",
          expense_date:       isoFromBR(e.date),
          stage_id:           null,
          installments_total: null,
          installments_paid:  null,
          next_due_date:      null,
        } as any)),
        ...selStg.map((s: any, idx: number) => createStage.mutateAsync({
          construction_id: construction.id,
          name:            s.name,
          start_date:      s.start_date || null,
          end_date:        s.end_date || null,
          status:          s.status ?? "pendente",
          pct_complete:    s.pct_complete ?? 0,
          budget_estimated:null,
          order_index:     idx,
          notes:           null,
        })),
      ]);
      setStep("done");
    } catch (e: any) {
      toast({ title: "Erro ao importar", description: e.message, variant: "destructive" });
      setStep("preview");
    }
  };

  const selExpCount = expenses.filter(e => e.checked).length;
  const selStgCount = stages.filter(s => s.checked).length;
  const selExpTotal = expenses.filter(e => e.checked).reduce((s, e) => s + (e.value ?? 0), 0);

  const tabStyle = (tab: string) => ({
    padding: "8px 18px", fontSize: 12, fontWeight: 600, borderRadius: "8px 8px 0 0",
    cursor: "pointer", border: "none",
    background: activeTab === tab ? "rgba(232,201,122,0.12)" : "transparent",
    color: activeTab === tab ? "#E8C97A" : "#64748B",
    borderBottom: activeTab === tab ? "2px solid #E8C97A" : "2px solid transparent",
  } as React.CSSProperties);

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#F0F4F8" }}>
            📄 Importar PDF — {construction.name}
          </DialogTitle>
        </DialogHeader>

        {/* ── Upload ── */}
        {step === "upload" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-center" style={{ color: "#94A3B8" }}>
              Selecione o relatório de custos para importar despesas e etapas automaticamente
            </p>
            <div className="flex justify-center">
              <button
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm"
                style={{ background: "rgba(232,201,122,0.1)", color: "#E8C97A", border: "1px solid rgba(232,201,122,0.3)" }}
                onClick={() => document.getElementById("pdf-upload-input")?.click()}
              >
                📂 Selecionar arquivo
                <span className="text-xs font-normal" style={{ color: "#64748B" }}>PDF ou XLSX</span>
              </button>
            </div>
            <input
              id="pdf-upload-input"
              type="file"
              accept=".pdf,.xlsx,.xls"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if(f) handleFile(f); }}
            />
          </div>
        )}

        {/* ── Parsing ── */}
        {step === "parsing" && (
          <div className="text-center py-12">
            <div className="inline-block w-10 h-10 rounded-full border-2 border-t-yellow-400 border-slate-700 animate-spin mb-4" />
            <p style={{ color: "#E8C97A", fontWeight: 600 }}>Lendo PDF com IA…</p>
            <p className="text-sm mt-1" style={{ color: "#64748B" }}>{fileName}</p>
            <p className="text-xs mt-2" style={{ color: "#4A5568" }}>Extraindo despesas e inferindo etapas…</p>
          </div>
        )}

        {/* ── Preview ── */}
        {step === "preview" && (
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg p-3 text-center" style={{ background: "#080C10", border: "1px solid #1A2535" }}>
                <p className="text-xs" style={{ color: "#64748B" }}>Despesas</p>
                <p className="font-bold text-lg" style={{ color: "#E8C97A" }}>{selExpCount}</p>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: "#080C10", border: "1px solid #1A2535" }}>
                <p className="text-xs" style={{ color: "#64748B" }}>Total selecionado</p>
                <p className="font-bold text-lg" style={{ color: "#E8C97A" }}>{formatCurrency(selExpTotal)}</p>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: "#080C10", border: "1px solid #1A2535" }}>
                <p className="text-xs" style={{ color: "#64748B" }}>Etapas detectadas</p>
                <p className="font-bold text-lg" style={{ color: "#2DD4BF" }}>{selStgCount}</p>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ borderBottom: "1px solid #1A2535", display: "flex", gap: 4 }}>
              <button style={tabStyle("expenses")} onClick={() => setActiveTab("expenses")}>
                Despesas ({expenses.length})
              </button>
              <button style={tabStyle("stages")} onClick={() => setActiveTab("stages")}>
                Etapas ({stages.length})
              </button>
            </div>

            {/* Expenses tab */}
            {activeTab === "expenses" && (
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {expenses.map((e, i) => (
                  <div key={i}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer"
                    style={{ background: e.checked ? "rgba(232,201,122,0.05)" : "transparent", border: `1px solid ${e.checked ? "rgba(232,201,122,0.15)" : "#1A2535"}`, opacity: e.checked ? 1 : 0.4 }}
                    onClick={() => setExpenses(prev => prev.map((x,j) => j===i ? {...x, checked: !x.checked} : x))}
                  >
                    <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-xs"
                      style={{ background: e.checked ? "rgba(232,201,122,0.2)" : "#1A2535", border: `1px solid ${e.checked ? "#E8C97A" : "#334155"}`, color: "#E8C97A" }}>
                      {e.checked && "✓"}
                    </div>
                    <span className="text-xs w-20 flex-shrink-0" style={{ color: "#64748B" }}>{e.date}</span>
                    <span className="text-xs flex-1 truncate" style={{ color: "#CBD5E1" }}>{e.description}</span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(100,116,139,0.15)", color: "#94A3B8", fontSize: 10 }}>{e.category}</span>
                    {e.is_future && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(251,191,36,0.1)", color: "#FBBF24", fontSize: 10, border: "1px solid rgba(251,191,36,0.2)" }}>futuro</span>}
                    <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color: "#E8C97A" }}>{formatCurrency(e.value)}</span>
                  </div>
                ))}
                {/* Split info */}
                {wPct < 1 && (
                  <p className="text-xs pt-1" style={{ color: "#64748B" }}>
                    Split automático: William {(wPct*100).toFixed(0)}% · Sócio {((1-wPct)*100).toFixed(0)}%
                  </p>
                )}
              </div>
            )}

            {/* Stages tab */}
            {activeTab === "stages" && (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {stages.length === 0 ? (
                  <p className="text-center py-8 text-sm" style={{ color: "#64748B" }}>Nenhuma etapa detectada</p>
                ) : stages.map((s, i) => (
                  <div key={i}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer"
                    style={{ background: s.checked ? "rgba(45,212,191,0.04)" : "transparent", border: `1px solid ${s.checked ? "rgba(45,212,191,0.2)" : "#1A2535"}`, opacity: s.checked ? 1 : 0.4 }}
                    onClick={() => setStages(prev => prev.map((x,j) => j===i ? {...x, checked: !x.checked} : x))}
                  >
                    <div className="w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center text-xs"
                      style={{ background: s.checked ? "rgba(45,212,191,0.2)" : "#1A2535", border: `1px solid ${s.checked ? "#2DD4BF" : "#334155"}`, color: "#2DD4BF" }}>
                      {s.checked && "✓"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "#F0F4F8" }}>{s.name}</p>
                      <div className="flex gap-3 mt-0.5 flex-wrap">
                        {s.start_date && <span className="text-xs" style={{ color: "#64748B" }}>▶ {s.start_date}</span>}
                        {s.end_date && <span className="text-xs" style={{ color: "#64748B" }}>🏁 {s.end_date}</span>}
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{
                          background: s.status === "concluida" ? "rgba(16,185,129,0.1)" : s.status === "em_andamento" ? "rgba(45,212,191,0.1)" : "rgba(100,116,139,0.1)",
                          color: s.status === "concluida" ? "#10B981" : s.status === "em_andamento" ? "#2DD4BF" : "#64748B",
                          fontSize: 10,
                        }}>
                          {s.status === "concluida" ? "Concluída" : s.status === "em_andamento" ? "Em andamento" : "Pendente"}
                          {s.pct_complete > 0 && ` ${s.pct_complete}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-xs pt-1" style={{ color: "#64748B" }}>As etapas existentes não são removidas — apenas as selecionadas serão adicionadas.</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
              <button onClick={() => setStep("upload")} className="text-sm" style={{ color: "#64748B" }}>← Novo arquivo</button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ border: "1px solid #1A2535", color: "#94A3B8" }}>Cancelar</button>
                <GoldButton onClick={handleImport} disabled={selExpCount === 0 && selStgCount === 0}>
                  ✓ Importar {selExpCount > 0 ? `${selExpCount} despesas` : ""}{selExpCount > 0 && selStgCount > 0 ? " + " : ""}{selStgCount > 0 ? `${selStgCount} etapas` : ""}
                </GoldButton>
              </div>
            </div>
          </div>
        )}

        {/* ── Importing ── */}
        {step === "importing" && (
          <div className="text-center py-12">
            <div className="inline-block w-10 h-10 rounded-full border-2 border-t-yellow-400 border-slate-700 animate-spin mb-4" />
            <p style={{ color: "#E8C97A", fontWeight: 600 }}>Importando…</p>
          </div>
        )}

        {/* ── Done ── */}
        {step === "done" && (
          <div className="text-center py-10 space-y-3">
            <div style={{ fontSize: 48 }}>✅</div>
            <p className="font-bold text-lg" style={{ color: "#F0F4F8" }}>Importação concluída!</p>
            <p className="text-sm" style={{ color: "#64748B" }}>
              {expenses.filter(e => e.checked).length} despesas e {stages.filter(s => s.checked).length} etapas adicionadas a {construction.name}
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <button onClick={() => { setStep("upload"); setExpenses([]); setStages([]); }} className="px-4 py-2 rounded-lg text-sm" style={{ border: "1px solid #1A2535", color: "#94A3B8" }}>Importar outro</button>
              <GoldButton onClick={onClose}>Fechar</GoldButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConstructionsPage() {
  const { data: constructions = [], isLoading } = useConstructions();
  const { data: assets = [] }                   = useAssets();
  const { data: allExpenses = [] }              = useConstructionExpenses(undefined, true);
  const createConstruction = useCreateConstruction();
  const updateConstruction = useUpdateConstruction();
  const deleteConstruction = useDeleteConstruction();
  const { toast } = useToast();

  const [stagesFor, setStagesFor]     = useState<any>(null);
  const [despesasFor, setDespesasFor] = useState<any>(null);
  const [importFor, setImportFor]     = useState<any>(null);
  const [newOpen, setNewOpen]       = useState(false);
  const [editItem, setEditItem]     = useState<any>(null);
  const [delItem, setDelItem]       = useState<any>(null);
  const [form, setForm]             = useState({ ...emptyForm });

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
      total_units_built:      parseInt(form.total_units_built) || 0,
      total_units_rented:     parseInt(form.total_units_rented) || 0,
      estimated_rent_per_unit: parseFloat(form.estimated_rent_per_unit) || 0,
      total_budget:           form.total_budget ? parseFloat(form.total_budget) : null,
      land_total_amount:      form.land_total_amount ? parseFloat(form.land_total_amount) : null,
      estimated_value_ready:  form.estimated_value_ready ? parseFloat(form.estimated_value_ready) : null,
      ownership_pct:          parseFloat(form.ownership_pct) || 100,
      partner_name:           form.partner_name || null,
      partner_pct:            form.partner_pct ? parseFloat(form.partner_pct) : null,
      notes:                  form.notes || null,
      debt_to_partner:        form.debt_to_partner ? parseFloat(form.debt_to_partner) : null,
      debt_partner_name:      form.debt_partner_name || null,
      debt_target_date:       form.debt_target_date || null,
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
      total_units_built:      String(c.total_units_built ?? ""),
      total_units_rented:     String(c.total_units_rented ?? ""),
      estimated_rent_per_unit: String(c.estimated_rent_per_unit ?? ""),
      total_budget:           String(c.total_budget ?? ""),
      land_total_amount:      String(c.land_total_amount ?? ""),
      estimated_value_ready:  String(c.estimated_value_ready ?? ""),
      ownership_pct:          String(c.ownership_pct ?? 100),
      partner_name:           c.partner_name ?? "",
      partner_pct:            String(c.partner_pct ?? ""),
      notes:                  c.notes ?? "",
      debt_to_partner:        String(c.debt_to_partner ?? ""),
      debt_partner_name:      c.debt_partner_name ?? "",
      debt_target_date:       c.debt_target_date ?? "",
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

  // ─── Construction Card ──────────────────────────────────────────────────────
  const renderCard = (c: any) => {
    const s        = STATUS_MAP[c.status ?? ""] ?? { label: c.status, variant: "gray" as const };
    const progress = c.total_units_planned ? ((c.total_units_built ?? 0) / c.total_units_planned) * 100 : 0;
    const rentProj = (c.total_units_planned ?? 0) * (c.estimated_rent_per_unit ?? 0) * ((c.ownership_pct ?? 100) / 100);
    const addr     = assetAddress(c.assets);

    // Split obra × terreno (lançamentos sem expense_kind = legado, conta como obra)
    const expsOfCard = (allExpenses as any[]).filter((e: any) => e.construction_id === c.id);
    const spentObra    = expsOfCard.filter(e => (e.expense_kind ?? "obra") === "obra")
                                   .reduce((s: number, e: any) => s + (e.total_amount ?? 0), 0);
    const spentTerreno = expsOfCard.filter(e => e.expense_kind === "terreno")
                                   .reduce((s: number, e: any) => s + (e.total_amount ?? 0), 0);

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

        {/* Caixa OBRA (execução) */}
        {(c.total_budget ?? 0) > 0 && (() => {
          const budget = c.total_budget as number;
          const spent  = spentObra;
          const pct    = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
          const isOver = spent > budget;
          const remaining = budget - spent;
          const barColor = isOver ? '#F43F5E' : '#A78BFA';
          return (
            <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: '#A78BFA', fontWeight: 600 }}>🏗️ Obra</span>
                <span className="font-mono" style={{ color: '#A78BFA' }}>{formatCurrency(budget)}</span>
              </div>
              {spent > 0 && (
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: '#64748B' }}>Gasto execução</span>
                  <span className="font-mono" style={{ color: isOver ? '#F87171' : '#CBD5E1' }}>{formatCurrency(spent)}</span>
                </div>
              )}
              <div style={{ height: 4, background: '#1A2535', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 99 }} />
              </div>
              <p className="text-right mt-1" style={{ fontSize: 10, color: '#94A3B8' }}>
                {pct.toFixed(1)}% consumido{remaining > 0 ? ` · ${formatCurrency(remaining)} restante` : isOver ? ` · ⚠ ${formatCurrency(spent - budget)} acima` : ''}
              </p>
            </div>
          );
        })()}

        {/* Caixa TERRENO (aquisição) */}
        {((c.land_total_amount ?? 0) > 0 || spentTerreno > 0) && (() => {
          const total = c.land_total_amount as number ?? 0;
          const paid  = spentTerreno;
          const pct   = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
          const remaining = total - paid;
          return (
            <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(232,201,122,0.05)', border: '1px solid rgba(232,201,122,0.2)' }}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: '#E8C97A', fontWeight: 600 }}>📍 Terreno</span>
                {total > 0
                  ? <span className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(total)}</span>
                  : <span className="text-[10px]" style={{ color: '#64748B' }}>(total não cadastrado)</span>}
              </div>
              {paid > 0 && (
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: '#64748B' }}>Pago aquisição</span>
                  <span className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(paid)}</span>
                </div>
              )}
              {total > 0 && (
                <>
                  <div style={{ height: 4, background: '#1A2535', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#E8C97A', borderRadius: 99 }} />
                  </div>
                  <p className="text-right mt-1" style={{ fontSize: 10, color: '#94A3B8' }}>
                    {pct.toFixed(1)}% pago{remaining > 0 ? ` · ${formatCurrency(remaining)} restante` : ' · ✓ quitado'}
                  </p>
                </>
              )}
              {total === 0 && paid > 0 && (
                <p className="text-[10px]" style={{ color: '#64748B' }}>
                  Edite a obra e preencha "Total contratado terreno" pra ver % pago
                </p>
              )}
            </div>
          );
        })()}

        {/* Dívida com sócio */}
        {(c.debt_to_partner ?? 0) > 0 && (() => {
          const debtOrig  = c.debt_to_partner as number;
          const pago      = (allExpenses as any[])
            .filter((e: any) => e.construction_id === c.id && e.category === "Amortização")
            .reduce((s: number, e: any) => s + (e.william_amount ?? 0), 0);
          const saldo     = Math.max(debtOrig - pago, 0);
          const pct       = debtOrig > 0 ? Math.min((pago / debtOrig) * 100, 100) : 0;
          const creditor  = c.debt_partner_name ?? "Sócio";
          const targetStr = c.debt_target_date ? formatDate(c.debt_target_date) : null;
          return (
            <div className="rounded-lg px-3 py-2 space-y-1.5" style={{ background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.2)' }}>
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-semibold" style={{ color: '#F87171' }}>Dívida com {creditor}</span>
                {targetStr && <span className="text-xs" style={{ color: '#64748B' }}>Meta: {targetStr}</span>}
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: '#64748B' }}>Original</span>
                <span className="font-mono" style={{ color: '#F87171' }}>{formatCurrency(debtOrig)}</span>
              </div>
              {pago > 0 && (
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#64748B' }}>Amortizado</span>
                  <span className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(pago)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-bold">
                <span style={{ color: '#94A3B8' }}>Saldo devedor</span>
                <span className="font-mono" style={{ color: saldo === 0 ? '#10B981' : '#E8C97A' }}>{formatCurrency(saldo)}</span>
              </div>
              <div style={{ height: 4, background: '#1A2535', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#10B981', borderRadius: 99 }} />
              </div>
              <p className="text-right" style={{ fontSize: 10, color: '#64748B' }}>{pct.toFixed(1)}% quitado</p>
            </div>
          );
        })()}

        {/* Actions */}
        <div className="flex gap-2 pt-1 flex-wrap">
          <GoldButton
            variant="outline" className="text-xs py-1.5 px-3"
            onClick={() => setDespesasFor(c)}
          >Despesas</GoldButton>
          <GoldButton
            variant="outline" className="text-xs py-1.5 px-3"
            onClick={() => setStagesFor(c)}
          ><Layers className="w-3 h-3" />Etapas</GoldButton>
          {c.partner_name?.toLowerCase().includes("jairo") && (
            <button
              onClick={() => setImportFor(c)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "rgba(45,212,191,0.08)", color: "#2DD4BF", border: "1px solid rgba(45,212,191,0.2)" }}
            >📂 Upload</button>
          )}
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

  // ─── Render ──────────────────────────────────────────────────────────────────

  // Full-page DespesasView
  if (despesasFor) {
    return <DespesasView construction={despesasFor} onClose={() => setDespesasFor(null)} />;
  }

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
        <KpiCard label="Unidades em Desenvolvimento" value={totalUnitsPlanned} color="cyan" formatAs="number" />
        <KpiCard label="Renda Futura Projetada" value={totalRentProjection} color="gold" />
        <KpiCard label="Valor Projetado (Bens Prontos)" value={totalValueReady} color="green" />
      </div>

      <div className="space-y-4 mt-2">
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
      </div>

      {/* ── Modals ── */}
      {newOpen && <ConstructionFormModal title="Nova Obra" form={form} setF={setF} assets={assets as any[]} onSave={handleSaveConstruction} onClose={() => { setNewOpen(false); setForm({ ...emptyForm }); }} isPending={createConstruction.isPending || updateConstruction.isPending} />}
      {editItem && <ConstructionFormModal title="Editar Obra" form={form} setF={setF} assets={assets as any[]} onSave={handleSaveConstruction} onClose={() => { setEditItem(null); setForm({ ...emptyForm }); }} isPending={createConstruction.isPending || updateConstruction.isPending} />}
      {stagesFor && <StagesModal construction={stagesFor} onClose={() => setStagesFor(null)} />}
      {importFor && <ImportPdfModal construction={importFor} onClose={() => setImportFor(null)} />}

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

    </div>
  );
}
