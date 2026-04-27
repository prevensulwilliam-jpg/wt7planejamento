import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Installment = {
  id: string;
  commission_id: string;
  installment_number: number;
  due_date: string;          // YYYY-MM-DD
  amount: number;
  paid_at: string | null;    // YYYY-MM-DD
  paid_amount: number | null;
  notes: string | null;
};

export type OtherCommission = {
  id: string;
  description: string;
  source: string | null;
  reference_month: string;
  amount: number;
  commission_rate: number;
  commission_value: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  issued_at: string | null;
  installments_count: number;
  installments: Installment[];
};

// ─── List by month ───
export function useOtherCommissions(month?: string) {
  return useQuery({
    queryKey: ["other_commissions", month],
    queryFn: async () => {
      let q = (supabase as any)
        .from("other_commissions")
        .select("*, installments:other_commission_installments(*)")
        .order("created_at", { ascending: false });
      if (month) q = q.eq("reference_month", month);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      return rows.map(r => ({
        ...r,
        installments: ((r.installments ?? []) as Installment[])
          .sort((a, b) => a.installment_number - b.installment_number),
      })) as OtherCommission[];
    },
  });
}

// ─── Summary for KPIs ───
export function useOtherCommissionsSummary(month: string) {
  // Para "Comissões Recebidas" precisamos olhar TODAS as parcelas pagas no mês,
  // independente da reference_month do lançamento.
  const { data: monthRows = [], isLoading: l1 } = useOtherCommissions(month);

  // Buscar parcelas pagas dentro do mês (qualquer comissão)
  const { data: receivedTotal = 0, isLoading: l2 } = useQuery({
    queryKey: ["other_commissions_received", month],
    queryFn: async () => {
      // mês YYYY-MM → range
      const [y, m] = month.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const endDate = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${String(endDate).padStart(2, "0")}`;
      const { data, error } = await (supabase as any)
        .from("other_commission_installments")
        .select("amount, paid_amount, paid_at")
        .not("paid_at", "is", null)
        .gte("paid_at", start)
        .lte("paid_at", end);
      if (error) throw error;
      return (data ?? []).reduce(
        (s: number, r: any) => s + Number(r.paid_amount ?? r.amount ?? 0),
        0
      );
    },
  });

  const totalCommission = monthRows.reduce((s, r) => s + (r.commission_value ?? 0), 0);
  return {
    totalCommission,
    totalReceived: receivedTotal,
    totalRecords: monthRows.length,
    isLoading: l1 || l2,
  };
}

// ─── Create (com parcelas) ───
export function useCreateOtherCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      description: string;
      source?: string | null;
      reference_month: string;
      amount: number;
      commission_rate: number;
      commission_value: number;
      notes?: string | null;
      created_by?: string | null;
      issued_at?: string | null;
      installments: Array<{ due_date: string; amount: number }>;
    }) => {
      const { installments, ...main } = entry;
      const { data: created, error } = await (supabase as any)
        .from("other_commissions")
        .insert({ ...main, installments_count: installments.length })
        .select("id")
        .single();
      if (error) throw error;

      if (installments.length > 0) {
        const rows = installments.map((p, i) => ({
          commission_id: created.id,
          installment_number: i + 1,
          due_date: p.due_date,
          amount: p.amount,
        }));
        const { error: e2 } = await (supabase as any)
          .from("other_commission_installments")
          .insert(rows);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["other_commissions"] });
      qc.invalidateQueries({ queryKey: ["other_commissions_received"] });
    },
  });
}

// ─── Update lançamento + replace parcelas ───
export function useUpdateOtherCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      description: string;
      source?: string | null;
      reference_month: string;
      amount: number;
      commission_rate: number;
      commission_value: number;
      notes?: string | null;
      issued_at?: string | null;
      installments: Array<{
        id?: string;
        installment_number: number;
        due_date: string;
        amount: number;
        paid_at?: string | null;
        paid_amount?: number | null;
      }>;
    }) => {
      const { id, installments, ...main } = payload;
      const { error } = await (supabase as any)
        .from("other_commissions")
        .update({ ...main, installments_count: installments.length })
        .eq("id", id);
      if (error) throw error;

      // estratégia simples: deletar todas e reinserir (preserva paid_at via payload)
      const { error: eDel } = await (supabase as any)
        .from("other_commission_installments")
        .delete()
        .eq("commission_id", id);
      if (eDel) throw eDel;

      if (installments.length > 0) {
        const rows = installments.map((p, i) => ({
          commission_id: id,
          installment_number: i + 1,
          due_date: p.due_date,
          amount: p.amount,
          paid_at: p.paid_at ?? null,
          paid_amount: p.paid_amount ?? null,
        }));
        const { error: eIns } = await (supabase as any)
          .from("other_commission_installments")
          .insert(rows);
        if (eIns) throw eIns;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["other_commissions"] });
      qc.invalidateQueries({ queryKey: ["other_commissions_received"] });
    },
  });
}

// ─── Marcar parcela paga / desfazer ───
export function useToggleInstallmentPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      paid_at: string | null;
      paid_amount?: number | null;
    }) => {
      const { error } = await (supabase as any)
        .from("other_commission_installments")
        .update({ paid_at: params.paid_at, paid_amount: params.paid_amount ?? null })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["other_commissions"] });
      qc.invalidateQueries({ queryKey: ["other_commissions_received"] });
    },
  });
}

// ─── Delete ───
export function useDeleteOtherCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("other_commissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["other_commissions"] });
      qc.invalidateQueries({ queryKey: ["other_commissions_received"] });
    },
  });
}
