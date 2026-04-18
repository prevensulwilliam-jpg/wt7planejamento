import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface RecurringBill {
  id: string;
  name: string;
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
  created_at: string;
  updated_at: string;
}

export interface BillInstance {
  id: string;
  recurring_bill_id: string;
  reference_month: string;
  expected_amount: number;
  actual_amount: number | null;
  due_date: string;
  status: "pending" | "paid" | "overdue" | "skipped";
  matched_expense_id: string | null;
  matched_transaction_id: string | null;
  paid_at: string | null;
  notes: string | null;
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring_bills"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring_bills"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring_bills"] }),
  });
}

// ─── Monthly Bill Instances ─────────────────────────────────────────────────
export function useBillInstances(month: string) {
  return useQuery({
    queryKey: ["bill_instances", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_bill_instances" as any)
        .select("*, recurring_bill:recurring_bills(*)")
        .eq("reference_month", month)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BillInstance[];
    },
  });
}

export function useGenerateMonthInstances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (month: string) => {
      // 1. Buscar bills ativas
      const { data: bills, error: bErr } = await supabase
        .from("recurring_bills" as any)
        .select("*")
        .eq("active", true);
      if (bErr) throw bErr;
      if (!bills?.length) return { created: 0 };

      // 2. Buscar instâncias já existentes do mês
      const { data: existing } = await supabase
        .from("monthly_bill_instances" as any)
        .select("recurring_bill_id")
        .eq("reference_month", month);
      const existingIds = new Set((existing ?? []).map((e: any) => e.recurring_bill_id));

      // 3. Criar instâncias faltantes
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const toInsert = (bills as any[])
        .filter(b => !existingIds.has(b.id))
        .map(b => {
          const day = Math.min(b.due_day, lastDay);
          const dueDate = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          return {
            recurring_bill_id: b.id,
            reference_month: month,
            expected_amount: b.amount,
            due_date: dueDate,
            status: "pending",
          };
        });

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from("monthly_bill_instances" as any)
          .insert(toInsert as any);
        if (error) throw error;
      }

      return { created: toInsert.length };
    },
    onSuccess: (_, month) => {
      qc.invalidateQueries({ queryKey: ["bill_instances", month] });
    },
  });
}

export function useUpdateBillInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BillInstance> & { id: string }) => {
      const { error } = await supabase
        .from("monthly_bill_instances" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bill_instances"] }),
  });
}

export function useMarkBillPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, actual_amount, paid_at }: { id: string; actual_amount?: number; paid_at?: string }) => {
      const { error } = await supabase
        .from("monthly_bill_instances" as any)
        .update({
          status: "paid",
          actual_amount: actual_amount ?? null,
          paid_at: paid_at ?? new Date().toISOString().split("T")[0],
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bill_instances"] }),
  });
}

// ─── Auto-match com bank_transactions ──────────────────────────────────────
const STOP_WORDS = new Set([
  "plano","pacote","mensal","boletos","consolidados","total","valor","fixo",
  "apartamento","apt","imovel","kitnet","conta","debito","credito","pagamento",
  "recorrente","despesa","fatura","mes","com","dos","das","por","para","sem","ref",
  "tarifa","cotas","msg",
]);

function extractKeywords(name: string): string[] {
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 4 && !STOP_WORDS.has(w));
}

export function useAutoMatchBills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (month: string) => {
      // 1. Instâncias pendentes/atrasadas do mês
      const { data: instances, error: iErr } = await supabase
        .from("monthly_bill_instances" as any)
        .select("*, recurring_bill:recurring_bills(*)")
        .eq("reference_month", month)
        .in("status", ["pending", "overdue"]);
      if (iErr) throw iErr;
      if (!instances?.length) return { matched: 0 };

      // 2. Transações bancárias do mês (despesas, amount < 0)
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const start = `${month}-01`;
      const end = `${month}-${String(lastDay).padStart(2, "0")}`;
      const { data: txs, error: tErr } = await supabase
        .from("bank_transactions" as any)
        .select("id, description, amount, date, type, category_intent")
        .gte("date", start).lte("date", end)
        .eq("type", "debit");
      if (tErr) throw tErr;
      if (!txs?.length) return { matched: 0 };

      const usedTxIds = new Set<string>();
      let matched = 0;

      for (const inst of instances as any[]) {
        const bill = inst.recurring_bill;
        if (!bill) continue;
        const expected = Number(inst.expected_amount ?? bill.amount);
        const tolerance = bill.is_fixed ? 0.10 : 0.35;
        const keywords = extractKeywords(bill.name);

        const candidates = (txs as any[])
          .filter(t => !usedTxIds.has(t.id))
          .filter(t => {
            const absAmt = Math.abs(Number(t.amount));
            if (expected <= 0) return false;
            const deviation = Math.abs(absAmt - expected) / expected;
            if (deviation > tolerance) return false;
            const desc = (t.description ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return keywords.some(w => desc.includes(w));
          })
          .sort((a, b) => {
            const devA = Math.abs(Math.abs(Number(a.amount)) - expected);
            const devB = Math.abs(Math.abs(Number(b.amount)) - expected);
            return devA - devB;
          });

        if (candidates.length > 0) {
          const best = candidates[0];
          usedTxIds.add(best.id);
          const { error } = await supabase
            .from("monthly_bill_instances" as any)
            .update({
              status: "paid",
              matched_transaction_id: best.id,
              actual_amount: Math.abs(Number(best.amount)),
              paid_at: best.date,
            } as any)
            .eq("id", inst.id);
          if (!error) matched++;
        }
      }

      return { matched };
    },
    onSuccess: (_, month) => {
      qc.invalidateQueries({ queryKey: ["bill_instances", month] });
      qc.invalidateQueries({ queryKey: ["bills_summary", month] });
    },
  });
}

// ─── Summary for Command Center ─────────────────────────────────────────────
export function useBillsSummary(month: string) {
  return useQuery({
    queryKey: ["bills_summary", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_bill_instances" as any)
        .select("expected_amount, actual_amount, status, due_date")
        .eq("reference_month", month);
      if (error) throw error;

      const instances = (data ?? []) as any[];
      const today = new Date().toISOString().split("T")[0];
      const totalExpected = instances.reduce((s, i) => s + (i.expected_amount ?? 0), 0);
      const totalPaid = instances.filter(i => i.status === "paid").reduce((s, i) => s + (i.actual_amount ?? i.expected_amount ?? 0), 0);
      const totalPending = instances.filter(i => i.status === "pending").reduce((s, i) => s + (i.expected_amount ?? 0), 0);
      const overdue = instances.filter(i => i.status === "pending" && i.due_date < today);
      const upcoming7d = instances.filter(i => {
        if (i.status !== "pending") return false;
        const due = new Date(i.due_date);
        const in7 = new Date();
        in7.setDate(in7.getDate() + 7);
        return due >= new Date(today) && due <= in7;
      });

      return {
        totalExpected,
        totalPaid,
        totalPending,
        overdueCount: overdue.length,
        overdueAmount: overdue.reduce((s: number, i: any) => s + (i.expected_amount ?? 0), 0),
        upcoming7dCount: upcoming7d.length,
        upcoming7dAmount: upcoming7d.reduce((s: number, i: any) => s + (i.expected_amount ?? 0), 0),
        totalCount: instances.length,
        paidCount: instances.filter(i => i.status === "paid").length,
      };
    },
  });
}
