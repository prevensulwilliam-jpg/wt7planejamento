/**
 * LegalPage — Módulo Jurídico/Legal V1.
 *
 * V1: aba "Ações Pendentes" — briefings + checklist + custo + profissional.
 * V2 (futuro): contratos vivos, bens & documentos, modelos de contrato.
 */
import { useState, useMemo } from "react";
import { Scale, Plus, Calendar, AlertTriangle, CheckCircle2, Circle, Trash2, Pencil, FileText, X } from "lucide-react";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useLegalActions,
  useCreateLegalAction,
  useUpdateLegalAction,
  useDeleteLegalAction,
  useToggleChecklistItem,
  AREA_LABEL,
  STATUS_LABEL,
  PRIORITY_LABEL,
  type LegalAction,
  type LegalArea,
  type LegalStatus,
  type LegalPriority,
  type LegalProfessionalType,
  type LegalChecklistItem,
} from "@/hooks/useLegalActions";

const STATUS_FILTERS: Array<{ key: LegalStatus | "todos"; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "pendente", label: "Pendentes" },
  { key: "em_reuniao", label: "Em reunião" },
  { key: "em_execucao", label: "Em execução" },
  { key: "concluido", label: "Concluídos" },
];

function formatBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const target = new Date(d + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function ActionCard({ action, onEdit, onDelete, onToggleStep }: {
  action: LegalAction;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStep: (idx: number) => void;
}) {
  const area = AREA_LABEL[action.area];
  const status = STATUS_LABEL[action.status];
  const priority = PRIORITY_LABEL[action.priority];
  const dl = daysUntil(action.deadline);
  const checklist = action.checklist ?? [];
  const doneCount = checklist.filter((c) => c.done).length;
  const totalCount = checklist.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const isOverdue = dl !== null && dl < 0 && action.status !== "concluido";
  const isClose = dl !== null && dl >= 0 && dl <= 30 && action.status !== "concluido";

  return (
    <PremiumCard className="p-4 space-y-3" glowColor={isOverdue ? "#F43F5E" : isClose ? "#FBBF24" : undefined}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${area.color}`}>
              {area.emoji} {area.label}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${status.color}`}>
              {status.label}
            </span>
            <span className={`text-[10px] font-mono uppercase tracking-wider ${priority.color}`}>
              ● {priority.label}
            </span>
          </div>
          <h3 className="text-sm font-bold truncate" style={{ color: "#F0F4F8" }}>
            {action.title}
          </h3>
          {action.description && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: "#94A3B8" }}>
              {action.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-white/5" title="Editar">
            <Pencil className="w-4 h-4" style={{ color: "#E8C97A" }} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-white/5" title="Excluir">
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      {/* Profissional + deadline + custo */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-[9px] uppercase tracking-wider font-mono" style={{ color: "#4A5568" }}>Profissional</p>
          <p className="font-mono mt-0.5" style={{ color: "#F0F4F8" }}>
            {action.professional_name ?? <span style={{ color: "#64748B" }}>—</span>}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider font-mono" style={{ color: "#4A5568" }}>Prazo</p>
          <p className="font-mono mt-0.5" style={{ color: isOverdue ? "#F43F5E" : isClose ? "#FBBF24" : "#F0F4F8" }}>
            {formatDate(action.deadline)}
            {dl !== null && action.status !== "concluido" && (
              <span className="text-[10px] ml-1">
                ({isOverdue ? `${Math.abs(dl)}d atraso` : `${dl}d`})
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider font-mono" style={{ color: "#4A5568" }}>Custo</p>
          <p className="font-mono mt-0.5 text-[11px]" style={{ color: "#F0F4F8" }}>
            {action.cost_real != null
              ? formatBRL(action.cost_real)
              : action.cost_estimated_min != null
                ? `${formatBRL(action.cost_estimated_min)}–${formatBRL(action.cost_estimated_max)}`
                : "—"}
          </p>
        </div>
      </div>

      {/* Progresso checklist */}
      {totalCount > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#64748B" }}>
              Progresso · {doneCount}/{totalCount}
            </span>
            <span className="text-[10px] font-mono" style={{ color: "#94A3B8" }}>
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "#0B1220" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                background: progress === 100 ? "#10B981" : "linear-gradient(90deg, #3B82F6, #60A5FA)",
              }}
            />
          </div>
          {/* Checklist items */}
          <div className="space-y-1">
            {checklist.map((step, idx) => (
              <button
                key={idx}
                onClick={() => onToggleStep(idx)}
                className="flex items-start gap-2 text-xs w-full text-left hover:bg-white/5 px-1 py-0.5 rounded"
              >
                {step.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-green-400" />
                ) : (
                  <Circle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#4A5568" }} />
                )}
                <span className={step.done ? "line-through" : ""} style={{ color: step.done ? "#64748B" : "#F0F4F8" }}>
                  {step.step}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </PremiumCard>
  );
}

function ActionEditModal({ action, onClose }: { action: LegalAction | "new" | null; onClose: () => void }) {
  const { toast } = useToast();
  const create = useCreateLegalAction();
  const update = useUpdateLegalAction();
  const isOpen = action !== null;
  const isNew = action === "new";

  const [form, setForm] = useState(() => {
    if (action === "new" || action === null) {
      return {
        title: "", description: "", area: "outro" as LegalArea,
        status: "pendente" as LegalStatus, priority: "media" as LegalPriority,
        deadline: "", professional_name: "", professional_type: "" as LegalProfessionalType | "",
        professional_contact: "", briefing_md: "", notes: "",
        cost_estimated_min: "", cost_estimated_max: "", cost_real: "",
        checklist: [] as LegalChecklistItem[],
      };
    }
    return {
      title: action.title,
      description: action.description ?? "",
      area: action.area,
      status: action.status,
      priority: action.priority,
      deadline: action.deadline ?? "",
      professional_name: action.professional_name ?? "",
      professional_type: (action.professional_type ?? "") as LegalProfessionalType | "",
      professional_contact: action.professional_contact ?? "",
      briefing_md: action.briefing_md ?? "",
      notes: action.notes ?? "",
      cost_estimated_min: action.cost_estimated_min?.toString() ?? "",
      cost_estimated_max: action.cost_estimated_max?.toString() ?? "",
      cost_real: action.cost_real?.toString() ?? "",
      checklist: action.checklist ?? [],
    };
  });

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      area: form.area,
      status: form.status,
      priority: form.priority,
      deadline: form.deadline || null,
      professional_name: form.professional_name.trim() || null,
      professional_type: (form.professional_type || null) as LegalProfessionalType | null,
      professional_contact: form.professional_contact.trim() || null,
      briefing_md: form.briefing_md.trim() || null,
      notes: form.notes.trim() || null,
      cost_estimated_min: form.cost_estimated_min ? parseFloat(form.cost_estimated_min) : null,
      cost_estimated_max: form.cost_estimated_max ? parseFloat(form.cost_estimated_max) : null,
      cost_real: form.cost_real ? parseFloat(form.cost_real) : null,
      checklist: form.checklist,
    };
    try {
      if (isNew) {
        await create.mutateAsync(payload);
        toast({ title: "Ação criada" });
      } else if (action && action !== "new") {
        await update.mutateAsync({ id: action.id, patch: payload });
        toast({ title: "Ação atualizada" });
      }
      onClose();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const addStep = () => setForm((f) => ({ ...f, checklist: [...f.checklist, { step: "", done: false }] }));
  const updateStep = (idx: number, step: string) =>
    setForm((f) => ({ ...f, checklist: f.checklist.map((s, i) => i === idx ? { ...s, step } : s) }));
  const removeStep = (idx: number) =>
    setForm((f) => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }));

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#F0F4F8" }}>
            {isNew ? "Nova ação jurídica" : "Editar ação"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Título */}
          <div>
            <label className="text-xs" style={{ color: "#94A3B8" }}>Título</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="ex: T7 Sales formalização"
              style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs" style={{ color: "#94A3B8" }}>Descrição</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
            />
          </div>

          {/* Área + Status + Priority */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs" style={{ color: "#94A3B8" }}>Área</label>
              <Select value={form.area} onValueChange={(v) => setForm((f) => ({ ...f, area: v as LegalArea }))}>
                <SelectTrigger style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                  {Object.entries(AREA_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs" style={{ color: "#94A3B8" }}>Status</label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as LegalStatus }))}>
                <SelectTrigger style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs" style={{ color: "#94A3B8" }}>Prioridade</label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as LegalPriority }))}>
                <SelectTrigger style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deadline + custos */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs" style={{ color: "#94A3B8" }}>Prazo</label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
              />
            </div>
            <div>
              <label className="text-xs" style={{ color: "#94A3B8" }}>Custo estimado (R$)</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  placeholder="min"
                  value={form.cost_estimated_min}
                  onChange={(e) => setForm((f) => ({ ...f, cost_estimated_min: e.target.value }))}
                  style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
                />
                <Input
                  type="number"
                  placeholder="max"
                  value={form.cost_estimated_max}
                  onChange={(e) => setForm((f) => ({ ...f, cost_estimated_max: e.target.value }))}
                  style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs" style={{ color: "#94A3B8" }}>Custo real (R$)</label>
              <Input
                type="number"
                value={form.cost_real}
                onChange={(e) => setForm((f) => ({ ...f, cost_real: e.target.value }))}
                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
              />
            </div>
          </div>

          {/* Profissional */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs" style={{ color: "#94A3B8" }}>Profissional</label>
              <Input
                value={form.professional_name}
                onChange={(e) => setForm((f) => ({ ...f, professional_name: e.target.value }))}
                placeholder="ex: Dr. João"
                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
              />
            </div>
            <div>
              <label className="text-xs" style={{ color: "#94A3B8" }}>Tipo</label>
              <Select value={form.professional_type || "none"} onValueChange={(v) => setForm((f) => ({ ...f, professional_type: (v === "none" ? "" : v) as LegalProfessionalType | "" }))}>
                <SelectTrigger style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="advogado">Advogado</SelectItem>
                  <SelectItem value="contador">Contador</SelectItem>
                  <SelectItem value="despachante">Despachante</SelectItem>
                  <SelectItem value="cartorio">Cartório</SelectItem>
                  <SelectItem value="corretor">Corretor</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs" style={{ color: "#94A3B8" }}>Contato</label>
              <Input
                value={form.professional_contact}
                onChange={(e) => setForm((f) => ({ ...f, professional_contact: e.target.value }))}
                placeholder="email/whatsapp"
                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs" style={{ color: "#94A3B8" }}>Checklist de execução ({form.checklist.length})</label>
              <button onClick={addStep} className="text-xs flex items-center gap-1" style={{ color: "#E8C97A" }}>
                <Plus className="w-3 h-3" /> Adicionar passo
              </button>
            </div>
            <div className="space-y-1.5">
              {form.checklist.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs w-5 text-right" style={{ color: "#64748B" }}>{i + 1}.</span>
                  <Input
                    value={s.step}
                    onChange={(e) => updateStep(i, e.target.value)}
                    placeholder="passo do checklist"
                    style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
                  />
                  <button onClick={() => removeStep(i)} className="p-1 hover:bg-white/5 rounded">
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Briefing markdown */}
          <div>
            <label className="text-xs" style={{ color: "#94A3B8" }}>Briefing (markdown — pode ser caminho do arquivo)</label>
            <Textarea
              value={form.briefing_md}
              onChange={(e) => setForm((f) => ({ ...f, briefing_md: e.target.value }))}
              rows={4}
              placeholder="ex: ver wt7/briefings_juridicos/01_T7_formalizacao_societaria.md"
              style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8", fontSize: 12, fontFamily: "monospace" }}
            />
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs" style={{ color: "#94A3B8" }}>Notas livres</label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="anotações de reunião, observações, decisões"
              style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
            />
          </div>

          {/* Footer */}
          <div className="flex gap-2 justify-end pt-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ border: "1px solid #1A2535", color: "#94A3B8" }}
            >
              Cancelar
            </button>
            <GoldButton onClick={handleSave}>{isNew ? "Criar" : "Salvar"}</GoldButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LegalPage() {
  const [statusFilter, setStatusFilter] = useState<LegalStatus | "todos">("pendente");
  const [editing, setEditing] = useState<LegalAction | "new" | null>(null);

  const { data: actions = [], isLoading } = useLegalActions({ status: statusFilter });
  const deleteAction = useDeleteLegalAction();
  const toggleStep = useToggleChecklistItem();
  const { toast } = useToast();

  const stats = useMemo(() => {
    if (!actions || actions.length === 0) return { total: 0, alta: 0, vencendo30d: 0, vencidas: 0 };
    const today = new Date().toISOString().slice(0, 10);
    const in30d = new Date(); in30d.setDate(in30d.getDate() + 30);
    const in30dStr = in30d.toISOString().slice(0, 10);
    return {
      total: actions.length,
      alta: actions.filter((a) => a.priority === "alta" && !["concluido", "arquivado"].includes(a.status)).length,
      vencendo30d: actions.filter((a) => a.deadline && a.deadline >= today && a.deadline <= in30dStr && !["concluido", "arquivado"].includes(a.status)).length,
      vencidas: actions.filter((a) => a.deadline && a.deadline < today && !["concluido", "arquivado"].includes(a.status)).length,
    };
  }, [actions]);

  const handleDelete = async (action: LegalAction) => {
    if (!confirm(`Excluir "${action.title}"?`)) return;
    try {
      await deleteAction.mutateAsync(action.id);
      toast({ title: "Ação excluída" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleStep = async (action: LegalAction, idx: number) => {
    try {
      await toggleStep.mutateAsync({ actionId: action.id, checklist: action.checklist, idx });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: "#080C10" }}>
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b" style={{ borderColor: "#1A2535" }}>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5" style={{ color: "#F0F4F8" }}>
              <Scale className="w-6 h-6" style={{ color: "#C9A84C" }} />
              Jurídico & Legal
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              Ações pendentes · briefings · checklist · custos · profissionais
            </p>
          </div>
          <GoldButton onClick={() => setEditing("new")} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Nova ação
          </GoldButton>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PremiumCard className="p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#64748B" }}>Total {statusFilter !== "todos" ? "filtrado" : "ativo"}</div>
            <p className="text-2xl font-bold font-mono mt-2" style={{ color: "#F0F4F8" }}>{stats.total}</p>
          </PremiumCard>
          <PremiumCard className="p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#64748B" }}>Alta prioridade</div>
            <p className="text-2xl font-bold font-mono mt-2" style={{ color: stats.alta > 0 ? "#F43F5E" : "#F0F4F8" }}>{stats.alta}</p>
          </PremiumCard>
          <PremiumCard className="p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#64748B" }}>Vencendo 30d</div>
            <p className="text-2xl font-bold font-mono mt-2" style={{ color: stats.vencendo30d > 0 ? "#FBBF24" : "#F0F4F8" }}>{stats.vencendo30d}</p>
          </PremiumCard>
          <PremiumCard className="p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#64748B" }}>Vencidas</div>
            <p className="text-2xl font-bold font-mono mt-2" style={{ color: stats.vencidas > 0 ? "#F43F5E" : "#F0F4F8" }}>{stats.vencidas}</p>
          </PremiumCard>
        </div>

        {/* Filtros */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className="px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider transition-colors"
              style={{
                background: statusFilter === key ? "#141A24" : "transparent",
                border: "1px solid",
                borderColor: statusFilter === key ? "rgba(201,168,76,.4)" : "#1A2535",
                color: statusFilter === key ? "#C9A84C" : "#64748B",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Lista de ações */}
        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : actions.length === 0 ? (
          <PremiumCard className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-2" style={{ color: "#4A5568" }} />
            <p className="text-sm" style={{ color: "#94A3B8" }}>Nenhuma ação nesse filtro.</p>
            <p className="text-xs mt-1" style={{ color: "#64748B" }}>
              Click em <b style={{ color: "#C9A84C" }}>+ Nova ação</b> pra cadastrar.
            </p>
          </PremiumCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {actions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onEdit={() => setEditing(action)}
                onDelete={() => handleDelete(action)}
                onToggleStep={(idx) => handleToggleStep(action, idx)}
              />
            ))}
          </div>
        )}

        {/* Modal de edição/criação */}
        <ActionEditModal action={editing} onClose={() => setEditing(null)} />

        {/* Aviso V2 */}
        <PremiumCard className="p-4 mt-6">
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            <strong style={{ color: "#C9A84C" }}>V2 (próximos sprints):</strong> abas pra <b>Contratos vivos</b> (sociedades + obras + aluguéis), <b>Bens & Documentos</b> (escrituras + IPTU + alvarás + Habite-se + PPCI) e <b>Modelos de contrato</b> (templates aluguel kitnet, prestação serviço, etc).
          </p>
        </PremiumCard>
      </div>
    </div>
  );
}
