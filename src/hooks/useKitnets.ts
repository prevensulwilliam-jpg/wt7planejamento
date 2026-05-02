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
    staleTime: 30 * 1000,
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
      qc.invalidateQueries({ queryKey: ["kitnet_alerts"] });
      qc.invalidateQueries({ queryKey: ["kitnet_alerts_month"] });
    },
  });
}

export function useCreateKitnetEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"kitnet_entries"> & { _kitnetCode?: string; _tenantName?: string }) => {
      // Fechamento de kitnet NUNCA cria receita automática.
      // Receita vem APENAS de: extrato bancário (importado) ou lançamento manual em /revenues.
      const { _kitnetCode: kitnetCode, _tenantName: tenantName, ...entryData } = entry;
      const { data: inserted, error } = await supabase
        .from("kitnet_entries").insert(entryData).select("id").single();
      if (error) throw error;

      const entryId = inserted?.id as string | undefined;
      const totalLiquid = Number(entryData.total_liquid ?? 0);
      const refMonth = entryData.reference_month as string | undefined;

      // Auto-match com bank_transaction órfão (crédito do mês, mesmo valor, sem kitnet_entry_id)
      if (entryId && totalLiquid > 0 && refMonth) {
        const [y, m] = refMonth.split("-");
        const start = `${y}-${m}-01`;
        const end = new Date(+y, +m, 0).toISOString().split("T")[0];
        const cents = Math.round(totalLiquid * 100);

        const { data: candidates } = await supabase
          .from("bank_transactions")
          .select("id, amount, matched_revenue_id")
          .eq("type", "credit")
          .gte("date", start)
          .lte("date", end)
          .is("kitnet_entry_id", null);

        const matches = (candidates ?? []).filter(
          (c: any) => Math.round(Math.abs(Number(c.amount)) * 100) === cents
        );

        if (matches.length === 1) {
          const bt = matches[0] as any;
          const label = kitnetCode ? `${kitnetCode}${tenantName ? " - " + tenantName : ""}` : null;

          // Linka bt → kitnet_entry, zera matched_revenue_id (FK ON DELETE SET NULL vai ajudar)
          await supabase
            .from("bank_transactions")
            .update({
              kitnet_entry_id: entryId as any,
              matched_revenue_id: null,
              status: "matched",
              category_confirmed: "aluguel_kitnets",
              category_intent: "receita",
              ...(label ? { category_label: label } : {}),
            })
            .eq("id", bt.id);

          // Marca fechamento como conciliado
          await supabase
            .from("kitnet_entries")
            .update({
              reconciled: true,
              bank_transaction_id: bt.id,
              reconciled_at: new Date().toISOString(),
            } as any)
            .eq("id", entryId);

          // Deleta revenue órfão (opção A: sem duplicidade entre /revenues e /kitnets)
          if (bt.matched_revenue_id) {
            await supabase.from("revenues").delete().eq("id", bt.matched_revenue_id);
          }
        }
      }

      return entryId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitnet_entries"] });
      qc.invalidateQueries({ queryKey: ["kitnet_fechamentos"] });
      qc.invalidateQueries({ queryKey: ["kitnet_alerts"] });
      qc.invalidateQueries({ queryKey: ["kitnet_alerts_month"] });
      qc.invalidateQueries({ queryKey: ["kitnet_entries_unreconciled"] });
      qc.invalidateQueries({ queryKey: ["kitnet_entries_unreconciled_count"] });
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
      qc.invalidateQueries({ queryKey: ["revenues"] });
    },
  });
}

