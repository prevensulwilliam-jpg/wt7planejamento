import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Business = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  partner_name: string | null;
  ownership_pct: number;
  status: "ativo" | "incubado" | "encerrado";
  category: "recorrente" | "crescimento" | "incubado";
  monthly_target: number;
  target_year_end: number;
  target_year_end_date: string | null;
  icon: string | null;
  color: string | null;
  notes: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type BusinessRevenueEntry = {
  id: string;
  business_id: string;
  reference_month: string;
  amount_william: number;
  amount_total: number | null;
  notes: string | null;
  created_at: string;
};

export function useBusinesses() {
  return useQuery({
    queryKey: ["businesses"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as Business[];
    },
  });
}

export function useCreateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Business>) => {
      const { error } = await (supabase as any).from("businesses").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["businesses"] }),
  });
}

export function useUpdateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Business> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("businesses")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["businesses"] }),
  });
}

export function useDeleteBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("businesses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["businesses"] }),
  });
}

export function useBusinessRevenueEntries(businessId?: string) {
  return useQuery({
    queryKey: ["business_revenue_entries", businessId ?? "all"],
    queryFn: async () => {
      const q = (supabase as any).from("business_revenue_entries").select("*").order("reference_month", { ascending: false });
      const { data, error } = businessId ? await q.eq("business_id", businessId) : await q;
      if (error) throw error;
      return data as BusinessRevenueEntry[];
    },
  });
}

export function useUpsertRevenueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<BusinessRevenueEntry> & { business_id: string; reference_month: string; amount_william: number }) => {
      const { error } = await (supabase as any)
        .from("business_revenue_entries")
        .upsert(payload, { onConflict: "business_id,reference_month" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business_revenue_entries"] }),
  });
}

export function useDeleteRevenueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("business_revenue_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business_revenue_entries"] }),
  });
}

// ─── Detalhamento: quais receitas compõem o valor de um negócio em um mês ───
export type BusinessBreakdownEntry = {
  id: string;
  kind: "kitnet" | "revenue" | "manual";
  description: string;
  amount: number;
  date: string | null;
  source: string | null;
  business_id: string | null;
};

export function useBusinessBreakdown(businessId: string | null, businessCode: string | null, month: string) {
  return useQuery({
    queryKey: ["business_breakdown", businessId, month],
    enabled: !!businessId,
    queryFn: async () => {
      const rows: BusinessBreakdownEntry[] = [];

      if (businessCode === "KITNETS") {
        const { data } = await (supabase as any)
          .from("kitnet_entries")
          .select("id, reference_month, rent_gross, total_liquid, kitnets(code, tenant_name, residencial_code)")
          .eq("reference_month", month);
        (data ?? []).forEach((e: any) => {
          rows.push({
            id: e.id,
            kind: "kitnet",
            description: `${e.kitnets?.residencial_code ?? ""} ${e.kitnets?.code ?? ""} — ${e.kitnets?.tenant_name ?? "(vago)"}`,
            amount: Number(e.total_liquid ?? 0),
            date: null,
            source: "kitnet_entries",
            business_id: businessId,
          });
        });
      }

      // KITNETS usa kitnet_entries como fonte canônica (evita duplicação com revenues auto-criadas)
      // Mesma regra aplicada em useBusinessRealized
      if (businessCode !== "KITNETS") {
        const { data: revs } = await (supabase as any)
          .from("revenues")
          .select("id, description, source, amount, received_at, business_id")
          .eq("reference_month", month)
          .eq("business_id", businessId);
        (revs ?? []).forEach((r: any) => {
          rows.push({
            id: r.id,
            kind: "revenue",
            description: r.description ?? r.source ?? "(sem descrição)",
            amount: Number(r.amount ?? 0),
            date: r.received_at,
            source: r.source,
            business_id: r.business_id,
          });
        });
      }

      const { data: manual } = await (supabase as any)
        .from("business_revenue_entries")
        .select("id, amount_william, notes")
        .eq("business_id", businessId)
        .eq("reference_month", month);
      (manual ?? []).forEach((m: any) => {
        rows.push({
          id: m.id,
          kind: "manual",
          description: m.notes ?? "Ajuste manual",
          amount: Number(m.amount_william),
          date: null,
          source: "manual_override",
          business_id: businessId,
        });
      });

      return rows;
    },
  });
}

