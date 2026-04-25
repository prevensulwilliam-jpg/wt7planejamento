import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import {
  Select, SelectTrigger, SelectValue, SelectContent,
  SelectGroup, SelectLabel, SelectItem, SelectSeparator,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Gem, X, ArrowUp, ArrowDown, Filter, FileText, Zap } from "lucide-react";

type Card = {
  id: string;
  name: string;
  bank: string;
  last4: string | null;
  closing_day: number | null;
  due_day: number | null;
};

type ParseResult = {
  ok: boolean;
  invoice_id?: string;
  reference_month?: string;
  total_amount?: number;
  parsed?: number;
  inserted?: number;
  skipped?: number;
  error?: string;
};

type Tx = {
  id: string;
  card_id: string;
  invoice_id: string;
  transaction_date: string;
  description: string;
  merchant_normalized: string | null;
  amount: number;
  cardholder: string | null;
  installment_current: number;
  installment_total: number;
  category_id: string | null;
  counts_as_investment: boolean;
  vector: string | null;
  custom_categories: {
    name: string;
    emoji: string | null;
    slug: string | null;
    counts_as_investment: boolean;
  } | null;
  cards: { name: string; bank: string } | null;
};

type Category = {
  id: string;
  name: string;
  slug: string | null;
  emoji: string | null;
  counts_as_investment: boolean;
  vector: string | null;
};

type ClosedInvoice = {
  id: string;
  card_id: string;
  reference_month: string;
  total_amount: number;
  paid_amount: number | null;
  paid_at: string | null;
  closed_at: string | null;
  bank_tx_id: string | null;
  cards: { name: string; bank: string } | null;
};

/** Extrai um pattern genérico a partir do merchant_normalized (primeiras 2 palavras >= 3 chars). */
function extractPattern(merchant: string): string {
  const words = merchant.split(" ").filter(w => w.length >= 3);
  return words.slice(0, 2).join(" ").trim() || merchant.trim();
}

const VECTOR_LABELS: Record<string, { label: string; emoji: string }> = {
  aporte_obra: { label: "Aporte Obra", emoji: "🧱" },
  dev_profissional_agora: { label: "Dev Pro", emoji: "⚡" },
  dev_pessoal_futuro: { label: "Dev Pessoal", emoji: "🧠" },
  produtividade_ferramentas: { label: "Ferramentas", emoji: "🛠️" },
  consorcios_aporte: { label: "Consórcios", emoji: "🔁" },
};

function currentRefMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

function detectFormat(filename: string): "ofx" | "csv" | "pdf" | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "ofx") return "ofx";
  if (ext === "csv") return "csv";
  if (ext === "pdf") return "pdf";
  return null;
}

