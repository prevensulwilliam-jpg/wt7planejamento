/**
 * naval-cost-sync — sincroniza custos com Anthropic Admin API.
 *
 * Endpoint Anthropic: GET /v1/organizations/cost_report
 * Auth: header X-Api-Key com Admin Key (sk-ant-admin01-...)
 * Docs: https://platform.claude.com/docs/en/api/admin-api/usage-cost
 *
 * O que faz:
 *   1. Chama Anthropic Admin API com starting_at = primeiro dia do mês corrente
 *   2. Soma todos os amounts (em USD)
 *   3. Atualiza naval_cost_settings:
 *      - anthropic_mtd_cost_total_usd = MTD oficial
 *      - last_synced_at = now()
 *      - notes = breakdown por dia
 *   4. Retorna detalhes pra UI mostrar
 *
 * Trigger:
 *   - Manual via botão "Sincronizar agora" na UI
 *   - Auto via NavalMetricasContent quando last_synced_at > 4h
 *
 * Secrets necessários:
 *   - ANTHROPIC_ADMIN_KEY (formato sk-ant-admin01-...)
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (já existem)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CostReportItem {
  amount: string;          // Decimal string em CENTAVOS (ex "123.45" = $1.2345)
  currency: string;        // "USD"
  cost_type?: string;
  description?: string;
  model?: string;
  workspace_id?: string;
  token_type?: string;
  service_tier?: string;
}

interface CostReportBucket {
  starting_at: string;
  ending_at: string;
  results: CostReportItem[];
}

interface CostReportResponse {
  data: CostReportBucket[];
  has_more: boolean;
  next_page: string | null;
}

async function fetchCostReport(adminKey: string, startingAt: string, endingAt?: string): Promise<CostReportBucket[]> {
  const allBuckets: CostReportBucket[] = [];
  let page: string | undefined = undefined;
  let safetyCounter = 0;

  do {
    safetyCounter++;
    if (safetyCounter > 20) throw new Error("Pagination limit exceeded (>20 pages)");

    const params = new URLSearchParams({
      starting_at: startingAt,
      bucket_width: "1d",
    });
    if (endingAt) params.set("ending_at", endingAt);
    if (page) params.set("page", page);

    const url = `https://api.anthropic.com/v1/organizations/cost_report?${params.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "anthropic-version": "2023-06-01",
        "X-Api-Key": adminKey,
      },
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Anthropic Admin API error ${res.status}: ${err.slice(0, 300)}`);
    }

    const data = (await res.json()) as CostReportResponse;
    allBuckets.push(...(data.data ?? []));
    page = data.has_more ? (data.next_page ?? undefined) : undefined;
  } while (page);

  return allBuckets;
}

function sumBuckets(buckets: CostReportBucket[]): { totalCents: number; byDay: Array<{ day: string; cents: number }> } {
  let totalCents = 0;
  const byDay: Array<{ day: string; cents: number }> = [];
  for (const bucket of buckets) {
    let dayCents = 0;
    for (const r of bucket.results ?? []) {
      // amount está em "lowest currency unit" (cents pra USD)
      const cents = parseFloat(r.amount ?? "0");
      if (!isNaN(cents)) {
        dayCents += cents;
        totalCents += cents;
      }
    }
    byDay.push({ day: bucket.starting_at.slice(0, 10), cents: dayCents });
  }
  return { totalCents, byDay };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_ADMIN_KEY = Deno.env.get("ANTHROPIC_ADMIN_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ANTHROPIC_ADMIN_KEY) {
      return new Response(
        JSON.stringify({
          error: "ANTHROPIC_ADMIN_KEY não configurada",
          hint: "Adicione o secret no Supabase: Lovable → Settings → Edge Function Secrets → ANTHROPIC_ADMIN_KEY = sk-ant-admin01-...",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error("Supabase env missing");
    }

    if (!ANTHROPIC_ADMIN_KEY.startsWith("sk-ant-admin01-")) {
      return new Response(
        JSON.stringify({
          error: "Formato de key inválido",
          hint: "ANTHROPIC_ADMIN_KEY deve começar com 'sk-ant-admin01-' (Admin Key, não API Key normal). Crie em console.anthropic.com → Settings → API Keys → Create Key → marca 'Admin Key'.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Calcula starting_at = primeiro dia do mês corrente em UTC
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startingAt = monthStart.toISOString();

    console.log(`[naval-cost-sync] Buscando custos desde ${startingAt}`);
    const buckets = await fetchCostReport(ANTHROPIC_ADMIN_KEY, startingAt);
    const { totalCents, byDay } = sumBuckets(buckets);

    // amount vem em CENTAVOS (lowest currency unit) → divide por 100 pra ter USD
    const totalUsd = totalCents / 100;
    console.log(`[naval-cost-sync] MTD total: $${totalUsd.toFixed(4)} (${buckets.length} dias)`);

    // Monta breakdown legível
    const breakdownLines = byDay
      .map((d) => `${d.day}: $${(d.cents / 100).toFixed(4)}`)
      .join("\n");
    const notes = `Sincronizado via Admin API em ${now.toISOString()}.\nMTD: $${totalUsd.toFixed(4)} USD em ${buckets.length} dias.\n\nBreakdown por dia:\n${breakdownLines}`;

    // Atualiza naval_cost_settings (singleton id=1)
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { error: upsertErr } = await sb
      .from("naval_cost_settings")
      .upsert({
        id: 1,
        anthropic_mtd_cost_total_usd: Math.round(totalUsd * 10000) / 10000, // 4 decimais
        last_synced_at: now.toISOString(),
        notes: notes.slice(0, 5000),
      });
    if (upsertErr) {
      console.error("[naval-cost-sync] upsert error:", upsertErr);
      throw new Error(`Falha ao salvar: ${upsertErr.message}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        synced_at: now.toISOString(),
        mtd_total_usd: totalUsd,
        days_synced: buckets.length,
        breakdown_by_day: byDay.map((d) => ({ day: d.day, usd: d.cents / 100 })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[naval-cost-sync] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
