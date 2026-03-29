import { useState, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBankTransactions, useImportTransactions, useMatchTransaction, useIgnoreTransaction, useReconciliationSummary } from "@/hooks/useBankReconciliation";
import { parseOFX, parseCSV, type ParsedTransaction } from "@/lib/parseOFX";
import { categorizeTransaction, CATEGORY_LABELS, INTENT_CONFIG } from "@/lib/categorizeTransaction";
import { formatCurrency, formatDate, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { Upload, CheckCircle2, XCircle, ArrowLeftRight, FileText, Wifi, Download } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const PIE_COLORS = ["#C9A84C", "#2DD4BF", "#8B5CF6", "#F43F5E", "#10B981", "#3B82F6", "#F59E0B", "#EC4899", "#6366F1", "#14B8A6"];

export default function ReconciliationPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  const { data: accounts = [] } = useQuery({
    queryKey: ["bank_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*");
      if (error) throw error;
      return data;
    },
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: "#F0F4F8" }}>
            <ArrowLeftRight className="inline w-6 h-6 mr-2" style={{ color: "#C9A84C" }} />
            Conciliação Bancária
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
            Importe extratos OFX/CSV e concilie com receitas e despesas
          </p>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-48" style={{ background: "#0D1318", borderColor: "#1A2535", color: "#F0F4F8" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent style={{ background: "#0D1318", borderColor: "#1A2535" }}>
            {months.map(m => (
              <SelectItem key={m} value={m} style={{ color: "#F0F4F8" }}>{formatMonth(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList style={{ background: "#0D1318", borderColor: "#1A2535" }}>
          <TabsTrigger value="import" className="data-[state=active]:text-[#C9A84C]">
            <Upload className="w-4 h-4 mr-1" /> Importar
          </TabsTrigger>
          <TabsTrigger value="reconcile" className="data-[state=active]:text-[#C9A84C]">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Conciliar
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:text-[#C9A84C]">
            <FileText className="w-4 h-4 mr-1" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <ImportTab accounts={accounts} />
        </TabsContent>
        <TabsContent value="reconcile">
          <ReconcileTab month={month} accounts={accounts} statusFilter={statusFilter} setStatusFilter={setStatusFilter} accountFilter={accountFilter} setAccountFilter={setAccountFilter} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab month={month} accounts={accounts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============ IMPORT TAB ============ */
function ImportTab({ accounts }: { accounts: any[] }) {
  const [selectedAccount, setSelectedAccount] = useState("");
  const [preview, setPreview] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportTransactions();

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const ext = file.name.toLowerCase();
      let parsed: ParsedTransaction[] = [];
      if (ext.endsWith(".ofx")) {
        parsed = parseOFX(text);
      } else {
        parsed = parseCSV(text);
      }
      if (parsed.length === 0) {
        toast.error("Nenhuma transação encontrada no arquivo.");
        return;
      }
      const accountNames = accounts.map((a: any) => a.bank_name).filter(Boolean);
      const categorized = parsed.map((tx, idx) => {
        const result = categorizeTransaction(tx.description, tx.type, tx.amount, accountNames);
        return {
          ...tx,
          _previewId: `preview-${idx}`,
          category_suggestion: result.category,
          category_intent: result.intent,
          category_confidence: result.confidence,
          category_label: result.label,
          status: result.confidence === "high" && result.intent !== "duvida"
            ? "auto_categorized"
            : result.intent === "transferencia"
            ? "transferencia"
            : "pending",
        };
      });
      setPreview(categorized);
    };
    reader.readAsText(file, "latin1");
  }, [accounts]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const doImport = async () => {
    if (!selectedAccount) { toast.error("Selecione uma conta bancária."); return; }
    if (!preview.length) { toast.error("Selecione um arquivo primeiro."); return; }

    const rows = preview.map(tx => ({
      external_id: tx.external_id,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      source: tx.source,
      bank_account_id: selectedAccount,
      category_suggestion: tx.category_suggestion,
      category_intent: tx.category_intent,
      category_confidence: tx.category_confidence,
      category_label: tx.category_label,
      status: tx.category_intent === "transferencia" ? "ignored" : tx.status,
      raw_data: null,
    }));

    try {
      const result = await importMutation.mutateAsync(rows);
      const transfers = rows.filter(r => r.category_intent === "transferencia").length;
      const autoOk = rows.filter(r => r.status === "auto_categorized").length;
      const doubts = rows.filter(r => r.category_intent === "duvida").length;
      toast.success(
        `✅ Importado! ${autoOk} prontas para confirmar · ${doubts} com dúvidas · ${transfers} transferências ignoradas`
      );
      setPreview([]);
      setFileName("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar.");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PremiumCard>
        <h2 className="font-display font-semibold text-lg mb-4" style={{ color: "#F0F4F8" }}>
          <Upload className="inline w-5 h-5 mr-2" style={{ color: "#C9A84C" }} />
          Importar Extrato Bancário
        </h2>
        <p className="text-sm mb-4" style={{ color: "#94A3B8" }}>
          Banco do Brasil, Ailos, XP — baixe o extrato OFX ou CSV no internet banking
        </p>

        <div className="mb-4">
          <label className="text-xs font-mono uppercase" style={{ color: "#94A3B8" }}>Conta bancária</label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="mt-1" style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }}>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent style={{ background: "#0D1318", borderColor: "#1A2535" }}>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id} style={{ color: "#F0F4F8" }}>
                  {a.bank_name} — {a.account_type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-[#C9A84C]/50"
          style={{ borderColor: "#1A2535", background: "#080C10" }}
        >
          <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: "#4A5568" }} />
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            {fileName || "Arraste o arquivo .ofx ou .csv aqui, ou clique para selecionar"}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".ofx,.csv,.txt"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        {preview.length > 0 && (
          <div className="mt-4 space-y-3">
            {/* Resumo por intent */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Receitas", count: preview.filter(t => t.category_intent === "receita").length, color: "#10B981" },
                { label: "Despesas", count: preview.filter(t => t.category_intent === "despesa").length, color: "#F43F5E" },
                { label: "Transferências", count: preview.filter(t => t.category_intent === "transferencia").length, color: "#94A3B8" },
                { label: "Dúvidas", count: preview.filter(t => t.category_intent === "duvida").length, color: "#F59E0B" },
              ].map(({ label, count, color }) => (
                <div key={label} className="rounded-lg p-3 text-center" style={{ background: "#0D1318", border: `1px solid ${color}33` }}>
                  <p className="font-display font-bold text-xl" style={{ color }}>{count}</p>
                  <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Lista categorizada */}
            <div className="max-h-80 overflow-y-auto rounded-xl" style={{ border: "1px solid #1A2535" }}>
              {preview.map((tx) => {
                const intentColors: Record<string, string> = {
                  receita: "#10B981", despesa: "#F43F5E",
                  transferencia: "#94A3B8", duvida: "#F59E0B"
                };
                const color = intentColors[tx.category_intent] ?? "#94A3B8";
                return (
                  <div key={tx._previewId} className="flex items-center justify-between px-4 py-2.5"
                    style={{ borderBottom: "1px solid #1A2535" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <div className="min-w-0">
                        <p className="text-xs truncate" style={{ color: "#F0F4F8" }}>{tx.description}</p>
                        <p className="text-xs" style={{ color: "#64748B" }}>
                          {tx.date} · {tx.category_label}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-mono font-bold ml-3 flex-shrink-0"
                      style={{ color: tx.type === "credit" ? "#10B981" : "#F43F5E" }}>
                      {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Botão importar */}
            <GoldButton onClick={doImport} disabled={importMutation.isPending} className="w-full justify-center">
              {importMutation.isPending
                ? "Importando..."
                : `Importar ${preview.length} transações`}
            </GoldButton>
          </div>
        )}

        <Accordion type="single" collapsible className="mt-4">
          <AccordionItem value="instructions" style={{ borderColor: "#1A2535" }}>
            <AccordionTrigger className="text-sm" style={{ color: "#94A3B8" }}>
              Como baixar o extrato?
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-2" style={{ color: "#4A5568" }}>
              <p>🏦 <strong style={{ color: "#94A3B8" }}>Banco do Brasil</strong> → Internet Banking → Extrato → Exportar OFX</p>
              <p>🏦 <strong style={{ color: "#94A3B8" }}>Ailos</strong> → Internet Banking → Extrato → Baixar CSV</p>
              <p>🏦 <strong style={{ color: "#94A3B8" }}>XP</strong> → App XP → Extrato → Exportar</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </PremiumCard>

      <PremiumCard>
        <div className="flex items-center gap-2 mb-4">
          <Wifi className="w-5 h-5" style={{ color: "#2DD4BF" }} />
          <h2 className="font-display font-semibold text-lg" style={{ color: "#F0F4F8" }}>
            Conexão Automática (Open Finance)
          </h2>
          <WtBadge variant="gold">Em breve</WtBadge>
        </div>
        <p className="text-sm mb-4" style={{ color: "#94A3B8" }}>
          Conecte seu banco e o WT7 importa automaticamente a cada 24h via Pluggy
        </p>
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: "#10B981" }}>✅</span>
            <span style={{ color: "#F0F4F8" }}>Banco do Brasil</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: "#10B981" }}>✅</span>
            <span style={{ color: "#F0F4F8" }}>XP Investimentos</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: "#F59E0B" }}>⚠️</span>
            <span style={{ color: "#F0F4F8" }}>Ailos</span>
            <span className="text-xs" style={{ color: "#4A5568" }}>(parcial)</span>
          </div>
        </div>
        <div className="rounded-lg p-3 text-sm" style={{ background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.2)", color: "#2DD4BF" }}>
          Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nos secrets do projeto para ativar.
        </div>
      </PremiumCard>
    </div>
  );
}

/* ============ RECONCILE TAB ============ */
function ReconcileTab({ month, accounts, statusFilter, setStatusFilter, accountFilter, setAccountFilter }: {
  month: string; accounts: any[]; statusFilter: string; setStatusFilter: (v: string) => void; accountFilter: string; setAccountFilter: (v: string) => void;
}) {
  const queryClient = useQueryClient();
  const summary = useReconciliationSummary(month);
  const { data: allTransactions = [], isLoading } = useBankTransactions({ month });
  const matchMutation = useMatchTransaction();
  const ignoreMutation = useIgnoreTransaction();

  const recategorizeMutation = useMutation({
    mutationFn: async () => {
      const { data: txs } = await supabase
        .from("bank_transactions" as any)
        .select("*")
        .in("status", ["pending", "matched", "auto_categorized"]);

      if (!txs?.length) return { updated: 0 };

      let updated = 0;
      for (const tx of txs as any[]) {
        const result = categorizeTransaction(
          tx.description, tx.type, tx.amount, []
        );
        const newStatus = result.confidence === "high" && result.intent !== "duvida"
          ? "auto_categorized"
          : result.intent === "transferencia"
          ? "ignored"
          : "pending";

        await supabase
          .from("bank_transactions" as any)
          .update({
            category_suggestion: result.category,
            category_intent: result.intent,
            category_confidence: result.confidence,
            category_label: result.label,
            status: newStatus,
          })
          .eq("id", tx.id);
        updated++;
      }
      return { updated };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
      toast.success(`${result?.updated} transações recategorizadas!`);
    },
    onError: () => toast.error("Erro ao recategorizar."),
  });

  // Filter groups
  const doubts = allTransactions.filter((t: any) => t.category_intent === "duvida" && t.status === "pending");
  const transfers = allTransactions.filter((t: any) => t.category_intent === "transferencia");
  const autoCategorized = allTransactions.filter((t: any) => t.status === "auto_categorized");
  const matched = allTransactions.filter((t: any) => t.status === "matched");

  const classifyAs = async (id: string, intent: "receita" | "despesa" | "transferencia", category: string) => {
    const tx = allTransactions.find((t: any) => t.id === id);
    if (!tx) return;

    try {
      if (intent === "transferencia") {
        await ignoreMutation.mutateAsync(id);
        toast.info("Transferência entre contas — ignorada.");
        return;
      }

      await matchMutation.mutateAsync({ id, category, intent });

      if (intent === "receita") {
        await supabase.from("revenues").insert({
          source: category,
          description: tx.description,
          amount: tx.amount,
          type: "variable",
          reference_month: tx.date?.slice(0, 7),
          received_at: tx.date,
        });
        toast.success(`Receita criada: ${formatCurrency(tx.amount)} em ${CATEGORY_LABELS[category] || category}`);
      }

      if (intent === "despesa") {
        await supabase.from("expenses").insert({
          category,
          description: tx.description,
          amount: tx.amount,
          type: "variable",
          reference_month: tx.date?.slice(0, 7),
          paid_at: tx.date,
        });
        toast.success(`Despesa criada: ${formatCurrency(tx.amount)} em ${CATEGORY_LABELS[category] || category}`);
      }
    } catch {
      toast.error("Erro ao classificar transação.");
    }
  };

  const confirmAllAuto = async () => {
    let revenues = 0;
    let expenses = 0;

    try {
      for (const tx of autoCategorized) {
        const intent = tx.category_intent as string;
        const category = tx.category_suggestion as string;

        await matchMutation.mutateAsync({ id: tx.id, category, intent });

        if (intent === "receita") {
          await supabase.from("revenues").insert({
            source: category,
            description: tx.description,
            amount: tx.amount,
            type: "variable",
            reference_month: tx.date?.slice(0, 7),
            received_at: tx.date,
          });
          revenues++;
        } else if (intent === "despesa") {
          await supabase.from("expenses").insert({
            category,
            description: tx.description,
            amount: tx.amount,
            type: "variable",
            reference_month: tx.date?.slice(0, 7),
            paid_at: tx.date,
          });
          expenses++;
        }
      }
      toast.success(`${revenues} receitas e ${expenses} despesas criadas automaticamente!`);
    } catch {
      toast.error("Erro ao confirmar em lote.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Recategorizar */}
      <div className="flex justify-end">
        <button
          onClick={() => recategorizeMutation.mutate()}
          disabled={recategorizeMutation.isPending}
          className="text-xs px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all"
          style={{ background: "rgba(201,168,76,0.15)", color: "#E8C97A", border: "1px solid rgba(201,168,76,0.3)" }}>
          {recategorizeMutation.isPending ? "Recategorizando..." : "🔄 Recategorizar todas"}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Com Dúvidas" value={summary.doubts} color="gold" compact />
        <KpiCard label="Auto-categorizado" value={summary.autoCategorized} color="cyan" compact />
        <KpiCard label="Transferências" value={summary.transfers} color="gray" compact />
        <KpiCard label="Conciliados" value={summary.matched} color="green" compact />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" style={{ background: "#0D1318", borderColor: "#1A2535", color: "#F0F4F8" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent style={{ background: "#0D1318", borderColor: "#1A2535" }}>
            <SelectItem value="all" style={{ color: "#F0F4F8" }}>Todos</SelectItem>
            <SelectItem value="pending" style={{ color: "#F0F4F8" }}>Pendentes</SelectItem>
            <SelectItem value="auto_categorized" style={{ color: "#F0F4F8" }}>Auto-categorizado</SelectItem>
            <SelectItem value="matched" style={{ color: "#F0F4F8" }}>Conciliados</SelectItem>
            <SelectItem value="ignored" style={{ color: "#F0F4F8" }}>Ignorados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-48" style={{ background: "#0D1318", borderColor: "#1A2535", color: "#F0F4F8" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent style={{ background: "#0D1318", borderColor: "#1A2535" }}>
            <SelectItem value="all" style={{ color: "#F0F4F8" }}>Todas as contas</SelectItem>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id} style={{ color: "#F0F4F8" }}>{a.bank_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" style={{ background: "#1A2535" }} />)}
        </div>
      ) : allTransactions.length === 0 ? (
        <PremiumCard>
          <div className="text-center py-12">
            <ArrowLeftRight className="w-12 h-12 mx-auto mb-3" style={{ color: "#1A2535" }} />
            <p style={{ color: "#94A3B8" }}>Nenhuma transação para {formatMonth(month)}</p>
            <p className="text-sm mt-1" style={{ color: "#4A5568" }}>Importe um extrato na aba "Importar"</p>
          </div>
        </PremiumCard>
      ) : (
        <>
          {/* DOUBTS SECTION */}
          {doubts.length > 0 && (
            <PremiumCard glowColor="rgba(245,158,11,0.3)">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🤔</span>
                <h3 className="font-display font-bold" style={{ color: "#F59E0B" }}>
                  {doubts.length} transações precisam da sua atenção
                </h3>
              </div>
              <div className="space-y-3">
                {doubts.map((tx: any) => (
                  <div key={tx.id} className="rounded-xl p-4" style={{ background: "#0D1318", border: "1px solid rgba(245,158,11,0.3)" }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs font-mono" style={{ color: "#94A3B8" }}>{formatDate(tx.date)}</p>
                        <p className="text-sm font-medium mt-1" style={{ color: "#F0F4F8" }}>{tx.description}</p>
                      </div>
                      <span className="font-mono font-bold text-lg" style={{ color: tx.type === "credit" ? "#10B981" : "#F43F5E" }}>
                        {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
                      </span>
                    </div>
                    <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>Esta transação é:</p>
                    <div className="flex flex-wrap gap-2">
                      {tx.type === "credit" ? (
                        <>
                          <button onClick={() => classifyAs(tx.id, "receita", "kitnets")}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ background: "rgba(201,168,76,0.15)", color: "#E8C97A", border: "1px solid rgba(201,168,76,0.3)" }}>
                            🏘️ Aluguel/Kitnets
                          </button>
                          <button onClick={() => classifyAs(tx.id, "receita", "comissao_prevensul")}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ background: "rgba(45,212,191,0.15)", color: "#2DD4BF", border: "1px solid rgba(45,212,191,0.3)" }}>
                            💼 Comissão
                          </button>
                          <button onClick={() => classifyAs(tx.id, "receita", "solar")}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}>
                            ☀️ Solar
                          </button>
                          <button onClick={() => classifyAs(tx.id, "receita", "outros_receita")}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}>
                            💰 Outra Receita
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => classifyAs(tx.id, "despesa", "alimentacao")}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}>
                            🍽️ Alimentação
                          </button>
                          <button onClick={() => classifyAs(tx.id, "despesa", "assinaturas")}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ background: "rgba(139,92,246,0.15)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.3)" }}>
                            📱 Assinaturas
                          </button>
                          <button onClick={() => classifyAs(tx.id, "despesa", "obras")}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ background: "rgba(244,63,94,0.15)", color: "#F43F5E", border: "1px solid rgba(244,63,94,0.3)" }}>
                            🏗️ Obras
                          </button>
                          <button onClick={() => classifyAs(tx.id, "despesa", "outros")}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ background: "rgba(244,63,94,0.15)", color: "#F43F5E", border: "1px solid rgba(244,63,94,0.3)" }}>
                            📦 Outra Despesa
                          </button>
                        </>
                      )}
                      <button onClick={() => classifyAs(tx.id, "transferencia", "transferencia")}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                        style={{ background: "rgba(148,163,184,0.15)", color: "#94A3B8", border: "1px solid rgba(148,163,184,0.3)" }}>
                        🔄 Transferência
                      </button>
                      <button onClick={() => ignoreMutation.mutate(tx.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                        style={{ background: "rgba(74,85,104,0.15)", color: "#4A5568", border: "1px solid rgba(74,85,104,0.3)" }}>
                        Ignorar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </PremiumCard>
          )}

          {/* TRANSFERS INFO */}
          {transfers.length > 0 && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)" }}>
              <span>🔄</span>
              <p className="text-sm" style={{ color: "#94A3B8" }}>
                <strong style={{ color: "#F0F4F8" }}>{transfers.length} transferências entre contas</strong> detectadas e ignoradas automaticamente.
              </p>
            </div>
          )}

          {/* AUTO-CATEGORIZED */}
          {autoCategorized.length > 0 && (
            <div className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div className="flex items-center gap-3">
                <span>✅</span>
                <p className="text-sm" style={{ color: "#94A3B8" }}>
                  <strong style={{ color: "#10B981" }}>{autoCategorized.length} transações</strong> categorizadas automaticamente com alta confiança.
                </p>
              </div>
              <button
                onClick={confirmAllAuto}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-90"
                style={{ background: "rgba(16,185,129,0.2)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}>
                Confirmar todas
              </button>
            </div>
          )}

          {/* MATCHED / ALL TRANSACTIONS TABLE */}
          <PremiumCard>
            <h3 className="font-display font-semibold mb-4" style={{ color: "#F0F4F8" }}>
              Todas as transações ({allTransactions.length})
            </h3>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: "#1A2535" }}>
                    <TableHead style={{ color: "#94A3B8" }}>Data</TableHead>
                    <TableHead style={{ color: "#94A3B8" }}>Descrição</TableHead>
                    <TableHead style={{ color: "#94A3B8" }}>Categoria</TableHead>
                    <TableHead style={{ color: "#94A3B8" }}>Intent</TableHead>
                    <TableHead style={{ color: "#94A3B8" }}>Tipo</TableHead>
                    <TableHead className="text-right" style={{ color: "#94A3B8" }}>Valor</TableHead>
                    <TableHead style={{ color: "#94A3B8" }}>Status</TableHead>
                    <TableHead style={{ color: "#94A3B8" }}>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTransactions.map((tx: any) => {
                    const intentKey = tx.category_intent as keyof typeof INTENT_CONFIG;
                    const intentCfg = INTENT_CONFIG[intentKey];
                    return (
                      <TableRow key={tx.id} style={{ borderColor: "#1A2535" }}>
                        <TableCell style={{ color: "#F0F4F8" }}>{formatDate(tx.date)}</TableCell>
                        <TableCell className="max-w-[250px] truncate" style={{ color: "#F0F4F8" }}>{tx.description}</TableCell>
                        <TableCell>
                          <span className="text-xs font-mono" style={{ color: "#E8C97A" }}>
                            {CATEGORY_LABELS[tx.category_confirmed || tx.category_suggestion] || tx.category_label || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {intentCfg && <WtBadge variant={intentCfg.badge}>{intentCfg.label}</WtBadge>}
                        </TableCell>
                        <TableCell>
                          <WtBadge variant={tx.type === "credit" ? "green" : "red"}>
                            {tx.type === "credit" ? "Crédito" : "Débito"}
                          </WtBadge>
                        </TableCell>
                        <TableCell className="text-right font-mono" style={{ color: tx.type === "credit" ? "#10B981" : "#F43F5E" }}>
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell>
                          <WtBadge variant={
                            tx.status === "matched" ? "green" :
                            tx.status === "ignored" ? "gray" :
                            tx.status === "auto_categorized" ? "cyan" : "gold"
                          }>
                            {tx.status === "matched" ? "Conciliado" :
                             tx.status === "ignored" ? "Ignorado" :
                             tx.status === "auto_categorized" ? "Auto" : "Pendente"}
                          </WtBadge>
                        </TableCell>
                        <TableCell>
                          {(tx.status === "pending" || tx.status === "auto_categorized") && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => matchMutation.mutate({ id: tx.id, category: tx.category_suggestion || "outros", intent: tx.category_intent })}
                                className="p-1 rounded hover:bg-green-500/10"
                                title="Confirmar"
                              >
                                <CheckCircle2 className="w-4 h-4" style={{ color: "#10B981" }} />
                              </button>
                              <button
                                onClick={() => ignoreMutation.mutate(tx.id)}
                                className="p-1 rounded hover:bg-red-500/10"
                                title="Ignorar"
                              >
                                <XCircle className="w-4 h-4" style={{ color: "#F43F5E" }} />
                              </button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </PremiumCard>
        </>
      )}
    </div>
  );
}

