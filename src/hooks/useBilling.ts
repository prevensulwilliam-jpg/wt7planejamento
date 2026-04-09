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

export type KpiDrillType = 'totalBilled' | 'totalNew' | 'totalForecast' | 'totalReceived' | 'totalCommission' | 'total2026';

export interface BilledDetail { client_name: string; contract_total: number }
export interface NewDetail { client_name: string; closing_date: string; contract_total: number }
export interface ForecastDetail { client_name: string; payment_type: string; predicted_amount: number }
export interface ReceivedDetail { client_name: string; amount_paid: number }
export interface CommissionDetail { client_name: string; amount_paid: number; commission_rate: number; commission_value: number }
export interface YtdDetail { reference_month: string; client_name: string; amount_paid: number }

function calcPrevisaoDetail(
  data: any[],
  scheduleData: any[],
  month: string
): ForecastDetail[] {
  return data
    .map((r: any) => {
      let predicted_amount = 0;
      if (r.payment_type === "custom") {
        const scheduled = scheduleData.filter(
          (s) => s.billing_id === r.id && s.due_date?.startsWith(month)
        );
        predicted_amount = scheduled.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
      } else {
        const remaining = Math.max(1, (r.installment_total ?? 1) - (r.installment_current ?? 0));
        predicted_amount = (r.balance_remaining ?? 0) / remaining;
      }
      return {
        client_name: r.client_name ?? "",
        payment_type: r.payment_type === "custom" ? "Personalizado" : "Parcelas iguais",
        predicted_amount,
      };
    })
    .filter((d) => d.predicted_amount > 0);
}

function parseDateToYearMonth(val: string | null | undefined): string | null {
  if (!val) return null;
  const s = String(val).trim();
  // ISO: "2026-03-31" ou "2026-03"
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(s)) return s.substring(0, 7);
  // Brasileiro: "31/03/2026"
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) return `${br[3]}-${br[2]}`;
  // Abreviado PT-BR: "mar/26", "jan/25"
  const monthMap: Record<string, string> = {
    jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
    jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
  };
  const abbrev = /^([a-záê]{3})\/(\d{2})$/i.exec(s);
  if (abbrev) {
    const m = monthMap[abbrev[1].toLowerCase()];
    if (m) return `20${abbrev[2]}-${m}`;
  }
  return null;
}

export function useBillingSummary(month: string) {
  const { data = [], isLoading } = usePrevensulBilling(month);
  const { data: ytdData = [], isLoading: isLoadingYtd } = usePrevensulBillingRange("2026-01", month);
  const { data: scheduleData = [], isLoading: isLoadingSchedule } = useBillingScheduleForMonth(month);

  // Busca todos os registros de qualquer reference_month para calcular Faturamentos Novos
  // pela data real de fechamento do contrato (closing_date), não pelo mês de lançamento
  const { data: allRecords = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ["prevensul_billing_all_for_new"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prevensul_billing")
        .select("id, client_name, contract_total, closing_date");
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Detail arrays
  const billedDetail: BilledDetail[] = data
    .filter((r: any) => (r.contract_total ?? 0) > 0)
    .map((r: any) => ({ client_name: r.client_name ?? "", contract_total: r.contract_total ?? 0 }));

  // Faturamentos Novos: deduplica por client_name+closing_date para evitar
  // contar o mesmo contrato replicado em múltiplos reference_months.
  const newInMonth = allRecords.filter(
    (r: any) => parseDateToYearMonth(r.closing_date) === month
  );
  const seenClients = new Set<string>();
  const newDetail: NewDetail[] = [];
  for (const r of newInMonth) {
    const key = `${r.client_name}__${r.closing_date}`;
    if (seenClients.has(key)) continue;
    seenClients.add(key);
    newDetail.push({
      client_name: (r as any).client_name ?? "",
      closing_date: (r as any).closing_date ?? "",
      contract_total: (r as any).contract_total ?? 0,
    });
  }

  const forecastDetail = calcPrevisaoDetail(data, scheduleData, month);

  const receivedDetail: ReceivedDetail[] = data
    .filter((r: any) => (r.amount_paid ?? 0) > 0)
    .map((r: any) => ({ client_name: r.client_name ?? "", amount_paid: r.amount_paid ?? 0 }));

  const commissionDetail: CommissionDetail[] = data
    .filter((r: any) => (r.commission_value ?? 0) > 0)
    .map((r: any) => ({
      client_name: r.client_name ?? "",
      amount_paid: r.amount_paid ?? 0,
      commission_rate: r.commission_rate ?? 0.03,
      commission_value: r.commission_value ?? 0,
    }));

  const ytdDetail: YtdDetail[] = ytdData
    .filter((r: any) => (r.amount_paid ?? 0) > 0)
    .map((r: any) => ({
      reference_month: r.reference_month ?? "",
      client_name: r.client_name ?? "",
      amount_paid: r.amount_paid ?? 0,
    }));

  // Totals
  const totalBilled = billedDetail.reduce((s, r) => s + r.contract_total, 0);
  const totalNew = newDetail.reduce((s, r) => s + r.contract_total, 0);
  const totalForecast = forecastDetail.reduce((s, r) => s + r.predicted_amount, 0);
  const totalReceived = receivedDetail.reduce((s, r) => s + r.amount_paid, 0);
  const totalCommission = commissionDetail.reduce((s, r) => s + r.commission_value, 0);
  const total2026 = ytdDetail.reduce((s, r) => s + r.amount_paid, 0);
  const totalRecords = data.length;

  return {
    totalBilled,
    totalNew,
    totalForecast,
    totalReceived,
    totalCommission,
    total2026,
    totalRecords,
    billedDetail,
    newDetail,
    forecastDetail,
    receivedDetail,
    commissionDetail,
    ytdDetail,
    isLoading: isLoading || isLoadingYtd || isLoadingSchedule || isLoadingAll,
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
        closing_date: null,
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

export function useDeleteAllBillingByMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (month: string) => {
      const { error } = await supabase.from("prevensul_billing").delete().eq("reference_month", month);
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