function money(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CardsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"in_progress" | "closed">("in_progress");
  const [refMonth, setRefMonth] = useState<string>(currentRefMonth());
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<ParseResult | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [payDialogInv, setPayDialogInv] = useState<ClosedInvoice | null>(null);
  const [closedUploadOpen, setClosedUploadOpen] = useState(false);

  // ── Filtros ───────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterCard, setFilterCard] = useState<string>("all");        // card_id
  const [filterHolder, setFilterHolder] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all"); // category_id | "invest" | "custeio" | "investigar"
  const [filterVector, setFilterVector] = useState<string>("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [onlyInstallments, setOnlyInstallments] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "amount" | "description">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function clearFilters() {
    setSearch("");
    setFilterCard("all");
    setFilterHolder("all");
    setFilterCategory("all");
    setFilterVector("all");
    setMinAmount("");
    setMaxAmount("");
    setOnlyInstallments(false);
  }

  function toggleSort(col: "date" | "amount" | "description") {
    if (sortBy === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir(col === "date" ? "desc" : "asc");
    }
  }

  const { data: cards } = useQuery({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cards").select("*").order("name");
      if (error) throw error;
      return data as Card[];
    },
  });

  // Todas as transações do mês-ref selecionado (todas as faturas, todos os cartões)
  const { data: txs = [], isLoading: loadingTxs } = useQuery<Tx[]>({
    queryKey: ["card_txs", refMonth],
    queryFn: async () => {
      // 1. pega as invoices do mês
      const { data: invs, error: ei } = await supabase
        .from("card_invoices")
        .select("id")
        .eq("reference_month", refMonth);
      if (ei) throw ei;
      const invIds = (invs || []).map(i => i.id);
      if (invIds.length === 0) return [];

      // 2. pega transações
      const { data, error } = await supabase
        .from("card_transactions")
        .select(`
          id, card_id, invoice_id, transaction_date, description, merchant_normalized, amount,
          cardholder, installment_current, installment_total,
          category_id, counts_as_investment, vector,
          custom_categories ( name, emoji, slug, counts_as_investment ),
          cards ( name, bank )
        `)
        .in("invoice_id", invIds)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Categorias despesa (dropdown)
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["card_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_categories")
        .select("id, name, slug, emoji, counts_as_investment, vector")
        .eq("type", "despesa")
        .order("counts_as_investment", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  // Faturas fechadas (closed_at IS NOT NULL) — Aba 2
  const { data: closedInvoices = [] } = useQuery<ClosedInvoice[]>({
    queryKey: ["card_invoices_closed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_invoices")
        .select(`
          id, card_id, reference_month, total_amount, paid_amount, paid_at, closed_at, bank_tx_id,
          cards ( name, bank )
        `)
        .not("closed_at", "is", null)
        .order("reference_month", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Mutation: marcar fatura como paga
  const markPaid = useMutation({
    mutationFn: async ({ invId, paid_at, paid_amount }: { invId: string; paid_at: string; paid_amount: number }) => {
      const { error } = await supabase
        .from("card_invoices")
        .update({ paid_at, paid_amount })
        .eq("id", invId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fatura marcada como paga");
      qc.invalidateQueries({ queryKey: ["card_invoices_closed"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
      qc.invalidateQueries({ queryKey: ["cockpit_breakdown"] });
      setPayDialogInv(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao marcar pago"),
  });

  // Mutation: fechar fatura (set closed_at = now)
  const closeInvoice = useMutation({
    mutationFn: async (invId: string) => {
      const { error } = await supabase
        .from("card_invoices")
        .update({ closed_at: new Date().toISOString() })
        .eq("id", invId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fatura fechada — agora aparece na aba 'Faturas fechadas'");
      qc.invalidateQueries({ queryKey: ["card_invoices_closed"] });
      qc.invalidateQueries({ queryKey: ["card_txs"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao fechar fatura"),
  });

  // Mutation: reclassificar transação + aprender pattern
  const reclassify = useMutation({
    mutationFn: async ({ tx, category }: { tx: Tx; category: Category }) => {
      // 1. Atualiza a transação
      const { error: eu } = await supabase
        .from("card_transactions")
        .update({
          category_id: category.id,
          counts_as_investment: category.counts_as_investment,
          vector: category.vector,
        })
        .eq("id", tx.id);
      if (eu) throw eu;

      // 2. Aprende o pattern (só se não for "A Investigar")
      if (category.slug !== "a_investigar" && tx.merchant_normalized) {
        const pat = extractPattern(tx.merchant_normalized);
        if (pat.length >= 3) {
          // Upsert manual — busca, atualiza ou insere
          const { data: existing } = await supabase
            .from("card_merchant_patterns")
            .select("id, confidence")
            .eq("merchant_pattern", pat)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("card_merchant_patterns")
              .update({
                category_id: category.id,
                confidence: (existing.confidence || 1) + 1,
                last_used_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
          } else {
            await supabase.from("card_merchant_patterns").insert({
              merchant_pattern: pat,
              category_id: category.id,
              confidence: 1,
            });
          }
        }
      }
    },
    onSuccess: (_, { category }) => {
      toast.success(`Categoria → ${category.emoji || ""} ${category.name}`);
      qc.invalidateQueries({ queryKey: ["card_txs"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao reclassificar"),
  });

  // Agregações
  const kpis = useMemo(() => {
    const total = txs.reduce((s, t) => s + Number(t.amount), 0);
    const invest = txs.filter(t => t.counts_as_investment).reduce((s, t) => s + Number(t.amount), 0);
    const custo = total - invest;
    const pctInvest = total > 0 ? (invest / total) * 100 : 0;

    // por vetor (só os que contam como investimento)
    const byVector: Record<string, number> = {};
    for (const t of txs) {
      if (t.counts_as_investment && t.vector) {
        byVector[t.vector] = (byVector[t.vector] || 0) + Number(t.amount);
      }
    }

    // por cartão
    const byCard: Record<string, { name: string; total: number; count: number }> = {};
    for (const t of txs) {
      const k = t.card_id;
      if (!byCard[k]) byCard[k] = { name: t.cards?.name || "—", total: 0, count: 0 };
      byCard[k].total += Number(t.amount);
      byCard[k].count += 1;
    }

    // a investigar
    const semCategoria = txs.filter(t => !t.custom_categories).length;

    return { total, invest, custo, pctInvest, byVector, byCard: Object.values(byCard), semCategoria };
  }, [txs]);

  // Lista única de portadores presentes
  const holders = useMemo(() => {
    const s = new Set<string>();
    for (const t of txs) if (t.cardholder) s.add(t.cardholder);
    return Array.from(s).sort();
  }, [txs]);

  // Lista única de vetores (só dos txs que contam invest)
  const vectorsPresent = useMemo(() => {
    const s = new Set<string>();
    for (const t of txs) if (t.vector) s.add(t.vector);
    return Array.from(s).sort();
  }, [txs]);

  // Lista única de cartões presentes no mês
  const cardsPresent = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of txs) if (t.card_id && t.cards?.name) m.set(t.card_id, t.cards.name);
    return Array.from(m.entries()); // [id, name]
  }, [txs]);

  const filteredTxs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minAmount ? Number(minAmount) : null;
    const max = maxAmount ? Number(maxAmount) : null;

    let out = txs.filter(t => {
      if (q) {
        const hay = `${t.description || ""} ${t.merchant_normalized || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterCard !== "all" && t.card_id !== filterCard) return false;
      if (filterHolder !== "all" && (t.cardholder || "") !== filterHolder) return false;

      if (filterCategory !== "all") {
        if (filterCategory === "invest") {
          if (!t.counts_as_investment) return false;
        } else if (filterCategory === "custeio") {
          if (t.counts_as_investment) return false;
          if (t.custom_categories?.slug === "a_investigar") return false;
        } else if (filterCategory === "investigar") {
          if (t.custom_categories && t.custom_categories.slug !== "a_investigar") return false;
        } else {
          if (t.category_id !== filterCategory) return false;
        }
      }

      if (filterVector !== "all" && (t.vector || "") !== filterVector) return false;

      const amt = Number(t.amount);
      if (min !== null && amt < min) return false;
      if (max !== null && amt > max) return false;

      if (onlyInstallments && t.installment_total <= 1) return false;
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      if (sortBy === "date") return a.transaction_date.localeCompare(b.transaction_date) * dir;
      if (sortBy === "amount") return (Number(a.amount) - Number(b.amount)) * dir;
      return (a.description || "").localeCompare(b.description || "") * dir;
    });
    return out;
  }, [txs, search, filterCard, filterHolder, filterCategory, filterVector, minAmount, maxAmount, onlyInstallments, sortBy, sortDir]);

  const activeFilters = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    if (search) chips.push({ key: "search", label: `Busca: "${search}"`, onClear: () => setSearch("") });
    if (filterCard !== "all") {
      const n = cardsPresent.find(([id]) => id === filterCard)?.[1] || filterCard;
      chips.push({ key: "card", label: `Cartão: ${n}`, onClear: () => setFilterCard("all") });
    }
    if (filterHolder !== "all") chips.push({ key: "holder", label: `Portador: ${filterHolder}`, onClear: () => setFilterHolder("all") });
    if (filterCategory !== "all") {
      const labelMap: Record<string, string> = { invest: "💎 Investimento", custeio: "Custo de Vida", investigar: "❓ A Investigar" };
      const lbl = labelMap[filterCategory] || categories.find(c => c.id === filterCategory)?.name || filterCategory;
      chips.push({ key: "cat", label: `Categoria: ${lbl}`, onClear: () => setFilterCategory("all") });
    }
    if (filterVector !== "all") {
      const lbl = VECTOR_LABELS[filterVector]?.label || filterVector;
      chips.push({ key: "vec", label: `Vetor: ${lbl}`, onClear: () => setFilterVector("all") });
    }
    if (minAmount) chips.push({ key: "min", label: `≥ ${money(Number(minAmount))}`, onClear: () => setMinAmount("") });
    if (maxAmount) chips.push({ key: "max", label: `≤ ${money(Number(maxAmount))}`, onClear: () => setMaxAmount("") });
    if (onlyInstallments) chips.push({ key: "parc", label: "Só parceladas", onClear: () => setOnlyInstallments(false) });
    return chips;
  }, [search, filterCard, filterHolder, filterCategory, filterVector, minAmount, maxAmount, onlyInstallments, cardsPresent, categories]);

  const filteredTotal = useMemo(() => filteredTxs.reduce((s, t) => s + Number(t.amount), 0), [filteredTxs]);

  async function handleUpload(file: File, opts?: { cardId?: string; closedAt?: string }) {
    const cardId = opts?.cardId ?? selectedCardId;
    if (!cardId) {
      toast.error("Selecione um cartão primeiro");
      return;
    }
    const format = detectFormat(file.name);
    if (!format) {
      toast.error("Formato inválido (use .ofx, .csv ou .pdf)");
      return;
    }

    setUploading(true);
    setLastResult(null);

    try {
      const file_content = format === "pdf" ? await fileToBase64(file) : await fileToText(file);
      const body: any = { card_id: cardId, file_format: format, file_content };
      if (opts?.closedAt) body.closed_at = opts.closedAt;
      const { data, error } = await supabase.functions.invoke("parse-card-invoice", {
        body,
      });
      if (error) throw error;
      const result = data as ParseResult;
      setLastResult(result);
      if (result.ok) {
        toast.success(
          opts?.closedAt
            ? `Fatura fechada importada: ${result.inserted} novas, ${result.skipped} duplicadas`
            : `Importado: ${result.inserted} novas, ${result.skipped} duplicadas → ${result.reference_month}`
        );
        if (result.reference_month && !opts?.closedAt) setRefMonth(result.reference_month);
        qc.invalidateQueries({ queryKey: ["card_txs"] });
        qc.invalidateQueries({ queryKey: ["card_invoices_closed"] });
      } else {
        toast.error(result.error || "Erro desconhecido");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro");
      setLastResult({ ok: false, error: e.message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#F0F4F8" }}>Cartões</h1>
          <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
            Compras em andamento → análise · Faturas fechadas → conciliação de pagamento.
          </p>
        </div>
        {tab === "in_progress" && (
          <div className="flex items-center gap-3">
            <label className="text-sm" style={{ color: "#94A3B8" }}>Mês-ref (venc.)</label>
            <MonthPicker value={refMonth} onChange={setRefMonth} className="w-44" />
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "in_progress" | "closed")}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="in_progress">Compras em andamento</TabsTrigger>
          <TabsTrigger value="closed">Faturas fechadas</TabsTrigger>
        </TabsList>

        <TabsContent value="in_progress" className="space-y-6 mt-6">

      {/* KPIs topo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard>
          <div className="p-4">
            <div className="text-xs uppercase tracking-wider" style={{ color: "#94A3B8" }}>Total Faturado</div>
            <div className="text-2xl font-bold mt-1" style={{ color: "#C9A84C" }}>{money(kpis.total)}</div>
            <div className="text-xs mt-1" style={{ color: "#94A3B8" }}>{txs.length} transações</div>
          </div>
        </PremiumCard>
        <PremiumCard>
          <div className="p-4">
            <div className="text-xs uppercase tracking-wider" style={{ color: "#94A3B8" }}>💎 Investimento</div>
            <div className="text-2xl font-bold mt-1" style={{ color: "#10B981" }}>{money(kpis.invest)}</div>
            <div className="text-xs mt-1" style={{ color: "#10B981" }}>{kpis.pctInvest.toFixed(1)}% do total</div>
          </div>
        </PremiumCard>
        <PremiumCard>
          <div className="p-4">
            <div className="text-xs uppercase tracking-wider" style={{ color: "#94A3B8" }}>Custo de Vida</div>
            <div className="text-2xl font-bold mt-1" style={{ color: "#F43F5E" }}>{money(kpis.custo)}</div>
            <div className="text-xs mt-1" style={{ color: "#94A3B8" }}>{(100 - kpis.pctInvest).toFixed(1)}% do total</div>
          </div>
        </PremiumCard>
        <PremiumCard>
          <div className="p-4">
            <div className="text-xs uppercase tracking-wider" style={{ color: "#94A3B8" }}>A Investigar</div>
            <div className="text-2xl font-bold mt-1" style={{ color: kpis.semCategoria > 0 ? "#F59E0B" : "#10B981" }}>
              {kpis.semCategoria}
            </div>
            <div className="text-xs mt-1" style={{ color: "#94A3B8" }}>sem categoria</div>
          </div>
        </PremiumCard>
      </div>

      {/* Breakdown por vetor 💎 + por cartão */}
      {txs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PremiumCard>
            <div className="p-4">
              <div className="text-sm font-semibold mb-3" style={{ color: "#F0F4F8" }}>💎 Investimento por vetor</div>
              {Object.keys(kpis.byVector).length === 0 ? (
                <div className="text-sm" style={{ color: "#94A3B8" }}>Nenhum aporte este mês.</div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(kpis.byVector)
                    .sort(([, a], [, b]) => b - a)
                    .map(([vec, val]) => {
                      const meta = VECTOR_LABELS[vec] || { label: vec, emoji: "•" };
                      const pct = kpis.invest > 0 ? (val / kpis.invest) * 100 : 0;
                      return (
                        <div key={vec} className="flex items-center justify-between text-sm" style={{ color: "#F0F4F8" }}>
                          <div>
                            <span className="mr-2">{meta.emoji}</span>
                            <span>{meta.label}</span>
                            <span className="ml-2 text-xs" style={{ color: "#94A3B8" }}>{pct.toFixed(0)}%</span>
                          </div>
                          <div className="font-mono" style={{ color: "#10B981" }}>{money(val)}</div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </PremiumCard>

          <PremiumCard>
            <div className="p-4">
              <div className="text-sm font-semibold mb-3" style={{ color: "#F0F4F8" }}>Por cartão</div>
              {kpis.byCard.length === 0 ? (
                <div className="text-sm" style={{ color: "#94A3B8" }}>Nenhum lançamento.</div>
              ) : (
                <div className="space-y-2">
                  {kpis.byCard
                    .sort((a, b) => b.total - a.total)
                    .map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm" style={{ color: "#F0F4F8" }}>
                        <div>
                          <span>{c.name}</span>
                          <span className="ml-2 text-xs" style={{ color: "#94A3B8" }}>{c.count} tx</span>
                        </div>
                        <div className="font-mono" style={{ color: "#C9A84C" }}>{money(c.total)}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </PremiumCard>
        </div>
      )}

      {/* Upload */}
      <PremiumCard>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: "#F0F4F8" }}>Importar fatura</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm" style={{ color: "#94A3B8" }}>Cartão</label>
              <select
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-black/30 border border-white/10 text-white"
              >
                <option value="">— escolha —</option>
                {cards?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.last4 ? `•••• ${c.last4}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm" style={{ color: "#94A3B8" }}>Arquivo (.ofx / .csv / .pdf)</label>
              <input
                type="file"
                accept=".ofx,.csv,.pdf"
                disabled={uploading || !selectedCardId}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
                className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-yellow-600 file:text-black file:font-semibold hover:file:bg-yellow-500"
              />
            </div>
          </div>
          {uploading && <p className="text-sm" style={{ color: "#C9A84C" }}>⏳ Processando...</p>}
          {lastResult?.ok && (
            <p className="text-sm" style={{ color: "#10B981" }}>
              ✓ Fatura {lastResult.reference_month} · {lastResult.inserted} novas / {lastResult.skipped} dup · {money(lastResult.total_amount || 0)}
            </p>
          )}
          {lastResult && !lastResult.ok && (
            <p className="text-sm text-red-400">❌ {lastResult.error}</p>
          )}
        </div>
      </PremiumCard>

      {/* Grid de transações do mês-ref */}
      <PremiumCard>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "#F0F4F8" }}>
              <Filter className="w-4 h-4" style={{ color: "#C9A84C" }} />
              Transações — {refMonth}
            </h2>
            <div className="text-sm flex items-center gap-3" style={{ color: "#94A3B8" }}>
              {loadingTxs ? "Carregando..." : (
                <>
                  <span>
                    <span style={{ color: "#F0F4F8", fontWeight: 600 }}>{filteredTxs.length}</span>
                    {filteredTxs.length !== txs.length && <span> de {txs.length}</span>} lançamentos
                  </span>
                  <span className="font-mono" style={{ color: "#C9A84C" }}>{money(filteredTotal)}</span>
                </>
              )}
            </div>
          </div>

          {/* Barra de filtros */}
          {txs.length > 0 && (
            <div className="mb-4 space-y-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                <Input
                  placeholder="🔍 Buscar descrição / merchant..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 text-xs"
                  style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
                />
                <Select value={filterCard} onValueChange={setFilterCard}>
                  <SelectTrigger className="h-9 text-xs" style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                    <SelectValue placeholder="Cartão" />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                    <SelectItem value="all" className="text-xs" style={{ color: "#E2E8F0" }}>Todos cartões</SelectItem>
                    {cardsPresent.map(([id, name]) => (
                      <SelectItem key={id} value={id} className="text-xs" style={{ color: "#E2E8F0" }}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterHolder} onValueChange={setFilterHolder}>
                  <SelectTrigger className="h-9 text-xs" style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                    <SelectValue placeholder="Portador" />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                    <SelectItem value="all" className="text-xs" style={{ color: "#E2E8F0" }}>Todos portadores</SelectItem>
                    {holders.map(h => (
                      <SelectItem key={h} value={h} className="text-xs" style={{ color: "#E2E8F0" }}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-9 text-xs" style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]" style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                    <SelectItem value="all" className="text-xs" style={{ color: "#E2E8F0" }}>Todas categorias</SelectItem>
                    <SelectSeparator style={{ background: "#1A2535" }} />
                    <SelectItem value="invest" className="text-xs" style={{ color: "#10B981" }}>💎 Todos investimentos</SelectItem>
                    <SelectItem value="custeio" className="text-xs" style={{ color: "#E2E8F0" }}>Todos custeio</SelectItem>
                    <SelectItem value="investigar" className="text-xs" style={{ color: "#F59E0B" }}>❓ A Investigar</SelectItem>
                    <SelectSeparator style={{ background: "#1A2535" }} />
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase tracking-widest" style={{ color: "#10B981" }}>💎 Investimento</SelectLabel>
                      {categories.filter(c => c.counts_as_investment).map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs" style={{ color: "#10B981" }}>{c.emoji} {c.name}</SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator style={{ background: "#1A2535" }} />
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase tracking-widest" style={{ color: "#94A3B8" }}>Custeio</SelectLabel>
                      {categories.filter(c => !c.counts_as_investment && c.slug !== "a_investigar").map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs" style={{ color: "#E2E8F0" }}>{c.emoji} {c.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                <Select value={filterVector} onValueChange={setFilterVector}>
                  <SelectTrigger className="h-9 text-xs" style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                    <SelectValue placeholder="Vetor" />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                    <SelectItem value="all" className="text-xs" style={{ color: "#E2E8F0" }}>Todos vetores</SelectItem>
                    {vectorsPresent.map(v => {
                      const meta = VECTOR_LABELS[v] || { label: v, emoji: "•" };
                      return (
                        <SelectItem key={v} value={v} className="text-xs" style={{ color: "#10B981" }}>
                          {meta.emoji} {meta.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Valor mín."
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="h-9 text-xs"
                  style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
                />
                <Input
                  type="number"
                  placeholder="Valor máx."
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="h-9 text-xs"
                  style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
                />
                <label className="flex items-center gap-2 text-xs px-2 h-9 rounded-md cursor-pointer" style={{ background: "#080C10", border: "1px solid #1A2535", color: "#E2E8F0" }}>
                  <input
                    type="checkbox"
                    checked={onlyInstallments}
                    onChange={(e) => setOnlyInstallments(e.target.checked)}
                    className="accent-yellow-600"
                  />
                  Só parceladas
                </label>
                {activeFilters.length > 0 && (
                  <button
                    onClick={clearFilters}
                    className="h-9 px-3 rounded-md text-xs font-medium transition-colors"
                    style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", color: "#F43F5E" }}
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeFilters.map(chip => (
                    <button
                      key={chip.key}
                      onClick={chip.onClear}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors hover:opacity-80"
                      style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C" }}
                    >
                      {chip.label}
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {txs.length === 0 && !loadingTxs && (
            <div className="text-sm py-8 text-center" style={{ color: "#94A3B8" }}>
              Nenhuma transação neste mês. Importe uma fatura acima.
            </div>
          )}

          {txs.length > 0 && filteredTxs.length === 0 && (
            <div className="text-sm py-8 text-center" style={{ color: "#94A3B8" }}>
              Nenhum resultado com os filtros atuais.
            </div>
          )}

          {filteredTxs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10" style={{ color: "#94A3B8" }}>
                    <th className="text-left py-2 px-2 cursor-pointer select-none" onClick={() => toggleSort("date")}>
                      <span className="inline-flex items-center gap-1">Data {sortBy === "date" && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</span>
                    </th>
                    <th className="text-left py-2 px-2 cursor-pointer select-none" onClick={() => toggleSort("description")}>
                      <span className="inline-flex items-center gap-1">Descrição {sortBy === "description" && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</span>
                    </th>
                    <th className="text-left py-2 px-2">Cartão</th>
                    <th className="text-left py-2 px-2">Portador</th>
                    <th className="text-left py-2 px-2">Categoria</th>
                    <th className="text-center py-2 px-2">Parc</th>
                    <th className="text-right py-2 px-2 cursor-pointer select-none" onClick={() => toggleSort("amount")}>
                      <span className="inline-flex items-center gap-1 justify-end w-full">Valor {sortBy === "amount" && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTxs.map((t) => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5" style={{ color: "#F0F4F8" }}>
                      <td className="py-2 px-2 whitespace-nowrap">{t.transaction_date}</td>
                      <td className="py-2 px-2">{t.description}</td>
                      <td className="py-2 px-2 text-xs" style={{ color: "#94A3B8" }}>
                        {t.cards?.bank || "—"}
                      </td>
                      <td className="py-2 px-2 text-xs" style={{ color: "#94A3B8" }}>
                        {t.cardholder || "—"}
                      </td>
                      <td className="py-2 px-2">
                        <CategoryPicker
                          tx={t}
                          categories={categories}
                          disabled={reclassify.isPending}
                          onChange={(cat) => reclassify.mutate({ tx: t, category: cat })}
                        />
                      </td>
                      <td className="py-2 px-2 text-center text-xs">
                        {t.installment_total > 1 ? `${t.installment_current}/${t.installment_total}` : "—"}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{money(Number(t.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PremiumCard>
        </TabsContent>

        {/* ════════════════ ABA 2 — FATURAS FECHADAS ════════════════ */}
        <TabsContent value="closed" className="space-y-6 mt-6">
          <PremiumCard>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "#F0F4F8" }}>
                  <FileText className="w-4 h-4" style={{ color: "#C9A84C" }} />
                  Faturas fechadas
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm" style={{ color: "#94A3B8" }}>
                    {closedInvoices.length} fatura{closedInvoices.length !== 1 ? "s" : ""}
                  </span>
                  <Button
                    onClick={() => setClosedUploadOpen(true)}
                    size="sm"
                    style={{ background: "#C9A84C", color: "#000" }}
                    className="hover:opacity-90"
                  >
                    + Importar fatura fechada
                  </Button>
                </div>
              </div>

              {closedInvoices.length === 0 ? (
                <div className="text-sm py-8 text-center" style={{ color: "#94A3B8" }}>
                  Nenhuma fatura fechada ainda. Faturas com <span style={{ color: "#C9A84C" }}>closed_at</span> preenchido aparecem aqui.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10" style={{ color: "#94A3B8" }}>
                        <th className="text-left py-2 px-2">Cartão</th>
                        <th className="text-left py-2 px-2">Ref. mês</th>
                        <th className="text-right py-2 px-2">Total</th>
                        <th className="text-center py-2 px-2">Status</th>
                        <th className="text-left py-2 px-2">Fechou</th>
                        <th className="text-left py-2 px-2">Pago em</th>
                        <th className="text-right py-2 px-2">Valor pago</th>
                        <th className="text-center py-2 px-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedInvoices.map((inv) => {
                        const isPaid = !!inv.paid_at;
                        const isReconciled = !!inv.bank_tx_id;
                        const statusColor = isPaid ? "#10B981" : "#F59E0B";
                        const statusLabel = isPaid ? "✓ pago" : "⏳ a pagar";
                        return (
                          <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5" style={{ color: "#F0F4F8" }}>
                            <td className="py-2 px-2">
                              {inv.cards?.name ?? "—"}
                              {isReconciled && (
                                <Zap className="inline-block w-3 h-3 ml-2" style={{ color: "#10B981" }} aria-label="Conciliado com extrato" />
                              )}
                            </td>
                            <td className="py-2 px-2 font-mono text-xs">{inv.reference_month}</td>
                            <td className="py-2 px-2 text-right font-mono">{money(Number(inv.total_amount))}</td>
                            <td className="py-2 px-2 text-center text-xs font-medium" style={{ color: statusColor }}>
                              {statusLabel}
                            </td>
                            <td className="py-2 px-2 text-xs" style={{ color: "#94A3B8" }}>
                              {inv.closed_at ? new Date(inv.closed_at).toLocaleDateString("pt-BR") : "—"}
                            </td>
                            <td className="py-2 px-2 text-xs" style={{ color: "#94A3B8" }}>
                              {inv.paid_at ? new Date(inv.paid_at + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-xs" style={{ color: isPaid ? "#10B981" : "#94A3B8" }}>
                              {inv.paid_amount ? money(Number(inv.paid_amount)) : "—"}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {!isPaid && (
                                <button
                                  onClick={() => setPayDialogInv(inv)}
                                  className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                                  style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981" }}
                                >
                                  Marcar pago
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </PremiumCard>
        </TabsContent>
      </Tabs>

      {/* Dialog: marcar fatura como paga */}
      <PayInvoiceDialog
        invoice={payDialogInv}
        open={!!payDialogInv}
        onClose={() => setPayDialogInv(null)}
        onSubmit={(paid_at, paid_amount) => {
          if (payDialogInv) markPaid.mutate({ invId: payDialogInv.id, paid_at, paid_amount });
        }}
        isPending={markPaid.isPending}
      />

      {/* Dialog: importar fatura fechada (Aba 2) */}
      <ClosedInvoiceUploadDialog
        open={closedUploadOpen}
        onClose={() => setClosedUploadOpen(false)}
        cards={cards ?? []}
        onUpload={(file, cardId, closedAt) => handleUpload(file, { cardId, closedAt })}
        uploading={uploading}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ClosedInvoiceUploadDialog — upload de fatura fechada (Aba 2)
// Aba "Compras em andamento" sobe sem closed_at (in_progress).
// Aba "Faturas fechadas" sobe COM closed_at (cria invoice já fechada).
// ═══════════════════════════════════════════════════════════════════

interface ClosedUploadProps {
  open: boolean;
  onClose: () => void;
  cards: Card[];
  onUpload: (file: File, cardId: string, closedAt: string) => void;
  uploading: boolean;
}

function ClosedInvoiceUploadDialog({ open, onClose, cards, onUpload, uploading }: ClosedUploadProps) {
  const today = new Date().toISOString().split("T")[0];
  const [cardId, setCardId] = useState("");
  const [closedAt, setClosedAt] = useState(today);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      setCardId("");
      setClosedAt(today);
      setFile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSubmit() {
    if (!file || !cardId || !closedAt) {
      toast.error("Preencha cartão, arquivo e data de fechamento");
      return;
    }
    onUpload(file, cardId, closedAt);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ background: "#0D1318", border: "1px solid rgba(201,168,76,0.4)" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#C9A84C" }}>
            Importar fatura fechada
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            Sobe a fatura definitiva (PDF/OFX/CSV) — vai criar invoice com <span style={{ color: "#C9A84C" }}>closed_at</span> preenchido.
            Pra fatura em andamento (consumindo ainda), use a aba <span style={{ color: "#C9A84C" }}>Compras em andamento</span>.
          </p>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider" style={{ color: "#94A3B8" }}>Cartão</label>
            <select
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-black/30 border border-white/10 text-white"
            >
              <option value="">— escolha —</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.last4 ? `•••• ${c.last4}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider" style={{ color: "#94A3B8" }}>Data de fechamento</label>
            <Input type="date" value={closedAt} onChange={(e) => setClosedAt(e.target.value)} className="h-9" />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider" style={{ color: "#94A3B8" }}>Arquivo (.ofx / .csv / .pdf)</label>
            <input
              type="file"
              accept=".ofx,.csv,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-yellow-600 file:text-black file:font-semibold hover:file:bg-yellow-500"
            />
            {file && (
              <p className="text-xs" style={{ color: "#10B981" }}>✓ {file.name}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={uploading || !file || !cardId || !closedAt}
            style={{ background: "#C9A84C", color: "#000" }}
          >
            {uploading ? "Processando..." : "Importar fatura fechada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PayInvoiceDialog — modal pra marcar fatura como paga
// ═══════════════════════════════════════════════════════════════════

interface PayInvoiceDialogProps {
  invoice: ClosedInvoice | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (paid_at: string, paid_amount: number) => void;
  isPending: boolean;
}

function PayInvoiceDialog({ invoice, open, onClose, onSubmit, isPending }: PayInvoiceDialogProps) {
  const today = new Date().toISOString().split("T")[0];
  const [paidAt, setPaidAt] = useState(today);
  const [paidAmount, setPaidAmount] = useState("");

  // Quando abre o dialog, pré-preenche com total_amount
  useEffect(() => {
    if (invoice) {
      setPaidAmount(String(Number(invoice.total_amount).toFixed(2)));
      setPaidAt(today);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id]);

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ background: "#0D1318", border: "1px solid rgba(16,185,129,0.4)" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#10B981" }}>
            Marcar fatura como paga
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm" style={{ color: "#94A3B8" }}>
            <span className="font-mono">{invoice.cards?.name}</span> · ref {invoice.reference_month} · total{" "}
            <span className="font-mono" style={{ color: "#C9A84C" }}>{`R$ ${Number(invoice.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider" style={{ color: "#94A3B8" }}>Data do pagamento</label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="h-9" />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider" style={{ color: "#94A3B8" }}>Valor pago (R$)</label>
            <Input type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="h-9" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onSubmit(paidAt, Number(paidAmount))}
            disabled={isPending || !paidAt || !paidAmount}
            style={{ background: "#10B981", color: "#000" }}
          >
            {isPending ? "Salvando..." : "Marcar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CategoryPicker — dropdown moderno com shadcn Select
// ═══════════════════════════════════════════════════════════════════

interface CategoryPickerProps {
  tx: Tx;
  categories: Category[];
  disabled: boolean;
  onChange: (cat: Category) => void;
}

function CategoryPicker({ tx, categories, disabled, onChange }: CategoryPickerProps) {
  const current = tx.custom_categories;
  const isInvest = !!tx.counts_as_investment;
  const isInvestigar = current?.slug === "a_investigar" || !current;

  const invests = categories.filter(c => c.counts_as_investment);
  const custeios = categories.filter(c => !c.counts_as_investment && c.slug !== "a_investigar");
  const aInv = categories.find(c => c.slug === "a_investigar");

  // Cor da trigger: verde se 💎, âmbar se a investigar, cinza-claro caso contrário
  const triggerColor = isInvest ? "#10B981" : isInvestigar ? "#F59E0B" : "#E2E8F0";
  const triggerBorder = isInvest ? "rgba(16,185,129,0.35)" : isInvestigar ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.08)";
  const triggerBg = isInvest ? "rgba(16,185,129,0.08)" : isInvestigar ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)";

  return (
    <Select
      value={tx.category_id || ""}
      disabled={disabled}
      onValueChange={(id) => {
        const cat = categories.find(c => c.id === id);
        if (cat) onChange(cat);
      }}
    >
      <SelectTrigger
        className="h-8 text-xs min-w-[180px] max-w-[240px] gap-1 px-2.5 py-1 rounded-md transition-colors hover:opacity-80"
        style={{ background: triggerBg, border: `1px solid ${triggerBorder}`, color: triggerColor }}
      >
        <SelectValue placeholder="— categoria —">
          {current ? (
            <span className="inline-flex items-center gap-1.5 truncate">
              <span>{current.emoji}</span>
              <span className="truncate font-medium">{current.name}</span>
              {isInvest && <Gem className="w-3 h-3 shrink-0" style={{ color: "#10B981" }} />}
            </span>
          ) : (
            <span style={{ color: "#F59E0B" }}>❓ A Investigar</span>
          )}
        </SelectValue>
      </SelectTrigger>

      <SelectContent
        className="max-h-[400px]"
        style={{ background: "#0D1318", border: "1px solid #1A2535" }}
      >
        {invests.length > 0 && (
          <SelectGroup>
            <SelectLabel
              className="text-[10px] uppercase tracking-widest font-mono py-1.5 px-2 flex items-center gap-1"
              style={{ color: "#10B981" }}
            >
              <Gem className="w-3 h-3" /> Investimento (conta pra Sobra)
            </SelectLabel>
            {invests.map(c => (
              <SelectItem
                key={c.id}
                value={c.id}
                className="text-xs cursor-pointer focus:bg-emerald-500/10"
                style={{ color: "#10B981" }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{c.emoji}</span>
                  <span>{c.name}</span>
                  {c.vector && (
                    <span className="ml-1 text-[9px] opacity-60 font-mono">· {c.vector}</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        <SelectSeparator style={{ background: "#1A2535" }} />

        {custeios.length > 0 && (
          <SelectGroup>
            <SelectLabel
              className="text-[10px] uppercase tracking-widest font-mono py-1.5 px-2"
              style={{ color: "#94A3B8" }}
            >
              Custo de Vida
            </SelectLabel>
            {custeios.map(c => (
              <SelectItem
                key={c.id}
                value={c.id}
                className="text-xs cursor-pointer focus:bg-white/5"
                style={{ color: "#E2E8F0" }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{c.emoji}</span>
                  <span>{c.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {aInv && (
          <>
            <SelectSeparator style={{ background: "#1A2535" }} />
            <SelectItem
              value={aInv.id}
              className="text-xs cursor-pointer focus:bg-amber-500/10"
              style={{ color: "#F59E0B" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <span>{aInv.emoji}</span>
                <span>{aInv.name}</span>
              </span>
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
