import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── DEBTS ────────────────────────────────────────────────────────────

export type Debt = {
  id: string;
  name: string;
  creditor: string | null;
  total_amount: number | null;
  remaining_amount: number | null;
  monthly_payment: number | null;
  due_date: string | null;
  status: string | null;
};

export function useDebts(includeAll = false) {
  return useQuery({
    queryKey: ["debts", includeAll ? "all" : "active"],
    queryFn: async () => {
      let q = supabase.from("debts").select("*").order("due_date", { ascending: true, nullsFirst: false });
      if (!includeAll) q = q.neq("status", "paid");
      const { data, error } = await q;
      if (error) throw error;
      return data as Debt[];
    },
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Debt> & { id: string }) => {
      const { error } = await (supabase as any).from("debts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debts"] });
      qc.invalidateQueries({ queryKey: ["debt_installments"] });
    },
  });
}

// ─── DEBT INSTALLMENTS ────────────────────────────────────────────────

export type DebtInstallment = {
  id: string;
  debt_id: string;
  sequence_number: number;
  due_date: string;
  amount: number;
  paid_at: string | null;
  paid_amount: number | null;
  bank_tx_id: string | null;
  notes: string | null;
};

export function useDebtInstallments(debtId?: string, fetchAll = false) {
  return useQuery({
    queryKey: ["debt_installments", debtId ?? "all"],
    queryFn: async () => {
      let q = (supabase as any)
        .from("debt_installments")
        .select("*")
        .order("sequence_number", { ascending: true });
      if (debtId) q = q.eq("debt_id", debtId);
      const { data, error } = await q;
      if (error) throw error;
      return data as DebtInstallment[];
    },
    enabled: !!debtId || fetchAll,
  });
}

export function useCreateInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      debt_id: string;
      sequence_number: number;
      due_date: string;
      amount: number;
      notes?: string | null;
    }) => {
      const { error } = await (supabase as any).from("debt_installments").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debt_installments"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
    },
  });
}

export function useMarkInstallmentPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      paid_at,
      paid_amount,
      bank_tx_id,
    }: {
      id: string;
      paid_at: string;
      paid_amount: number;
      bank_tx_id?: string | null;
    }) => {
      const { error } = await (supabase as any)
        .from("debt_installments")
        .update({
          paid_at,
          paid_amount,
          bank_tx_id: bank_tx_id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debt_installments"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
    },
  });
}

export function useUnmarkInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("debt_installments")
        .update({ paid_at: null, paid_amount: null, bank_tx_id: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debt_installments"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
    },
  });
}

export function useDeleteInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("debt_installments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debt_installments"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
    },
  });
}
