import { useState, useMemo } from "react";
import { Plus, Trash2, Pencil, Check, X, Compass, Lock, Unlock } from "lucide-react";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { KpiCard } from "@/components/wt7/KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlanItems, useCreatePlanItem, useUpdatePlanItem, useDeletePlanItem, PLAN_KIND_META, type PlanKind, type PlanItem } from "@/hooks/usePlanItems";
import { formatCurrency, formatMonth } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie } from "recharts";

// Paleta canônica
const RED = "#F43F5E";
const BLUE = "#3B82F6";
const GREEN = "#10B981";
const GOLD = "#E8C97A";

type FormState = {
  month: string;
  kind: PlanKind;
  category: string;
  description: string;
  amount: string;
  locked: boolean;
  notes: string;
};

const EMPTY_FORM: FormState = {
  month: "2026-06",
  kind: "obra",
  category: "",
  description: "",
  amount: "",
  locked: false,
  notes: "",
};

export default function PlanPage() {
  const { data: items = [], isLoading } = usePlanItems();
  const create = useCreatePlanItem();
  const update = useUpdatePlanItem();
  const del = useDeletePlanItem();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PlanItem>>({});

  // KPIs agregados
  const totals = useMemo(() => {
    const sum = { obras: 0, viagens: 0, casamento: 0, receitasLocked: 0, receitasProj: 0, custos: 0 };
    for (const i of items) {
      if (i.kind === "obra") sum.obras += Number(i.amount);
      else if (i.kind === "viagem") sum.viagens += Number(i.amount);
      else if (i.kind === "casamento") sum.casamento += Number(i.amount);
      else if (i.kind === "receita_travada") sum.receitasLocked += Number(i.amount);
      else if (i.kind === "receita_projetada") sum.receitasProj += Number(i.amount);
      else sum.custos += Number(i.amount);
    }
    return sum;
  }, [items]);

  const totalDesembolso = totals.obras + totals.viagens + totals.casamento + totals.custos;
  const totalReceitaProjetada = totals.receitasLocked + totals.receitasProj;
  const gap = totalDesembolso - totalReceitaProjetada;

  // Timeline por mês
  const timelineData = useMemo(() => {
    const map = new Map<string, { month: string; saida: number; entrada: number; net: number }>();
    for (const i of items) {
      const entry = map.get(i.month) ?? { month: i.month, saida: 0, entrada: 0, net: 0 };
      if (i.is_revenue || i.kind === "receita_travada" || i.kind === "receita_projetada") {
        entry.entrada += Number(i.amount);
      } else {
        entry.saida += Number(i.amount);
      }
      entry.net = entry.entrada - entry.saida;
      map.set(i.month, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [items]);

  // Pie por tipo
  const pieData = useMemo(() => {
    const data = [
      { name: "Obras", value: totals.obras, color: RED },
      { name: "Viagens", value: totals.viagens, color: RED },
      { name: "Casamento", value: totals.casamento, color: RED },
      { name: "Custos Fixos/Imposto/Outro", value: totals.custos, color: RED },
    ].filter(d => d.value > 0);
    return data;
  }, [totals]);

  const handleSubmit = async () => {
    if (!form.description || !form.amount || !form.month) {
      toast({ title: "Preencha mês, descrição e valor", variant: "destructive" });
      return;
    }
    try {
      const meta = PLAN_KIND_META[form.kind];
      await create.mutateAsync({
        month: form.month,
        kind: form.kind,
        category: form.category || null,
        description: form.description,
        amount: parseFloat(form.amount),
        is_revenue: meta.isRevenue,
        locked: form.locked,
        notes: form.notes || null,
      });
      toast({ title: "Item adicionado ao plano" });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      toast({ title: "Erro ao criar", description: e.message, variant: "destructive" });
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const payload: any = { ...editForm };
      if (payload.kind) payload.is_revenue = PLAN_KIND_META[payload.kind as PlanKind].isRevenue;
      if (payload.amount !== undefined) payload.amount = Number(payload.amount);
      await update.mutateAsync({ id, ...payload });
      setEditingId(null);
      setEditForm({});
      toast({ title: "Atualizado" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await del.mutateAsync(id);
      toast({ title: "Removido" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: "#080C10" }}>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#F0F4F8" }}>
              <Compass className="inline w-6 h-6 mr-2" style={{ color: GOLD }} />
              Plano Estratégico 2026-2028
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#94A3B8" }}>
              Bottom-up: cada desembolso + receita projetada → meta mensal derivada.
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <GoldButton><Plus className="w-4 h-4" /> Adicionar item</GoldButton>
            </DialogTrigger>
            <DialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
              <DialogHeader><DialogTitle style={{ color: "#F0F4F8" }}>Novo item no plano</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label style={{ color: "#94A3B8" }}>Mês</Label>
                  <MonthPicker value={form.month} onChange={v => setForm(f => ({ ...f, month: v }))} />
                </div>
                <div>
                  <Label style={{ color: "#94A3B8" }}>Tipo</Label>
                  <Select value={form.kind} onValueChange={v => setForm(f => ({ ...f, kind: v as PlanKind }))}>
                    <SelectTrigger style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }}><SelectValue /></SelectTrigger>
                    <SelectContent style={{ background: "#0D1318", borderColor: "#1A2535" }}>
                      {(Object.entries(PLAN_KIND_META) as [PlanKind, typeof PLAN_KIND_META[PlanKind]][]).map(([k, m]) => (
                        <SelectItem key={k} value={k}>{m.emoji} {m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label style={{ color: "#94A3B8" }}>Categoria (slug)</Label>
                  <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="ex: jw7_sonho, eua, china_japao" style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
                </div>
                <div>
                  <Label style={{ color: "#94A3B8" }}>Descrição</Label>
                  <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
                </div>
                <div>
                  <Label style={{ color: "#94A3B8" }}>Valor (R$)</Label>
                  <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="locked" checked={form.locked} onChange={e => setForm(f => ({ ...f, locked: e.target.checked }))} />
                  <Label htmlFor="locked" style={{ color: "#94A3B8" }}>🔒 Contratado/confirmado (não é estimativa)</Label>
                </div>
                <div>
                  <Label style={{ color: "#94A3B8" }}>Notas</Label>
                  <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
                </div>
                <GoldButton onClick={handleSubmit} disabled={create.isPending} className="w-full justify-center">
                  {create.isPending ? "Salvando..." : "Adicionar"}
                </GoldButton>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Obras" value={totals.obras} color="red" />
          <KpiCard label="Viagens + Casamento" value={totals.viagens + totals.casamento} color="red" />
          <KpiCard label="Receita Projetada" value={totalReceitaProjetada} color="cyan" />
          <KpiCard label="Gap (desembolso - receita)" value={gap} color={gap > 0 ? "red" : "green"} />
        </div>

        <Tabs defaultValue="itens">
          <TabsList style={{ background: "#0D1318", borderColor: "#1A2535" }}>
            <TabsTrigger value="itens">Itens do plano</TabsTrigger>
            <TabsTrigger value="timeline">Timeline mensal</TabsTrigger>
            <TabsTrigger value="resumo">Resumo por tipo</TabsTrigger>
          </TabsList>

          {/* ═══ ABA 1: Lista de itens ═══ */}
          <TabsContent value="itens" className="space-y-4">
            <PremiumCard className="p-4">
              {isLoading ? <Skeleton className="h-40" /> : items.length === 0 ? (
                <div className="text-center py-8" style={{ color: "#64748B" }}>Sem itens ainda</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow style={{ borderColor: "#1A2535" }}>
                      <TableHead style={{ color: "#94A3B8" }}>Mês</TableHead>
                      <TableHead style={{ color: "#94A3B8" }}>Tipo</TableHead>
                      <TableHead style={{ color: "#94A3B8" }}>Descrição</TableHead>
                      <TableHead style={{ color: "#94A3B8" }}>Categoria</TableHead>
                      <TableHead className="text-right" style={{ color: "#94A3B8" }}>Valor</TableHead>
                      <TableHead className="w-24" style={{ color: "#94A3B8" }}>Status</TableHead>
                      <TableHead className="w-20" style={{ color: "#94A3B8" }}>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(item => {
                      const meta = PLAN_KIND_META[item.kind];
                      const isEditing = editingId === item.id;
                      const valueColor = item.is_revenue ? BLUE : RED;

                      return (
                        <TableRow key={item.id} style={{ borderColor: "#1A2535" }}>
                          <TableCell>
                            {isEditing ? (
                              <Input type="text" value={editForm.month ?? item.month}
                                onChange={e => setEditForm(f => ({ ...f, month: e.target.value }))}
                                className="w-24 text-xs" placeholder="YYYY-MM"
                                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }} />
                            ) : (
                              <span className="font-mono text-xs" style={{ color: "#94A3B8" }}>{item.month}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <select value={(editForm.kind ?? item.kind) as string}
                                onChange={e => setEditForm(f => ({ ...f, kind: e.target.value as PlanKind }))}
                                className="text-xs px-2 py-1 rounded"
                                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                                {(Object.entries(PLAN_KIND_META) as [PlanKind, typeof PLAN_KIND_META[PlanKind]][]).map(([k, m]) => (
                                  <option key={k} value={k}>{m.emoji} {m.label}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs" style={{ color: meta.color }}>{meta.emoji} {meta.label}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input value={editForm.description ?? item.description}
                                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                className="text-xs" style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }} />
                            ) : (
                              <span style={{ color: "#F0F4F8" }}>{item.description}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input value={editForm.category ?? item.category ?? ""}
                                onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                                className="text-xs w-28" style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }} />
                            ) : (
                              <span className="text-xs font-mono" style={{ color: "#64748B" }}>{item.category ?? "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditing ? (
                              <Input type="number" value={(editForm.amount ?? item.amount) as any}
                                onChange={e => setEditForm(f => ({ ...f, amount: parseFloat(e.target.value) as any }))}
                                className="text-xs w-28 text-right" style={{ background: "#080C10", border: "1px solid #1A2535", color: valueColor }} />
                            ) : (
                              <span className="font-mono" style={{ color: valueColor }}>
                                {item.is_revenue ? "+" : "−"}{formatCurrency(item.amount)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.locked ? (
                              <span className="flex items-center gap-1 text-[10px]" style={{ color: GREEN }}>
                                <Lock className="w-3 h-3" /> Travado
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px]" style={{ color: "#64748B" }}>
                                <Unlock className="w-3 h-3" /> Estimativa
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {isEditing ? (
                                <>
                                  <button onClick={() => handleUpdate(item.id)} className="p-1.5 rounded" style={{ background: "rgba(16,185,129,0.2)" }}>
                                    <Check className="w-3.5 h-3.5" style={{ color: GREEN }} />
                                  </button>
                                  <button onClick={() => { setEditingId(null); setEditForm({}); }} className="p-1.5 rounded" style={{ background: "rgba(244,63,94,0.1)" }}>
                                    <X className="w-3.5 h-3.5" style={{ color: RED }} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => { setEditingId(item.id); setEditForm({}); }} className="p-1.5 rounded" style={{ background: "rgba(201,168,76,0.1)" }}>
                                    <Pencil className="w-3.5 h-3.5" style={{ color: GOLD }} />
                                  </button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <button className="p-1.5 rounded" style={{ background: "rgba(244,63,94,0.1)" }}>
                                        <Trash2 className="w-3.5 h-3.5" style={{ color: RED }} />
                                      </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle style={{ color: "#F0F4F8" }}>Remover item?</AlertDialogTitle>
                                        <AlertDialogDescription>{item.description} — {formatCurrency(item.amount)}</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(item.id)} style={{ background: RED, color: "white" }}>Remover</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </PremiumCard>
          </TabsContent>

          {/* ═══ ABA 2: Timeline ═══ */}
          <TabsContent value="timeline">
            <PremiumCard className="p-4">
              <p className="text-xs uppercase tracking-widest font-mono mb-3" style={{ color: "#4A5568" }}>
                Fluxo mensal previsto · vermelho = saída, azul = entrada
              </p>
              {timelineData.length === 0 ? (
                <div className="text-center py-8" style={{ color: "#64748B" }}>Sem itens no plano</div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={timelineData}>
                    <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "#131B22", border: "1px solid #2A3F55", borderRadius: 10 }}
                      formatter={(v: number) => formatCurrency(v)}
                      labelFormatter={(m) => formatMonth(m)}
                    />
                    <Legend />
                    <Bar dataKey="saida" name="Saída" fill={RED} />
                    <Bar dataKey="entrada" name="Entrada" fill={BLUE} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </PremiumCard>
          </TabsContent>

          {/* ═══ ABA 3: Resumo por tipo ═══ */}
          <TabsContent value="resumo">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PremiumCard className="p-4">
                <p className="text-xs uppercase tracking-widest font-mono mb-3" style={{ color: "#4A5568" }}>Desembolso total por categoria</p>
                {pieData.length === 0 ? (
                  <div className="text-center py-8" style={{ color: "#64748B" }}>Sem dados</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2} dataKey="value" nameKey="name">
                        {pieData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.5 + i * 0.15} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "#131B22", border: "1px solid #2A3F55", borderRadius: 10 }} />
                      <Legend iconType="circle" formatter={v => <span style={{ color: "#94A3B8", fontSize: 12 }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </PremiumCard>

              <PremiumCard className="p-4">
                <p className="text-xs uppercase tracking-widest font-mono mb-3" style={{ color: "#4A5568" }}>Números-chave</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm" style={{ color: "#94A3B8" }}>🏗️ Obras totais</span>
                    <span className="font-mono font-bold" style={{ color: RED }}>{formatCurrency(totals.obras)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm" style={{ color: "#94A3B8" }}>✈️ Viagens</span>
                    <span className="font-mono font-bold" style={{ color: RED }}>{formatCurrency(totals.viagens)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm" style={{ color: "#94A3B8" }}>💍 Casamento</span>
                    <span className="font-mono font-bold" style={{ color: RED }}>{formatCurrency(totals.casamento)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm" style={{ color: "#94A3B8" }}>💸 Outros custos</span>
                    <span className="font-mono font-bold" style={{ color: RED }}>{formatCurrency(totals.custos)}</span>
                  </div>
                  <div className="border-t pt-3" style={{ borderColor: "#1A2535" }}>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm" style={{ color: "#F0F4F8" }}>Total saída prevista</span>
                      <span className="font-mono font-bold text-lg" style={{ color: RED }}>{formatCurrency(totalDesembolso)}</span>
                    </div>
                    <div className="flex justify-between items-baseline mt-2">
                      <span className="text-sm" style={{ color: "#F0F4F8" }}>Total receita projetada</span>
                      <span className="font-mono font-bold text-lg" style={{ color: BLUE }}>{formatCurrency(totalReceitaProjetada)}</span>
                    </div>
                    <div className="flex justify-between items-baseline mt-2 pt-2 border-t" style={{ borderColor: "#1A2535" }}>
                      <span className="text-sm font-bold" style={{ color: GOLD }}>Gap a faturar</span>
                      <span className="font-mono font-bold text-xl" style={{ color: gap > 0 ? RED : GREEN }}>{formatCurrency(gap)}</span>
                    </div>
                    <p className="text-[10px] mt-2" style={{ color: "#64748B" }}>
                      Gap ÷ meses restantes = meta mensal adicional pra bater o plano.
                    </p>
                  </div>
                </div>
              </PremiumCard>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