// ─── Summary KPIs ───
export function useKitnetSummary(month: string) {
  const kitnets = useKitnets();
  const entries = useKitnetEntries(month);
  const monthStatusesQuery = useKitnetMonthStatuses(month);

  const data = kitnets.data ?? [];
  const entryData = entries.data ?? [];
  const statusMap = monthStatusesQuery.data ?? {};

  // Ocupadas = occupied + maintenance — respeita override por mês
  const occupied = data.filter(k => {
    const eff = statusMap[k.id] ?? k.status ?? "vacant";
    return eff === "occupied" || eff === "maintenance";
  }).length;
  // Vagas = tudo que NÃO é occupied/maintenance
  const vacant = data.length - occupied;
  // Total recebido = soma total_liquid apenas dos fechamentos JÁ conciliados
  const totalReceived = entryData
    .filter(e => e.reconciled === true)
    .reduce((s, e) => s + (e.total_liquid ?? 0), 0);
  // Recebidos = fechamentos conciliados do mês
  const received = entryData.filter(e => e.reconciled === true).length;
  // Total de lançamentos do mês (conciliados + pendentes)
  const totalEntries = entryData.length;

  return {
    total: data.length,
    occupied,
    vacant,
    totalReceived,
    received,
    totalEntries,
    isLoading: kitnets.isLoading || entries.isLoading || monthStatusesQuery.isLoading,
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
        .update({ reconciled: true, bank_transaction_id: bankTransactionId, reconciled_at: new Date().toISOString() } as any)
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

/** Concilia um fechamento vinculando 1 ou mais transações bancárias */
export function useReconcileWithTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entryId,
      transactionIds,
    }: {
      entryId: string;
      transactionIds: string[];
    }) => {
      if (transactionIds.length > 0) {
        // 1. Busca dados das transações selecionadas (valor + revenue órfã linkada)
        const { data: txData, error: txFetchError } = await supabase
          .from("bank_transactions")
          .select("id, amount, matched_revenue_id")
          .in("id", transactionIds);
        if (txFetchError) throw txFetchError;

        // 2. Upsert em kitnet_entry_transactions (tabela de junção N:1 pra pingados)
        const rows = (txData ?? []).map((t: any) => ({
          kitnet_entry_id: entryId,
          bank_transaction_id: t.id,
          amount: Number(t.amount),
        }));
        const { error: linkError } = await (supabase as any)
          .from("kitnet_entry_transactions")
          .upsert(rows, { onConflict: "kitnet_entry_id,bank_transaction_id" });
        if (linkError) throw linkError;

        // 3. Atualiza bank_transactions: status matched, zera revenue, categoria kitnet
        //    Se for única transação, seta também kitnet_entry_id direto (facilita filtros).
        const singleLink = transactionIds.length === 1;
        await supabase
          .from("bank_transactions")
          .update({
            status: "matched",
            matched_revenue_id: null,
            category_confirmed: "aluguel_kitnets",
            category_intent: "receita",
            ...(singleLink ? { kitnet_entry_id: entryId as any } : {}),
          })
          .in("id", transactionIds);

        // 4. Deleta revenues órfãs (opção A: fechamento é fonte única)
        const orphanRevenueIds = (txData ?? [])
          .map((t: any) => t.matched_revenue_id)
          .filter((id: string | null): id is string => !!id);
        if (orphanRevenueIds.length > 0) {
          await supabase.from("revenues").delete().in("id", orphanRevenueIds);
        }
      }

      // 5. Marca o fechamento como conciliado
      const { error: updateError } = await supabase
        .from("kitnet_entries")
        .update({
          reconciled: true,
          bank_transaction_id: transactionIds[0] ?? null,
          reconciled_at: new Date().toISOString(),
        } as any)
        .eq("id", entryId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitnet_entries_unreconciled"] });
      qc.invalidateQueries({ queryKey: ["kitnet_entries_unreconciled_count"] });
      qc.invalidateQueries({ queryKey: ["kitnet_entries"] });
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["kitnet_linked_bt_ids"] });
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

// ─── Month Lock ───

export function useLockedMonth(month: string) {
  return useQuery({
    queryKey: ["locked_months", month],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("locked_months")
        .select("*")
        .eq("reference_month", month)
        .eq("is_locked", true)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; reference_month: string; locked_by: string; locked_at: string } | null;
    },
    enabled: !!month,
  });
}

export function useLockMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (month: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      // Upsert locked state
      const { error } = await (supabase as any)
        .from("locked_months")
        .upsert({ reference_month: month, locked_by: user?.id, locked_at: new Date().toISOString(), is_locked: true }, { onConflict: "reference_month" });
      if (error) throw error;
      // Log
      await (supabase as any).from("month_lock_log").insert({ reference_month: month, action: "lock", performed_by: user?.id });
    },
    onSuccess: (_d, month) => qc.invalidateQueries({ queryKey: ["locked_months", month] }),
  });
}

