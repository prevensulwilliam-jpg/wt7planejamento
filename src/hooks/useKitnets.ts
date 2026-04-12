import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ─── Kitnets ───
export function useKitnets() {
  return useQuery({
    queryKey: ["kitnets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kitnets")
        .select("*")
        .order("residencial_code")
        .order("unit_number");
      if (error) throw error;
      return data as Tables<"kitnets">[];
    },
  });
}

export function useUpdateKitnet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"kitnets"> & { id: string }) => {
      const { error } = await supabase.from("kitnets").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kitnets"] }),
  });
}

// ─── Kitnet Entries ───
export function useKitnetEntriesForKitnet(kitnetId: string | null) {
  return useQuery({
    queryKey: ["kitnet_entries_for", kitnetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kitnet_entries")
        .select("*")
        .eq("kitnet_id", kitnetId!)
        .order("reference_month", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!kitnetId,
  });
}

export function useKitnetEntries(month: string) {
  return useQuery({
    queryKey: ["kitnet_entries", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kitnet_entries")
        .select("*, kitnets(code, tenant_name, residencial_code)")
        .eq("reference_month", month)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!month,
  });
}

export function useUpdateKitnetEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TablesInsert<"kitnet_entries">> & { id: string }) => {
      const { error } = await supabase.from("kitnet_entries").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitnet_entries"] });
      qc.invalidateQueries({ queryKey: ["kitnet_fechamentos"] });
    },
  });
}

export function useCreateKitnetEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"kitnet_entries"> & { _kitnetCode?: string; _tenantName?: string }) => {
      const { _kitnetCode, _tenantName, ...entryData } = entry;
      const { error } = await supabase.from("kitnet_entries").insert(entryData);
      if (error) throw error;

      // Auto-create revenue for bank reconciliation matching by value
      if (entryData.total_liquid && entryData.total_liquid > 0 && entryData.reference_month) {
        const description = _kitnetCode
          ? `Repasse ${_kitnetCode}${_tenantName ? ` — ${_tenantName}` : ""}`
          : "Repasse Kitnet";

        // Avoid duplicates: check if revenue already exists for this kitnet+month
        const { data: existing } = await supabase
          .from("revenues")
          .select("id")
          .eq("source", "kitnets")
          .eq("reference_month", entryData.reference_month)
          .ilike("description", `%${_kitnetCode ?? ""}%`)
          .maybeSingle();

        if (!existing) {
          await supabase.from("revenues").insert({
            source: "kitnets",
            description,
            amount: entryData.total_liquid,
            type: "fixed",
            reference_month: entryData.reference_month,
            received_at: entryData.period_end ?? entryData.period_start ?? null,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitnet_entries"] });
      qc.invalidateQueries({ queryKey: ["revenues"] });
    },
  });
}

// ─── Summary KPIs ───
export function useKitnetSummary(month: string) {
  const kitnets = useKitnets();
  const entries = useKitnetEntries(month);

  const data = kitnets.data ?? [];
  const entryData = entries.data ?? [];

  const occupied = data.filter(k => k.status === "occupied").length;
  const maintenance = data.filter(k => k.status === "maintenance").length;
  const vacant = data.filter(k => k.status === "vacant").length;
  const totalReceived = entryData.reduce((s, e) => s + (e.total_liquid ?? 0), 0);

  return {
    occupied,
    maintenance,
    vacant,
    totalReceived,
    isLoading: kitnets.isLoading || entries.isLoading,
  };
}

// ─── CELESC Invoices ───
export function useCelescInvoices(month?: string) {
  return useQuery({
    queryKey: ["celesc_invoices", month],
    queryFn: async () => {
      let q = supabase.from("celesc_invoices").select("*").order("reference_month", { ascending: false });
      if (month) q = q.eq("reference_month", month);
      const { data, error } = await q;
      if (error) throw error;
      return data as Tables<"celesc_invoices">[];
    },
  });
}

export function useCreateCelescInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoice: TablesInsert<"celesc_invoices">) => {
      const { error } = await supabase.from("celesc_invoices").insert(invoice);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["celesc_invoices"] }),
  });
}

export function useUpdateCelescInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TablesInsert<"celesc_invoices">> & { id: string }) => {
      const { error } = await supabase.from("celesc_invoices").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["celesc_invoices"] }),
  });
}

// ─── Energy Readings ───
export function useEnergyReadings(month: string, residencialCode?: string) {
  return useQuery({
    queryKey: ["energy_readings", month, residencialCode],
    queryFn: async () => {
      let q = supabase
        .from("energy_readings")
        .select("*, kitnets(code, tenant_name, residencial_code, unit_number)")
        .eq("reference_month", month);
      const { data, error } = await q;
      if (error) throw error;
      // Filter by residencial code client-side since it's on the joined table
      if (residencialCode) {
        return data.filter((r: any) => r.kitnets?.residencial_code === residencialCode);
      }
      return data;
    },
    enabled: !!month,
  });
}

