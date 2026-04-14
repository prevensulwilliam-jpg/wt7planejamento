import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/wt7/DatePicker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProperties, useConstructionExpenses, useCreateConstructionExpense, useUpdateProperty, useDeleteProperty } from "@/hooks/useConstructions";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Building2, MapPin, Users, Plus, Pencil, Trash2 } from "lucide-react";
import { DraggableGrid } from "@/components/wt7/DraggableGrid";

const statusMap: Record<string, { label: string; variant: "gold" | "cyan" | "green" | "gray" | "red" }> = {
  aguardando_entrega: { label: "Aguardando", variant: "gold" },
  em_obra: { label: "Em Obra", variant: "cyan" },
  pronto_vazio: { label: "Pronto", variant: "green" },
  gerando_renda: { label: "Gerando Renda", variant: "green" },
  patrimonial: { label: "Patrimonial", variant: "gray" },
};

const categories = ["Terreno", "Terraplenagem", "Materiais", "Mão de Obra", "Instalações", "Acabamento", "Taxas/Cartório", "Outros"];

export default function ConstructionsPage() {
  const { data: properties, isLoading } = useProperties();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const { data: expenses } = useConstructionExpenses(selectedPropertyId);
  const createExpense = useCreateConstructionExpense();
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();
  const { toast } = useToast();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editProp, setEditProp] = useState<any>(null);
  const [delProp, setDelProp] = useState<any>(null);
  const [form, setForm] = useState({ description: "", category: "", total_amount: "", paid_by: "william", payment_type: "avista", installments_total: "", installments_paid: "", next_due_date: "", expense_date: "" });

  const totalUnitsInDev = (properties ?? []).filter(p => p.status === "em_obra" || p.status === "aguardando_entrega").reduce((s, p) => s + (p.total_units_planned ?? 0), 0);
  const totalInvestment = (expenses ?? []).reduce((s, e) => s + (e.total_amount ?? 0), 0);
  const futureRent = (properties ?? []).filter(p => p.status !== "patrimonial").reduce((s, p) => s + (p.total_units_planned ?? 0) * (p.estimated_rent_per_unit ?? 0) * ((p.ownership_pct ?? 100) / 100), 0);

  const handleCreateExpense = async () => {
    if (!form.description || !form.total_amount || !selectedPropertyId) return;
    const total = parseFloat(form.total_amount);
    const prop = (properties ?? []).find(p => p.id === selectedPropertyId);
    const williamPct = (prop?.ownership_pct ?? 100) / 100;
    try {
      await createExpense.mutateAsync({
        property_id: selectedPropertyId,
        property_code: prop?.code,
        description: form.description,
        category: form.category,
        total_amount: total,
        william_amount: form.paid_by === "william" ? total : form.paid_by === "ambos" ? total * williamPct : 0,
        partner_amount: form.paid_by === "socio" ? total : form.paid_by === "ambos" ? total * (1 - williamPct) : 0,
        paid_by: form.paid_by,
        payment_type: form.payment_type,
        expense_date: form.expense_date || null,
        installments_total: form.payment_type === "parcelado" ? parseInt(form.installments_total) || null : null,
        installments_paid: form.payment_type === "parcelado" ? parseInt(form.installments_paid) || 0 : null,
        next_due_date: form.next_due_date || null,
      });
      toast({ title: "Despesa registrada!" });
      setExpenseOpen(false);
      setForm({ description: "", category: "", total_amount: "", paid_by: "william", payment_type: "avista", installments_total: "", installments_paid: "", next_due_date: "", expense_date: "" });
    } catch { toast({ title: "Erro ao criar despesa", variant: "destructive" }); }
  };

  const handleEditProperty = async () => {
    if (!editProp) return;
    try {
      await updateProperty.mutateAsync({ id: editProp.id, status: editProp.status, total_units_built: editProp.total_units_built, total_units_rented: editProp.total_units_rented });
      toast({ title: "Projeto atualizado!" });
      setEditOpen(false);
    } catch { toast({ title: "Erro ao atualizar", variant: "destructive" }); }
  };

  const handleDeleteProperty = async () => {
    if (!delProp) return;
    try {
      await deleteProperty.mutateAsync(delProp.id);
      toast({ title: "Projeto excluído" });
      setDelProp(null);
    } catch { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const expenseKPIs = {
    total: (expenses ?? []).reduce((s, e) => s + (e.total_amount ?? 0), 0),
    william: (expenses ?? []).reduce((s, e) => s + (e.william_amount ?? 0), 0),
    partner: (expenses ?? []).reduce((s, e) => s + (e.partner_amount ?? 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
          <Building2 className="inline w-6 h-6 mr-2" style={{ color: '#C9A84C' }} />
          Obras & Terrenos
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Unidades em Desenvolvimento" value={totalUnitsInDev} color="cyan" compact />
        <KpiCard label="Investimento Total" value={totalInvestment} color="gold" />
        <KpiCard label="Renda Futura Projetada" value={futureRent} color="green" />
      </div>

      <Tabs defaultValue="projetos">
        <TabsList style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <TabsTrigger value="projetos">Projetos</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
        </TabsList>

        <TabsContent value="projetos" className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>
          ) : (properties ?? []).length === 0 ? (
            <PremiumCard><p style={{ color: '#94A3B8' }} className="text-center py-8">Nenhum projeto cadastrado</p></PremiumCard>
          ) : (
            <DraggableGrid
              storageKey="wt7_properties_order"
              items={properties ?? []}
              columns="grid-cols-1 md:grid-cols-2"
              renderCard={p => {
                const s = statusMap[p.status ?? ""] ?? { label: p.status, variant: "gray" as const };
                const progress = p.total_units_planned ? ((p.total_units_built ?? 0) / p.total_units_planned) * 100 : 0;
                const futureIncome = (p.total_units_planned ?? 0) * (p.estimated_rent_per_unit ?? 0) * ((p.ownership_pct ?? 100) / 100);
                return (
                  <PremiumCard className="space-y-3 h-full">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-display font-bold text-lg" style={{ color: '#F0F4F8' }}>{p.code} — {p.name}</p>
                        <p className="text-xs flex items-center gap-1 mt-1" style={{ color: '#94A3B8' }}><MapPin className="w-3 h-3" />{p.address}, {p.city}</p>
                      </div>
                      <WtBadge variant={s.variant}>{s.label}</WtBadge>
                    </div>
                    {(p.total_units_planned ?? 0) > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs" style={{ color: '#94A3B8' }}>
                          <span>Unidades: {p.total_units_built ?? 0}/{p.total_units_planned} construídas · {p.total_units_rented ?? 0} alugadas</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}
                    {p.partner_name && (
                      <p className="text-xs" style={{ color: '#2DD4BF' }}>
                        <Users className="inline w-3 h-3 mr-1" />{p.partner_pct}% {p.partner_name}
                      </p>
                    )}
                    {p.estimated_completion && <p className="text-xs" style={{ color: '#94A3B8' }}>Previsão: {formatDate(p.estimated_completion)}</p>}
                    {futureIncome > 0 && <p className="text-xs font-mono" style={{ color: '#E8C97A' }}>Renda futura (sua parte): {formatCurrency(futureIncome)}/mês</p>}
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <GoldButton variant="outline" className="text-xs py-1.5 px-3" onClick={() => { setSelectedPropertyId(p.id); document.querySelector<HTMLButtonElement>('[data-value="despesas"]')?.click(); }}>
                        Ver Despesas
                      </GoldButton>
                      <GoldButton variant="outline" className="text-xs py-1.5 px-3" onClick={() => { setEditProp({ ...p }); setEditOpen(true); }}>
                        <Pencil className="w-3 h-3" />Editar
                      </GoldButton>
                      <button
                        onClick={() => setDelProp(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}
                      >
                        <Trash2 className="w-3 h-3" />Excluir
                      </button>
                    </div>
                  </PremiumCard>
                );
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="despesas" className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger className="w-64" style={{ background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' }}>
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                {(properties ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedPropertyId && <GoldButton onClick={() => setExpenseOpen(true)}><Plus className="w-4 h-4" />Nova Despesa</GoldButton>}
          </div>

          {selectedPropertyId && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard label="Total Investido" value={expenseKPIs.total} color="gold" />
                <KpiCard label="Parte William" value={expenseKPIs.william} color="cyan" />
                <KpiCard label="Parte Sócio" value={expenseKPIs.partner} color="green" />
              </div>
              <PremiumCard>
                <Table>
                  <TableHeader>
                    <TableRow style={{ borderColor: '#1A2535' }}>
                      {["Data", "Descrição", "Categoria", "Total", "William", "Sócio", "Tipo"].map(h => (
                        <TableHead key={h} style={{ color: '#94A3B8' }}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(expenses ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhuma despesa registrada</TableCell></TableRow>
                    ) : (expenses ?? []).map(e => (
                      <TableRow key={e.id} style={{ borderColor: '#1A2535' }}>
                        <TableCell style={{ color: '#CBD5E1' }}>{e.expense_date ? formatDate(e.expense_date) : "—"}</TableCell>
                        <TableCell style={{ color: '#F0F4F8' }}>{e.description}</TableCell>
                        <TableCell><WtBadge variant="cyan">{e.category}</WtBadge></TableCell>
                        <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(e.total_amount ?? 0)}</TableCell>
                        <TableCell className="font-mono" style={{ color: '#2DD4BF' }}>{formatCurrency(e.william_amount ?? 0)}</TableCell>
                        <TableCell className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(e.partner_amount ?? 0)}</TableCell>
                        <TableCell><WtBadge variant={e.payment_type === "parcelado" ? "gold" : "gray"}>{e.payment_type === "parcelado" ? `${e.installments_paid}/${e.installments_total}` : "À vista"}</WtBadge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </PremiumCard>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit property modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Editar Projeto</DialogTitle></DialogHeader>
          {editProp && (
            <div className="space-y-4">
              <div><Label style={{ color: '#94A3B8' }}>Status</Label>
                <Select value={editProp.status} onValueChange={v => setEditProp({ ...editProp, status: v })}>
                  <SelectTrigger style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                    {Object.entries(statusMap).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label style={{ color: '#94A3B8' }}>Unidades Construídas</Label><Input type="number" value={editProp.total_units_built ?? 0} onChange={e => setEditProp({ ...editProp, total_units_built: parseInt(e.target.value) || 0 })} style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }} /></div>
              <div><Label style={{ color: '#94A3B8' }}>Unidades Alugadas</Label><Input type="number" value={editProp.total_units_rented ?? 0} onChange={e => setEditProp({ ...editProp, total_units_rented: parseInt(e.target.value) || 0 })} style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }} /></div>
            </div>
          )}
          <DialogFooter><GoldButton onClick={handleEditProperty}>Salvar</GoldButton></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create expense modal */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Nova Despesa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label style={{ color: '#94A3B8' }}>Data</Label><DatePicker value={form.expense_date} onChange={v => setForm({ ...form, expense_date: v })} /></div>
            <div><Label style={{ color: '#94A3B8' }}>Descrição</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }} /></div>
            <div><Label style={{ color: '#94A3B8' }}>Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label style={{ color: '#94A3B8' }}>Valor Total (R$)</Label><Input type="number" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }} /></div>
            <div><Label style={{ color: '#94A3B8' }}>Pago por</Label>
              <Select value={form.paid_by} onValueChange={v => setForm({ ...form, paid_by: v })}>
                <SelectTrigger style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                  <SelectItem value="william">William</SelectItem>
                  <SelectItem value="socio">Sócio</SelectItem>
                  <SelectItem value="ambos">Ambos (50/50)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label style={{ color: '#94A3B8' }}>Tipo</Label>
              <Select value={form.payment_type} onValueChange={v => setForm({ ...form, payment_type: v })}>
                <SelectTrigger style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                  <SelectItem value="avista">À vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.payment_type === "parcelado" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label style={{ color: '#94A3B8' }}>Total Parcelas</Label><Input type="number" value={form.installments_total} onChange={e => setForm({ ...form, installments_total: e.target.value })} style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }} /></div>
                  <div><Label style={{ color: '#94A3B8' }}>Pagas</Label><Input type="number" value={form.installments_paid} onChange={e => setForm({ ...form, installments_paid: e.target.value })} style={{ background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' }} /></div>
                </div>
                <div><Label style={{ color: '#94A3B8' }}>Próx. Vencimento</Label><DatePicker value={form.next_due_date} onChange={v => setForm({ ...form, next_due_date: v })} /></div>
              </>
            )}
          </div>
          <DialogFooter><GoldButton onClick={handleCreateExpense}>Registrar</GoldButton></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão de projeto */}
      {delProp && (
        <Dialog open onOpenChange={o => !o && setDelProp(null)}>
          <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
            <DialogHeader>
              <DialogTitle style={{ color: '#F0F4F8' }}>Excluir "{delProp.code} — {delProp.name}"?</DialogTitle>
            </DialogHeader>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              Esta ação é irreversível. Todas as despesas vinculadas ao projeto também serão excluídas.
            </p>
            <DialogFooter className="gap-2">
              <button
                onClick={() => setDelProp(null)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ border: '1px solid #1A2535', color: '#94A3B8' }}
              >Cancelar</button>
              <button
                onClick={handleDeleteProperty}
                disabled={deleteProperty.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', color: '#F43F5E' }}
              >{deleteProperty.isPending ? "Excluindo..." : "Excluir Projeto"}</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