export function useUnlockMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (month: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("locked_months")
        .update({ is_locked: false })
        .eq("reference_month", month);
      if (error) throw error;
      await (supabase as any).from("month_lock_log").insert({ reference_month: month, action: "unlock", performed_by: user?.id });
    },
    onSuccess: (_d, month) => qc.invalidateQueries({ queryKey: ["locked_months", month] }),
  });
}

// ─── Kitnet Alerts (saldo pendente entre meses) ───

export function useKitnetAlerts(kitnetId: string | null, month: string) {
  return useQuery({
    queryKey: ["kitnet_alerts", kitnetId, month],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kitnet_alerts")
        .select("*")
        .eq("kitnet_id", kitnetId)
        .eq("alert_month", month)
        .eq("resolved", false);
      if (error) throw error;
      return data as { id: string; pending_amount: number; source_month: string; alert_type: string }[];
    },
    enabled: !!kitnetId && !!month,
  });
}

export function useCreateKitnetAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { kitnet_id: string; source_entry_id: string; alert_month: string; source_month: string; pending_amount: number }) => {
      const { error } = await (supabase as any).from("kitnet_alerts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kitnet_alerts"] }),
  });
}

export function useResolveKitnetAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await (supabase as any)
        .from("kitnet_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kitnet_alerts"] }),
  });
}

export function useConfirmAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirmed }: { id: string; confirmed: boolean }) => {
      const { error } = await (supabase as any)
        .from("kitnet_alerts")
        .update({ confirmed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitnet_alerts"] });
      qc.invalidateQueries({ queryKey: ["kitnet_alerts_month"] });
    },
  });
}

// Busca alertas de saldo pendente para exibir na tabela de lançamentos (por mês)
export function useKitnetAlertsForMonth(month: string) {
  return useQuery({
    queryKey: ["kitnet_alerts_month", month],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kitnet_alerts")
        .select("*")
        .eq("alert_month", month)
        .eq("resolved", false);
      if (error) throw error;
      return (data ?? []) as { id: string; kitnet_id: string; pending_amount: number; source_month: string }[];
    },
    enabled: !!month,
  });
}

// ─── Status por Mês por Kitnet ───────────────────────────────────────────────

/**
 * Retorna mapa kitnet_id → status efetivo para um mês específico.
 *
 * Regra de fallback (Opção B — propaga via leitura):
 *   1. Se houver override em kitnet_month_status para EXATAMENTE este mês → usa
 *   2. Senão, busca o ÚLTIMO override de meses anteriores → usa esse status
 *   3. Senão (sem nenhum histórico), cai pro k.status default no consumer
 *
 * Exemplo: kitnet com overrides fev=vacant, mar=occupied, abr=occupied.
 *   - Consultar mai/2026 → não tem override → usa abril (occupied) ✓
 *   - Consultar jul/2026 → não tem override → usa abril (occupied) ✓
 *   - Consultar jan/2026 → sem histórico anterior → cai pro k.status default
 */
export function useKitnetMonthStatuses(month: string) {
  return useQuery({
    queryKey: ["kitnet_month_status", month],
    queryFn: async () => {
      // Pega TODOS os overrides até este mês (inclusive)
      const { data, error } = await (supabase as any)
        .from("kitnet_month_status")
        .select("kitnet_id, status, reference_month")
        .lte("reference_month", month)
        .order("reference_month", { ascending: false });
      if (error) {
        console.warn("[useKitnetMonthStatuses] query error:", error.message);
        return {} as Record<string, string>;
      }
      // Como veio ordenado DESC, o primeiro de cada kitnet_id é o mais recente ≤ month
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => {
        if (!(r.kitnet_id in map)) map[r.kitnet_id] = r.status;
      });
      return map;
    },
    enabled: !!month,
  });
}

/**
 * Retorna o status efetivo de UMA kitnet para um mês específico.
 * Mesma regra de fallback de useKitnetMonthStatuses.
 * Retorna { status, source: 'override' | 'inherited' | null } pra UI distinguir.
 */
