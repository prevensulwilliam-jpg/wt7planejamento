import { useState, useMemo } from "react";
import { Briefcase, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Target } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, getCurrentMonth } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import {
  useBusinesses,
  useCreateBusiness,
  useUpdateBusiness,
  useDeleteBusiness,
  useBusinessRevenueEntries,
  useUpsertRevenueEntry,
  useDeleteRevenueEntry,
  type Business,
} from "@/hooks/useBusinesses";

const inputStyle = { background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" };

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  recorrente:   { label: "Recorrente",   color: "#10B981" },
  crescimento:  { label: "Crescimento",  color: "#3B82F6" },
  incubado:     { label: "Incubado",     color: "#A78BFA" },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ativo:     { label: "Ativo",     color: "#10B981" },
  incubado:  { label: "Incubado",  color: "#A78BFA" },
  encerrado: { label: "Encerrado", color: "#64748B" },
};

// ─── Form ────────────────────────────────────────────────────────────────────
type FormData = {
  code: string;
  name: string;
  description: string;
  partner_name: string;
  ownership_pct: number;
  status: string;
  category: string;
  monthly_target: number;
  target_12m: number;
  icon: string;
  color: string;
  notes: string;
};

const emptyForm = (): FormData => ({
  code: "",
  name: "",
  description: "",
  partner_name: "",
  ownership_pct: 100,
  status: "ativo",
  category: "crescimento",
  monthly_target: 0,
  target_12m: 0,
  icon: "💼",
  color: "#C9A84C",
  notes: "",
});

