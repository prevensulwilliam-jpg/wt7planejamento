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
}

function deriveInstances({ bills, txs, month, today }: DeriveArgs): BillInstance[] {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const usedTxIds = new Set<string>();

  // Ordenar bills por especificidade (fixo primeiro, depois por valor decrescente)
  // — bills mais específicas têm prioridade no claim de uma transação
  const sortedBills = [...bills].sort((a, b) => {
    if (a.is_fixed !== b.is_fixed) return a.is_fixed ? -1 : 1;
    return Number(b.amount) - Number(a.amount);
  });

  const results: BillInstance[] = [];

  for (const bill of sortedBills) {
    const dueDay = Math.min(bill.due_day, lastDay);
    const dueDate = `${month}-${String(dueDay).padStart(2, "0")}`;
    const expected = Number(bill.amount);
    const tolerance = bill.is_fixed ? 0.10 : 0.35;
    const dueDateObj = new Date(y, m - 1, dueDay);

    const candidates = txs
      .filter(t => !usedTxIds.has(t.id))
      .filter(t => {
        // 1. Filtro de categoria (se ambos têm, precisam bater)
        if (bill.category && t.category_confirmed && t.category_confirmed !== bill.category) {
          return false;
        }
        // 2. Filtro de valor
        const absAmt = Math.abs(Number(t.amount));
        if (expected <= 0) return false;
        const dev = Math.abs(absAmt - expected) / expected;
        return dev <= tolerance;
      })
      .map(t => {
        const absAmt = Math.abs(Number(t.amount));
        const dev = Math.abs(absAmt - expected) / expected;
        const txDate = new Date(t.date);
        const daysDiff = Math.abs((txDate.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
        return { t, dev, daysDiff };
      })
      .sort((a, b) => {
        // Ordena por desvio de valor + distância temporal
        const scoreA = a.dev + a.daysDiff / 100;
        const scoreB = b.dev + b.daysDiff / 100;
        return scoreA - scoreB;
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
  const start = `${month}-01`;
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;

  const [billsRes, txsRes] = await Promise.all([
    supabase.from("recurring_bills" as any).select("*").eq("active", true),
    supabase
      .from("bank_transactions" as any)
      .select("id, description, amount, date, type, category_intent, category_confirmed, status")
      .gte("date", start)
      .lte("date", end)
      .eq("type", "debit"),
  ]);

  if (billsRes.error) throw billsRes.error;
  if (txsRes.error) throw txsRes.error;

  return {
    bills: ((billsRes.data ?? []) as unknown) as RecurringBill[],
    txs: (txsRes.data ?? []) as any[],
  };
}

// ─── Instâncias derivadas ──────────────────────────────────────────────────
export function useBillInstances(month: string) {
  return useQuery({
    queryKey: ["bill_instances", month],
    queryFn: async () => {
      const { bills, txs } = await fetchBillsAndTxs(month);
      const today = new Date().toISOString().slice(0, 10);
      return deriveInstances({ bills, txs, month, today });
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
      const totalPaid = instances
        .filter(i => i.status === "paid")
        .reduce((s, i) => s + (i.actual_amount ?? i.expected_amount), 0);
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
        totalPending: totalPending + totalOverdue,
        overdueCount: overdue.length,
        overdueAmount: totalOverdue,
        upcoming7dCount: upcoming7d.length,
        upcoming7dAmount: upcoming7d.reduce((s, i) => s + i.expected_amount, 0),
        totalCount: instances.length,
        paidCount: instances.filter(i => i.status === "paid").length,
      };
    },
  });
}
