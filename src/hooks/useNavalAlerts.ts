import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NavalAlert = {
  id: string;
  detector: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  metric_name: string | null;
  metric_value: number | null;
  metric_threshold: number | null;
  detected_at: string;
  dismissed_at: string | null;
  dismissed_by_user: boolean;
};

/** Alertas ativos (não dismissed) — ordenados por severity desc + data desc. */
export function useNavalAlerts() {
  return useQuery<NavalAlert[]>({
    queryKey: ["naval_alerts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("naval_alerts")
        .select("*")
        .is("dismissed_at", null)
        .order("detected_at", { ascending: false });
      if (error) throw error;
      const order = { critical: 0, warning: 1, info: 2 };
      return (data ?? [] as NavalAlert[]).sort((a: NavalAlert, b: NavalAlert) =>
        (order[a.severity] ?? 99) - (order[b.severity] ?? 99)
      );
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

/** Dispara o detector manualmente (sem esperar o cron diário). */
export function useRunDailyCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("naval-daily-check", { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["naval_alerts"] }),
  });
}

/** Marca alerta como visto/resolvido. */
export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("naval_alerts")
        .update({ dismissed_at: new Date().toISOString(), dismissed_by_user: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["naval_alerts"] }),
  });
}
