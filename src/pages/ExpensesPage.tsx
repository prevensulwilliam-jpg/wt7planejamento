import { useState } from "react";
import { Plus, Download, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { KpiCard } from "@/components/wt7/KpiCard";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpenses, useCreateExpense, useDeleteExpense, exportCSV } from "@/hooks/useFinances";
import { formatCurrency, formatDate, formatMonth, getCurrentMonth } from "@/lib/formatters";
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

export default function ExpensesPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data = [], isLoading } = useExpenses(month);
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();
  const { toast } = useToast();

  const [form, setForm] = useState({ category: "", description: "", amount: "", type: "variable", paid_at: "", reference_month: month });

  const totalMonth = data.reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalFixed = data.filter(e => e.type === 'fixed').reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalVariable = data.filter(e => e.type !== 'fixed').reduce((s, e) => s + (e.amount ?? 0), 0);

  const byCat = data.reduce((acc, e) => {
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
    exportCSV(data, ["Categoria", "Descrição", "Tipo", "Valor", "Data", "Mês"], ["category", "description", "type", "amount", "paid_at", "reference_month"], `despesas_${month}.csv`);
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
            <GoldButton><Plus className="w-4 h-4" /> Nova Despesa</GoldButton>
          </DialogTrigger>
          <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
            <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Nova Despesa</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label style={{ color: '#94A3B8' }}>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
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
                <KpiCard label="Total do Mês" value={totalMonth} color="red" />
                <KpiCard label="Despesas Fixas" value={totalFixed} color="gold" />
                <KpiCard label="Despesas Variáveis" value={totalVariable} color="cyan" />
                <KpiCard label="Maior Categoria" value={topCategory?.[1] ?? 0} color="cyan" />
              </>
            )}
          </div>

          <PremiumCard>
            {isLoading ? <Skeleton className="h-[300px] rounded-xl" style={{ background: '#131B22' }} /> : data.length === 0 ? (
              <div className="text-center py-12" style={{ color: '#4A5568' }}>
                <p className="text-lg mb-2">📊</p>
                <p className="text-sm">Nenhuma despesa neste mês</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: '#1A2535' }}>
                    <TableHead style={{ color: '#94A3B8' }}>Categoria</TableHead>
                    <TableHead style={{ color: '#94A3B8' }}>Descrição</TableHead>
                    <TableHead style={{ color: '#94A3B8' }}>Tipo</TableHead>
                    <TableHead style={{ color: '#94A3B8' }} className="text-right">Valor</TableHead>
                    <TableHead style={{ color: '#94A3B8' }}>Data</TableHead>
                    <TableHead style={{ color: '#94A3B8' }} className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(e => {
                    const catOpt = categoryOptions.find(c => c.value === e.category);
                    return (
                      <TableRow key={e.id} style={{ borderColor: '#1A2535' }}>
                        <TableCell><WtBadge variant="gray">{catOpt?.label ?? e.category}</WtBadge></TableCell>
                        <TableCell style={{ color: '#F0F4F8' }}>{e.description}</TableCell>
                        <TableCell style={{ color: '#94A3B8' }} className="text-xs font-mono">{e.type === 'fixed' ? 'Fixo' : 'Variável'}</TableCell>
                        <TableCell className="text-right font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(e.amount ?? 0)}</TableCell>
                        <TableCell className="font-mono text-xs" style={{ color: '#94A3B8' }}>{e.paid_at ? formatDate(e.paid_at) : '—'}</TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><button className="text-wt-text-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button></AlertDialogTrigger>
                            <AlertDialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                              <AlertDialogHeader>
                                <AlertDialogTitle style={{ color: '#F0F4F8' }}>Excluir despesa?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(e.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