// Totais do mês: todas as receitas + só as vinculadas — pra calcular gap
export function useMonthRevenueReconciliation(month: string) {
  return useQuery({
    queryKey: ["revenues_reconciliation", month],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("revenues")
        .select("amount, business_id")
        .eq("reference_month", month);
      if (error) throw error;
      let total = 0, linked = 0, unlinked = 0, unlinkedCount = 0;
      (data ?? []).forEach((r: any) => {
        const a = Number(r.amount ?? 0);
        total += a;
        if (r.business_id) linked += a;
        else { unlinked += a; unlinkedCount++; }
      });
      return { total, linked, unlinked, unlinkedCount };
    },
  });
}

// Receitas do mês SEM negócio vinculado — pra oferecer reconciliação rápida
export function useUnlinkedRevenuesForMonth(month: string) {
  return useQuery({
    queryKey: ["revenues_unlinked", month],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("revenues")
        .select("id, description, source, amount, received_at, business_id")
        .eq("reference_month", month)
        .is("business_id", null)
        .order("received_at", { ascending: false });
      if (error) throw error;
      return data as Array<{ id: string; description: string | null; source: string | null; amount: number; received_at: string | null; business_id: string | null }>;
    },
  });
}

export function useLinkRevenueToBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ revenueId, businessId }: { revenueId: string; businessId: string | null }) => {
      const { error } = await (supabase as any)
        .from("revenues")
        .update({ business_id: businessId })
        .eq("id", revenueId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business_realized"] });
      qc.invalidateQueries({ queryKey: ["business_breakdown"] });
      qc.invalidateQueries({ queryKey: ["revenues_unlinked"] });
      qc.invalidateQueries({ queryKey: ["revenues"] });
    },
  });
}

// ─── Entradas neutras TOTAIS do mês (independente de business_id) ───────────
// Usado pro banner consolidado em /negocios. Diferente do `neutral` por business
// no useBusinessRealized: este pega TODAS as revenues com counts_as_income=false
// do mês, mesmo as órfãs (sem business_id ou apontando pra business deletado).
//
// Espelha exatamente o KPI "Entradas Neutras" de /revenues.
export function useMonthNeutralEntries(month: string) {
  return useQuery({
    queryKey: ["month_neutral_entries", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenues")
        .select("amount, business_id, description, source, nature")
        .eq("reference_month", month)
        .eq("counts_as_income", false);
      if (error) throw error;
      const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      return { total, count: (data ?? []).length, items: data ?? [] };
    },
  });
}

// ─── Acumulado Year-To-Date (jan/Y → mês corrente) ──────────────────────────
// Soma realizado de todos os meses do ano corrente, por negócio. Usado pra KPI
// "Acumulado 2026" no /negocios. Mesmo critério de useBusinessRealized:
// kitnets via kitnet_entries (fonte canônica), demais via revenues.
export function useBusinessYTDRealized(year: number) {
  return useQuery({
    queryKey: ["business_ytd_realized", year],
    queryFn: async () => {
      const start = `${year}-01`;
      const end = `${year}-12`;
      const result = new Map<string, number>();

      const { data: kitnetBiz } = await (supabase as any)
        .from("businesses").select("id").eq("code", "KITNETS").maybeSingle();
      const kitnetBizId = kitnetBiz?.id ?? null;

      // 1. Kitnets — soma todos os fechamentos reconciled do ano
      if (kitnetBizId) {
        const { data: entries } = await (supabase as any)
          .from("kitnet_entries")
          .select("total_liquid, reference_month, reconciled")
          .gte("reference_month", start)
          .lte("reference_month", end);
        const total = ((entries ?? []) as any[])
          .filter(e => e.reconciled === true)
          .reduce((s, e) => s + Number(e.total_liquid ?? 0), 0);
        result.set(kitnetBizId, total);
      }

      // 2. Revenues do ano agregadas por business_id (skip KITNETS — duplica)
      const { data: revs } = await (supabase as any)
        .from("revenues")
        .select("business_id, amount, counts_as_income")
        .gte("reference_month", start)
        .lte("reference_month", end)
        .not("business_id", "is", null);
      ((revs ?? []) as any[])
        .filter(r => r.counts_as_income !== false)
        .forEach(r => {
          if (!r.business_id || r.business_id === kitnetBizId) return;
          result.set(r.business_id, (result.get(r.business_id) ?? 0) + Number(r.amount));
        });

      // 3. Override manual sobrescreve total do mês
      const { data: manual } = await (supabase as any)
        .from("business_revenue_entries")
        .select("business_id, amount_william, reference_month")
        .gte("reference_month", start)
        .lte("reference_month", end);
      // Para cada business com manual override, soma manual ao invés de revenue
      // (já que useBusinessRealized faz override TOTAL no mês com manual)
      const manualByBiz = new Map<string, number>();
      ((manual ?? []) as any[]).forEach(m => {
        manualByBiz.set(m.business_id, (manualByBiz.get(m.business_id) ?? 0) + Number(m.amount_william));
      });
      // Aplica override apenas se houver manual (caso contrário mantém soma auto)
      manualByBiz.forEach((amount, bizId) => {
        if (bizId !== kitnetBizId) result.set(bizId, amount);
      });

      return result;
    },
  });
}

