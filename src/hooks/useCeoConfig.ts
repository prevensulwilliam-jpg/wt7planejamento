import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Tipos ───
export interface CeoInvestimento { RWT02: number; RWT03: number; }
export interface CeoMetaMensal { RWT02: number; RWT03: number; }
export interface CeoLucroHistorico { valor: number; nota: string; }
export interface CeoProjecao { ano: string; unidades: number; }
export interface CeoCdi { taxa: number; }

export interface CeoConfigAll {
  investimento: CeoInvestimento;
  meta_mensal: CeoMetaMensal;
  lucro_historico: CeoLucroHistorico;
  projecao_crescimento: CeoProjecao[];
  cdi_referencia: CeoCdi;
}

// Defaults (usados se tabela ainda não foi criada/populada)
const DEFAULTS: CeoConfigAll = {
  investimento: { RWT02: 1_000_000, RWT03: 500_000 },
  meta_mensal: { RWT02: 14_400, RWT03: 6_700 },
  lucro_historico: { valor: 405_120, nota: "Estimativa 2024+2025 a 80% da meta" },
  projecao_crescimento: [
    { ano: "Hoje", unidades: 13 },
    { ano: "2026", unidades: 28 },
    { ano: "2027", unidades: 43 },
    { ano: "2028", unidades: 58 },
  ],
  cdi_referencia: { taxa: 10.5 },
};

// ─── Hook principal: busca todas as configs ───
export function useCeoConfig() {
  return useQuery({
    queryKey: ["ceo_config"],
    queryFn: async (): Promise<CeoConfigAll> => {
      const { data, error } = await supabase
        .from("ceo_config" as any)
        .select("config_key, config_value");

      if (error || !data) return DEFAULTS;

      const map: Record<string, any> = {};
      (data as any[]).forEach((row: any) => {
        map[row.config_key] = row.config_value;
      });

      return {
        investimento: map.investimento ?? DEFAULTS.investimento,
        meta_mensal: map.meta_mensal ?? DEFAULTS.meta_mensal,
        lucro_historico: map.lucro_historico ?? DEFAULTS.lucro_historico,
        projecao_crescimento: map.projecao_crescimento ?? DEFAULTS.projecao_crescimento,
        cdi_referencia: map.cdi_referencia ?? DEFAULTS.cdi_referencia,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Hook de update: atualiza uma config por key ───
export function useUpdateCeoConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ceo_config" as any)
        .upsert(
          { config_key: key, config_value: value, updated_by: user.user?.id, updated_at: new Date().toISOString() } as any,
          { onConflict: "config_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ceo_config"] });
    },
  });
}