function BusinessForm({ form, setForm, onSave, onCancel, isPending }: {
  form: FormData;
  setForm: (f: FormData) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label style={{ color: "#94A3B8" }}>Código</Label>
          <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} style={inputStyle} placeholder="ex: CW7" />
        </div>
        <div className="col-span-2">
          <Label style={{ color: "#94A3B8" }}>Nome</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="ex: CW7 Energia Solar" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label style={{ color: "#94A3B8" }}>Ícone (emoji)</Label>
          <Input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <Label style={{ color: "#94A3B8" }}>Cor</Label>
          <Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={inputStyle} placeholder="#C9A84C" />
        </div>
        <div>
          <Label style={{ color: "#94A3B8" }}>Participação (%)</Label>
          <Input type="number" value={form.ownership_pct || ""} onChange={e => setForm({ ...form, ownership_pct: parseFloat(e.target.value) || 0 })} style={inputStyle} />
        </div>
      </div>

      <div>
        <Label style={{ color: "#94A3B8" }}>Sócio (se houver)</Label>
        <Input value={form.partner_name} onChange={e => setForm({ ...form, partner_name: e.target.value })} style={inputStyle} placeholder="ex: Diego Tavares" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label style={{ color: "#94A3B8" }}>Status</Label>
          <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
            <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
            <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
              {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label style={{ color: "#94A3B8" }}>Categoria</Label>
          <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
            <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
            <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
              {Object.entries(CATEGORY_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label style={{ color: "#C9A84C" }}>Meta mensal (R$)</Label>
          <Input type="number" value={form.monthly_target || ""} onChange={e => setForm({ ...form, monthly_target: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, borderColor: "rgba(201,168,76,0.4)" }} />
        </div>
        <div>
          <Label style={{ color: "#C9A84C" }}>Meta 12 meses (R$)</Label>
          <Input type="number" value={form.target_12m || ""} onChange={e => setForm({ ...form, target_12m: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, borderColor: "rgba(201,168,76,0.4)" }} />
        </div>
      </div>

      <div>
        <Label style={{ color: "#94A3B8" }}>Notas estratégicas</Label>
        <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={inputStyle} rows={2} placeholder="Foco, observações, próximos passos..." />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ border: "1px solid #1A2535", color: "#94A3B8" }}>Cancelar</button>
        <GoldButton onClick={onSave} disabled={isPending}>Salvar</GoldButton>
      </div>
    </div>
  );
}

// ─── Revenue Entry Modal ─────────────────────────────────────────────────────
function RevenueModal({ business, month, onClose }: { business: Business; month: string; onClose: () => void }) {
  const { data: entries = [] } = useBusinessRevenueEntries(business.id);
  const upsert = useUpsertRevenueEntry();
  const del = useDeleteRevenueEntry();
  const { toast } = useToast();

  const [ref, setRef] = useState(month);
  const [amountWilliam, setAmountWilliam] = useState(0);
  const [amountTotal, setAmountTotal] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const existing = entries.find(e => e.reference_month === ref);

  // Ao mudar o mês, pré-preenche com o valor existente
  const loadExisting = (m: string) => {
    setRef(m);
    const e = entries.find(x => x.reference_month === m);
    setAmountWilliam(e?.amount_william ?? 0);
    setAmountTotal(e?.amount_total ?? "");
    setNotes(e?.notes ?? "");
  };

  const save = async () => {
    try {
      await upsert.mutateAsync({
        business_id: business.id,
        reference_month: ref,
        amount_william: amountWilliam,
        amount_total: amountTotal === "" ? null : Number(amountTotal),
        notes: notes || null,
      });
      toast({ title: "Receita registrada" });
      setAmountWilliam(0); setAmountTotal(""); setNotes("");
    } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const remove = async (id: string) => {
    try {
      await del.mutateAsync(id);
      toast({ title: "Registro excluído" });
    } catch { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#F0F4F8" }}>
            <span className="mr-2">{business.icon}</span>
            Receitas — {business.name}
          </DialogTitle>
        </DialogHeader>

        <PremiumCard className="p-3">
          <p className="text-sm font-medium mb-3" style={{ color: "#C9A84C" }}>Lançar / editar receita</p>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label style={{ color: "#94A3B8" }}>Mês</Label>
                <MonthPicker value={ref} onChange={loadExisting} />
              </div>
              <div>
                <Label style={{ color: "#10B981" }}>Sua parte (R$)</Label>
                <Input type="number" value={amountWilliam || ""} onChange={e => setAmountWilliam(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, borderColor: "rgba(16,185,129,0.4)" }} />
              </div>
              <div>
                <Label style={{ color: "#94A3B8" }}>Total negócio (opc)</Label>
                <Input type="number" value={amountTotal} onChange={e => setAmountTotal(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} style={inputStyle} placeholder="antes do split" />
              </div>
            </div>
            <div>
              <Label style={{ color: "#94A3B8" }}>Notas</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
            </div>
            <div className="flex justify-end">
              <GoldButton onClick={save} disabled={upsert.isPending}>
                {existing ? "Atualizar" : "Adicionar"}
              </GoldButton>
            </div>
          </div>
        </PremiumCard>

        <div className="space-y-2">
          <p className="text-xs" style={{ color: "#94A3B8" }}>Histórico ({entries.length})</p>
          {entries.length === 0 ? (
            <p className="text-center py-4 text-sm" style={{ color: "#64748B" }}>Nenhum registro ainda</p>
          ) : (
            entries.map(e => {
              const pct = business.monthly_target > 0 ? (e.amount_william / business.monthly_target) * 100 : 0;
              const color = pct >= 100 ? "#10B981" : pct >= 70 ? "#C9A84C" : "#F43F5E";
              return (
                <PremiumCard key={e.id} className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: "#F0F4F8" }}>{e.reference_month}</span>
                        <WtBadge variant="gold">{formatCurrency(e.amount_william)}</WtBadge>
                        {business.monthly_target > 0 && (
                          <span className="text-xs font-mono" style={{ color }}>{pct.toFixed(0)}% meta</span>
                        )}
                      </div>
                      {e.amount_total != null && (
                        <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                          Total do negócio: {formatCurrency(e.amount_total)}
                        </p>
                      )}
                      {e.notes && <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{e.notes}</p>}
                    </div>
                    <button onClick={() => remove(e.id)} className="p-1.5 rounded-lg" style={{ background: "rgba(244,63,94,0.1)", color: "#F43F5E", border: "1px solid rgba(244,63,94,0.2)" }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </PremiumCard>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function BusinessesPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Business | null>(null);
  const [deleting, setDeleting] = useState<Business | null>(null);
  const [revenueTarget, setRevenueTarget] = useState<Business | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());

  const { data: businesses = [], isLoading } = useBusinesses();
  const { data: allEntries = [] } = useBusinessRevenueEntries();
  const createBiz = useCreateBusiness();
  const updateBiz = useUpdateBusiness();
  const deleteBiz = useDeleteBusiness();
  const { toast } = useToast();

  // Lookup de receita do mês selecionado por negócio
  const revenueByBiz = useMemo(() => {
    const map = new Map<string, number>();
    allEntries.forEach(e => {
      if (e.reference_month === month) {
        map.set(e.business_id, (map.get(e.business_id) ?? 0) + Number(e.amount_william));
      }
    });
    return map;
  }, [allEntries, month]);

  // Agregados globais
  const totals = useMemo(() => {
    let targetMonth = 0, realized = 0, target12m = 0;
    businesses.forEach(b => {
      if (b.status !== "encerrado") {
        targetMonth += Number(b.monthly_target);
        target12m  += Number(b.target_12m);
        realized   += revenueByBiz.get(b.id) ?? 0;
      }
    });
    return { targetMonth, realized, target12m, pct: targetMonth > 0 ? (realized / targetMonth) * 100 : 0 };
  }, [businesses, revenueByBiz]);

  const grouped = useMemo(() => {
    const g: Record<string, Business[]> = { recorrente: [], crescimento: [], incubado: [] };
    businesses.forEach(b => { (g[b.category] ??= []).push(b); });
    return g;
  }, [businesses]);

  const openAdd = () => { setForm(emptyForm()); setAddOpen(true); };
  const openEdit = (b: Business) => {
    setForm({
      code: b.code, name: b.name,
      description: b.description ?? "",
      partner_name: b.partner_name ?? "",
      ownership_pct: b.ownership_pct,
      status: b.status, category: b.category,
      monthly_target: b.monthly_target, target_12m: b.target_12m,
      icon: b.icon ?? "💼", color: b.color ?? "#C9A84C",
      notes: b.notes ?? "",
    });
    setEditing(b);
  };

  const handleAdd = async () => {
    if (!form.code || !form.name) { toast({ title: "Código e nome obrigatórios", variant: "destructive" }); return; }
    try {
      await createBiz.mutateAsync({ ...form, order_index: businesses.length });
      toast({ title: "Negócio cadastrado" });
      setAddOpen(false); setForm(emptyForm());
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const handleEdit = async () => {
    if (!editing) return;
    try {
      await updateBiz.mutateAsync({ id: editing.id, ...form });
      toast({ title: "Negócio atualizado" });
      setEditing(null); setForm(emptyForm());
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteBiz.mutateAsync(deleting.id);
      toast({ title: "Negócio excluído" });
      setDeleting(null);
    } catch { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const renderCard = (b: Business) => {
    const realized = revenueByBiz.get(b.id) ?? 0;
    const target = b.monthly_target;
    const pct = target > 0 ? Math.min((realized / target) * 100, 200) : 0;
    const pctDisplay = target > 0 ? (realized / target) * 100 : 0;
    const delta = realized - target;
    const color = target === 0 ? "#64748B"
                : pctDisplay >= 100 ? "#10B981"
                : pctDisplay >= 70  ? "#C9A84C"
                : "#F43F5E";

    return (
      <PremiumCard key={b.id} className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">{b.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate" style={{ color: "#F0F4F8" }}>{b.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: STATUS_MAP[b.status]?.color + "20", color: STATUS_MAP[b.status]?.color, border: `1px solid ${STATUS_MAP[b.status]?.color}40` }}>
                  {STATUS_MAP[b.status]?.label}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                {b.code} · {b.ownership_pct}%{b.partner_name ? ` · sócio: ${b.partner_name}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setRevenueTarget(b)} className="p-1.5 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }} title="Receitas">
              <TrendingUp className="w-3 h-3" />
            </button>
            <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg" style={{ background: "rgba(200,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(200,168,76,0.2)" }}>
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => setDeleting(b)} className="p-1.5 rounded-lg" style={{ background: "rgba(244,63,94,0.1)", color: "#F43F5E", border: "1px solid rgba(244,63,94,0.2)" }}>
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {target > 0 ? (
          <>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span style={{ color: "#94A3B8" }}>Meta {month}</span>
              <span className="font-mono" style={{ color }}>
                {formatCurrency(realized)} / {formatCurrency(target)}
              </span>
            </div>
            <Progress value={pct} className="h-2" />
            <div className="flex justify-between text-xs mt-1.5">
              <span style={{ color: pctDisplay >= 100 ? "#10B981" : "#94A3B8" }}>
                {pctDisplay.toFixed(0)}% da meta
              </span>
              <span style={{ color: delta >= 0 ? "#10B981" : "#F43F5E", fontFamily: "monospace" }}>
                {delta >= 0 ? "+" : ""}{formatCurrency(delta)}
              </span>
            </div>
          </>
        ) : (
          <div className="py-2 text-center text-xs" style={{ color: "#64748B" }}>
            Sem meta mensal · {b.status === "incubado" ? "incubado" : "definir alvo"}
          </div>
        )}

        {b.target_12m > 0 && (
          <div className="mt-2 pt-2 text-xs flex justify-between" style={{ color: "#64748B", borderTop: "1px solid #1A2535" }}>
            <span><Target className="inline w-3 h-3 mr-1" />Meta 12m</span>
            <span className="font-mono" style={{ color: "#C9A84C" }}>{formatCurrency(b.target_12m)}</span>
          </div>
        )}

        {b.notes && (
          <p className="text-xs mt-2 pt-2" style={{ color: "#94A3B8", borderTop: "1px solid #1A2535" }}>
            {b.notes}
          </p>
        )}
      </PremiumCard>
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: "#080C10" }}>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#F0F4F8" }}>
              <Briefcase className="inline w-6 h-6 mr-2" style={{ color: "#C9A84C" }} />
              Negócios
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#94A3B8" }}>
              Mapa estratégico das frentes de renda · meta vs realizado
            </p>
          </div>
          <div className="flex items-center gap-2">
            <MonthPicker value={month} onChange={setMonth} className="w-44" />
            <GoldButton onClick={openAdd}><Plus className="w-4 h-4" />Novo negócio</GoldButton>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Meta do mês" value={totals.targetMonth} color="gold" />
          <KpiCard label="Realizado no mês" value={totals.realized} color={totals.realized >= totals.targetMonth ? "green" : "red"} />
          <KpiCard label={totals.realized >= totals.targetMonth ? "Excedente" : "Gap"} value={Math.abs(totals.targetMonth - totals.realized)} color={totals.realized >= totals.targetMonth ? "green" : "red"} />
          <KpiCard label="Meta 12 meses (anual)" value={totals.target12m} color="gold" />
        </div>

        {/* Progresso consolidado */}
        <PremiumCard className="p-4">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm" style={{ color: "#94A3B8" }}>Progresso consolidado do mês</span>
            <span className="font-mono text-sm" style={{ color: "#C9A84C" }}>{totals.pct.toFixed(0)}%</span>
          </div>
          <Progress value={Math.min(totals.pct, 200)} className="h-3" />
        </PremiumCard>

        {/* Grupos */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : businesses.length === 0 ? (
          <PremiumCard className="p-8 text-center">
            <p style={{ color: "#94A3B8" }}>Nenhum negócio cadastrado. Clique em "Novo negócio" para começar.</p>
          </PremiumCard>
        ) : (
          (["recorrente", "crescimento", "incubado"] as const).map(cat => {
            const list = grouped[cat] ?? [];
            if (list.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: CATEGORY_MAP[cat].color }}>
                  <span>{CATEGORY_MAP[cat].label}</span>
                  <span className="text-xs font-normal" style={{ color: "#64748B" }}>({list.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {list.map(renderCard)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add modal */}
      {addOpen && (
        <Dialog open onOpenChange={o => !o && setAddOpen(false)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
            <DialogHeader>
              <DialogTitle style={{ color: "#F0F4F8" }}>Novo negócio</DialogTitle>
            </DialogHeader>
            <BusinessForm form={form} setForm={setForm} onSave={handleAdd} onCancel={() => setAddOpen(false)} isPending={createBiz.isPending} />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit modal */}
      {editing && (
        <Dialog open onOpenChange={o => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
            <DialogHeader>
              <DialogTitle style={{ color: "#F0F4F8" }}>Editar {editing.name}</DialogTitle>
            </DialogHeader>
            <BusinessForm form={form} setForm={setForm} onSave={handleEdit} onCancel={() => setEditing(null)} isPending={updateBiz.isPending} />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirm */}
      {deleting && (
        <Dialog open onOpenChange={o => !o && setDeleting(null)}>
          <DialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
            <DialogHeader>
              <DialogTitle style={{ color: "#F0F4F8" }}>Excluir "{deleting.name}"?</DialogTitle>
            </DialogHeader>
            <p className="text-sm" style={{ color: "#94A3B8" }}>Também excluirá todas as receitas registradas.</p>
            <DialogFooter className="gap-2">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 rounded-lg text-sm" style={{ border: "1px solid #1A2535", color: "#94A3B8" }}>Cancelar</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", color: "#F43F5E" }}>Excluir</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Revenue modal */}
      {revenueTarget && (
        <RevenueModal business={revenueTarget} month={month} onClose={() => setRevenueTarget(null)} />
      )}
    </div>
  );
}
