import { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Download, Trash2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, X, Search, ChevronDown } from "lucide-react";
import { KpiCard } from "@/components/wt7/KpiCard";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRevenues, useCreateRevenue, useDeleteRevenue, useUpdateRevenue, exportCSV } from "@/hooks/useFinances";
import { useBusinesses } from "@/hooks/useBusinesses";
import { useCategories } from "@/hooks/useCategories";
import { formatCurrency, formatDate, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { detectTransactionType } from "@/lib/categorizeTransaction";
import { REVENUE_SOURCE_MAP, getRevenueDisplay, extractBank, getUniqueBanks } from "@/lib/categoryMap";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { DatePicker } from "@/components/wt7/DatePicker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const DEFAULT_SRC_COLOR = '#4A5568';

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

  const [form, setForm] = useState({ source: "", description: "", amount: "", type: "variable", received_at: "", reference_month: month, business_id: "" as string | "", nature: "income", counts_as_income: true });
  const { data: businessList = [] } = useBusinesses();

  // Sort & filter state
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterType, setFilterType] = useState<"all" | "fixed" | "variable" | "eventual">("all");
  const [filterSource, setFilterSource] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const [srcSearchOpen, setSrcSearchOpen] = useState(false);
  const [srcSearch, setSrcSearch] = useState("");
  const [filterSrcSearchOpen, setFilterSrcSearchOpen] = useState(false);
  const [filterSrcSearch, setFilterSrcSearch] = useState("");
  const filterSrcRef = useRef<HTMLDivElement>(null);
  const [filterBank, setFilterBank] = useState("all");
  const [onlyRealIncome, setOnlyRealIncome] = useState(false);
  const [bankFilterOpen, setBankFilterOpen] = useState(false);
  const bankFilterRef = useRef<HTMLDivElement>(null);

  // Count usage per source
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    revenues.forEach(r => { if (r.source) counts[r.source] = (counts[r.source] ?? 0) + 1; });
    return counts;
  }, [revenues]);

  // All source options from map + any in data not in map, sorted by usage
  const allSourceOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string; emoji: string; name: string; color: string }[] = [];
    const namesSeen = new Set<string>();
    Object.entries(REVENUE_SOURCE_MAP).forEach(([value, src]) => {
      if (namesSeen.has(src.name)) return;
      namesSeen.add(src.name);
      options.push({ value, label: `${src.emoji} ${src.name}`, emoji: src.emoji, name: src.name, color: src.color });
      seen.add(value);
    });
    revenues.forEach(r => {
      if (r.source && !seen.has(r.source)) {
        const display = getRevenueDisplay(r.source);
        options.push({ value: r.source, label: `${display.emoji} ${display.name}`, emoji: display.emoji, name: display.name, color: display.color });
        seen.add(r.source);
      }
    });
    return options.sort((a, b) => (sourceCounts[b.value] ?? 0) - (sourceCounts[a.value] ?? 0) || a.name.localeCompare(b.name));
  }, [revenues, sourceCounts]);

  const getSourceDisplay = (srcValue: string | null) => {
    const display = getRevenueDisplay(srcValue);
    return { ...display, label: `${display.emoji} ${display.name}` };
  };

  const availableBanks = useMemo(() => getUniqueBanks(revenues), [revenues]);

  // Close filter dropdowns on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterSrcRef.current && !filterSrcRef.current.contains(e.target as Node)) {
        setFilterSrcSearchOpen(false);
        setFilterSrcSearch("");
      }
      if (bankFilterRef.current && !bankFilterRef.current.contains(e.target as Node)) {
        setBankFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredRevenues = useMemo(() => {
    let data = [...revenues];
    if (filterType !== "all") data = data.filter(r => r.type === filterType);
    if (filterSource !== "all") {
      data = data.filter(r => r.source === filterSource);
    }
    if (filterBank !== "all") {
      data = data.filter(r => extractBank(r.description ?? "") === filterBank);
    }
    if (onlyRealIncome) {
      data = data.filter((r: any) => r.counts_as_income !== false);
    }
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
  }, [revenues, sortField, sortDir, filterType, filterSource, filterBank, onlyRealIncome]);

  // Nature helpers
  const NATURE_META: Record<string, { emoji: string; label: string; color: string }> = {
    income: { emoji: "💰", label: "Receita", color: "#10B981" },
    transfer: { emoji: "🔄", label: "Transferência", color: "#64748B" },
    reimbursement: { emoji: "💳", label: "Reembolso", color: "#F59E0B" },
    refund: { emoji: "↩️", label: "Estorno", color: "#94A3B8" },
  };
  const totalRealIncome = revenues.filter((r: any) => r.counts_as_income !== false).reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalNeutral = revenues.filter((r: any) => r.counts_as_income === false).reduce((s, r) => s + (r.amount ?? 0), 0);

  const totalMonth = filteredRevenues.reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalFixed = revenues.filter(r => r.type === 'fixed').reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalVariable = revenues.filter(r => r.type !== 'fixed').reduce((s, r) => s + (r.amount ?? 0), 0);

  const bySource = revenues.reduce((acc, r) => {
    const src = r.source ?? 'outros';
    acc[src] = (acc[src] ?? 0) + (r.amount ?? 0);
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(bySource).map(([k, v]) => {
    const display = getSourceDisplay(k);
    return { name: display.name, value: v, color: display.color };
  });

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
        business_id: form.business_id || null,
        nature: form.nature,
        counts_as_income: form.nature === "income",
      } as any);
      toast({ title: "Receita registrada com sucesso" });
      setDialogOpen(false);
      setForm({ source: "", description: "", amount: "", type: "variable", received_at: "", reference_month: month, business_id: "", nature: "income", counts_as_income: true });
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
                <div className="relative">
                  <button type="button" onClick={() => setSrcSearchOpen(o => !o)}
                    className="flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm"
                    style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }}>
                    <span>{form.source ? (allSourceOptions.find(c => c.value === form.source)?.label ?? form.source) : "Selecione"}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </button>
                  {srcSearchOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg shadow-xl overflow-hidden" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                      <div className="p-2" style={{ borderBottom: '1px solid #1A2535' }}>
                        <div className="flex items-center gap-2 px-2 py-1 rounded" style={{ background: '#080C10' }}>
                          <Search className="w-3 h-3" style={{ color: '#4A5568' }} />
                          <input value={srcSearch} onChange={e => setSrcSearch(e.target.value)}
                            placeholder="Buscar fonte..."
                            autoFocus
                            className="bg-transparent text-xs outline-none w-full"
                            style={{ color: '#F0F4F8' }} />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {allSourceOptions
                          .filter(c => !srcSearch || c.name.toLowerCase().includes(srcSearch.toLowerCase()))
                          .map(c => (
                            <button key={c.value} type="button"
                              onClick={() => {
                                const autoType = detectTransactionType(c.value, "receita");
                                setForm(f => ({ ...f, source: c.value, type: autoType }));
                                setSrcSearchOpen(false);
                                setSrcSearch("");
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-[#131B22] transition-colors flex items-center justify-between"
                              style={{ color: form.source === c.value ? "#E8C97A" : "#CBD5E1" }}>
                              <span>{c.label}</span>
                              {sourceCounts[c.value] ? <span className="text-[10px]" style={{ color: '#4A5568' }}>{sourceCounts[c.value]}x</span> : null}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
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
                <Label style={{ color: '#94A3B8' }}>Natureza</Label>
                <Select value={form.nature} onValueChange={v => setForm(f => ({ ...f, nature: v, counts_as_income: v === "income" }))}>
                  <SelectTrigger style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#0D1318', borderColor: '#1A2535' }}>
                    <SelectItem value="income">💰 Receita real (conta na Sobra)</SelectItem>
                    <SelectItem value="transfer">🔄 Transferência entre contas</SelectItem>
                    <SelectItem value="reimbursement">💳 Reembolso (pagará no cartão)</SelectItem>
                    <SelectItem value="refund">↩️ Estorno de serviço</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] mt-1" style={{ color: '#64748B' }}>
                  Só "Receita real" entra no denominador da Sobra Reinvestida.
                </p>
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
                <DatePicker value={form.received_at} onChange={v => setForm(f => ({ ...f, received_at: v }))} />
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Mês Referência</Label>
                <MonthPicker value={form.reference_month} onChange={v => setForm(f => ({ ...f, reference_month: v }))} />
              </div>
              <div>
                <Label style={{ color: '#C9A84C' }}>Negócio (cockpit estratégico)</Label>
                <Select value={form.business_id || "__none__"} onValueChange={v => setForm(f => ({ ...f, business_id: v === "__none__" ? "" : v }))}>
                  <SelectTrigger style={{ background: '#080C10', borderColor: 'rgba(201,168,76,0.4)', color: '#F0F4F8' }}><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                  <SelectContent style={{ background: '#0D1318', borderColor: '#1A2535' }}>
                    <SelectItem value="__none__">— sem vínculo —</SelectItem>
                    {businessList.filter(b => b.status !== 'encerrado').map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] mt-1" style={{ color: '#64748B' }}>
                  Vincular a um negócio soma esta receita automaticamente na meta mensal em /businesses.
                </p>
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
                <KpiCard label="Receita Real" value={totalRealIncome} color="gold" />
                <KpiCard label="Entradas Neutras" value={totalNeutral} color="cyan" />
                <KpiCard label="Fixas" value={totalFixed} color="green" />
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

            <div className="relative" ref={filterSrcRef}>
              <button onClick={() => setFilterSrcSearchOpen(o => !o)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg outline-none"
                style={{ background: "#080C10", border: "1px solid #1A2535", color: filterSource !== "all" ? "#E8C97A" : "#64748B" }}>
                {filterSource !== "all" ? (allSourceOptions.find(c => c.value === filterSource)?.label ?? filterSource) : "Todas fontes"}
                <ChevronDown className="w-3 h-3" />
              </button>
              {filterSrcSearchOpen && (
                <div className="absolute z-50 mt-1 w-64 rounded-lg shadow-xl overflow-hidden" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                  <div className="p-2" style={{ borderBottom: '1px solid #1A2535' }}>
                    <div className="flex items-center gap-2 px-2 py-1 rounded" style={{ background: '#080C10' }}>
                      <Search className="w-3 h-3" style={{ color: '#4A5568' }} />
                      <input value={filterSrcSearch} onChange={e => setFilterSrcSearch(e.target.value)}
                        placeholder="Buscar fonte..."
                        autoFocus
                        className="bg-transparent text-xs outline-none w-full"
                        style={{ color: '#F0F4F8' }} />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <button onClick={() => { setFilterSource("all"); setFilterSrcSearchOpen(false); setFilterSrcSearch(""); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[#131B22] transition-colors"
                      style={{ color: filterSource === "all" ? "#E8C97A" : "#94A3B8" }}>
                      Todas fontes
                    </button>
                    {allSourceOptions
                      .filter(c => !filterSrcSearch || c.name.toLowerCase().includes(filterSrcSearch.toLowerCase()))
                      .map(c => (
                        <button key={c.value} onClick={() => { setFilterSource(c.value); setFilterSrcSearchOpen(false); setFilterSrcSearch(""); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[#131B22] transition-colors flex items-center justify-between"
                          style={{ color: filterSource === c.value ? "#E8C97A" : "#CBD5E1" }}>
                          <span>{c.label}</span>
                          {sourceCounts[c.value] ? <span className="text-[10px]" style={{ color: '#4A5568' }}>{sourceCounts[c.value]}x</span> : null}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {availableBanks.length > 0 && (
              <div className="relative" ref={bankFilterRef}>
                <button onClick={() => setBankFilterOpen(o => !o)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg outline-none"
                  style={{
                    background: filterBank !== "all" ? "rgba(45,212,191,0.15)" : "#080C10",
                    border: `1px solid ${filterBank !== "all" ? "rgba(45,212,191,0.4)" : "#1A2535"}`,
                    color: filterBank !== "all" ? "#2DD4BF" : "#64748B",
                  }}>
                  🏦 {filterBank !== "all" ? filterBank : "Todos os bancos"}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {bankFilterOpen && (
                  <div className="absolute z-50 mt-1 w-64 rounded-lg shadow-xl overflow-hidden" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                    <div className="max-h-60 overflow-y-auto">
                      <button onClick={() => { setFilterBank("all"); setBankFilterOpen(false); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-[#131B22] transition-colors"
                        style={{ color: filterBank === "all" ? "#E8C97A" : "#94A3B8" }}>
                        Todos os bancos
                      </button>
                      {availableBanks.map(bank => (
                        <button key={bank} onClick={() => { setFilterBank(bank); setBankFilterOpen(false); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[#131B22] transition-colors flex items-center gap-2"
                          style={{ color: filterBank === bank ? "#2DD4BF" : "#CBD5E1" }}>
                          🏦 {bank}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={() => setOnlyRealIncome(v => !v)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg outline-none"
              style={{
                background: onlyRealIncome ? "rgba(16,185,129,0.15)" : "#080C10",
                border: `1px solid ${onlyRealIncome ? "rgba(16,185,129,0.4)" : "#1A2535"}`,
                color: onlyRealIncome ? "#10B981" : "#64748B",
              }}>
              💰 {onlyRealIncome ? "Só receita real" : "Todas entradas"}
            </button>

            {(filterType !== "all" || filterSource !== "all" || filterBank !== "all" || sortField || onlyRealIncome) && (
              <button onClick={() => { setFilterType("all"); setFilterSource("all"); setFilterBank("all"); setSortField(null); setOnlyRealIncome(false); }}
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
                    const srcDisplay = getSourceDisplay(revenue.source);
                    const natureKey = (revenue as any).nature ?? "income";
                    const natureInfo = NATURE_META[natureKey] ?? NATURE_META.income;
                    const isNeutral = (revenue as any).counts_as_income === false;

                    return (
                      <TableRow key={revenue.id} style={{ borderColor: '#1A2535', opacity: isNeutral ? 0.6 : 1 }}>
                        <TableCell>
                          {isEditing ? (
                            <div className="space-y-1">
                              <select value={editForm.source ?? revenue.source ?? ""}
                                onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))}
                                className="text-xs px-2 py-1 rounded outline-none w-full"
                                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                                {allSourceOptions.map(s => (
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                              </select>
                              <select value={editForm.nature ?? natureKey}
                                onChange={e => setEditForm(f => ({ ...f, nature: e.target.value, counts_as_income: e.target.value === "income" }))}
                                className="text-xs px-2 py-1 rounded outline-none w-full"
                                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                                <option value="income">💰 Receita real</option>
                                <option value="transfer">🔄 Transferência</option>
                                <option value="reimbursement">💳 Reembolso</option>
                                <option value="refund">↩️ Estorno</option>
                              </select>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                              <WtBadge variant="gray">{srcDisplay.label}</WtBadge>
                              {isNeutral && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(100,116,139,0.15)", color: natureInfo.color, border: `1px solid ${natureInfo.color}33` }}>
                                  {natureInfo.emoji} {natureInfo.label}
                                </span>
                              )}
                            </div>
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
