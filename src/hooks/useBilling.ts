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

export function useBillingScheduleForMonth(month: string) {
  return useQuery({
    queryKey: ["billing_schedule", month],
    queryFn: async () => {
      const start = `${month}-01`;
      const end = `${month}-31`;
      const { data, error } = await (supabase as any)
        .from("billing_payment_schedule")
        .select("*")
        .gte("due_date", start)
        .lte("due_date", end);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        billing_id: string;
        installment_number: number;
        due_date: string;
        amount: number;
        paid_at: string | null;
        status: string;
      }>;
    },
    enabled: !!month,
  });
}

function calcPrevisao(
  data: any[],
  scheduleData: any[],
  month: string
): number {
  return data.reduce((sum: number, r: any) => {
    if (r.payment_type === "custom") {
      // Parcelas do cronograma personalizado que vencem neste mês
      const scheduled = scheduleData.filter(
        (s) => s.billing_id === r.id && s.due_date?.startsWith(month)
      );
      return sum + scheduled.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
    } else {
      // Parcelas iguais: contract_total / installment_total
      const total = r.installment_total ?? 1;
      return sum + (r.contract_total ?? 0) / total;
    }
  }, 0);
}

export function useBillingSummary(month: string) {
  const { data = [], isLoading } = usePrevensulBilling(month);
  const { data: ytdData = [], isLoading: isLoadingYtd } = usePrevensulBillingRange("2026-01", month);
  const { data: scheduleData = [], isLoading: isLoadingSchedule } = useBillingScheduleForMonth(month);

  // Faturamento Total — todos os contratos do mês selecionado
  const totalBilled = data.reduce((s: number, r: any) => s + (r.contract_total ?? 0), 0);

  // Faturamentos Novos — contratos cuja data de fechamento está no mês selecionado
  const totalNew = data
    .filter((r: any) => r.closing_date && String(r.closing_date).startsWith(month))
    .reduce((s: number, r: any) => s + (r.contract_total ?? 0), 0);

  // Previsão — parcela esperada por contrato no mês
  const totalForecast = calcPrevisao(data, scheduleData, month);

  // Recebidos — pago no mês
  const totalReceived = data.reduce((s: number, r: any) => s + (r.amount_paid ?? 0), 0);

  // Comissões — 3% do recebido
  const totalCommission = data.reduce((s: number, r: any) => s + (r.commission_value ?? 0), 0);

  // Faturamento 2026 — YTD: soma do pago de jan/2026 até o mês selecionado
  const total2026 = ytdData.reduce((s: number, r: any) => s + (r.amount_paid ?? 0), 0);

  return {
    totalBilled,
    totalNew,
    totalForecast,
    totalReceived,
    totalCommission,
    total2026,
    isLoading: isLoading || isLoadingYtd || isLoadingSchedule,
  };
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
      const { error } = await supabase.from("prevensul_billing").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prevensul_billing"] });
      qc.invalidateQueries({ queryKey: ["prevensul_billing_range"] });
    },
  });
}

export function useUpsertBillingSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      billingId,
      items,
    }: {
      billingId: string;
      items: Array<{ installment_number: number; due_date: string; amount: number }>;
    }) => {
      // Apaga o cronograma anterior e insere o novo
      const { error: delErr } = await (supabase as any)
        .from("billing_payment_schedule")
        .delete()
        .eq("billing_id", billingId);
      if (delErr) throw delErr;

      if (items.length === 0) return;

      const rows = items.map((item) => ({
        billing_id: billingId,
        installment_number: item.installment_number,
        due_date: item.due_date,
        amount: item.amount,
        status: "pending",
      }));

      const { error: insErr } = await (supabase as any)
        .from("billing_payment_schedule")
        .insert(rows);
      if (insErr) throw insErr;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["billing_schedule"] });
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
        payment_type: r.payment_type ?? "equal",
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
  const brl = (v: number | null | undefined): string => {
    if (v == null || v === 0) return "R$ -";
    return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const esc = (v: any): string => {
    const s = v == null ? "" : String(v);
    return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const headers = ["CLIENTE", "VALOR", "SALDO", "CONTR/NF", "PARCELA", "DATA FECH.", "PAGO", "COMISSÃO", "STATUS", "ASSINATURA"];

  const rows = data.map((r) => [
    r.client_name ?? "",
    brl(r.contract_total),
    brl(r.balance_remaining),
    r.contract_nf ?? "-",
    r.installment_current != null || r.installment_total != null
      ? `${r.installment_current ?? "-"}/${r.installment_total ?? "-"}`
      : "-",
    r.closing_date ?? "-",
    brl(r.amount_paid),
    brl(r.commission_value),
    r.status ?? "",
    "",
  ]);

  const csv = [headers, ...rows].map((row) => row.map(esc).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