/* ============ HISTORY TAB ============ */
function HistoryTab({ month, accounts }: { month: string; accounts: any[] }) {
  const { data: transactions = [], isLoading } = useBankTransactions({ month });

  const weeklyData = [1, 2, 3, 4, 5].map(week => {
    const weekTxs = transactions.filter((t: any) => {
      const day = new Date(t.date).getDate();
      const w = Math.ceil(day / 7);
      return w === week;
    });
    return {
      name: `Sem ${week}`,
      entradas: weekTxs.filter((t: any) => t.type === "credit").reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
      saidas: weekTxs.filter((t: any) => t.type === "debit").reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
    };
  }).filter(w => w.entradas > 0 || w.saidas > 0);

  const categoryMap: Record<string, number> = {};
  transactions.filter((t: any) => t.type === "debit").forEach((t: any) => {
    const cat = t.category_confirmed || t.category_suggestion || "outros";
    categoryMap[cat] = (categoryMap[cat] || 0) + Math.abs(t.amount);
  });
  const pieData = Object.entries(categoryMap).map(([name, value]) => ({
    name: CATEGORY_LABELS[name] || name,
    value,
  })).sort((a, b) => b.value - a.value);

  const exportCSV = () => {
    const bom = "\uFEFF";
    const header = "Data;Banco;Descrição;Categoria;Intent;Tipo;Valor;Status;Origem\n";
    const rows = transactions.map((t: any) =>
      [
        formatDate(t.date),
        (t as any).bank_accounts?.bank_name || "",
        `"${t.description}"`,
        CATEGORY_LABELS[t.category_confirmed || t.category_suggestion] || "",
        t.category_intent || "",
        t.type === "credit" ? "Crédito" : "Débito",
        t.amount?.toFixed(2).replace(".", ","),
        t.status,
        t.source,
      ].join(";")
    ).join("\n");
    const blob = new Blob([bom + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conciliacao_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <GoldButton onClick={exportCSV}>
          <Download className="w-4 h-4 mr-1" /> Exportar CSV
        </GoldButton>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" style={{ background: "#1A2535" }} />)}
        </div>
      ) : transactions.length === 0 ? (
        <PremiumCard>
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: "#1A2535" }} />
            <p style={{ color: "#94A3B8" }}>Nenhuma transação em {formatMonth(month)}</p>
          </div>
        </PremiumCard>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <PremiumCard>
              <h3 className="font-display font-semibold mb-4" style={{ color: "#F0F4F8" }}>Entradas vs Saídas por Semana</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A2535" />
                  <XAxis dataKey="name" stroke="#4A5568" fontSize={12} />
                  <YAxis stroke="#4A5568" fontSize={12} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#0D1318", border: "1px solid #1A2535", borderRadius: 8, color: "#F0F4F8" }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Bar dataKey="entradas" fill="#10B981" radius={[4, 4, 0, 0]} name="Entradas" />
                  <Bar dataKey="saidas" fill="#F43F5E" radius={[4, 4, 0, 0]} name="Saídas" />
                </BarChart>
              </ResponsiveContainer>
            </PremiumCard>

            <PremiumCard>
              <h3 className="font-display font-semibold mb-4" style={{ color: "#F0F4F8" }}>Saídas por Categoria</h3>
              {pieData.length === 0 ? (
                <p className="text-center py-8" style={{ color: "#4A5568" }}>Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#0D1318", border: "1px solid #1A2535", borderRadius: 8, color: "#F0F4F8" }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                    <Legend wrapperStyle={{ color: "#94A3B8", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </PremiumCard>
          </div>

          <PremiumCard>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: "#1A2535" }}>
                    <TableHead style={{ color: "#94A3B8" }}>Data</TableHead>
                    <TableHead style={{ color: "#94A3B8" }}>Banco</TableHead>
                    <TableHead style={{ color: "#94A3B8" }}>Descrição</TableHead>
                    <TableHead style={{ color: "#94A3B8" }}>Categoria</TableHead>
                    <TableHead style={{ color: "#94A3B8" }}>Tipo</TableHead>
                    <TableHead className="text-right" style={{ color: "#94A3B8" }}>Valor</TableHead>
                    <TableHead style={{ color: "#94A3B8" }}>Status</TableHead>
                    <TableHead style={{ color: "#94A3B8" }}>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx: any) => (
                    <TableRow key={tx.id} style={{ borderColor: "#1A2535" }}>
                      <TableCell style={{ color: "#F0F4F8" }}>{formatDate(tx.date)}</TableCell>
                      <TableCell style={{ color: "#F0F4F8" }}>{(tx as any).bank_accounts?.bank_name || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" style={{ color: "#F0F4F8" }}>{tx.description}</TableCell>
                      <TableCell className="text-xs font-mono" style={{ color: "#E8C97A" }}>
                        {CATEGORY_LABELS[tx.category_confirmed || tx.category_suggestion] || "—"}
                      </TableCell>
                      <TableCell>
                        <WtBadge variant={tx.type === "credit" ? "green" : "red"}>
                          {tx.type === "credit" ? "Crédito" : "Débito"}
                        </WtBadge>
                      </TableCell>
                      <TableCell className="text-right font-mono" style={{ color: tx.type === "credit" ? "#10B981" : "#F43F5E" }}>
                        {formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell>
                        <WtBadge variant={tx.status === "matched" ? "green" : tx.status === "ignored" ? "gray" : tx.status === "auto_categorized" ? "cyan" : "gold"}>
                          {tx.status === "matched" ? "✓" : tx.status === "ignored" ? "—" : tx.status === "auto_categorized" ? "Auto" : "⏳"}
                        </WtBadge>
                      </TableCell>
                      <TableCell className="text-xs uppercase font-mono" style={{ color: "#4A5568" }}>{tx.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </PremiumCard>
        </>
      )}
    </div>
  );
}
