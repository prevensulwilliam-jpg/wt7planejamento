import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface RecurringBill {
  id: string;
  name: string;
  alias: string | null;
  category: string | null;
  amount: number;
  due_day: number;
  frequency: string;
  is_fixed: boolean;
  auto_promoted: boolean;
  active: boolean;
  notes: string | null;
  linked_consortium_id: string | null;
  linked_residencial_code: string | null;
  linked_pattern_id: string | null;
  created_at: string;
  updated_at: string;
}

// BillInstance agora é um objeto DERIVADO em tempo de query — não existe mais tabela
export interface BillInstance {
  id: string; // sintético: `${bill.id}-${month}`
  recurring_bill_id: string;
  reference_month: string;
  expected_amount: number;
  actual_amount: number | null;
  due_date: string;
  status: "pending" | "paid" | "overdue";
  matched_transaction_id: string | null;
  paid_at: string | null;
  recurring_bill?: RecurringBill;
}

// ─── Recurring Bills CRUD ───────────────────────────────────────────────────
export function useRecurringBills() {
  return useQuery({
    queryKey: ["recurring_bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_bills" as any)
        .select("*")
        .order("due_day", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RecurringBill[];
    },
  });
}

export function useActiveRecurringBills() {
  return useQuery({
    queryKey: ["recurring_bills", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_bills" as any)
        .select("*")
        .eq("active", true)
        .order("due_day", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RecurringBill[];
    },
  });
}

export function useCreateRecurringBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bill: Partial<RecurringBill>) => {
      const { error } = await supabase
        .from("recurring_bills" as any)
        .insert(bill as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring_bills"] });
      qc.invalidateQueries({ queryKey: ["bill_instances"] });
      qc.invalidateQueries({ queryKey: ["bills_summary"] });
    },
  });
}

export function useUpdateRecurringBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RecurringBill> & { id: string }) => {
      const { error } = await supabase
        .from("recurring_bills" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring_bills"] });
      qc.invalidateQueries({ queryKey: ["bill_instances"] });
      qc.invalidateQueries({ queryKey: ["bills_summary"] });
    },
  });
}

export function useDeleteRecurringBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recurring_bills" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring_bills"] });
      qc.invalidateQueries({ queryKey: ["bill_instances"] });
      qc.invalidateQueries({ queryKey: ["bills_summary"] });
    },
  });
}

// ─── Derivação de status (core do refactor) ────────────────────────────────
interface DeriveArgs {
  bills: RecurringBill[];
  txs: any[];
  month: string;
  today: string;
  manualMatches?: Record<string, string>; // bill_id → transaction_id
}

// Normaliza string: lowercase, sem acentos, sem pontuação
function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Stopwords de descrições bancárias (não são palavras-chave úteis)
const STOPWORDS = new Set([
  "pg", "p", "internet", "debito", "credito", "pix", "transf", "intern", "interc",
  "cr", "tr", "db", "de", "do", "da", "dos", "das", "e", "a", "o", "os", "as",
  "s", "sa", "ltda", "eireli", "me", "adm", "s.a", "s/a",
  "cobranca", "referente", "mes", "anterior",
  "coop", "trab", "medico", "servicos", "servico", "pagamento", "pagamentos",
]);

// Extrai tokens significativos (>= 2 chars, não stopwords)
// 2 chars inclui siglas relevantes: XP, BB, TIM
function keywords(name: string): string[] {
  return norm(name)
    .split(" ")
    .filter(w => w.length >= 2 && !STOPWORDS.has(w));
}

