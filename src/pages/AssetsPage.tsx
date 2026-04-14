import { useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/wt7/DatePicker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssets } from "@/hooks/useFinances";
import {
  useInvestments, useCreateInvestment, useConsortiums, useCreateConsortium, useCreateAsset,
  useUpdateAsset, useDeleteAsset, useUpdateInvestment, useDeleteInvestment,
  useUpdateConsortium, useDeleteConsortium,
} from "@/hooks/useConstructions";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Landmark, Plus, TrendingUp, Pencil, Trash2, GripVertical } from "lucide-react";

// ─── Drag helpers ───────────────────────────────────────────────────────────

function useLocalOrder<T extends { id: string }>(key: string, items: T[]): [T[], (newOrder: T[]) => void] {
  const load = (): string[] | null => {
    try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
  };
  const savedOrder = load();
  const sorted: T[] = savedOrder
    ? [...items].sort((a, b) => {
        const ai = savedOrder.indexOf(a.id);
        const bi = savedOrder.indexOf(b.id);
        return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
      })
    : items;
  const save = (newOrder: T[]) => {
    localStorage.setItem(key, JSON.stringify(newOrder.map(x => x.id)));
  };
  return [sorted, save];
}

function DraggableGrid<T extends { id: string }>({
  storageKey,
  items,
  renderCard,
  columns = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
}: {
  storageKey: string;
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  columns?: string;
}) {
  const [orderedItems, saveOrder] = useLocalOrder(storageKey, items);
  const [order, setOrder] = useState<T[]>(orderedItems);
  const draggingId = useRef<string | null>(null);
  const dragOverId = useRef<string | null>(null);

  // Sync when items change (new item added / deleted)
  const synced = order.filter(o => items.find(i => i.id === o.id));
  const missing = items.filter(i => !order.find(o => o.id === i.id));
  const display = [...synced, ...missing];

  const onDragStart = useCallback((id: string) => { draggingId.current = id; }, []);
  const onDragEnter = useCallback((id: string) => { dragOverId.current = id; }, []);
  const onDragEnd = useCallback(() => {
    if (!draggingId.current || !dragOverId.current || draggingId.current === dragOverId.current) {
      draggingId.current = null; dragOverId.current = null; return;
    }
    const from = display.findIndex(i => i.id === draggingId.current);
    const to   = display.findIndex(i => i.id === dragOverId.current);
    const next = [...display];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    saveOrder(next);
    draggingId.current = null; dragOverId.current = null;
  }, [display, saveOrder]);

  return (
    <div className={`grid ${columns} gap-4`}>
      {display.map(item => (
        <div
          key={item.id}
          draggable
          onDragStart={() => onDragStart(item.id)}
          onDragEnter={() => onDragEnter(item.id)}
          onDragEnd={onDragEnd}
          onDragOver={e => e.preventDefault()}
          className="cursor-grab active:cursor-grabbing"
          style={{ transition: 'opacity 0.15s' }}
        >
          {renderCard(item)}
        </div>
      ))}
    </div>
  );
}

// ─── Confirm delete dialog ───────────────────────────────────────────────────
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

