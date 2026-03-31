import { useState, useMemo, useRef } from "react";
import { Plus, Download, Trash2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, X, Search, ChevronDown } from "lucide-react";
import { KpiCard } from "@/components/wt7/KpiCard";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpenses, useCreateExpense, useDeleteExpense, useUpdateExpense, exportCSV } from "@/hooks/useFinances";
import { useCategories } from "@/hooks/useCategories";
import { formatCurrency, formatDate, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { detectTransactionType } from "@/lib/categorizeTransaction";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";

const categoryOptions = [
  { value: "alimentacao", label: "🍽️ Alimentação" },
  { value: "suplementos", label: "💊 Suplementos" },
  { value: "academia", label: "🏋️ Academia/Personal" },
  { value: "saude", label: "🏥 Saúde" },
  { value: "lazer", label: "🎉 Lazer" },
  { value: "viagens", label: "✈️ Viagens" },
  { value: "impostos", label: "🧾 Impostos" },
  { value: "empresas_t7", label: "🏢 Empresas/T7" },
  { value: "kitnets_manutencao", label: "🔧 Kitnets Manutenção" },
  { value: "assinaturas", label: "📱 Assinaturas" },
  { value: "veiculo", label: "🚗 Veículo" },
  { value: "casamento", label: "💍 Casamento" },
  { value: "outros", label: "📦 Outros" },
];

const catColors: Record<string, string> = {
  alimentacao: '#F59E0B', suplementos: '#8B5CF6', academia: '#10B981', saude: '#EC4899',
  lazer: '#3B82F6', viagens: '#2DD4BF', impostos: '#F43F5E', empresas_t7: '#C9A84C',
  kitnets_manutencao: '#F97316', assinaturas: '#6366F1', veiculo: '#94A3B8', casamento: '#EC4899', outros: '#4A5568',
};

function navigateMonth(current: string, delta: number): string {
  const [y, m] = current.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type SortField = "category" | "type" | "amount" | "date" | null;

export default function ExpensesPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: expenses = [], isLoading } = useExpenses(month);
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();
  const updateExpense = useUpdateExpense();
  const { data: categories = [] } = useCategories("despesa");
  const { toast } = useToast();

  const [form, setForm] = useState({ category: "", description: "", amount: "", type: "variable", paid_at: "", reference_month: month });

  // Sort & filter state
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterType, setFilterType] = useState<"all" | "fixed" | "variable">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const [catSearchOpen, setCatSearchOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [filterCatSearchOpen, setFilterCatSearchOpen] = useState(false);
  const [filterCatSearch, setFilterCatSearch] = useState("");
  const filterCatRef = useRef<HTMLDivElement>(null);

  // Count usage per category from current expenses
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    expenses.forEach(e => { if (e.category) counts[e.category] = (counts[e.category] ?? 0) + 1; });
    return counts;
  }, [expenses]);

  // All categories from DB + any in data not in DB, sorted by usage
  const allCategoryOptions = useMemo(() => {
    const dbCats = categories.map(c => ({
      value: c.name.toLowerCase().replace(/[\s/]+/g, "_"),
      label: `${c.emoji || '📦'} ${c.name}`,
      emoji: c.emoji || '📦',
      name: c.name,
    }));
    // Add hardcoded ones not in DB
    const dbValues = new Set(dbCats.map(c => c.value));
    categoryOptions.forEach(co => {
      if (!dbValues.has(co.value)) dbCats.push({ value: co.value, label: co.label, emoji: co.label.split(' ')[0], name: co.label.replace(/^.+?\s/, '') });
    });
    // Add any from data not in either
    const allValues = new Set(dbCats.map(c => c.value));
    expenses.forEach(e => {
      if (e.category && !allValues.has(e.category)) {
        dbCats.push({ value: e.category, label: `📦 ${e.category}`, emoji: '📦', name: e.category });
        allValues.add(e.category);
      }
    });
    // Sort by usage count desc, then alphabetically
    return dbCats.sort((a, b) => (categoryCounts[b.value] ?? 0) - (categoryCounts[a.value] ?? 0) || a.name.localeCompare(b.name));
  }, [categories, expenses, categoryCounts]);

  const filteredExpenses = useMemo(() => {
    let data = [...expenses];
    if (filterType !== "all") data = data.filter(e => e.type === filterType);
    if (filterCategory !== "all") data = data.filter(e => e.category === filterCategory);
    if (sortField) {
      data.sort((a, b) => {
        let va: any = sortField === "date" ? (a.paid_at ?? "") : (a as any)[sortField] ?? "";
        let vb: any = sortField === "date" ? (b.paid_at ?? "") : (b as any)[sortField] ?? "";
        if (sortField === "amount") { va = Number(va); vb = Number(vb); }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [expenses, sortField, sortDir, filterType, filterCategory]);

  const totalMonth = filteredExpenses.reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalFixed = expenses.filter(e => e.type === 'fixed').reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalVariable = expenses.filter(e => e.type !== 'fixed').reduce((s, e) => s + (e.amount ?? 0), 0);

  const byCat = expenses.reduce((acc, e) => {
    const cat = e.category ?? 'outros';
    acc[cat] = (acc[cat] ?? 0) + (e.amount ?? 0);
    return acc;
  }, {} as Record<string, number>);

  const topCategory = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  const pieData = Object.entries(byCat).map(([k, v]) => ({
    name: categoryOptions.find(c => c.value === k)?.label?.replace(/^.+\s/, '') ?? k,
    value: v,
    color: catColors[k] ?? '#4A5568',
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
    if (!form.category || !form.amount || !form.description) return;
    try {
      await createExpense.mutateAsync({
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        type: form.type,
        paid_at: form.paid_at || null,
        reference_month: form.reference_month,
      });
      toast({ title: "Despesa registrada com sucesso" });
      setDialogOpen(false);
      setForm({ category: "", description: "", amount: "", type: "variable", paid_at: "", reference_month: month });
    } catch {
      toast({ title: "Erro ao registrar despesa", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense.mutateAsync(id);
      toast({ title: "Despesa removida" });
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  const handleExportCSV = () => {
    exportCSV(expenses, ["Categoria", "Descrição", "Tipo", "Valor", "Data", "Mês"], ["category", "description", "type", "amount", "paid_at", "reference_month"], `despesas_${month}.csv`);
  };

  const allCategories = categories.length > 0 ? categories : categoryOptions.map(c => ({ name: c.label.replace(/^.+\s/, ''), emoji: c.label.split(' ')[0], id: c.value }));

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
            <GoldButton><Plus className="w-4 h-4" /> Nova Despesa</GoldButton>
          </DialogTrigger>
          <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
            <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Nova Despesa</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label style={{ color: '#94A3B8' }}>Categoria</Label>
                <Select value={form.category} onValueChange={v => { const autoType = detectTransactionType(v, "despesa"); setForm(f => ({ ...f, category: v, type: autoType })); }}>
                  <SelectTrigger style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent style={{ background: '#0D1318', borderColor: '#1A2535' }}>
                    {categoryOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Descrição</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} placeholder="Obrigatório" />
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
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Data Pagamento</Label>
                <Input type="date" value={form.paid_at} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))} style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} />
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Mês Referência</Label>
                <Input type="month" value={form.reference_month} onChange={e => setForm(f => ({ ...f, reference_month: e.target.value }))} style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} />
              </div>
              <GoldButton onClick={handleSubmit} disabled={createExpense.isPending} className="w-full justify-center">
                {createExpense.isPending ? "Salvando..." : "Registrar Despesa"}
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
                <KpiCard label="Total do Mês" value={expenses.reduce((s, e) => s + (e.amount ?? 0), 0)} color="red" />
                <KpiCard label="Despesas Fixas" value={totalFixed} color="gold" />
                <KpiCard label="Despesas Variáveis" value={totalVariable} color="cyan" />
                <KpiCard label="Maior Categoria" value={topCategory?.[1] ?? 0} color="cyan" />
              </>
            )}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1A2535' }}>
              {(["all", "fixed", "variable"] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className="px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: filterType === t ? "rgba(201,168,76,0.2)" : "#080C10",
                    color: filterType === t ? "#E8C97A" : "#64748B",
                  }}>
                  {t === "all" ? "Todos" : t === "fixed" ? "Fixos" : "Variáveis"}
                </button>
              ))}
            </div>

            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg outline-none"
              style={{ background: "#080C10", border: "1px solid #1A2535", color: filterCategory !== "all" ? "#E8C97A" : "#64748B" }}>
              <option value="all">Todas categorias</option>
              {uniqueCategories.map(c => {
                const cat = categories.find(ct => ct.name.toLowerCase().replace(/\s+/g, "_") === c || ct.name === c);
                return <option key={c} value={c}>{cat ? `${cat.emoji} ${cat.name}` : c}</option>;
              })}
            </select>

            {(filterType !== "all" || filterCategory !== "all" || sortField) && (
              <button onClick={() => { setFilterType("all"); setFilterCategory("all"); setSortField(null); }}
                className="px-3 py-1.5 text-xs rounded-lg"
                style={{ background: "rgba(244,63,94,0.1)", color: "#F43F5E", border: "1px solid rgba(244,63,94,0.2)" }}>
                Limpar filtros
              </button>
            )}

            <span className="text-xs ml-auto" style={{ color: '#4A5568' }}>
              {filteredExpenses.length} registros
            </span>
          </div>

          <PremiumCard>
            {isLoading ? <Skeleton className="h-[300px] rounded-xl" style={{ background: '#131B22' }} /> : filteredExpenses.length === 0 ? (
              <div className="text-center py-12" style={{ color: '#4A5568' }}>
                <p className="text-lg mb-2">📊</p>
                <p className="text-sm">Nenhuma despesa encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: '#1A2535' }}>
                    <TableHead onClick={() => toggleSort("category")} className="cursor-pointer select-none" style={{ color: '#94A3B8' }}>
                      <div className="flex items-center gap-1">Categoria <SortIcon field="category" /></div>
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
                  {filteredExpenses.map(expense => {
                    const isEditing = editingId === expense.id;
                    const catOpt = categoryOptions.find(c => c.value === expense.category);

                    return (
                      <TableRow key={expense.id} style={{ borderColor: '#1A2535' }}>
                        <TableCell>
                          {isEditing ? (
                            <select value={editForm.category ?? expense.category ?? ""}
                              onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                              className="text-xs px-2 py-1 rounded outline-none w-full"
                              style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                              {categoryOptions.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                          ) : (
                            <WtBadge variant="gray">{catOpt?.label ?? expense.category}</WtBadge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <input value={editForm.description ?? expense.description ?? ""}
                              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                              className="text-xs px-2 py-1 rounded outline-none w-full"
                              style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }} />
                          ) : (
                            <span style={{ color: '#F0F4F8' }}>{expense.description}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <select value={editForm.type ?? expense.type ?? "variable"}
                              onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                              className="text-xs px-2 py-1 rounded outline-none"
                              style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                              <option value="fixed">Fixo</option>
                              <option value="variable">Variável</option>
                            </select>
                          ) : (
                            <span className="text-xs font-mono" style={{ color: '#94A3B8' }}>
                              {expense.type === 'fixed' ? 'Fixo' : 'Variável'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <input type="number" value={editForm.amount ?? expense.amount ?? 0}
                              onChange={e => setEditForm(f => ({ ...f, amount: parseFloat(e.target.value) }))}
                              className="text-xs px-2 py-1 rounded outline-none w-24 text-right"
                              style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F43F5E" }} />
                          ) : (
                            <span className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(expense.amount ?? 0)}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs" style={{ color: '#94A3B8' }}>
                          {expense.paid_at ? formatDate(expense.paid_at) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <button onClick={async () => {
                                  try {
                                    await updateExpense.mutateAsync({ id: expense.id, ...editForm });
                                    setEditingId(null);
                                    toast({ title: "Despesa atualizada!" });
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
                                <button onClick={() => { setEditingId(expense.id); setEditForm({}); }}
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
                                      <AlertDialogTitle style={{ color: '#F0F4F8' }}>Remover despesa?</AlertDialogTitle>
                                      <AlertDialogDescription>{expense.description} — {formatCurrency(expense.amount ?? 0)}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(expense.id)} style={{ background: "#F43F5E", color: "white" }}>Remover</AlertDialogAction>
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
                    <TableCell className="text-right font-mono font-bold" style={{ color: '#F43F5E' }}>{formatCurrency(totalMonth)}</TableCell>
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
              <h3 className="font-display font-bold text-sm mb-4" style={{ color: '#F0F4F8' }}>Despesas por Categoria</h3>
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

            <PremiumCard>
              <h3 className="font-display font-bold text-sm mb-4" style={{ color: '#F0F4F8' }}>Ranking por Categoria</h3>
              {pieData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-sm" style={{ color: '#4A5568' }}>Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={pieData.sort((a, b) => b.value - a.value)} layout="vertical">
                    <XAxis type="number" tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: '#131B22', border: '1px solid #2A3F55', borderRadius: 10 }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </PremiumCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