function deriveInstances({ bills, txs, month, today, manualMatches = {} }: DeriveArgs): BillInstance[] {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const usedTxIds = new Set<string>();

  // Reserva as txs vinculadas manualmente — não podem ser usadas pelo matcher automático
  Object.values(manualMatches).forEach(txId => usedTxIds.add(txId));

  // Pré-normaliza descrições das txs (uma vez só)
  const normTxs = txs.map(t => ({
    ...t,
    _normDesc: norm(String(t.description || "")),
    _abs: Math.abs(Number(t.amount)),
  }));

  // Ordenar bills por especificidade: fixo primeiro, depois valor decrescente.
  // Bills com nome mais específico ganham prioridade no claim.
  const sortedBills = [...bills].sort((a, b) => {
    if (a.is_fixed !== b.is_fixed) return a.is_fixed ? -1 : 1;
    return Number(b.amount) - Number(a.amount);
  });

  const results: BillInstance[] = [];

  for (const bill of sortedBills) {
    const dueDay = Math.min(bill.due_day, lastDay);
    const dueDate = `${month}-${String(dueDay).padStart(2, "0")}`;
    const expected = Number(bill.amount);
    const dueDateObj = new Date(y, m - 1, dueDay);
    const billKeywords = keywords(bill.name);

    // Se há manual match pra este bill neste mês, usa ele e pula matcher automático
    const manualTxId = manualMatches[bill.id];
    if (manualTxId) {
      const manualTx = normTxs.find(t => t.id === manualTxId);
      if (manualTx) {
        results.push({
          id: `${bill.id}-${month}`,
          recurring_bill_id: bill.id,
          reference_month: month,
          expected_amount: expected,
          actual_amount: Math.abs(Number(manualTx.amount)),
          due_date: dueDate,
          status: "paid",
          matched_transaction_id: manualTx.id,
          paid_at: manualTx.date,
          recurring_bill: bill,
        });
        continue;
      }
    }

    const candidates = normTxs
      .filter(t => !usedTxIds.has(t.id))
      .filter(t => t.type === "debit")               // só débitos
      .map(t => {
        if (expected <= 0) return null;
        const dev = Math.abs(t._abs - expected) / expected;

        // Score de match de nome: fração de keywords do bill que aparecem na tx
        const matched = billKeywords.filter(k => t._normDesc.includes(k)).length;
        const nameScore = billKeywords.length > 0 ? matched / billKeywords.length : 0;

        const txDate = new Date(t.date);
        const daysDiff = Math.abs((txDate.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));

        return { t, dev, daysDiff, nameScore, matched };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .filter(c => {
        // Regra A: nome casa forte (>= 50% keywords) E valor em faixa ampla (±50%)
        if (c.nameScore >= 0.5 && c.dev <= 0.50) return true;
        // Regra B: valor casa muito preciso (±5%) E alguma keyword bate
        if (c.dev <= 0.05 && c.matched >= 1) return true;
        // Regra C: nome casa perfeito (100%) — aceita qualquer valor dentro de 80%
        if (c.nameScore >= 1.0 && c.dev <= 0.80) return true;
        return false;
      })
      .sort((a, b) => {
        // Prioriza: mais keywords casadas → menor desvio de valor → menor distância de data
        if (b.matched !== a.matched) return b.matched - a.matched;
        if (a.dev !== b.dev) return a.dev - b.dev;
        return a.daysDiff - b.daysDiff;
      });

    const match = candidates[0]?.t;
    if (match) usedTxIds.add(match.id);

    const status: BillInstance["status"] = match
      ? "paid"
      : dueDate < today
      ? "overdue"
      : "pending";

    results.push({
      id: `${bill.id}-${month}`,
      recurring_bill_id: bill.id,
      reference_month: month,
      expected_amount: expected,
      actual_amount: match ? Math.abs(Number(match.amount)) : null,
      due_date: dueDate,
      status,
      matched_transaction_id: match?.id ?? null,
      paid_at: match?.date ?? null,
      recurring_bill: bill,
    });
  }

  // Restaurar ordem por due_day
  return results.sort((a, b) =>
    a.due_date.localeCompare(b.due_date)
  );
}

async function fetchBillsAndTxs(month: string) {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();

  // Janela expandida: ±10 dias fora do mês pra capturar pagamentos antecipados
  // (ex: fatura de Abril paga em 30/03) ou pagos com atraso (01/05)
  const startDate = new Date(y, m - 1, 1 - 10);
  const endDate = new Date(y, m - 1, lastDay + 10);
  const start = startDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);

  const [billsRes, txsRes, manualRes] = await Promise.all([
    supabase.from("recurring_bills" as any).select("*").eq("active", true),
    supabase
      .from("bank_transactions" as any)
      .select("id, description, amount, date, type, category_intent, category_confirmed, status")
      .gte("date", start)
      .lte("date", end)
      .eq("type", "debit"),
    supabase
      .from("recurring_bill_manual_matches" as any)
      .select("recurring_bill_id, transaction_id")
      .eq("reference_month", month),
  ]);

  if (billsRes.error) throw billsRes.error;
  if (txsRes.error) throw txsRes.error;
  if (manualRes.error) throw manualRes.error;

  const manualMatches: Record<string, string> = {};
  for (const row of (manualRes.data ?? []) as any[]) {
    manualMatches[row.recurring_bill_id] = row.transaction_id;
  }

  // Se a tx manual-matched está fora da janela, busca ela separadamente
  const txIds = new Set(((txsRes.data ?? []) as any[]).map(t => t.id));
  const missingManualTxIds = Object.values(manualMatches).filter(id => !txIds.has(id));
  let extraTxs: any[] = [];
  if (missingManualTxIds.length > 0) {
    const { data: extra } = await supabase
      .from("bank_transactions" as any)
      .select("id, description, amount, date, type, category_intent, category_confirmed, status")
      .in("id", missingManualTxIds);
    extraTxs = (extra ?? []) as any[];
  }

  return {
    bills: ((billsRes.data ?? []) as unknown) as RecurringBill[],
    txs: [...((txsRes.data ?? []) as any[]), ...extraTxs],
    manualMatches,
  };
}

// ─── Instâncias derivadas ──────────────────────────────────────────────────
export function useBillInstances(month: string) {
  return useQuery({
    queryKey: ["bill_instances", month],
    queryFn: async () => {
      const { bills, txs, manualMatches } = await fetchBillsAndTxs(month);
      const today = new Date().toISOString().slice(0, 10);
      return deriveInstances({ bills, txs, month, today, manualMatches });
    },
  });
}

// ─── Summary derivado ──────────────────────────────────────────────────────
export function useBillsSummary(month: string) {
  return useQuery({
    queryKey: ["bills_summary", month],
    queryFn: async () => {
      const { bills, txs } = await fetchBillsAndTxs(month);
      const today = new Date().toISOString().slice(0, 10);
      const instances = deriveInstances({ bills, txs, month, today });

      const totalExpected = instances.reduce((s, i) => s + i.expected_amount, 0);
      const paidInstances = instances.filter(i => i.status === "paid");
      const totalPaid = paidInstances
        .reduce((s, i) => s + (i.actual_amount ?? i.expected_amount), 0);
      // Delta = soma (pago real - esperado) só das pagas
      const totalDelta = paidInstances
        .reduce((s, i) => s + ((i.actual_amount ?? i.expected_amount) - i.expected_amount), 0);
      const pending = instances.filter(i => i.status === "pending");
      const overdue = instances.filter(i => i.status === "overdue");
      const totalPending = pending.reduce((s, i) => s + i.expected_amount, 0);
      const totalOverdue = overdue.reduce((s, i) => s + i.expected_amount, 0);

      const in7 = new Date();
      in7.setDate(in7.getDate() + 7);
      const in7Str = in7.toISOString().slice(0, 10);
      const upcoming7d = pending.filter(i => i.due_date >= today && i.due_date <= in7Str);

      return {
        totalExpected,
        totalPaid,
        totalDelta, // negativo = economia, positivo = excesso
        totalPending: totalPending + totalOverdue,
        overdueCount: overdue.length,
        overdueAmount: totalOverdue,
        upcoming7dCount: upcoming7d.length,
        upcoming7dAmount: upcoming7d.reduce((s, i) => s + i.expected_amount, 0),
        totalCount: instances.length,
        paidCount: paidInstances.length,
      };
    },
  });
}

// ─── Manual Matches (override do matcher automático) ───────────────────────
export function useLinkTransactionManually() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      billId,
      referenceMonth,
      transactionId,
    }: {
      billId: string;
      referenceMonth: string;
      transactionId: string;
    }) => {
      const { error } = await supabase
        .from("recurring_bill_manual_matches" as any)
        .upsert(
          {
            recurring_bill_id: billId,
            reference_month: referenceMonth,
            transaction_id: transactionId,
          } as any,
          { onConflict: "recurring_bill_id,reference_month" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bill_instances"] });
      qc.invalidateQueries({ queryKey: ["bills_summary"] });
      qc.invalidateQueries({ queryKey: ["manual_matches"] });
    },
  });
}