// ─── Agregação automática por negócio ────────────────────────────────────────
// Kitnets: soma kitnet_entries.total_liquid RECONCILED do mês (Modelo A)
// Demais: soma revenues WHERE business_id = X do mês:
//         - amount   = counts_as_income=true (receita REAL — vai pro KPI Realizado)
//         - neutral  = counts_as_income=false (transfer/reembolso/estorno —
//                      mostrado no card como informativo, NÃO entra no Realizado)
// Override manual: se houver business_revenue_entries do mês, sobrepõe cálculo
//                  do amount (neutral preserva).
//
// O campo `neutral` espelha o KPI "Entradas Neutras" do /revenues, mas
// segmentado por negócio (cada card vê suas próprias).
export function useBusinessRealized(month: string) {
  return useQuery({
    queryKey: ["business_realized", month],
    queryFn: async () => {
      const result = new Map<string, { amount: number; neutral: number; source: "auto" | "manual" | "kitnet" }>();

      // 1. Kitnets (caso especial — Modelo A: só conta fechamentos reconciled)
      const { data: kitnetBiz } = await (supabase as any)
        .from("businesses").select("id").eq("code", "KITNETS").maybeSingle();
      if (kitnetBiz?.id) {
        const { data: entries } = await (supabase as any)
          .from("kitnet_entries")
          .select("total_liquid, reconciled")
          .eq("reference_month", month);
        const total = ((entries ?? []) as any[])
          .filter(e => e.reconciled === true)
          .reduce((s: number, e: any) => s + Number(e.total_liquid ?? 0), 0);
        result.set(kitnetBiz.id, { amount: total, neutral: 0, source: "kitnet" });
      }

      // 2. Revenues agregados por business_id (com split real × neutral)
      // IMPORTANTE 1: pula revenues linkadas a KITNETS pra evitar dupla contagem
      //   no AMOUNT — mas neutral de KITNETS (ex: reembolso Walmir RWT05) é
      //   contabilizado normalmente pra aparecer no card.
      // IMPORTANTE 2: separa counts_as_income true (amount) de false (neutral).
      const kitnetBizId = kitnetBiz?.id ?? null;
      const { data: revs, error: revErr } = await (supabase as any)
        .from("revenues")
        .select("business_id, amount, counts_as_income")
        .eq("reference_month", month)
        .not("business_id", "is", null);
      if (revErr) throw revErr;
      (revs ?? []).forEach((r: any) => {
        if (!r.business_id) return;
        const isNeutral = r.counts_as_income === false;
        const isKitnet = r.business_id === kitnetBizId;

        // KITNETS: amount sempre vem de kitnet_entries (Modelo A); só adiciona neutral
        // Outros: amount soma counts_as_income=true; neutral soma counts_as_income=false
        const existing = result.get(r.business_id) ?? { amount: 0, neutral: 0, source: "auto" as const };
        if (isNeutral) {
          existing.neutral += Number(r.amount);
        } else if (!isKitnet) {
          existing.amount += Number(r.amount);
        }
        result.set(r.business_id, existing);
      });

      // 3. Override manual (business_revenue_entries) — só sobrescreve amount
      const { data: manual } = await (supabase as any)
        .from("business_revenue_entries")
        .select("business_id, amount_william")
        .eq("reference_month", month);
      (manual ?? []).forEach((m: any) => {
        // Override TOTAL do amount (não soma); preserva neutral acumulado
        const existing = result.get(m.business_id) ?? { amount: 0, neutral: 0, source: "manual" as const };
        result.set(m.business_id, { amount: Number(m.amount_william), neutral: existing.neutral, source: "manual" });
      });

      return result;
    },
  });
}

