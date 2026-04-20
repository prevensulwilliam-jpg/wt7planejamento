import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { toast } from "sonner";

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
  const [refMonth, setRefMonth] = useState<string>(currentRefMonth());
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<ParseResult | null>(null);

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

  async function handleUpload(file: File) {
    if (!selectedCardId) {
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
      const { data, error } = await supabase.functions.invoke("parse-card-invoice", {
        body: { card_id: selectedCardId, file_format: format, file_content },
      });
      if (error) throw error;
      const result = data as ParseResult;
      setLastResult(result);
      if (result.ok) {
        toast.success(`Importado: ${result.inserted} novas, ${result.skipped} duplicadas → ${result.reference_month}`);
        if (result.reference_month) setRefMonth(result.reference_month);
        qc.invalidateQueries({ queryKey: ["card_txs"] });
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
            Consolidação BB + XP do mês de vencimento selecionado.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm" style={{ color: "#94A3B8" }}>Mês-ref (venc.)</label>
          <MonthPicker value={refMonth} onChange={setRefMonth} className="w-44" />
        </div>
      </div>

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "#F0F4F8" }}>
              Transações — {refMonth}
            </h2>
            <span className="text-sm" style={{ color: "#94A3B8" }}>
              {loadingTxs ? "Carregando..." : `${txs.length} lançamentos`}
            </span>
          </div>

          {txs.length === 0 && !loadingTxs && (
            <div className="text-sm py-8 text-center" style={{ color: "#94A3B8" }}>
              Nenhuma transação neste mês. Importe uma fatura acima.
            </div>
          )}

          {txs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10" style={{ color: "#94A3B8" }}>
                    <th className="text-left py-2 px-2">Data</th>
                    <th className="text-left py-2 px-2">Descrição</th>
                    <th className="text-left py-2 px-2">Cartão</th>
                    <th className="text-left py-2 px-2">Portador</th>
                    <th className="text-left py-2 px-2">Categoria</th>
                    <th className="text-center py-2 px-2">Parc</th>
                    <th className="text-right py-2 px-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((t) => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5" style={{ color: "#F0F4F8" }}>
                      <td className="py-2 px-2 whitespace-nowrap">{t.transaction_date}</td>
                      <td className="py-2 px-2">{t.description}</td>
                      <td className="py-2 px-2 text-xs" style={{ color: "#94A3B8" }}>
                        {t.cards?.bank || "—"}
                      </td>
                      <td className="py-2 px-2 text-xs" style={{ color: "#94A3B8" }}>
                        {t.cardholder || "—"}
                      </td>
                      <td className="py-2 px-2 text-xs">
                        <div className="flex items-center gap-1">
                          <select
                            value={t.category_id || ""}
                            disabled={reclassify.isPending}
                            onChange={(e) => {
                              const cat = categories.find(c => c.id === e.target.value);
                              if (cat) reclassify.mutate({ tx: t, category: cat });
                            }}
                            className="bg-black/30 border border-white/10 rounded px-1 py-0.5 text-xs max-w-[200px]"
                            style={{
                              color: t.counts_as_investment ? "#10B981" : (t.custom_categories?.slug === "a_investigar" ? "#F59E0B" : "#F0F4F8"),
                            }}
                          >
                            <option value="" disabled>— categoria —</option>
                            <optgroup label="💎 Investimento">
                              {categories.filter(c => c.counts_as_investment).map(c => (
                                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Custo de Vida">
                              {categories.filter(c => !c.counts_as_investment && c.slug !== "a_investigar").map(c => (
                                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                              ))}
                            </optgroup>
                            <optgroup label="—">
                              {categories.filter(c => c.slug === "a_investigar").map(c => (
                                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                              ))}
                            </optgroup>
                          </select>
                          {t.counts_as_investment && <span style={{ color: "#10B981" }}>💎</span>}
                        </div>
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
    </div>
  );
}
