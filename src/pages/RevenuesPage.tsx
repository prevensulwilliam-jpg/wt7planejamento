import { useState, useMemo } from "react";
import { Plus, Download, Trash2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, X } from "lucide-react";
import { KpiCard } from "@/components/wt7/KpiCard";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRevenues, useCreateRevenue, useDeleteRevenue, useUpdateRevenue, exportCSV } from "@/hooks/useFinances";
import { useCategories } from "@/hooks/useCategories";
import { formatCurrency, formatDate, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const sourceOptions = [
  { value: "aluguel_kitnets", label: "Kitnets" },
  { value: "sal_rio", label: "Salário" },
  { value: "comiss_o_prevensul", label: "Comissão Prevensul" },
  { value: "t7", label: "T7 Sales" },
  { value: "solar_energia", label: "Energia Solar" },
  { value: "laudos_t_cnicos", label: "Laudos Técnicos" },
  { value: "casamento_energia", label: "Casamento Energia" },
  { value: "outros_receita", label: "Outros (Receita)" },
  { value: "outros__receita_", label: "Outros" },
];

const sourceColors: Record<string, string> = {
  aluguel_kitnets: '#C9A84C', comiss_o_prevensul: '#2DD4BF', sal_rio: '#10B981',
  solar_energia: '#F59E0B', t7: '#8B5CF6', laudos_t_cnicos: '#3B82F6', casamento_energia: '#EC4899', outros_receita: '#4A5568', "outros__receita_": '#4A5568',
};

const sourceBadgeVariant: Record<string, 'gold' | 'green' | 'cyan' | 'gray'> = {
  kitnets: 'gold', comissao_prevensul: 'cyan', salario: 'green',
  solar_energia: 'gold', t7: 'cyan', laudos: 'cyan', casamento_energia: 'green', outros: 'gray',
};

function navigateMonth(current: string, delta: number): string {
  const [y, m] = current.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type SortField = "source" | "type" | "amount" | "date" | null;

export default function RevenuesPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: revenues = [], isLoading } = useRevenues(month);
  const createRevenue = useCreateRevenue();
  const deleteRevenue = useDeleteRevenue();
  const updateRevenue = useUpdateRevenue();
  const { data: categories = [] } = useCategories("receita");
  const { toast } = useToast();

  const [form, setForm] = useState({ source: "", description: "", amount: "", type: "variable", received_at: "", reference_month: month });

  // Sort & filter state
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterType, setFilterType] = useState<"all" | "fixed" | "variable" | "eventual">("all");
  const [filterSource, setFilterSource] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const filteredRevenues = useMemo(() => {
    let data = [...revenues];
    if (filterType !== "all") data = data.filter(r => r.type === filterType);
    if (filterSource !== "all") data = data.filter(r => r.source === filterSource);
    if (sortField) {
      data.sort((a, b) => {
        let va: any = sortField === "date" ? (a.received_at ?? "") : (a as any)[sortField] ?? "";
        let vb: any = sortField === "date" ? (b.received_at ?? "") : (b as any)[sortField] ?? "";
        if (sortField === "amount") { va = Number(va); vb = Number(vb); }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [revenues, sortField, sortDir, filterType, filterSource]);

  const totalMonth = filteredRevenues.reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalFixed = revenues.filter(r => r.type === 'fixed').reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalVariable = revenues.filter(r => r.type !== 'fixed').reduce((s, r) => s + (r.amount ?? 0), 0);

  const bySource = revenues.reduce((acc, r) => {
    const src = r.source ?? 'outros';
    acc[src] = (acc[src] ?? 0) + (r.amount ?? 0);
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(bySource).map(([k, v]) => ({
    name: sourceOptions.find(s => s.value === k)?.label ?? k,
    value: v,
    color: sourceColors[k] ?? '#4A5568',
  }));

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const handleSubmit = async () => {
    if (!form.source || !form.amount) return;
    try {
      await createRevenue.mutateAsync({
        source: form.source,
        description: form.description || null,
        amount: parseFloat(form.amount),
        type: form.type,
        received_at: form.received_at || null,
        reference_month: form.reference_month,
      });
      toast({ title: "Receita registrada com sucesso" });
      setDialogOpen(false);
      setForm({ source: "", description: "", amount: "", type: "variable", received_at: "", reference_month: month });
    } catch {
      toast({ title: "Erro ao registrar receita", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRevenue.mutateAsync(id);
      toast({ title: "Receita removida" });
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  const handleExportCSV = () => {
    exportCSV(revenues, ["Fonte", "Descrição", "Tipo", "Valor", "Data", "Mês"], ["source", "description", "type", "amount", "received_at", "reference_month"], `receitas_${month}.csv`);
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMonth(m => navigateMonth(m, -1))} className="text-wt-text-muted hover:text-wt-text-secondary"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="font-display font-bold text-xl text-wt-text-primary">{formatMonth(month)}</h1>
          <button onClick={() => setMonth(m => navigateMonth(m, 1))} className="text-wt-text-muted hover:text-wt-text-secondary"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <GoldButton><Plus className="w-4 h-4" /> Nova Receita</GoldButton>
          </DialogTrigger>
          <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
            <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Nova Receita</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label style={{ color: '#94A3B8' }}>Fonte</Label>
                <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent style={{ background: '#0D1318', borderColor: '#1A2535' }}>
                    {sourceOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Descrição</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} />
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Valor (R$)</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} />
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#0D1318', borderColor: '#1A2535' }}>
                    <SelectItem value="fixed">Fixo</SelectItem>
                    <SelectItem value="variable">Variável</SelectItem>
                    <SelectItem value="eventual">Eventual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Data Recebimento</Label>
                <Input type="date" value={form.received_at} onChange={e => setForm(f => ({ ...f, received_at: e.target.value }))} style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} />
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Mês Referência</Label>
                <Input type="month" value={form.reference_month} onChange={e => setForm(f => ({ ...f, reference_month: e.target.value }))} style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} />
              </div>
              <GoldButton onClick={handleSubmit} disabled={createRevenue.isPending} className="w-full justify-center">
                {createRevenue.isPending ? "Salvando..." : "Registrar Receita"}
              </GoldButton>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="lancamentos">
        <TabsList style={{ background: '#0D1318', borderColor: '#1A2535' }}>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="analise">Análise</TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-2xl" style={{ background: '#0D1318' }} />) : (
              <>
                <KpiCard label="Total do Mês" value={revenues.reduce((s, r) => s + (r.amount ?? 0), 0)} color="gold" />
                <KpiCard label="Receitas Fixas" value={totalFixed} color="green" />
                <KpiCard label="Receitas Variáveis" value={totalVariable} color="cyan" />
                <KpiCard label="Quantidade" value={revenues.length} color="cyan" formatAs="number" />
              </>
            )}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1A2535' }}>
              {(["all", "fixed", "variable", "eventual"] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className="px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: filterType === t ? "rgba(201,168,76,0.2)" : "#080C10",
                    color: filterType === t ? "#E8C97A" : "#64748B",
                  }}>
                  {t === "all" ? "Todos" : t === "fixed" ? "Fixos" : t === "variable" ? "Variáveis" : "Eventuais"}
                </button>
              ))}
            </div>

            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg outline-none"
              style={{ background: "#080C10", border: "1px solid #1A2535", color: filterSource !== "all" ? "#E8C97A" : "#64748B" }}>
              <option value="all">Todas fontes</option>
              {sourceOptions.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            {(filterType !== "all" || filterSource !== "all" || sortField) && (
              <button onClick={() => { setFilterType("all"); setFilterSource("all"); setSortField(null); }}
                className="px-3 py-1.5 text-xs rounded-lg"
                style={{ background: "rgba(244,63,94,0.1)", color: "#F43F5E", border: "1px solid rgba(244,63,94,0.2)" }}>
                Limpar filtros
              </button>
            )}

            <span className="text-xs ml-auto" style={{ color: '#4A5568' }}>
              {filteredRevenues.length} registros
            </span>
          </div>

          <PremiumCard>
            {isLoading ? <Skeleton className="h-[300px] rounded-xl" style={{ background: '#131B22' }} /> : filteredRevenues.length === 0 ? (
              <div className="text-center py-12" style={{ color: '#4A5568' }}>
                <p className="text-lg mb-2">💰</p>
                <p className="text-sm">Nenhuma receita encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: '#1A2535' }}>
                    <TableHead onClick={() => toggleSort("source")} className="cursor-pointer select-none" style={{ color: '#94A3B8' }}>
                      <div className="flex items-center gap-1">Fonte <SortIcon field="source" /></div>
                    </TableHead>
                    <TableHead style={{ color: '#94A3B8' }}>Descrição</TableHead>
                    <TableHead onClick={() => toggleSort("type")} className="cursor-pointer select-none" style={{ color: '#94A3B8' }}>
                      <div className="flex items-center gap-1">Tipo <SortIcon field="type" /></div>
                    </TableHead>
                    <TableHead onClick={() => toggleSort("amount")} className="cursor-pointer select-none text-right" style={{ color: '#94A3B8' }}>
                      <div className="flex items-center gap-1 justify-end">Valor <SortIcon field="amount" /></div>
                    </TableHead>
                    <TableHead onClick={() => toggleSort("date")} className="cursor-pointer select-none" style={{ color: '#94A3B8' }}>
                      <div className="flex items-center gap-1">Data <SortIcon field="date" /></div>
                    </TableHead>
                    <TableHead style={{ color: '#94A3B8' }} className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRevenues.map(revenue => {
                    const isEditing = editingId === revenue.id;
                    const srcOpt = sourceOptions.find(s => s.value === revenue.source);

                    return (
                      <TableRow key={revenue.id} style={{ borderColor: '#1A2535' }}>
                        <TableCell>
                          {isEditing ? (
                            <select value={editForm.source ?? revenue.source ?? ""}
                              onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))}
                              className="text-xs px-2 py-1 rounded outline-none w-full"
                              style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                              {sourceOptions.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          ) : (
                            <WtBadge variant={sourceBadgeVariant[revenue.source ?? ''] ?? 'gray'}>{srcOpt?.label ?? revenue.source}</WtBadge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <input value={editForm.description ?? revenue.description ?? ""}
                              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                              className="text-xs px-2 py-1 rounded outline-none w-full"
                              style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }} />
                          ) : (
                            <span style={{ color: '#F0F4F8' }}>{revenue.description}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <select value={editForm.type ?? revenue.type ?? "variable"}
                              onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                              className="text-xs px-2 py-1 rounded outline-none"
                              style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                              <option value="fixed">Fixo</option>
                              <option value="variable">Variável</option>
                              <option value="eventual">Eventual</option>
                            </select>
                          ) : (
                            <span className="text-xs font-mono" style={{ color: '#94A3B8' }}>
                              {revenue.type === 'fixed' ? 'Fixo' : revenue.type === 'variable' ? 'Variável' : 'Eventual'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <input type="number" value={editForm.amount ?? revenue.amount ?? 0}
                              onChange={e => setEditForm(f => ({ ...f, amount: parseFloat(e.target.value) }))}
                              className="text-xs px-2 py-1 rounded outline-none w-24 text-right"
                              style={{ background: "#080C10", border: "1px solid #1A2535", color: "#10B981" }} />
                          ) : (
                            <span className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(revenue.amount ?? 0)}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs" style={{ color: '#94A3B8' }}>
                          {revenue.received_at ? formatDate(revenue.received_at) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <button onClick={async () => {
                                  try {
                                    await updateRevenue.mutateAsync({ id: revenue.id, ...editForm });
                                    setEditingId(null);
                                    toast({ title: "Receita atualizada!" });
                                  } catch {
                                    toast({ title: "Erro ao atualizar", variant: "destructive" });
                                  }
                                }} className="p-1.5 rounded hover:opacity-80" style={{ background: "rgba(16,185,129,0.2)" }}>
                                  <Check className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
                                </button>
                                <button onClick={() => setEditingId(null)} className="p-1.5 rounded hover:opacity-80" style={{ background: "rgba(244,63,94,0.1)" }}>
                                  <X className="w-3.5 h-3.5" style={{ color: '#F43F5E' }} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => { setEditingId(revenue.id); setEditForm({}); }}
                                  className="p-1.5 rounded hover:opacity-80" style={{ background: "rgba(201,168,76,0.1)" }}>
                                  <Pencil className="w-3.5 h-3.5" style={{ color: '#C9A84C' }} />
                                </button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <button className="p-1.5 rounded hover:opacity-80" style={{ background: "rgba(244,63,94,0.1)" }}>
                                      <Trash2 className="w-3.5 h-3.5" style={{ color: '#F43F5E' }} />
                                    </button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle style={{ color: '#F0F4F8' }}>Remover receita?</AlertDialogTitle>
                                      <AlertDialogDescription>{revenue.description} — {formatCurrency(revenue.amount ?? 0)}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(revenue.id)} style={{ background: "#F43F5E", color: "white" }}>Remover</AlertDialogAction>
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
                <TableFooter style={{ background: '#080C10' }}>
                  <TableRow style={{ borderColor: '#1A2535' }}>
                    <TableCell colSpan={3} className="font-display font-bold" style={{ color: '#F0F4F8' }}>TOTAL</TableCell>
                    <TableCell className="text-right font-mono font-bold" style={{ color: '#E8C97A' }}>{formatCurrency(totalMonth)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </PremiumCard>
        </TabsContent>

        <TabsContent value="analise" className="space-y-6">
          <div className="flex justify-end">
            <GoldButton variant="outline" onClick={handleExportCSV}><Download className="w-4 h-4" /> Exportar CSV</GoldButton>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PremiumCard>
              <h3 className="font-display font-bold text-sm mb-4" style={{ color: '#F0F4F8' }}>Receita por Fonte</h3>
              {pieData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-sm" style={{ color: '#4A5568' }}>Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={pieData} layout="vertical">
                    <XAxis type="number" tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: '#131B22', border: '1px solid #2A3F55', borderRadius: 10 }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </PremiumCard>

            <PremiumCard>
              <h3 className="font-display font-bold text-sm mb-4" style={{ color: '#F0F4F8' }}>Composição</h3>
              {pieData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-sm" style={{ color: '#4A5568' }}>Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: '#131B22', border: '1px solid #2A3F55', borderRadius: 10 }} />
                    <Legend iconType="circle" formatter={v => <span style={{ color: '#94A3B8', fontSize: 12 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </PremiumCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