// ─── Kitnet Entries by kitnet ───
export function useKitnetFechamentos(kitnetId: string | null) {
  return useQuery({
    queryKey: ["kitnet_fechamentos", kitnetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kitnet_entries")
        .select("*")
        .eq("kitnet_id", kitnetId!)
        .order("reference_month", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!kitnetId,
  });
}

// ─── Last energy reading for a kitnet ───
export function useLastEnergyReading(kitnetId: string | null) {
  return useQuery({
    queryKey: ["last_energy_reading", kitnetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("energy_readings")
        .select("*")
        .eq("kitnet_id", kitnetId!)
        .order("reference_month", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!kitnetId,
  });
}

export function useSaveEnergyReadings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (readings: TablesInsert<"energy_readings">[]) => {
      const { error } = await supabase.from("energy_readings").upsert(readings, {
        onConflict: "id",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["energy_readings"] }),
  });
}

// ─── Energy Config (tarifa por complexo) ───
export function useEnergyConfig() {
  return useQuery({
    queryKey: ["energy_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("energy_config" as any)
        .select("*")
        .order("residencial_code");
      if (error) throw error;
      return data as unknown as { id: string; residencial_code: string; tariff_kwh: number }[];
    },
  });
}

export function useUpdateEnergyTariff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ residencial_code, tariff_kwh }: { residencial_code: string; tariff_kwh: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("energy_config" as any)
        .update({ tariff_kwh, updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq("residencial_code", residencial_code);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["energy_config"] }),
  });
}

// ─── Conciliação de Kitnets ───

/** Todos os fechamentos não conciliados, opcionalmente filtrados por mês */
export function useUnreconciledEntries(month?: string) {
  return useQuery({
    queryKey: ["kitnet_entries_unreconciled", month],
    queryFn: async () => {
      let q = supabase
        .from("kitnet_entries")
        .select("*, kitnets(code, residencial_code, tenant_name)")
        .eq("reconciled", false)
        .order("reference_month", { ascending: false });
      if (month) q = q.eq("reference_month", month);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Conta total de fechamentos não conciliados (para widget do Dashboard) */
export function useUnreconciledCount() {
  return useQuery({
    queryKey: ["kitnet_entries_unreconciled_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("kitnet_entries")
        .select("id", { count: "exact", head: true })
        .eq("reconciled", false);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000, // atualiza a cada 1 min
  });
}

/** Marca um fechamento como conciliado e vincula a uma transação bancária */
export function useReconcileKitnetEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entryId,
      bankTransactionId,
    }: {
      entryId: string;
      bankTransactionId: string | null;
    }) => {
      const { error } = await supabase
        .from("kitnet_entries")
        .update({ reconciled: true, bank_transaction_id: bankTransactionId })
        .eq("id", entryId);
      if (error) throw error;
      // Marca a transação bancária como matched se vinculada
      if (bankTransactionId) {
        await supabase
          .from("bank_transactions")
          .update({ status: "matched" })
          .eq("id", bankTransactionId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitnet_entries_unreconciled"] });
      qc.invalidateQueries({ queryKey: ["kitnet_entries_unreconciled_count"] });
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
    },
  });
}

// ─── Delete Kitnet Entry ───
export function useDeleteKitnetEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.from("kitnet_entries").delete().eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitnet_entries"] });
      qc.invalidateQueries({ queryKey: ["kitnet_entries_unreconciled"] });
      qc.invalidateQueries({ queryKey: ["kitnet_entries_unreconciled_count"] });
      qc.invalidateQueries({ queryKey: ["kitnet_fechamentos"] });
      qc.invalidateQueries({ queryKey: ["kitnet_entries_for"] });
    },
  });
}

// ─── Prev Month Helper ───
export function usePrevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Energy Readings Summary (agrupado por complexo) ───
export function useEnergyReadingsSummary(month: string) {
  return useQuery({
    queryKey: ["energy_readings_summary", month],
    queryFn: async () => {
      // Busca todas as leituras do mês com join em kitnets para pegar residencial_code
      const { data, error } = await supabase
        .from("energy_readings")
        .select("amount_to_charge, kitnet:kitnets(residencial_code)")
        .eq("reference_month", month);
      if (error) throw error;

      // Agrupa por residencial_code
      const summary: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const code = r.kitnet?.residencial_code;
        if (code) summary[code] = (summary[code] ?? 0) + (r.amount_to_charge ?? 0);
      });
      return summary; // { RWT02: 1187.43, RWT03: 891.12 }
    },
    enabled: !!month,
  });
}
