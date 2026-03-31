import { useState, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { categorizeTransaction, CATEGORY_LABELS, INTENT_CONFIG, detectTransactionType } from "@/lib/categorizeTransaction";
import { getAllPatterns, normalizeDescription, recordClassification } from "@/lib/patternLearning";
import { useCategories } from "@/hooks/useCategories";
import { formatCurrency, formatDate, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { Upload, CheckCircle2, XCircle, ArrowLeftRight, FileText, Wifi, Download } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useBankStatementUpload } from "@/hooks/useBankStatementUpload";
import { ImportHistoryTab } from "@/components/reconciliation/ImportHistoryTab";

const DESPESA_OPTIONS = [
  { value: "cartao_credito", label: "💳 Cartão de Crédito" },
  { value: "energia_eletrica", label: "⚡ Energia Elétrica" },
  { value: "internet", label: "🌐 Internet" },
  { value: "telefonia", label: "📱 Telefonia" },
  { value: "lazer", label: "🎉 Lazer" },
  { value: "alimentacao", label: "🍽️ Alimentação" },
  { value: "suplementos", label: "💊 Suplementação" },
  { value: "saude", label: "🏥 Saúde" },
  { value: "maconaria", label: "🔷 Maçonaria" },
  { value: "guarani", label: "⚽ Guarani" },
  { value: "consorcio", label: "🔄 Consórcio" },
  { value: "terapia", label: "🧠 Terapia" },
  { value: "obras", label: "🏗️ Obras" },
  { value: "terrenos", label: "🌍 Terrenos" },
  { value: "agua", label: "💧 Água/Saneamento" },
  { value: "gasolina", label: "⛽ Gasolina" },
  { value: "farmacia", label: "💊 Farmácia" },
  { value: "academia", label: "🏋️ Academia" },
  { value: "impostos", label: "🧾 Impostos/Taxas" },
  { value: "casamento", label: "💍 Casamento" },
  { value: "assinaturas", label: "📲 Assinaturas" },
  { value: "veiculo", label: "🚗 Veículo" },
  { value: "outros", label: "📦 Outros" },
];

const RECEITA_OPTIONS = [
  { value: "kitnets", label: "🏘️ Aluguel/Kitnets" },
  { value: "salario", label: "💼 Salário" },
  { value: "comissao_prevensul", label: "📊 Comissão Prevensul" },
  { value: "solar", label: "☀️ Energia Solar" },
  { value: "laudos", label: "📋 Laudos Técnicos" },
  { value: "t7", label: "🚀 T7 Sales" },
  { value: "dividendos", label: "📈 Dividendos/Rendimentos" },
  { value: "outros_receita", label: "💰 Outros (Receita)" },
];

const ALL_CATEGORY_LABELS: Record<string, string> = {
  ...CATEGORY_LABELS,
  cartao_credito: "Cartão de Crédito", energia_eletrica: "Energia Elétrica",
  internet: "Internet", telefonia: "Telefonia", lazer: "Lazer",
  alimentacao: "Alimentação", suplementos: "Suplementação", saude: "Saúde",
  maconaria: "Maçonaria", guarani: "Guarani", consorcio: "Consórcio",
  terapia: "Terapia", obras: "Obras", terrenos: "Terrenos",
  agua: "Água/Saneamento", gasolina: "Gasolina", farmacia: "Farmácia",
  academia: "Academia", impostos: "Impostos/Taxas", casamento: "Casamento",
  assinaturas: "Assinaturas", veiculo: "Veículo", outros: "Outros",
  kitnets: "Kitnets", salario: "Salário",
  comissao_prevensul: "Comissão Prevensul", solar: "Energia Solar",
  laudos: "Laudos", t7: "T7 Sales", dividendos: "Dividendos",
  outros_receita: "Outros (Receita)", transferencia: "Transferência entre Contas",
};

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
          <ImportHistoryTab accounts={accounts} />
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
  const uploadStatementMutation = useBankStatementUpload();

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
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

      // Buscar padrões aprendidos
      const learnedPatterns = await getAllPatterns();
      const accountNames = accounts.map((a: any) => a.bank_name).filter(Boolean);

      const categorized = parsed.map((tx, idx) => {
        // 1. Tentar padrão aprendido primeiro
        const normalized = normalizeDescription(tx.description);
        const learned = learnedPatterns.find((p: any) => {
          const pNorm = p.description_pattern as string;
          return normalized.includes(pNorm) || pNorm.includes(normalized);
        });

        if (learned) {
          return {
            ...tx,
            _previewId: `preview-${idx}`,
            category_suggestion: learned.category,
            category_intent: learned.intent,
            category_confidence: "high",
            category_label: learned.label,
            status: learned.intent === "transferencia" ? "transferencia" : "auto_categorized",
            _learned: true,
            _learnedCount: learned.count,
          };
        }

        // 2. Fallback para regras manuais
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
          _learned: false,
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

    const selectedBankName = accounts.find((a: any) => a.id === selectedAccount)?.bank_name ?? "";

    const rows = preview.map(tx => ({
      external_id: tx.external_id,
      date: tx.date,
      description: selectedBankName
        ? `${tx.description} [${selectedBankName}]`
        : tx.description,
      amount: tx.amount,
      type: tx.type,
      source: tx.source,
      bank_account_id: selectedAccount,
      category_suggestion: tx.category_suggestion,
      category_intent: tx.category_intent,
      category_confidence: tx.category_confidence,
      category_label: tx.category_label,
      status: tx.category_intent === "transferencia"
        ? "ignored"
        : tx.status === "auto_categorized"
        ? "matched"
        : "pending",
      category_confirmed: tx.status === "auto_categorized" ? tx.category_suggestion : null,
      raw_data: null,
    }));

    try {
      await importMutation.mutateAsync(rows);

      // Auto-create revenues/expenses for confirmed rows and link back
      const autoRows = rows.filter(r => r.status === "matched" && r.category_intent !== "transferencia");
      let revenues = 0;
      let expenses = 0;

      // We need the inserted bank_transaction IDs — fetch by external_id
      for (const tx of autoRows) {
        const { data: btRow } = await supabase
          .from("bank_transactions" as any)
          .select("id")
          .eq("external_id", tx.external_id)
          .single();
        const btId = (btRow as any)?.id;

        if (tx.category_intent === "receita") {
          const { data, error } = await supabase.from("revenues").insert({
            source: tx.category_suggestion,
            description: tx.description,
            amount: tx.amount,
            type: "variable",
            reference_month: tx.date?.slice(0, 7),
            received_at: tx.date,
          }).select("id").single();
          if (!error && data && btId) {
            await supabase.from("bank_transactions" as any)
              .update({ matched_revenue_id: data.id }).eq("id", btId);
            revenues++;
          }
        } else if (tx.category_intent === "despesa") {
          const { data, error } = await supabase.from("expenses").insert({
            category: tx.category_suggestion,
            description: tx.description,
            amount: tx.amount,
            type: "variable",
            reference_month: tx.date?.slice(0, 7),
            paid_at: tx.date,
          }).select("id").single();
          if (!error && data && btId) {
            await supabase.from("bank_transactions" as any)
              .update({ matched_expense_id: data.id }).eq("id", btId);
            expenses++;
          }
        }
        await recordClassification(
          tx.description,
          tx.category_suggestion,
          tx.category_intent,
          tx.category_label ?? tx.category_suggestion
        );
      }

      const transfers = rows.filter(r => r.status === "ignored").length;
      const doubts = rows.filter(r => r.status === "pending").length;

      if (fileRef.current?.files?.[0]) {
        const originalFile = fileRef.current.files[0];
        const periodDates = rows.map(r => r.date).filter(Boolean).sort();
        
        const importStats = {
          totalTransactions: rows.length,
          newTransactions: revenues + expenses,
          duplicateTransactions: 0,
          autoCategorized: rows.filter(r => r.status === "matched").length,
          pendingReview: doubts,
          totalCredits: rows.filter(r => r.type === "credit").reduce((s, r) => s + r.amount, 0),
          totalDebits: rows.filter(r => r.type === "debit").reduce((s, r) => s + r.amount, 0),
          periodStart: periodDates[0] || new Date().toISOString().split('T')[0],
          periodEnd: periodDates[periodDates.length - 1] || new Date().toISOString().split('T')[0],
          referenceMonth: periodDates[0]?.slice(0, 7) || month
        };
        
        await uploadStatementMutation.mutateAsync({
          file: originalFile,
          accountId: selectedAccount,
          importStats
        });
      }

      toast.success(
        `✅ ${revenues} receitas e ${expenses} despesas criadas automaticamente · ` +
        `${transfers} transferências ignoradas · ` +
        `${doubts > 0 ? `${doubts} aguardam sua classificação` : "nenhuma dúvida"} · ` +
        `📁 Extrato salvo no histórico`
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
                          {tx._learned && (
                            <span className="ml-1 text-xs px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(139,92,246,0.2)", color: "#8B5CF6" }}>
                              🧠 {tx._learnedCount}x
                            </span>
                          )}
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
        .neq("status", "ignored")
        .neq("status", "matched");

      if (!txs?.length) return { updated: 0, revenues: 0, expenses: 0 };

      let updated = 0, revenues = 0, expenses = 0;
      for (const tx of txs as any[]) {
        const result = categorizeTransaction(
          tx.description, tx.type, tx.amount, []
        );
        const isAuto = result.confidence === "high" && result.intent !== "duvida";
        const newStatus = result.intent === "transferencia"
          ? "ignored"
          : isAuto ? "matched" : "pending";

        let revenueId: string | null = null;
        let expenseId: string | null = null;

        if (isAuto && result.intent === "receita" && !tx.matched_revenue_id) {
          const { data, error } = await supabase.from("revenues").insert({
            source: result.category,
            description: tx.description,
            amount: tx.amount,
            type: "variable",
            reference_month: tx.date?.slice(0, 7),
            received_at: tx.date,
          }).select("id").single();
          if (!error && data) { revenueId = data.id; revenues++; }
        } else if (isAuto && result.intent === "despesa" && !tx.matched_expense_id) {
          const { data, error } = await supabase.from("expenses").insert({
            category: result.category,
            description: tx.description,
            amount: tx.amount,
            type: "variable",
            reference_month: tx.date?.slice(0, 7),
            paid_at: tx.date,
          }).select("id").single();
          if (!error && data) { expenseId = data.id; expenses++; }
        } else if (isAuto && result.intent === "receita" && tx.matched_revenue_id) {
          await supabase.from("revenues").update({ source: result.category }).eq("id", tx.matched_revenue_id);
        } else if (isAuto && result.intent === "despesa" && tx.matched_expense_id) {
          await supabase.from("expenses").update({ category: result.category }).eq("id", tx.matched_expense_id);
        }

        const updatePayload: any = {
          category_suggestion: result.category,
          category_intent: result.intent,
          category_confidence: result.confidence,
          category_label: result.label,
          category_confirmed: isAuto ? result.category : null,
          status: newStatus,
        };
        if (revenueId) updatePayload.matched_revenue_id = revenueId;
        if (expenseId) updatePayload.matched_expense_id = expenseId;

        await supabase
          .from("bank_transactions" as any)
          .update(updatePayload)
          .eq("id", tx.id);
        updated++;
      }
      return { updated, revenues, expenses };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["revenues"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(
        `${r?.revenues ?? 0} receitas e ${r?.expenses ?? 0} despesas criadas · ` +
        `${r?.updated ?? 0} transações processadas`
      );
    },
    onError: () => toast.error("Erro ao recategorizar."),
  });

  // Sync: create missing revenues/expenses for matched transactions without linked IDs
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: txs } = await supabase
        .from("bank_transactions" as any)
        .select("*")
        .eq("status", "matched")
        .is("matched_revenue_id", null)
        .is("matched_expense_id", null);

      if (!txs?.length) return { revenues: 0, expenses: 0 };

      let revenues = 0, expenses = 0;
      for (const tx of txs as any[]) {
        const intent = tx.category_intent;
        const category = tx.category_confirmed || tx.category_suggestion;
        if (!category || intent === "transferencia") continue;

        if (intent === "receita") {
          const { data, error } = await supabase.from("revenues").insert({
            source: category,
            description: tx.description,
            amount: tx.amount,
            type: "variable",
            reference_month: tx.date?.slice(0, 7),
            received_at: tx.date,
          }).select("id").single();
          if (!error && data) {
            await supabase.from("bank_transactions" as any)
              .update({ matched_revenue_id: data.id }).eq("id", tx.id);
            revenues++;
          }
        } else if (intent === "despesa") {
          const { data, error } = await supabase.from("expenses").insert({
            category,
            description: tx.description,
            amount: tx.amount,
            type: "variable",
            reference_month: tx.date?.slice(0, 7),
            paid_at: tx.date,
          }).select("id").single();
          if (!error && data) {
            await supabase.from("bank_transactions" as any)
              .update({ matched_expense_id: data.id }).eq("id", tx.id);
            expenses++;
          }
        }
      }
      return { revenues, expenses };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["revenues"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(
        `🔗 Sincronizado: ${r?.revenues ?? 0} receitas e ${r?.expenses ?? 0} despesas criadas para transações já conciliadas`
      );
    },
    onError: () => toast.error("Erro ao sincronizar."),
  });

  // Filter groups
  const doubts = allTransactions.filter((t: any) => t.category_intent === "duvida" && t.status === "pending");
  const transfers = allTransactions.filter((t: any) => t.category_intent === "transferencia");
  const autoCategorized = allTransactions.filter((t: any) => t.status === "auto_categorized");
  const matched = allTransactions.filter((t: any) => t.status === "matched");

  const classifyAs = async (id: string, intent: "receita" | "despesa" | "transferencia", category: string, enrichedDescription?: string) => {
    const tx = allTransactions.find((t: any) => t.id === id);
    if (!tx) return;
    const description = enrichedDescription ?? tx.description;

    try {
      if (intent === "transferencia") {
        await ignoreMutation.mutateAsync(id);
        await recordClassification(tx.description, "transferencia", "transferencia", "Transferência entre Contas");
        toast.info("Transferência entre contas — ignorada.");
        return;
      }

      const label = ALL_CATEGORY_LABELS[category] || category;
      let revenueId: string | undefined = tx.matched_revenue_id ?? undefined;
      let expenseId: string | undefined = tx.matched_expense_id ?? undefined;

      if (intent === "receita" && !tx.matched_revenue_id) {
        const { data, error } = await supabase.from("revenues").insert({
          source: category,
          description,
          amount: tx.amount,
          type: detectTransactionType(category, "receita"),
          reference_month: tx.date?.slice(0, 7),
          received_at: tx.date,
        }).select("id").single();
        if (error) throw error;
        revenueId = data?.id;
        toast.success(`Receita criada: ${formatCurrency(tx.amount)} em ${label}`);
      } else if (intent === "receita" && tx.matched_revenue_id) {
        await supabase.from("revenues").update({ source: category }).eq("id", tx.matched_revenue_id);
        toast.success("Categoria da receita atualizada.");
      }

      if (intent === "despesa" && !tx.matched_expense_id) {
        const { data, error } = await supabase.from("expenses").insert({
          category,
          description,
          amount: tx.amount,
          type: detectTransactionType(category, "despesa"),
          reference_month: tx.date?.slice(0, 7),
          paid_at: tx.date,
        }).select("id").single();
        if (error) throw error;
        expenseId = data?.id;
        toast.success(`Despesa criada: ${formatCurrency(tx.amount)} em ${label}`);
      } else if (intent === "despesa" && tx.matched_expense_id) {
        await supabase.from("expenses").update({ category }).eq("id", tx.matched_expense_id);
        toast.success("Categoria da despesa atualizada.");
      }

      await matchMutation.mutateAsync({ id, category, intent, revenueId, expenseId });
      await recordClassification(tx.description, category, intent, label);
      queryClient.invalidateQueries({ queryKey: ["revenues"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    } catch (err: any) {
      toast.error(`Erro ao classificar: ${err.message || "erro desconhecido"}`);
    }
  };

  const confirmAllAuto = async () => {
    let revenues = 0;
    let expenses = 0;

    try {
      for (const tx of autoCategorized) {
        const intent = tx.category_intent as string;
        const category = tx.category_suggestion as string;
        let revenueId: string | undefined;
        let expenseId: string | undefined;

        if (intent === "receita" && !tx.matched_revenue_id) {
          const { data, error } = await supabase.from("revenues").insert({
            source: category,
            description: tx.description,
            amount: tx.amount,
            type: detectTransactionType(category, "receita"),
            reference_month: tx.date?.slice(0, 7),
            received_at: tx.date,
          }).select("id").single();
          if (error) throw error;
          revenueId = data?.id;
          revenues++;
        } else if (intent === "despesa" && !tx.matched_expense_id) {
          const { data, error } = await supabase.from("expenses").insert({
            category,
            description: tx.description,
            amount: tx.amount,
            type: detectTransactionType(category, "despesa"),
            reference_month: tx.date?.slice(0, 7),
            paid_at: tx.date,
          }).select("id").single();
          if (error) throw error;
          expenseId = data?.id;
          expenses++;
        }

        await matchMutation.mutateAsync({ id: tx.id, category, intent, revenueId, expenseId });
        const pLabel = ALL_CATEGORY_LABELS[category] || category;
        await recordClassification(tx.description, category, intent, pLabel);
      }
      queryClient.invalidateQueries({ queryKey: ["revenues"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(`${revenues} receitas e ${expenses} despesas criadas automaticamente!`);
    } catch (err: any) {
      toast.error(`Erro ao confirmar em lote: ${err.message || "erro desconhecido"}`);
    }
  };

  const [newExpenseOpen, setNewExpenseOpen] = useState(false);
  const [newRevenueOpen, setNewRevenueOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        <button onClick={() => setNewRevenueOpen(true)}
          className="text-xs px-4 py-2 rounded-lg font-medium flex items-center gap-1.5"
          style={{ background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}>
          + Nova Receita
        </button>
        <button onClick={() => setNewExpenseOpen(true)}
          className="text-xs px-4 py-2 rounded-lg font-medium flex items-center gap-1.5"
          style={{ background: "rgba(244,63,94,0.15)", color: "#F43F5E", border: "1px solid rgba(244,63,94,0.3)" }}>
          + Nova Despesa
        </button>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="text-xs px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all"
          style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.3)" }}>
          {syncMutation.isPending ? "..." : "🔗 Sincronizar"}
        </button>
        <button
          onClick={() => recategorizeMutation.mutate()}
          disabled={recategorizeMutation.isPending}
          className="text-xs px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all"
          style={{ background: "rgba(201,168,76,0.15)", color: "#E8C97A", border: "1px solid rgba(201,168,76,0.3)" }}>
          {recategorizeMutation.isPending ? "..." : "🔄 Recategorizar"}
        </button>
      </div>

      <NewExpenseModal open={newExpenseOpen} onClose={() => setNewExpenseOpen(false)} defaultMonth={month} />
      <NewRevenueModal open={newRevenueOpen} onClose={() => setNewRevenueOpen(false)} defaultMonth={month} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Com Dúvidas" value={summary.doubts} color="gold" formatAs="number" />
        <KpiCard label="Auto-categorizado" value={summary.autoCategorized} color="cyan" formatAs="number" />
        <KpiCard label="Transferências" value={summary.transfers} color="gray" formatAs="number" />
        <KpiCard label="Conciliados" value={summary.matched} color="green" formatAs="number" />
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
                  <DoubtCard
                    key={tx.id}
                    tx={tx}
                    classifyAs={classifyAs}
                    ignoreTransaction={(id) => ignoreMutation.mutate(id)}
                  />
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

          {/* AUTO-CATEGORIZED — cards de revisão */}
          {autoCategorized.length > 0 && (
            <PremiumCard glowColor="rgba(45,212,191,0.3)">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <h3 className="font-display font-bold" style={{ color: "#2DD4BF" }}>
                    {autoCategorized.length} auto-categorizadas — revise e confirme
                  </h3>
                </div>
                <button
                  onClick={confirmAllAuto}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-90"
                  style={{ background: "rgba(16,185,129,0.2)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}>
                  ✓ Confirmar todas
                </button>
              </div>
              <div className="space-y-3">
                {autoCategorized.map((tx: any) => (
                  <AutoCategorizedCard
                    key={tx.id}
                    tx={tx}
                    classifyAs={classifyAs}
                    ignoreTransaction={(id) => ignoreMutation.mutate(id)}
                    confirmAs={(id, category, intent) => matchMutation.mutate({ id, category, intent })}
                  />
                ))}
              </div>
            </PremiumCard>
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
                                onClick={() => classifyAs(tx.id, (tx.category_intent === "receita" || tx.category_intent === "despesa" || tx.category_intent === "transferencia") ? tx.category_intent : "despesa", tx.category_suggestion || "outros")}
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

/* ============ DOUBT CARD ============ */
function DoubtCard({ tx, classifyAs, ignoreTransaction }: {
  tx: any;
  classifyAs: (id: string, intent: "receita" | "despesa" | "transferencia", category: string, enrichedDescription?: string) => void;
  ignoreTransaction: (id: string) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<"receita" | "despesa" | "transferencia">(
    tx.type === "credit" ? "receita" : "despesa"
  );
  const { data: despesaCats = [] } = useCategories("despesa");
  const { data: receitaCats = [] } = useCategories("receita");
  const dynamicDespOpts = despesaCats.length > 0
    ? despesaCats.map((c: any) => ({ value: c.name.toLowerCase().replace(/[^a-z0-9]/g, "_"), label: `${c.emoji} ${c.name}` }))
    : DESPESA_OPTIONS;
  const dynamicRecOpts = receitaCats.length > 0
    ? receitaCats.map((c: any) => ({ value: c.name.toLowerCase().replace(/[^a-z0-9]/g, "_"), label: `${c.emoji} ${c.name}` }))
    : RECEITA_OPTIONS;
  const options = selectedIntent === "receita" ? dynamicRecOpts : dynamicDespOpts;

  const handleConfirm = () => {
    if (!selectedCategory) return;
    classifyAs(tx.id, selectedIntent, selectedCategory);
  };

  return (
    <div className="rounded-xl p-4" style={{ background: "#0D1318", border: "1px solid rgba(245,158,11,0.3)" }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-mono" style={{ color: "#94A3B8" }}>{formatDate(tx.date)}</p>
          <p className="text-sm font-medium mt-0.5" style={{ color: "#F0F4F8" }}>{tx.description}</p>
          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
            🏦 {tx.bank_accounts?.bank_name ?? "Banco não identificado"}
          </p>
        </div>
        <span className="font-mono font-bold text-base ml-4 flex-shrink-0"
          style={{ color: tx.type === "credit" ? "#10B981" : "#F43F5E" }}>
          {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
        </span>
      </div>

      <div className="flex gap-2 mb-3">
        <p className="text-xs self-center" style={{ color: "#94A3B8" }}>Tipo:</p>
        {(["receita", "despesa", "transferencia"] as const).map(intent => (
          <button
            key={intent}
            onClick={() => { setSelectedIntent(intent); setSelectedCategory(""); }}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
            style={{
              background: selectedIntent === intent
                ? intent === "receita" ? "rgba(16,185,129,0.25)" : intent === "despesa" ? "rgba(244,63,94,0.25)" : "rgba(148,163,184,0.25)"
                : "rgba(255,255,255,0.05)",
              color: selectedIntent === intent
                ? intent === "receita" ? "#10B981" : intent === "despesa" ? "#F43F5E" : "#94A3B8"
                : "#64748B",
              border: `1px solid ${selectedIntent === intent
                ? intent === "receita" ? "rgba(16,185,129,0.4)" : intent === "despesa" ? "rgba(244,63,94,0.4)" : "rgba(148,163,184,0.4)"
                : "transparent"}`,
            }}>
            {intent === "receita" ? "💰 Receita" : intent === "despesa" ? "💸 Despesa" : "🔄 Transferência"}
          </button>
        ))}
      </div>

      {selectedIntent !== "transferencia" && (
        <div className="mb-3">
          <p className="text-xs mb-2" style={{ color: "#94A3B8" }}>Categoria:</p>
          <div className="flex flex-wrap gap-1.5">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedCategory(opt.value)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: selectedCategory === opt.value ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.05)",
                  color: selectedCategory === opt.value ? "#E8C97A" : "#94A3B8",
                  border: `1px solid ${selectedCategory === opt.value ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.08)"}`,
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        {selectedIntent === "transferencia" ? (
          <button
            onClick={() => classifyAs(tx.id, "transferencia", "transferencia")}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: "rgba(148,163,184,0.2)", color: "#94A3B8", border: "1px solid rgba(148,163,184,0.3)" }}>
            Confirmar como Transferência
          </button>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={!selectedCategory}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{
              background: selectedCategory ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)",
              color: selectedCategory ? "#E8C97A" : "#4A5568",
              border: `1px solid ${selectedCategory ? "rgba(201,168,76,0.4)" : "transparent"}`,
            }}>
            ✓ Confirmar
          </button>
        )}
        <button
          onClick={() => ignoreTransaction(tx.id)}
          className="px-3 py-1.5 rounded-lg text-xs transition-all"
          style={{ color: "#4A5568", border: "1px solid rgba(255,255,255,0.06)" }}>
          Ignorar
        </button>
      </div>
    </div>
  );
}

/* ============ AUTO-CATEGORIZED CARD ============ */
function AutoCategorizedCard({ tx, classifyAs, ignoreTransaction, confirmAs }: {
  tx: any;
  classifyAs: (id: string, intent: "receita" | "despesa" | "transferencia", category: string) => void;
  ignoreTransaction: (id: string) => void;
  confirmAs: (id: string, category: string, intent: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(tx.category_suggestion || "");
  const [selectedIntent, setSelectedIntent] = useState<"receita" | "despesa" | "transferencia">(
    tx.category_intent === "receita" ? "receita" : tx.category_intent === "transferencia" ? "transferencia" : "despesa"
  );
  const { data: despesaCats = [] } = useCategories("despesa");
  const { data: receitaCats = [] } = useCategories("receita");
  const dynamicDespOpts = despesaCats.length > 0
    ? despesaCats.map((c: any) => ({ value: c.name.toLowerCase().replace(/[^a-z0-9]/g, "_"), label: `${c.emoji} ${c.name}` }))
    : DESPESA_OPTIONS;
  const dynamicRecOpts = receitaCats.length > 0
    ? receitaCats.map((c: any) => ({ value: c.name.toLowerCase().replace(/[^a-z0-9]/g, "_"), label: `${c.emoji} ${c.name}` }))
    : RECEITA_OPTIONS;
  const options = selectedIntent === "receita" ? dynamicRecOpts : dynamicDespOpts;

  const categoryLabel = CATEGORY_LABELS[tx.category_suggestion] || tx.category_label || tx.category_suggestion || "—";
  const intentLabel = tx.category_intent === "receita" ? "💰 Receita" : tx.category_intent === "despesa" ? "💸 Despesa" : "🔄 Transferência";

  if (!editing) {
    return (
      <div className="rounded-xl p-4" style={{ background: "#0D1318", border: "1px solid rgba(45,212,191,0.3)" }}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono" style={{ color: "#94A3B8" }}>{formatDate(tx.date)}</p>
            <p className="text-sm font-medium mt-0.5 truncate" style={{ color: "#F0F4F8" }}>{tx.description}</p>
            <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
              🏦 {tx.bank_accounts?.bank_name ?? "—"}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
                style={{ background: "rgba(45,212,191,0.15)", color: "#2DD4BF", border: "1px solid rgba(45,212,191,0.3)" }}>
                {intentLabel}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
                style={{ background: "rgba(201,168,76,0.15)", color: "#E8C97A", border: "1px solid rgba(201,168,76,0.3)" }}>
                {categoryLabel}
              </span>
            </div>
          </div>
          <span className="font-mono font-bold text-base ml-4 flex-shrink-0"
            style={{ color: tx.type === "credit" ? "#10B981" : "#F43F5E" }}>
            {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
          </span>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => confirmAs(tx.id, tx.category_suggestion || "outros", tx.category_intent)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: "rgba(16,185,129,0.2)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}>
            ✓ Confirmar
          </button>
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{ color: "#E8C97A", border: "1px solid rgba(201,168,76,0.2)" }}>
            ✏️ Alterar
          </button>
          <button
            onClick={() => ignoreTransaction(tx.id)}
            className="px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{ color: "#4A5568", border: "1px solid rgba(255,255,255,0.06)" }}>
            Ignorar
          </button>
        </div>
      </div>
    );
  }

  // Editing mode — same as DoubtCard
  return (
    <div className="rounded-xl p-4" style={{ background: "#0D1318", border: "1px solid rgba(201,168,76,0.3)" }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-mono" style={{ color: "#94A3B8" }}>{formatDate(tx.date)}</p>
          <p className="text-sm font-medium mt-0.5" style={{ color: "#F0F4F8" }}>{tx.description}</p>
          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
            🏦 {tx.bank_accounts?.bank_name ?? "—"}
          </p>
        </div>
        <span className="font-mono font-bold text-base ml-4 flex-shrink-0"
          style={{ color: tx.type === "credit" ? "#10B981" : "#F43F5E" }}>
          {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
        </span>
      </div>

      <div className="flex gap-2 mb-3">
        <p className="text-xs self-center" style={{ color: "#94A3B8" }}>Tipo:</p>
        {(["receita", "despesa", "transferencia"] as const).map(intent => (
          <button
            key={intent}
            onClick={() => { setSelectedIntent(intent); setSelectedCategory(""); }}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
            style={{
              background: selectedIntent === intent
                ? intent === "receita" ? "rgba(16,185,129,0.25)" : intent === "despesa" ? "rgba(244,63,94,0.25)" : "rgba(148,163,184,0.25)"
                : "rgba(255,255,255,0.05)",
              color: selectedIntent === intent
                ? intent === "receita" ? "#10B981" : intent === "despesa" ? "#F43F5E" : "#94A3B8"
                : "#64748B",
              border: `1px solid ${selectedIntent === intent
                ? intent === "receita" ? "rgba(16,185,129,0.4)" : intent === "despesa" ? "rgba(244,63,94,0.4)" : "rgba(148,163,184,0.4)"
                : "transparent"}`,
            }}>
            {intent === "receita" ? "💰 Receita" : intent === "despesa" ? "💸 Despesa" : "🔄 Transferência"}
          </button>
        ))}
      </div>

      {selectedIntent !== "transferencia" && (
        <div className="mb-3">
          <p className="text-xs mb-2" style={{ color: "#94A3B8" }}>Categoria:</p>
          <div className="flex flex-wrap gap-1.5">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedCategory(opt.value)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: selectedCategory === opt.value ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.05)",
                  color: selectedCategory === opt.value ? "#E8C97A" : "#94A3B8",
                  border: `1px solid ${selectedCategory === opt.value ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.08)"}`,
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => {
            if (selectedIntent === "transferencia") {
              classifyAs(tx.id, "transferencia", "transferencia");
            } else if (selectedCategory) {
              classifyAs(tx.id, selectedIntent, selectedCategory);
            }
          }}
          disabled={selectedIntent !== "transferencia" && !selectedCategory}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
          style={{ background: "rgba(201,168,76,0.2)", color: "#E8C97A", border: "1px solid rgba(201,168,76,0.4)" }}>
          ✓ Confirmar alteração
        </button>
        <button
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 rounded-lg text-xs transition-all"
          style={{ color: "#4A5568" }}>
          ← Voltar
        </button>
      </div>
    </div>
  );
}


function NewExpenseModal({ open, onClose, defaultMonth }: { open: boolean; onClose: () => void; defaultMonth: string }) {
  const qc = useQueryClient();
  const { data: cats = [] } = useCategories("despesa");
  const dynamicOpts = cats.length > 0
    ? cats.map((c: any) => ({ value: c.name.toLowerCase().replace(/[^a-z0-9]/g, "_"), label: `${c.emoji} ${c.name}` }))
    : DESPESA_OPTIONS;
  const [form, setForm] = useState({
    category: "", description: "", amount: "",
    paid_at: new Date().toISOString().split("T")[0],
    reference_month: defaultMonth, type: "variable" as string,
  });

  const handleSave = async () => {
    if (!form.category || !form.amount || !form.description) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const { error } = await supabase.from("expenses").insert({
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount.replace(",", ".")),
      type: form.type,
      paid_at: form.paid_at,
      reference_month: form.reference_month,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Despesa criada!");
    qc.invalidateQueries({ queryKey: ["expenses"] });
    onClose();
    setForm({ category: "", description: "", amount: "", paid_at: new Date().toISOString().split("T")[0], reference_month: defaultMonth, type: "variable" });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }} className="max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ color: "#F0F4F8" }}>💸 Nova Despesa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-mono uppercase mb-2 block" style={{ color: "#94A3B8" }}>Categoria *</label>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
              {dynamicOpts.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(f => ({ ...f, category: opt.value }))}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: form.category === opt.value ? "rgba(244,63,94,0.2)" : "rgba(255,255,255,0.05)",
                    color: form.category === opt.value ? "#F43F5E" : "#94A3B8",
                    border: `1px solid ${form.category === opt.value ? "rgba(244,63,94,0.4)" : "rgba(255,255,255,0.08)"}`,
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Descrição *</label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Ex: Fatura Cartão Nubank"
              style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Valor (R$) *</label>
              <Input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0,00" type="number"
                style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
            </div>
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Data</label>
              <Input type="date" value={form.paid_at} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))}
                style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Tipo</label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0D1318", borderColor: "#1A2535" }}>
                  <SelectItem value="fixed" style={{ color: "#F0F4F8" }}>Fixo</SelectItem>
                  <SelectItem value="variable" style={{ color: "#F0F4F8" }}>Variável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Mês referência</label>
              <Input type="month" value={form.reference_month}
                onChange={e => setForm(f => ({ ...f, reference_month: e.target.value }))}
                style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg" style={{ color: "#94A3B8" }}>Cancelar</button>
          <GoldButton onClick={handleSave}>Salvar Despesa</GoldButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ NEW REVENUE MODAL ============ */
function NewRevenueModal({ open, onClose, defaultMonth }: { open: boolean; onClose: () => void; defaultMonth: string }) {
  const qc = useQueryClient();
  const { data: cats = [] } = useCategories("receita");
  const dynamicOpts = cats.length > 0
    ? cats.map((c: any) => ({ value: c.name.toLowerCase().replace(/[^a-z0-9]/g, "_"), label: `${c.emoji} ${c.name}` }))
    : RECEITA_OPTIONS;
  const [form, setForm] = useState({
    source: "", description: "", amount: "",
    received_at: new Date().toISOString().split("T")[0],
    reference_month: defaultMonth, type: "variable" as string,
  });

  const handleSave = async () => {
    if (!form.source || !form.amount || !form.description) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const { error } = await supabase.from("revenues").insert({
      source: form.source,
      description: form.description,
      amount: parseFloat(form.amount.replace(",", ".")),
      type: form.type,
      received_at: form.received_at,
      reference_month: form.reference_month,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Receita criada!");
    qc.invalidateQueries({ queryKey: ["revenues"] });
    onClose();
    setForm({ source: "", description: "", amount: "", received_at: new Date().toISOString().split("T")[0], reference_month: defaultMonth, type: "variable" });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }} className="max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ color: "#F0F4F8" }}>💰 Nova Receita</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-mono uppercase mb-2 block" style={{ color: "#94A3B8" }}>Fonte *</label>
            <div className="flex flex-wrap gap-1.5">
              {dynamicOpts.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(f => ({ ...f, source: opt.value }))}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: form.source === opt.value ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)",
                    color: form.source === opt.value ? "#10B981" : "#94A3B8",
                    border: `1px solid ${form.source === opt.value ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}`,
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Descrição *</label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Ex: Repasse RWT02 Março"
              style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Valor (R$) *</label>
              <Input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0,00" type="number"
                style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
            </div>
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Data</label>
              <Input type="date" value={form.received_at}
                onChange={e => setForm(f => ({ ...f, received_at: e.target.value }))}
                style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Tipo</label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0D1318", borderColor: "#1A2535" }}>
                  <SelectItem value="fixed" style={{ color: "#F0F4F8" }}>Fixo</SelectItem>
                  <SelectItem value="variable" style={{ color: "#F0F4F8" }}>Variável</SelectItem>
                  <SelectItem value="eventual" style={{ color: "#F0F4F8" }}>Eventual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-mono uppercase mb-1 block" style={{ color: "#94A3B8" }}>Mês referência</label>
              <Input type="month" value={form.reference_month}
                onChange={e => setForm(f => ({ ...f, reference_month: e.target.value }))}
                style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg" style={{ color: "#94A3B8" }}>Cancelar</button>
          <GoldButton onClick={handleSave}>Salvar Receita</GoldButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


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
