import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoals, useUpdateGoal, useDashboardKPIs } from "@/hooks/useFinances";
import { useCreateGoal } from "@/hooks/useConstructions";
import { formatCurrency, getCurrentMonth } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Target, Plus, Pencil } from "lucide-react";

const goalIcons: Record<string, string> = { renda: '💰', imoveis: '🏘️', reserva: '💾', saude: '📉' };

export default function GoalsPage() {
  const { data: goals, isLoading } = useGoals();
  const updateGoal = useUpdateGoal();
  const createGoal = useCreateGoal();
  const kpis = useDashboardKPIs(getCurrentMonth());
  const { toast } = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [form, setForm] = useState({ name: "", type: "renda", target_value: "", current_value: "", deadline: "", notes: "" });

  const handleCreate = async () => {
    if (!form.name || !form.target_value) return;
    try {
      await createGoal.mutateAsync({ name: form.name, type: form.type, target_value: parseFloat(form.target_value), current_value: parseFloat(form.current_value) || 0, deadline: form.deadline || null, notes: form.notes || null });
      toast({ title: "Meta criada!" });
      setNewOpen(false);
      setForm({ name: "", type: "renda", target_value: "", current_value: "", deadline: "", notes: "" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateGoal.mutateAsync({ id, current_value: parseFloat(editValue) || 0 });
      toast({ title: "Meta atualizada!" });
      setEditId(null);
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const gap100k = 100000 - kpis.totalRevenue;
  const pct100k = Math.min((kpis.totalRevenue / 100000) * 100, 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
          <Target className="inline w-6 h-6 mr-2" style={{ color: '#C9A84C' }} />
          Metas
        </h1>
        <GoldButton onClick={() => setNewOpen(true)}><Plus className="w-4 h-4" />Nova Meta</GoldButton>
      </div>

      {/* Special R$100k card */}
      <PremiumCard glowColor="#C9A84C" className="space-y-4">
        <h3 className="font-display font-bold text-lg" style={{ color: '#E8C97A' }}>🎯 Meta R$ 100k/mês</h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-3xl font-bold" style={{ color: '#E8C97A' }}>{formatCurrency(kpis.totalRevenue)}</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>de {formatCurrency(100000)}</p>
          </div>
          <p className="font-mono text-lg" style={{ color: gap100k > 0 ? '#F43F5E' : '#10B981' }}>
            {gap100k > 0 ? `Faltam ${formatCurrency(gap100k)}` : "Meta atingida! 🎉"}
          </p>
        </div>
        <Progress value={pct100k} className="h-3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {Object.entries(kpis.revenueBySource).map(([src, val]) => (
            <div key={src} className="p-2 rounded-lg" style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid #1A2535' }}>
              <p className="text-xs capitalize" style={{ color: '#94A3B8' }}>{src.replace(/_/g, ' ')}</p>
              <p className="font-mono text-sm" style={{ color: '#E8C97A' }}>{formatCurrency(val)}</p>
            </div>
          ))}
        </div>
      </PremiumCard>

      {/* Goal cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : (goals ?? []).length === 0 ? (
        <PremiumCard><p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhuma meta cadastrada</p></PremiumCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(goals ?? []).map(g => {
            const pct = g.target_value ? Math.min(((g.current_value ?? 0) / g.target_value) * 100, 100) : 0;
            const icon = goalIcons[g.type ?? ""] ?? "🎯";
            return (
              <PremiumCard key={g.id} className="space-y-3">
                <div className="flex items-start justify-between">
                  <p className="font-display font-bold" style={{ color: '#F0F4F8' }}>{icon} {g.name}</p>
                  <button onClick={() => { setEditId(g.id); setEditValue(String(g.current_value ?? 0)); }} className="p-1 rounded hover:bg-white/5"><Pencil className="w-3.5 h-3.5" style={{ color: '#94A3B8' }} /></button>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-mono" style={{ color: '#E8C97A' }}>{g.type === 'saude' ? `${g.current_value}%` : formatCurrency(g.current_value ?? 0)}</span>
                  <span className="font-mono" style={{ color: '#94A3B8' }}>/ {g.type === 'saude' ? `${g.target_value}%` : formatCurrency(g.target_value ?? 0)}</span>
                </div>
                <Progress value={pct} className="h-2" />
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: '#94A3B8' }}>{pct.toFixed(0)}%</span>
                  {g.deadline && <span className="text-xs" style={{ color: '#94A3B8' }}>Prazo: {g.deadline}</span>}
                </div>
                {editId === g.id && (
                  <div className="flex gap-2 pt-1">
                    <Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className="flex-1" style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }} />
                    <GoldButton className="text-xs py-1 px-3" onClick={() => handleUpdate(g.id)}>Salvar</GoldButton>
                  </div>
                )}
                {g.notes && <p className="text-xs" style={{ color: '#4A5568' }}>{g.notes}</p>}
              </PremiumCard>
            );
          })}
        </div>
      )}

      {/* New goal modal */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Nova Meta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label style={{ color: '#94A3B8' }}>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }} /></div>
            <div><Label style={{ color: '#94A3B8' }}>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                  <SelectItem value="renda">💰 Renda</SelectItem>
                  <SelectItem value="imoveis">🏘️ Imóveis</SelectItem>
                  <SelectItem value="reserva">💾 Reserva</SelectItem>
                  <SelectItem value="saude">📉 Saúde</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label style={{ color: '#94A3B8' }}>Valor Meta</Label><Input type="number" value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })} style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }} /></div>
              <div><Label style={{ color: '#94A3B8' }}>Valor Atual</Label><Input type="number" value={form.current_value} onChange={e => setForm({ ...form, current_value: e.target.value })} style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }} /></div>
            </div>
            <div><Label style={{ color: '#94A3B8' }}>Prazo</Label><Input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }} /></div>
            <div><Label style={{ color: '#94A3B8' }}>Observações</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }} /></div>
          </div>
          <DialogFooter><GoldButton onClick={handleCreate}>Criar Meta</GoldButton></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
