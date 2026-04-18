import { useState, useMemo } from "react";
import { Briefcase, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Target, Search, Link2 } from "lucide-react";
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
  useBusinessRealized,
  useBusinessBreakdown,
  useUnlinkedRevenuesForMonth,
  useLinkRevenueToBusiness,
  useMonthRevenueReconciliation,
  type Business,
} from "@/hooks/useBusinesses";
import { useReconcileMonth, useKitnetOrphans } from "@/hooks/useReconcileMonth";
import { suggestBusiness as suggestBusinessShared } from "@/lib/suggestBusiness";
import { AlertTriangle } from "lucide-react";
import { toast as sonnerToast } from "sonner";

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

// Wrapper do suggestBusiness compartilhado com tipagem Business
const suggestBusiness = (r: { description: string | null; source: string | null }, businesses: Business[]): Business | null =>
  suggestBusinessShared(r, businesses);

// ─── Reconciliation Dialog — mostra todas as receitas sem vínculo ────────────
function ReconciliationDialog({ month, businesses, onClose }: { month: string; businesses: Business[]; onClose: () => void }) {
  const { data: unlinked = [], isLoading } = useUnlinkedRevenuesForMonth(month);
  const linkRev = useLinkRevenueToBusiness();
  const { toast } = useToast();
  const [bulkPending, setBulkPending] = useState(false);

  const link = async (revenueId: string, businessId: string) => {
    try {
      await linkRev.mutateAsync({ revenueId, businessId });
      toast({ title: "Vinculado" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const total = unlinked.reduce((s, r) => s + Number(r.amount), 0);
  const activeBizs = businesses.filter(b => b.status !== "encerrado");

  // Aplica sugestão a todas de uma vez
  const applyAllSuggestions = async () => {
    setBulkPending(true);
    try {
      for (const r of unlinked) {
        const sug = suggestBusiness(r, businesses);
        if (sug) await linkRev.mutateAsync({ revenueId: r.id, businessId: sug.id });
      }
      toast({ title: "Sugestões aplicadas em lote" });
    } catch { toast({ title: "Erro no lote", variant: "destructive" }); }
    finally { setBulkPending(false); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#F0F4F8" }}>
            <AlertTriangle className="inline w-4 h-4 mr-2" style={{ color: "#F59E0B" }} />
            Reconciliar receitas sem vínculo — {month}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between border-b pb-2 gap-3" style={{ borderColor: "#1A2535" }}>
          <span className="text-sm" style={{ color: "#94A3B8" }}>{unlinked.length} receita{unlinked.length !== 1 ? "s" : ""} sem negócio · <span className="font-mono" style={{ color: "#F59E0B" }}>{formatCurrency(total)}</span></span>
          {unlinked.length > 0 && (
            <button onClick={applyAllSuggestions} disabled={bulkPending} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.5)" }}>
              {bulkPending ? "Aplicando..." : "✨ Aplicar sugestões em lote"}
            </button>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : unlinked.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: "#10B981" }}>
            ✓ Todas as receitas do mês estão vinculadas a algum negócio.
          </p>
        ) : (
          <div className="space-y-2">
            {unlinked.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg" style={{ background: "#080C10", border: "1px solid #1A2535" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#F0F4F8" }}>
                    {r.description ?? r.source ?? "(sem descrição)"}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#64748B" }}>
                    {r.received_at ?? "—"} · fonte: {r.source ?? "—"}
                  </p>
                </div>
                <span className="font-mono text-sm shrink-0" style={{ color: "#C9A84C" }}>{formatCurrency(Number(r.amount))}</span>
                <Select value="" onValueChange={(bid) => link(r.id, bid)}>
                  <SelectTrigger className="w-48 shrink-0" style={inputStyle}><SelectValue placeholder="Vincular a..." /></SelectTrigger>
                  <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                    {activeBizs.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Breakdown Modal — detalha quais receitas compõem o valor ───────────────
function BreakdownModal({ business, month, onClose }: { business: Business; month: string; onClose: () => void }) {
  const { data: rows = [], isLoading } = useBusinessBreakdown(business.id, business.code, month);
  const { data: unlinked = [] } = useUnlinkedRevenuesForMonth(month);
  const linkRev = useLinkRevenueToBusiness();
  const { toast } = useToast();
  const [showUnlinked, setShowUnlinked] = useState(false);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  const link = async (revenueId: string) => {
    try {
      await linkRev.mutateAsync({ revenueId, businessId: business.id });
      toast({ title: "Receita vinculada" });
    } catch { toast({ title: "Erro ao vincular", variant: "destructive" }); }
  };

  const unlink = async (revenueId: string) => {
    try {
      await linkRev.mutateAsync({ revenueId, businessId: null });
      toast({ title: "Receita desvinculada" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#F0F4F8" }}>
            <Search className="inline w-4 h-4 mr-2" style={{ color: "#C9A84C" }} />
            Detalhes — {business.icon} {business.name} · {month}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-baseline justify-between border-b pb-2" style={{ borderColor: "#1A2535" }}>
          <span className="text-sm" style={{ color: "#94A3B8" }}>Total computado</span>
          <span className="text-lg font-bold font-mono" style={{ color: "#C9A84C" }}>{formatCurrency(total)}</span>
        </div>

        {isLoading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : rows.length === 0 ? (
          <p className="text-center py-6 text-sm" style={{ color: "#64748B" }}>Nenhuma entrada registrada para este mês.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: "#080C10", border: "1px solid #1A2535" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium truncate" style={{ color: "#F0F4F8" }}>{r.description}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{
                      background: r.kind === "kitnet" ? "rgba(16,185,129,0.15)" : r.kind === "manual" ? "rgba(167,139,250,0.15)" : "rgba(59,130,246,0.15)",
                      color: r.kind === "kitnet" ? "#10B981" : r.kind === "manual" ? "#A78BFA" : "#3B82F6",
                    }}>
                      {r.kind === "kitnet" ? "kitnet_entries" : r.kind === "manual" ? "override" : "revenues"}
                    </span>
                  </div>
                  {(r.date || r.source) && (
                    <p className="text-[10px] mt-0.5" style={{ color: "#64748B" }}>
                      {r.date ? r.date : ""} {r.source ? ` · fonte: ${r.source}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm" style={{ color: "#10B981" }}>{formatCurrency(r.amount)}</span>
                  {r.kind === "revenue" && (
                    <button onClick={() => unlink(r.id)} title="Desvincular deste negócio" className="p-1 rounded" style={{ background: "rgba(244,63,94,0.1)", color: "#F43F5E", border: "1px solid rgba(244,63,94,0.2)" }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Receitas sem vínculo */}
        <div className="pt-3 border-t" style={{ borderColor: "#1A2535" }}>
          <button onClick={() => setShowUnlinked(s => !s)} className="flex items-center gap-2 text-xs" style={{ color: "#C9A84C" }}>
            <Link2 className="w-3 h-3" />
            Receitas sem vínculo neste mês ({unlinked.length}) {showUnlinked ? "▲" : "▼"}
          </button>

          {showUnlinked && (
            <div className="space-y-1.5 mt-2">
              {unlinked.length === 0 ? (
                <p className="text-xs" style={{ color: "#64748B" }}>Todas as receitas do mês já estão vinculadas a algum negócio.</p>
              ) : (
                unlinked.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: "#080C10", border: "1px dashed #1A2535" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: "#F0F4F8" }}>
                        {r.description ?? r.source ?? "(sem descrição)"}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#64748B" }}>
                        {r.received_at ?? "—"} · fonte: {r.source ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-xs" style={{ color: "#94A3B8" }}>{formatCurrency(r.amount)}</span>
                      <button onClick={() => link(r.id)} title={`Vincular a ${business.name}`} className="px-2 py-1 rounded text-[10px] font-medium" style={{ background: "rgba(200,168,76,0.15)", color: "#C9A84C", border: "1px solid rgba(200,168,76,0.4)" }}>
                        + vincular
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
  const [breakdownTarget, setBreakdownTarget] = useState<Business | null>(null);
  const [reconOpen, setReconOpen] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm());

  const { data: businesses = [], isLoading } = useBusinesses();
  const { data: realizedMap = new Map() } = useBusinessRealized(month);
  const { data: recon } = useMonthRevenueReconciliation(month);
  const { data: kitnetOrphans } = useKitnetOrphans(month);
  const createBiz = useCreateBusiness();
  const updateBiz = useUpdateBusiness();
  const deleteBiz = useDeleteBusiness();
  const reconcileMonth = useReconcileMonth();
  const { toast } = useToast();

  // Roda pipeline completo de reconciliação (mesmo hook que o /reconciliation usa)
  const handleReconcileMonth = async () => {
    try {
      sonnerToast.loading("🔄 Reconciliando valores do mês...", { id: "recon-biz" });
      const r = await reconcileMonth.mutateAsync(month);
      const bits: string[] = [];
      if (r.kitnetMatches > 0) bits.push(`🏘️ ${r.kitnetMatches} kitnets`);
      if (r.revenuesCreated > 0) bits.push(`💰 ${r.revenuesCreated} receitas`);
      if (r.businessLinked > 0) bits.push(`🎯 ${r.businessLinked} vinculadas`);
      const warn = r.kitnetOrphans > 0
        ? ` · ⚠️ ${r.kitnetOrphans} depósito(s) kitnet aguardando fechamento`
        : "";
      sonnerToast.success(
        (bits.length ? bits.join(" · ") : "✅ Tudo em dia") + warn,
        { id: "recon-biz", duration: 7000 }
      );
    } catch (err: any) {
      sonnerToast.error(`Erro: ${err?.message ?? "desconhecido"}`, { id: "recon-biz" });
    }
  };

  // Lookup de receita do mês: valor + fonte (auto/manual/kitnet)
  const revenueByBiz = useMemo(() => {
    const map = new Map<string, number>();
    realizedMap.forEach((v: any, k: string) => map.set(k, v.amount));
    return map;
  }, [realizedMap]);

  const sourceByBiz = useMemo(() => {
    const map = new Map<string, string>();
    realizedMap.forEach((v: any, k: string) => map.set(k, v.source));
    return map;
  }, [realizedMap]);

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

  // Sub-componente: top 3 itens que compõem o realizado (pra cards sem meta)
  const BusinessTopItems = ({ business, month, onSeeAll }: { business: Business; month: string; onSeeAll: () => void }) => {
    const { data: rows = [] } = useBusinessBreakdown(business.id, business.code, month);
    const sorted = [...rows].sort((a: any, b: any) => Number(b.amount ?? 0) - Number(a.amount ?? 0));
    if (sorted.length === 0) return null;
    const top = sorted.slice(0, 3);
    const extra = sorted.length - top.length;
    return (
      <div className="mt-2 pt-2" style={{ borderTop: "1px solid #1A2535" }}>
        <div className="text-[10px] uppercase tracking-wider font-mono mb-1.5" style={{ color: "#4A5568" }}>
          Composição {sorted.length > 3 ? `(top 3 de ${sorted.length})` : `(${sorted.length})`}
        </div>
        <div className="space-y-0.5">
          {top.map((r: any) => (
            <div key={r.id} className="flex justify-between items-center text-xs py-0.5">
              <span className="flex-1 truncate" style={{ color: "#94A3B8" }}>{r.description}</span>
              <span className="font-mono font-medium ml-2" style={{ color: "#10B981" }}>{formatCurrency(r.amount)}</span>
            </div>
          ))}
        </div>
        {extra > 0 && (
          <button
            onClick={onSeeAll}
            className="w-full text-[10px] mt-1.5 py-1 rounded text-center transition-colors hover:opacity-80"
            style={{ color: "#3B82F6", background: "rgba(59,130,246,0.05)" }}
          >
            + {extra} {extra === 1 ? "outra" : "outras"} → ver todas
          </button>
        )}
      </div>
    );
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
            <button onClick={() => setBreakdownTarget(b)} className="p-1.5 rounded-lg" style={{ background: "rgba(59,130,246,0.1)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.2)" }} title="Ver detalhes / de onde vieram os valores">
              <Search className="w-3 h-3" />
            </button>
            <button onClick={() => setRevenueTarget(b)} className="p-1.5 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }} title="Ajuste manual (override)">
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
              <span style={{ color: "#94A3B8" }}>
                Meta {month}
                {sourceByBiz.get(b.id) === "manual" && (
                  <span className="ml-1 text-[9px] px-1 rounded" style={{ background: "rgba(167,139,250,0.15)", color: "#A78BFA" }}>manual</span>
                )}
                {sourceByBiz.get(b.id) === "kitnet" && (
                  <span className="ml-1 text-[9px] px-1 rounded" style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}>auto: kitnets</span>
                )}
                {sourceByBiz.get(b.id) === "auto" && (
                  <span className="ml-1 text-[9px] px-1 rounded" style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6" }}>auto: receitas</span>
                )}
              </span>
              <span className="font-mono" style={{ color }}>
                {formatCurrency(realized)} / {formatCurrency(target)}
              </span>
            </div>
            <div style={{ position: "relative", height: 8, background: "#1A2535", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(pctDisplay, 100)}%`,
                background: pctDisplay >= 100 ? "linear-gradient(90deg, #10B981, #34D399)" : "linear-gradient(90deg, #C9A84C, #E8C97A)",
                transition: "width 0.3s",
                borderRadius: 99,
              }} />
            </div>
            <div className="flex justify-between text-xs mt-1.5">
              <span style={{ color: pctDisplay >= 100 ? "#10B981" : "#94A3B8" }}>
                {pctDisplay >= 100 ? "✓ meta batida " : ""}
                {pctDisplay.toFixed(0)}% da meta
              </span>
              <span style={{ color: delta >= 0 ? "#10B981" : "#F43F5E", fontFamily: "monospace" }}>
                {delta >= 0 ? "+" : ""}{formatCurrency(delta)}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span style={{ color: "#94A3B8" }}>
                Realizado {month}
                <span className="ml-1 text-[9px] px-1 rounded" style={{ background: "rgba(148,163,184,0.15)", color: "#94A3B8" }}>sem meta</span>
              </span>
              <span className="font-mono font-semibold" style={{ color: realized > 0 ? "#10B981" : "#64748B" }}>
                {formatCurrency(realized)}
              </span>
            </div>
            <div style={{ position: "relative", height: 8, background: "#1A2535", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: realized > 0 ? "100%" : "0%",
                background: "linear-gradient(90deg, #64748B, #94A3B8)",
                transition: "width 0.3s",
                borderRadius: 99,
                opacity: 0.5,
              }} />
            </div>
            <div className="flex justify-between text-xs mt-1.5">
              <span style={{ color: "#64748B" }}>
                {b.status === "incubado" ? "🌱 incubado" : "eventual · sem alvo definido"}
              </span>
              <button
                onClick={() => openEdit(b)}
                className="text-[10px] underline decoration-dotted"
                style={{ color: "#64748B" }}
                title="Definir meta mensal"
              >
                definir alvo
              </button>
            </div>
            {realized > 0 && (
              <BusinessTopItems business={b} month={month} onSeeAll={() => setBreakdownTarget(b)} />
            )}
          </>
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

        {/* Banner de reconciliação — receitas sem vínculo (Gap 1) */}
        {recon && recon.unlinkedCount > 0 && (
          <PremiumCard className="p-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.4)" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: "#F59E0B" }} />
                <span className="text-sm" style={{ color: "#F0F4F8" }}>
                  <strong style={{ color: "#F59E0B" }}>{recon.unlinkedCount}</strong> receita{recon.unlinkedCount !== 1 ? "s" : ""} sem negócio vinculado —{" "}
                  <strong className="font-mono" style={{ color: "#F59E0B" }}>{formatCurrency(recon.unlinked)}</strong> não está somando em nenhum card.
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReconcileMonth}
                  disabled={reconcileMonth.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  style={{ background: "rgba(201,168,76,0.2)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.5)" }}
                >
                  🔄 Reconciliar automático
                </button>
                <button onClick={() => setReconOpen(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "rgba(245,158,11,0.2)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.5)" }}>
                  Vincular manual →
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
              <div><span style={{ color: "#64748B" }}>Total do mês</span> <span className="font-mono" style={{ color: "#F0F4F8" }}>{formatCurrency(recon.total)}</span></div>
              <div><span style={{ color: "#64748B" }}>Já vinculado</span> <span className="font-mono" style={{ color: "#10B981" }}>{formatCurrency(recon.linked)}</span></div>
              <div><span style={{ color: "#64748B" }}>Gap</span> <span className="font-mono" style={{ color: "#F59E0B" }}>{formatCurrency(recon.unlinked)}</span></div>
            </div>
          </PremiumCard>
        )}

        {/* Banner de Kitnets sem fechamento — Gap 2 silencioso */}
        {kitnetOrphans && kitnetOrphans.count > 0 && (
          <PremiumCard className="p-3" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.4)" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: "#60A5FA" }} />
                <span className="text-sm" style={{ color: "#F0F4F8" }}>
                  <strong style={{ color: "#60A5FA" }}>{kitnetOrphans.count}</strong> depósito{kitnetOrphans.count !== 1 ? "s" : ""} de kitnet aguardando fechamento do ADM —{" "}
                  <strong className="font-mono" style={{ color: "#60A5FA" }}>{formatCurrency(kitnetOrphans.total)}</strong> não entra no Realizado até o fechamento.
                </span>
              </div>
              <a href={`/kitnets?tab=entries&month=${month}`} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "rgba(59,130,246,0.2)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.5)" }}>
                Ir para fechamentos →
              </a>
            </div>
          </PremiumCard>
        )}

        {/* Progresso consolidado */}
        <PremiumCard className="p-4">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm" style={{ color: "#94A3B8" }}>Progresso consolidado do mês</span>
            <span className="font-mono text-sm font-semibold" style={{ color: totals.pct >= 100 ? "#10B981" : "#C9A84C" }}>
              {totals.pct.toFixed(0)}%
            </span>
          </div>
          <div style={{ position: "relative", height: 12, background: "#1A2535", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${Math.min(totals.pct, 100)}%`,
              background: totals.pct >= 100
                ? "linear-gradient(90deg, #10B981, #34D399)"
                : "linear-gradient(90deg, #C9A84C, #E8C97A)",
              transition: "width 0.4s ease",
              borderRadius: 99,
              boxShadow: totals.pct >= 100 ? "0 0 12px rgba(16,185,129,0.4)" : "0 0 8px rgba(201,168,76,0.3)",
            }} />
            {totals.pct > 100 && (
              <div style={{
                position: "absolute",
                top: 0, left: 0,
                height: "100%",
                width: `${Math.min(totals.pct - 100, 100)}%`,
                background: "linear-gradient(90deg, rgba(16,185,129,0.4), rgba(52,211,153,0.6))",
                borderRadius: 99,
                mixBlendMode: "screen",
              }} />
            )}
          </div>
          {totals.pct > 100 && (
            <div className="text-xs mt-1.5 font-mono" style={{ color: "#10B981" }}>
              ✓ meta batida · excedente de +{(totals.pct - 100).toFixed(0)}%
            </div>
          )}
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

      {/* Reconciliation dialog */}
      {reconOpen && (
        <ReconciliationDialog month={month} businesses={businesses} onClose={() => setReconOpen(false)} />
      )}

      {/* Breakdown modal */}
      {breakdownTarget && (
        <BreakdownModal business={breakdownTarget} month={month} onClose={() => setBreakdownTarget(null)} />
      )}

      {/* Revenue manual override modal */}
      {revenueTarget && (
        <RevenueModal business={revenueTarget} month={month} onClose={() => setRevenueTarget(null)} />
      )}
    </div>
  );
}