const inputStyle = { background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' };
const ASSET_TYPES = ["imovel","terreno","veiculo","aplicacao","consorcio","outros"];
const INV_TYPES   = ["CDB","LCI","LCA","Tesouro Direto","FII","Ações","Poupança","Outros"];

// ─── Main ────────────────────────────────────────────────────────────────────
export default function AssetsPage() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") ?? "bens";
  const { data: assets, isLoading: assetsLoading } = useAssets();
  const { data: investments, isLoading: invLoading } = useInvestments();
  const { data: consortiums, isLoading: consLoading } = useConsortiums();
  const { toast } = useToast();

  const createAsset      = useCreateAsset();
  const updateAsset      = useUpdateAsset();
  const deleteAsset      = useDeleteAsset();
  const createInvestment = useCreateInvestment();
  const updateInvestment = useUpdateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const createConsortium = useCreateConsortium();
  const updateConsortium = useUpdateConsortium();
  const deleteConsortium = useDeleteConsortium();

  // ─── Bens state ───────────────────────────────────────────────────────────
  const emptyAsset = { name: "", type: "imovel", estimated_value: "", acquisition_date: "", notes: "" };
  const [assetOpen, setAssetOpen]   = useState(false);
  const [editAsset, setEditAsset]   = useState<any | null>(null);
  const [delAsset,  setDelAsset]    = useState<any | null>(null);
  const [assetForm, setAssetForm]   = useState(emptyAsset);

  // ─── Investimentos state ──────────────────────────────────────────────────
  const emptyInv = { name: "", bank: "", type: "CDB", initial_amount: "", current_amount: "", rate_percent: "", maturity_date: "" };
  const [invOpen, setInvOpen]     = useState(false);
  const [editInv, setEditInv]     = useState<any | null>(null);
  const [delInv,  setDelInv]      = useState<any | null>(null);
  const [invForm, setInvForm]     = useState(emptyInv);

  // ─── Consórcios state ─────────────────────────────────────────────────────
  const emptyCons = { name: "", total_value: "", monthly_payment: "", installments_total: "", installments_paid: "", status: "ativo" };
  const [consOpen, setConsOpen]   = useState(false);
  const [editCons, setEditCons]   = useState<any | null>(null);
  const [delCons,  setDelCons]    = useState<any | null>(null);
  const [consForm, setConsForm]   = useState(emptyCons);

  // ─── KPIs ─────────────────────────────────────────────────────────────────
  const totalPatrimonio  = (assets ?? []).reduce((s, a) => s + (a.estimated_value ?? 0), 0);
  const totalInvestido   = (investments ?? []).reduce((s, i) => s + ((i as any).initial_amount ?? 0), 0);
  const totalAtualInv    = (investments ?? []).reduce((s, i) => s + ((i as any).current_amount ?? 0), 0);
  const rendimento       = totalAtualInv - totalInvestido;

  // ─── Bens handlers ────────────────────────────────────────────────────────
  const handleCreateAsset = async () => {
    if (!assetForm.name) return;
    try {
      await createAsset.mutateAsync({ name: assetForm.name, type: assetForm.type, estimated_value: parseFloat(assetForm.estimated_value) || null, acquisition_date: assetForm.acquisition_date || null, notes: assetForm.notes || null });
      toast({ title: "Bem registrado!" }); setAssetOpen(false); setAssetForm(emptyAsset);
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };
  const handleUpdateAsset = async () => {
    if (!editAsset) return;
    try {
      await updateAsset.mutateAsync({ id: editAsset.id, name: assetForm.name, type: assetForm.type, estimated_value: parseFloat(assetForm.estimated_value) || null, acquisition_date: assetForm.acquisition_date || null, notes: assetForm.notes || null });
      toast({ title: "Bem atualizado!" }); setEditAsset(null);
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };
  const handleDeleteAsset = async () => {
    if (!delAsset) return;
    try { await deleteAsset.mutateAsync(delAsset.id); toast({ title: "Bem excluído" }); setDelAsset(null); }
    catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  // ─── Investimentos handlers ───────────────────────────────────────────────
  const handleCreateInv = async () => {
    if (!invForm.name) return;
    try {
      await createInvestment.mutateAsync({ name: invForm.name, bank: invForm.bank, type: invForm.type, initial_amount: parseFloat(invForm.initial_amount) || null, current_amount: parseFloat(invForm.current_amount) || null, rate_percent: parseFloat(invForm.rate_percent) || null, maturity_date: invForm.maturity_date || null });
      toast({ title: "Investimento registrado!" }); setInvOpen(false); setInvForm(emptyInv);
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };
  const handleUpdateInv = async () => {
    if (!editInv) return;
    try {
      await updateInvestment.mutateAsync({ id: editInv.id, name: invForm.name, bank: invForm.bank, type: invForm.type, initial_amount: parseFloat(invForm.initial_amount) || null, current_amount: parseFloat(invForm.current_amount) || null, rate_percent: parseFloat(invForm.rate_percent) || null, maturity_date: invForm.maturity_date || null });
      toast({ title: "Investimento atualizado!" }); setEditInv(null);
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };
  const handleDeleteInv = async () => {
    if (!delInv) return;
    try { await deleteInvestment.mutateAsync(delInv.id); toast({ title: "Investimento excluído" }); setDelInv(null); }
    catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  // ─── Consórcios handlers ──────────────────────────────────────────────────
  const handleCreateCons = async () => {
    if (!consForm.name) return;
    try {
      await createConsortium.mutateAsync({ name: consForm.name, total_value: parseFloat(consForm.total_value) || null, monthly_payment: parseFloat(consForm.monthly_payment) || null, installments_total: parseInt(consForm.installments_total) || null, installments_paid: parseInt(consForm.installments_paid) || 0, status: consForm.status });
      toast({ title: "Consórcio registrado!" }); setConsOpen(false); setConsForm(emptyCons);
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };
  const handleUpdateCons = async () => {
    if (!editCons) return;
    try {
      await updateConsortium.mutateAsync({ id: editCons.id, name: consForm.name, total_value: parseFloat(consForm.total_value) || null, monthly_payment: parseFloat(consForm.monthly_payment) || null, installments_total: parseInt(consForm.installments_total) || null, installments_paid: parseInt(consForm.installments_paid) || 0, status: consForm.status });
      toast({ title: "Consórcio atualizado!" }); setEditCons(null);
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };
  const handleDeleteCons = async () => {
    if (!delCons) return;
    try { await deleteConsortium.mutateAsync(delCons.id); toast({ title: "Consórcio excluído" }); setDelCons(null); }
    catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  // ─── Card action buttons ──────────────────────────────────────────────────
  function CardActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
    return (
      <div className="flex items-center gap-1 ml-auto">
        <button onClick={e => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: '#E8C97A' }} title="Editar">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
          style={{ color: '#F43F5E' }} title="Excluir">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <GripVertical className="w-4 h-4 ml-1" style={{ color: '#4A5568' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
        <Landmark className="inline w-6 h-6 mr-2" style={{ color: '#C9A84C' }} />
        Patrimônio
      </h1>

      <KpiCard label="Patrimônio Líquido Total" value={totalPatrimonio + totalAtualInv} color="gold" />

      <Tabs defaultValue={defaultTab}>
        <TabsList style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <TabsTrigger value="bens">Bens</TabsTrigger>
          <TabsTrigger value="investimentos">Investimentos</TabsTrigger>
          <TabsTrigger value="consorcios">Consórcios</TabsTrigger>
        </TabsList>

        {/* ─── BENS ─── */}
        <TabsContent value="bens" className="space-y-4">
          <div className="flex justify-end"><GoldButton onClick={() => { setAssetForm(emptyAsset); setAssetOpen(true); }}><Plus className="w-4 h-4" />Novo Bem</GoldButton></div>
          {assetsLoading ? <Skeleton className="h-32 rounded-2xl" /> : (assets ?? []).length === 0 ? (
            <PremiumCard><p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum bem cadastrado</p></PremiumCard>
          ) : (
            <DraggableGrid
              storageKey="wt7_assets_order"
              items={assets ?? []}
              columns="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              renderCard={a => (
                <PremiumCard className="space-y-2 h-full">
                  <div className="flex items-start gap-2">
                    <p className="font-display font-bold flex-1" style={{ color: '#F0F4F8' }}>{a.name}</p>
                    <CardActions
                      onEdit={() => { setAssetForm({ name: a.name ?? "", type: a.type ?? "imovel", estimated_value: String(a.estimated_value ?? ""), acquisition_date: a.acquisition_date ?? "", notes: a.notes ?? "" }); setEditAsset(a); }}
                      onDelete={() => setDelAsset(a)}
                    />
                  </div>
                  <WtBadge variant="gold">{a.type}</WtBadge>
                  <p className="font-mono text-xl" style={{ color: '#E8C97A' }}>{formatCurrency(a.estimated_value ?? 0)}</p>
                  {a.acquisition_date && <p className="text-xs" style={{ color: '#94A3B8' }}>Adquirido: {formatDate(a.acquisition_date)}</p>}
                  {a.notes && <p className="text-xs" style={{ color: '#4A5568' }}>{a.notes}</p>}
                </PremiumCard>
              )}
            />
          )}
        </TabsContent>

        {/* ─── INVESTIMENTOS ─── */}
        <TabsContent value="investimentos" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard label="Total Investido" value={totalInvestido} color="gold" />
            <KpiCard label="Valor Atual" value={totalAtualInv} color="cyan" />
            <KpiCard label="Rendimento" value={rendimento} color="green" />
          </div>
          <div className="flex justify-end"><GoldButton onClick={() => { setInvForm(emptyInv); setInvOpen(true); }}><Plus className="w-4 h-4" />Nova Aplicação</GoldButton></div>
          {invLoading ? <Skeleton className="h-32 rounded-2xl" /> : (investments ?? []).length === 0 ? (
            <PremiumCard><p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum investimento</p></PremiumCard>
          ) : (
            <DraggableGrid
              storageKey="wt7_investments_order"
              items={(investments ?? []) as any[]}
              columns="grid-cols-1 md:grid-cols-2"
              renderCard={(inv: any) => (
                <PremiumCard className="space-y-2 h-full">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold" style={{ color: '#F0F4F8' }}>{inv.name}</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>{inv.bank} · {inv.type}</p>
                    </div>
                    <WtBadge variant="cyan">{inv.rate_percent ? `${inv.rate_percent}% a.a.` : "—"}</WtBadge>
                    <CardActions
                      onEdit={() => { setInvForm({ name: inv.name ?? "", bank: inv.bank ?? "", type: inv.type ?? "CDB", initial_amount: String(inv.initial_amount ?? ""), current_amount: String(inv.current_amount ?? ""), rate_percent: String(inv.rate_percent ?? ""), maturity_date: inv.maturity_date ?? "" }); setEditInv(inv); }}
                      onDelete={() => setDelInv(inv)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-xs" style={{ color: '#94A3B8' }}>Aplicado</p><p className="font-mono" style={{ color: '#F0F4F8' }}>{formatCurrency(inv.initial_amount ?? 0)}</p></div>
                    <div><p className="text-xs" style={{ color: '#94A3B8' }}>Atual</p><p className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(inv.current_amount ?? 0)}</p></div>
                  </div>
                  <p className="text-xs font-mono" style={{ color: (inv.current_amount ?? 0) >= (inv.initial_amount ?? 0) ? '#10B981' : '#F43F5E' }}>
                    <TrendingUp className="inline w-3 h-3 mr-1" />
                    Rendimento: {formatCurrency((inv.current_amount ?? 0) - (inv.initial_amount ?? 0))}
                  </p>
                  {inv.maturity_date && <p className="text-xs" style={{ color: '#94A3B8' }}>Vencimento: {formatDate(inv.maturity_date)}</p>}
                </PremiumCard>
              )}
            />
          )}
        </TabsContent>

        {/* ─── CONSÓRCIOS ─── */}
        <TabsContent value="consorcios" className="space-y-4">
          <div className="flex justify-end"><GoldButton onClick={() => { setConsForm(emptyCons); setConsOpen(true); }}><Plus className="w-4 h-4" />Novo Consórcio</GoldButton></div>
          {consLoading ? <Skeleton className="h-32 rounded-2xl" /> : (consortiums ?? []).length === 0 ? (
            <PremiumCard><p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum consórcio</p></PremiumCard>
          ) : (
            <DraggableGrid
              storageKey="wt7_consortiums_order"
              items={(consortiums ?? []) as any[]}
              columns="grid-cols-1 md:grid-cols-2"
              renderCard={(c: any) => {
                const pct  = c.installments_total ? ((c.installments_paid ?? 0) / c.installments_total) * 100 : 0;
                const pago = (c.installments_paid ?? 0) * (c.monthly_payment ?? 0);
                return (
                  <PremiumCard className="space-y-2 h-full">
                    <div className="flex items-start gap-2">
                      <p className="font-display font-bold flex-1" style={{ color: '#F0F4F8' }}>{c.name}</p>
                      <WtBadge variant={c.status === "contemplado" ? "green" : c.status === "ativo" ? "gold" : "gray"}>{c.status}</WtBadge>
                      <CardActions
                        onEdit={() => { setConsForm({ name: c.name ?? "", total_value: String(c.total_value ?? ""), monthly_payment: String(c.monthly_payment ?? ""), installments_total: String(c.installments_total ?? ""), installments_paid: String(c.installments_paid ?? ""), status: c.status ?? "ativo" }); setEditCons(c); }}
                        onDelete={() => setDelCons(c)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><p className="text-xs" style={{ color: '#94A3B8' }}>Total</p><p className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(c.total_value ?? 0)}</p></div>
                      <div><p className="text-xs" style={{ color: '#94A3B8' }}>Parcela</p><p className="font-mono" style={{ color: '#F0F4F8' }}>{formatCurrency(c.monthly_payment ?? 0)}</p></div>
                      <div><p className="text-xs" style={{ color: '#94A3B8' }}>Pago</p><p className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(pago)}</p></div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs" style={{ color: '#94A3B8' }}><span>{c.installments_paid ?? 0}/{c.installments_total ?? 0} parcelas</span><span>{pct.toFixed(0)}%</span></div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  </PremiumCard>
                );
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* ─── DIALOGS CRIAR/EDITAR BENS ─── */}
      {(assetOpen || !!editAsset) && (
        <Dialog open onOpenChange={o => { if (!o) { setAssetOpen(false); setEditAsset(null); } }}>
          <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
            <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>{editAsset ? "Editar Bem" : "Novo Bem"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label style={{ color: '#94A3B8' }}>Nome</Label><Input value={assetForm.name} onChange={e => setAssetForm({ ...assetForm, name: e.target.value })} style={inputStyle} /></div>
              <div><Label style={{ color: '#94A3B8' }}>Tipo</Label>
                <Select value={assetForm.type} onValueChange={v => setAssetForm({ ...assetForm, type: v })}>
                  <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                    {ASSET_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label style={{ color: '#94A3B8' }}>Valor Estimado</Label><Input type="number" value={assetForm.estimated_value} onChange={e => setAssetForm({ ...assetForm, estimated_value: e.target.value })} style={inputStyle} /></div>
              <div><Label style={{ color: '#94A3B8' }}>Data Aquisição</Label><DatePicker value={assetForm.acquisition_date} onChange={v => setAssetForm({ ...assetForm, acquisition_date: v })} /></div>
              <div><Label style={{ color: '#94A3B8' }}>Observações</Label><Input value={assetForm.notes} onChange={e => setAssetForm({ ...assetForm, notes: e.target.value })} style={inputStyle} /></div>
            </div>
            <DialogFooter>
              <GoldButton onClick={editAsset ? handleUpdateAsset : handleCreateAsset}>
                {editAsset ? "Salvar" : "Registrar"}
              </GoldButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── DIALOGS CRIAR/EDITAR INVESTIMENTOS ─── */}
      {(invOpen || !!editInv) && (
        <Dialog open onOpenChange={o => { if (!o) { setInvOpen(false); setEditInv(null); } }}>
          <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
            <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>{editInv ? "Editar Aplicação" : "Nova Aplicação"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label style={{ color: '#94A3B8' }}>Nome</Label><Input value={invForm.name} onChange={e => setInvForm({ ...invForm, name: e.target.value })} style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label style={{ color: '#94A3B8' }}>Banco</Label><Input value={invForm.bank} onChange={e => setInvForm({ ...invForm, bank: e.target.value })} style={inputStyle} /></div>
                <div><Label style={{ color: '#94A3B8' }}>Tipo</Label>
                  <Select value={invForm.type} onValueChange={v => setInvForm({ ...invForm, type: v })}>
                    <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                    <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                      {INV_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label style={{ color: '#94A3B8' }}>Valor Aplicado</Label><Input type="number" value={invForm.initial_amount} onChange={e => setInvForm({ ...invForm, initial_amount: e.target.value })} style={inputStyle} /></div>
                <div><Label style={{ color: '#94A3B8' }}>Valor Atual</Label><Input type="number" value={invForm.current_amount} onChange={e => setInvForm({ ...invForm, current_amount: e.target.value })} style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label style={{ color: '#94A3B8' }}>Taxa % a.a.</Label><Input type="number" value={invForm.rate_percent} onChange={e => setInvForm({ ...invForm, rate_percent: e.target.value })} style={inputStyle} /></div>
                <div><Label style={{ color: '#94A3B8' }}>Vencimento</Label><DatePicker value={invForm.maturity_date} onChange={v => setInvForm({ ...invForm, maturity_date: v })} /></div>
              </div>
            </div>
            <DialogFooter>
              <GoldButton onClick={editInv ? handleUpdateInv : handleCreateInv}>
                {editInv ? "Salvar" : "Registrar"}
              </GoldButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── DIALOGS CRIAR/EDITAR CONSÓRCIOS ─── */}
      {(consOpen || !!editCons) && (
        <Dialog open onOpenChange={o => { if (!o) { setConsOpen(false); setEditCons(null); } }}>
          <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
            <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>{editCons ? "Editar Consórcio" : "Novo Consórcio"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label style={{ color: '#94A3B8' }}>Nome</Label><Input value={consForm.name} onChange={e => setConsForm({ ...consForm, name: e.target.value })} style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label style={{ color: '#94A3B8' }}>Valor Total</Label><Input type="number" value={consForm.total_value} onChange={e => setConsForm({ ...consForm, total_value: e.target.value })} style={inputStyle} /></div>
                <div><Label style={{ color: '#94A3B8' }}>Parcela Mensal</Label><Input type="number" value={consForm.monthly_payment} onChange={e => setConsForm({ ...consForm, monthly_payment: e.target.value })} style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label style={{ color: '#94A3B8' }}>Total Parcelas</Label><Input type="number" value={consForm.installments_total} onChange={e => setConsForm({ ...consForm, installments_total: e.target.value })} style={inputStyle} /></div>
                <div><Label style={{ color: '#94A3B8' }}>Pagas</Label><Input type="number" value={consForm.installments_paid} onChange={e => setConsForm({ ...consForm, installments_paid: e.target.value })} style={inputStyle} /></div>
              </div>
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
            <DialogFooter>
              <GoldButton onClick={editCons ? handleUpdateCons : handleCreateCons}>
                {editCons ? "Salvar" : "Registrar"}
              </GoldButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── CONFIRM DELETE ─── */}
      {delAsset  && <ConfirmDelete name={delAsset.name  ?? ""} onConfirm={handleDeleteAsset} onCancel={() => setDelAsset(null)}  />}
      {delInv    && <ConfirmDelete name={delInv.name    ?? ""} onConfirm={handleDeleteInv}   onCancel={() => setDelInv(null)}    />}
      {delCons   && <ConfirmDelete name={delCons.name   ?? ""} onConfirm={handleDeleteCons}  onCancel={() => setDelCons(null)}   />}
    </div>
  );
}
