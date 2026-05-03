/**
 * useNavalCostSettings — KV singleton de calibragem de custos Naval.
 * Permite William sincronizar valores reais do painel Anthropic com o WT7.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NavalCostSettings {
  id: number;
  usd_to_brl: number;
  anthropic_balance_usd: number | null;
  anthropic_mtd_cost_usd: number | null;
  anthropic_mtd_cost_total_usd: number | null;
  api_key_label: string;
  notes: string | null;
  last_synced_at: string | null;
  updated_at: string;
}

export function useNavalCostSettings() {
  return useQuery({
    queryKey: ["naval_cost_settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("naval_cost_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? {
        id: 1,
        usd_to_brl: 5.0,
        anthropic_balance_usd: null,
        anthropic_mtd_cost_usd: null,
        anthropic_mtd_cost_total_usd: null,
        api_key_label: "NavaWT7",
        notes: null,
        last_synced_at: null,
        updated_at: new Date().toISOString(),
      }) as NavalCostSettings;
    },
  });
}

export interface UpdateCostSettingsInput {
  usd_to_brl?: number;
  anthropic_balance_usd?: number | null;
  anthropic_mtd_cost_usd?: number | null;
  anthropic_mtd_cost_total_usd?: number | null;
  api_key_label?: string;
  notes?: string | null;
}

export function useUpdateNavalCostSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: UpdateCostSettingsInput) => {
      const { data, error } = await (supabase as any)
        .from("naval_cost_settings")
        .upsert({ id: 1, ...patch, last_synced_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      return data as NavalCostSettings;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["naval_cost_settings"] }),
  });
}

export interface SyncCostResult {
  ok: boolean;
  synced_at: string;
  mtd_total_usd: number;
  days_synced: number;
  breakdown_by_day?: Array<{ day: string; usd: number }>;
}

/**
 * Aciona naval-cost-sync edge function que chama Anthropic Admin API
 * e atualiza naval_cost_settings com MTD oficial.
 *
 * Requer secret ANTHROPIC_ADMIN_KEY configurado no Supabase.
 */
export function useSyncNavalCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<SyncCostResult> => {
      const { data, error } = await supabase.functions.invoke("naval-cost-sync", { body: {} });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Falha ao sincronizar");
      return data as SyncCostResult;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["naval_cost_settings"] }),
  });
}