export function useUnlinkTransactionManually() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      billId,
      referenceMonth,
    }: {
      billId: string;
      referenceMonth: string;
    }) => {
      const { error } = await supabase
        .from("recurring_bill_manual_matches" as any)
        .delete()
        .eq("recurring_bill_id", billId)
        .eq("reference_month", referenceMonth);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bill_instances"] });
      qc.invalidateQueries({ queryKey: ["bills_summary"] });
      qc.invalidateQueries({ queryKey: ["manual_matches"] });
    },
  });
}

// Lista debits do mês disponíveis pra vincular (com janela ±10 dias)
export function useMonthDebits(month: string) {
  return useQuery({
    queryKey: ["month_debits", month],
    queryFn: async () => {
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const startDate = new Date(y, m - 1, 1 - 10);
      const endDate = new Date(y, m - 1, lastDay + 10);
      const start = startDate.toISOString().slice(0, 10);
      const end = endDate.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("bank_transactions" as any)
        .select("id, description, amount, date")
        .gte("date", start)
        .lte("date", end)
        .eq("type", "debit")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// Verifica se uma instância está matched manualmente
export function useManualMatchesForMonth(month: string) {
  return useQuery({
    queryKey: ["manual_matches", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_bill_manual_matches" as any)
        .select("recurring_bill_id, transaction_id")
        .eq("reference_month", month);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as any[]) {
        map[row.recurring_bill_id] = row.transaction_id;
      }
      return map;
    },
  });
}
