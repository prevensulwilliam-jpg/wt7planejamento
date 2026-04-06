import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export function usePrevensulBilling(month?: string) {
  return useQuery({
    queryKey: ["prevensul_billing", month],
    queryFn: async () => {
      let q = supabase
        .from("prevensul_billing")
        .select("*")
        .order("client_name", { ascending: true });
      if (month) q = q.eq("reference_month", month);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function usePrevensulBillingRange(startMonth?: string, endMonth?: string) {
  return useQuery({
    queryKey: ["prevensul_billing_range", startMonth, endMonth],
    queryFn: async () => {
      let q = supabase
        .from("prevensul_billing")
        .select("*")
        .order("reference_month", { ascending: true });
      if (startMonth) q = q.gte("reference_month", startMonth);
      if (endMonth) q = q.lte("reference_month", endMonth);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!startMonth && !!endMonth,
  });
}

export function useBillingSummary(month: string) {
  const { data = [], isLoading } = usePrevensulBilling(month);
  const totalBilled = data.reduce((s, r) => s + (r.contract_total ?? 0), 0);
  const totalReceived = data.reduce((s, r) => s + (r.amount_paid ?? 0), 0);
  const totalCommission = data.reduce((s, r) => s + (r.commission_value ?? 0), 0);
  const totalRecords = data.length;
  return { totalBilled, totalReceived, totalCommission, totalRecords, isLoading };
}

export function useCreateBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"prevensul_billing">) => {
      const { error } = await supabase.from("prevensul_billing").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prevensul_billing"] }),
  });
}

export function useUpdateBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, any>) => {
      const { error } = await supabase.from("prevensul_billing").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prevensul_billing"] });
      qc.invalidateQueries({ queryKey: ["prevensul_billing_range"] });
    },
  });
}

export function useReplicateMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceMonth, targetMonth, userId }: { sourceMonth: string; targetMonth: string; userId: string }) => {
      const { data: sourceData, error: fetchErr } = await supabase
        .from("prevensul_billing")
        .select("*")
        .eq("reference_month", sourceMonth);
      if (fetchErr) throw fetchErr;
      if (!sourceData || sourceData.length === 0) throw new Error("Mês anterior sem registros");

      const copies = sourceData.map(r => ({
        client_name: r.client_name,
        contract_total: r.contract_total,
        balance_remaining: r.balance_remaining,
        contract_nf: r.contract_nf,
        installment_current: r.installment_current ? r.installment_current + 1 : null,
        installment_total: r.installment_total,
        closing_date: r.closing_date,
        amount_paid: r.amount_paid,
        commission_rate: r.commission_rate,
        status: r.status,
        reference_month: targetMonth,
        created_by: userId,
      }));
      const { error: insertErr } = await supabase.from("prevensul_billing").insert(copies);
      if (insertErr) throw insertErr;
      return copies.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prevensul_billing"] }),
  });
}

export function useDeleteBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prevensul_billing").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prevensul_billing"] });
      qc.invalidateQueries({ queryKey: ["prevensul_billing_range"] });
    },
  });
}

export function useImportHistory() {
  return useQuery({
    queryKey: ["import_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_history")
        .select("*")
        .order("imported_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateImportHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      file_name: string;
      reference_month: string;
      records_imported: number;
      total_paid: number;
      total_commission: number;
      imported_by: string;
    }) => {
      const { error } = await supabase.from("import_history").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["import_history"] }),
  });
}

export function exportCSV(data: any[], filename: string) {
  const headers = ["Cliente", "Contrato/NF", "Parcela", "Valor Contrato", "Recebido", "Comissão", "Status", "Mês"];
  const rows = data.map((r) => [
    r.client_name,
    r.contract_nf,
    `${r.installment_current ?? ""}/${r.installment_total ?? ""}`,
    r.contract_total,
    r.amount_paid,
    r.commission_value,
    r.status,
    r.reference_month,
  ]);
  const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