export function useKitnetMonthStatus(kitnetId: string | null, month: string) {
  return useQuery({
    queryKey: ["kitnet_month_status_single", kitnetId, month],
    queryFn: async () => {
      // 1. Tenta override exato deste mês
      const { data: exact, error: e1 } = await (supabase as any)
        .from("kitnet_month_status")
        .select("status, reference_month")
        .eq("kitnet_id", kitnetId)
        .eq("reference_month", month)
        .maybeSingle();
      if (e1) throw e1;
      if (exact) return { status: exact.status as string, source: "override" as const, inherited_from: month };

      // 2. Fallback: último override anterior
      const { data: prev, error: e2 } = await (supabase as any)
        .from("kitnet_month_status")
        .select("status, reference_month")
        .eq("kitnet_id", kitnetId)
        .lt("reference_month", month)
        .order("reference_month", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (e2) throw e2;
      if (prev) return { status: prev.status as string, source: "inherited" as const, inherited_from: prev.reference_month as string };

      return null;
    },
    enabled: !!kitnetId && !!month,
  });
}

/** Upsert: define o status de uma kitnet para um mês específico */
export function useUpsertKitnetMonthStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kitnetId, month, status }: { kitnetId: string; month: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("kitnet_month_status")
        .upsert(
          { kitnet_id: kitnetId, reference_month: month, status, updated_at: new Date().toISOString() },
          { onConflict: "kitnet_id,reference_month" }
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kitnet_month_status", vars.month] });
      qc.invalidateQueries({ queryKey: ["kitnet_month_status_single", vars.kitnetId, vars.month] });
    },
  });
}

// ─── Dados por Mês (tenant_name / tenant_phone / rent_value) ─────────────────

type MonthData = { kitnet_id: string; reference_month: string; tenant_name: string | null; tenant_phone: string | null; rent_value: number | null };

/**
 * Retorna mapa kitnet_id → dados efetivos para o mês (herança: busca o snapshot
 * mais recente ≤ month para cada kitnet).
 */
export function useKitnetMonthDataMap(month: string) {
  return useQuery({
    queryKey: ["kitnet_month_data_map", month],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kitnet_month_data")
        .select("kitnet_id, reference_month, tenant_name, tenant_phone, rent_value")
        .lte("reference_month", month)
        .order("reference_month", { ascending: false });
      if (error) throw error;
      // Agrupa por kitnet_id → pega o primeiro (mais recente) de cada
      const map: Record<string, MonthData> = {};
      for (const row of (data ?? []) as MonthData[]) {
        if (!map[row.kitnet_id]) map[row.kitnet_id] = row;
      }
      return map;
    },
    enabled: !!month,
  });
}

/**
 * Retorna os dados efetivos de uma única kitnet para um mês (snapshot mais recente ≤ month).
 */
export function useKitnetEffectiveData(kitnetId: string | null, month: string) {
  return useQuery({
    queryKey: ["kitnet_effective_data", kitnetId, month],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kitnet_month_data")
        .select("tenant_name, tenant_phone, rent_value, reference_month")
        .eq("kitnet_id", kitnetId)
        .lte("reference_month", month)
        .order("reference_month", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { tenant_name: string | null; tenant_phone: string | null; rent_value: number | null; reference_month: string } | null;
    },
    enabled: !!kitnetId && !!month,
  });
}

/** Upsert: cria/atualiza snapshot de dados para um mês específico de uma kitnet. */
export function useUpsertKitnetMonthData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      kitnetId, month, tenant_name, tenant_phone, rent_value,
    }: { kitnetId: string; month: string; tenant_name: string | null; tenant_phone: string | null; rent_value: number | null }) => {
      const { error } = await (supabase as any)
        .from("kitnet_month_data")
        .upsert(
          { kitnet_id: kitnetId, reference_month: month, tenant_name, tenant_phone, rent_value, updated_at: new Date().toISOString() },
          { onConflict: "kitnet_id,reference_month" }
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kitnet_month_data_map"] });
      qc.invalidateQueries({ queryKey: ["kitnet_effective_data", vars.kitnetId] });
    },
  });
}
