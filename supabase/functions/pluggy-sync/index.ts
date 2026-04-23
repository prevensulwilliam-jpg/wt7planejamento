// ═══════════════════════════════════════════════════════════════════
// pluggy-sync — sincroniza transações via Pluggy com semântica segura:
//
//   1. Janela de busca = desde o último last_sync menos 3 dias de overlap
//      (fallback 90 dias no primeiro sync). 30 dias fixos era bug —
//      perdia transações se o William não rodasse por 31+ dias.
//
//   2. Para transações JÁ existentes (external_id match), só atualiza
//      campos não-semânticos (description, raw_data). NUNCA sobrescreve
//      status, kitnet_entry_id, matched_revenue_id, category_confirmed,
//      category_intent — esses são estados de conciliação do usuário.
//
//   3. Erros da API do Pluggy são reportados, não silenciosos.
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_OVERLAP = 3;          // reimporta últimos 3 dias pra pegar lançamentos tardios
const DAYS_FIRST_SYNC = 90;      // janela do primeiro sync (sem last_sync)

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PLUGGY_CLIENT_ID = Deno.env.get("PLUGGY_CLIENT_ID") ?? "";
    const PLUGGY_CLIENT_SECRET = Deno.env.get("PLUGGY_CLIENT_SECRET") ?? "";

    if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "Pluggy não configurado. Adicione PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nos secrets." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Auth with Pluggy
    const authRes = await fetch("https://api.pluggy.ai/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET }),
    });
    if (!authRes.ok) {
      const text = await authRes.text();
      return new Response(
        JSON.stringify({ error: `Pluggy auth falhou (${authRes.status}): ${text}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { apiKey } = await authRes.json();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Pluggy auth retornou sem apiKey." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Supabase client (service role) — precisa pra ler/escrever sem RLS
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: connections } = await supabase
      .from("pluggy_connections")
      .select("id, account_id, last_sync")
      .eq("status", "active");

    let newCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (const conn of connections ?? []) {
      try {
        // Janela de busca: (last_sync − 3 dias) OU 90 dias atrás se nunca sincronizou.
        const from = conn.last_sync
          ? (() => {
              const d = new Date(conn.last_sync as string);
              d.setDate(d.getDate() - DAYS_OVERLAP);
              return d.toISOString().split("T")[0];
            })()
          : daysAgo(DAYS_FIRST_SYNC);

        const txRes = await fetch(
          `https://api.pluggy.ai/transactions?accountId=${conn.account_id}&from=${from}`,
          { headers: { "X-API-KEY": apiKey } }
        );
        if (!txRes.ok) {
          errors.push(`conn=${conn.id}: Pluggy GET tx falhou (${txRes.status})`);
          continue;
        }
        const body = await txRes.json();
        const txs: any[] = body?.results ?? [];

        if (txs.length === 0) {
          await supabase.from("pluggy_connections")
            .update({ last_sync: new Date().toISOString() })
            .eq("id", conn.id);
          continue;
        }

        // IDs externos que queremos checar se já existem
        const externalIds = txs.map(t => t.id).filter(Boolean);
        const { data: existing } = await supabase
          .from("bank_transactions")
          .select("external_id")
          .in("external_id", externalIds);
        const existingIds = new Set((existing ?? []).map((r: any) => r.external_id));

        // SEPARA em novos (insert) e já existentes (update não-destrutivo)
        const newRows: any[] = [];
        const updateCandidates: any[] = [];

        for (const tx of txs) {
          const row = {
            external_id: tx.id,
            date: tx.date?.split("T")[0] ?? null,
            description: tx.description ?? "(sem descrição)",
            amount: Math.abs(Number(tx.amount) || 0),
            type: tx.type === "CREDIT" ? "credit" : "debit",
            source: "pluggy",
            raw_data: tx,
          };
          if (existingIds.has(tx.id)) {
            updateCandidates.push(row);
          } else {
            newRows.push({ ...row, status: "pending" }); // status só no INSERT
          }
        }

        // Insert dos novos
        if (newRows.length > 0) {
          const { error: insErr } = await supabase.from("bank_transactions").insert(newRows);
          if (insErr) {
            errors.push(`conn=${conn.id}: insert falhou: ${insErr.message}`);
          } else {
            newCount += newRows.length;
          }
        }

        // Update só de campos não-semânticos nas existentes
        // (NÃO tocar status / kitnet_entry_id / matched_revenue_id / category_*)
        for (const row of updateCandidates) {
          const { error: updErr } = await supabase
            .from("bank_transactions")
            .update({
              description: row.description,
              amount: row.amount,
              type: row.type,
              raw_data: row.raw_data,
              date: row.date,
            })
            .eq("external_id", row.external_id);
          if (updErr) {
            errors.push(`conn=${conn.id} ext=${row.external_id}: update falhou: ${updErr.message}`);
          } else {
            updatedCount++;
          }
        }

        await supabase.from("pluggy_connections")
          .update({ last_sync: new Date().toISOString() })
          .eq("id", conn.id);
      } catch (e: any) {
        errors.push(`conn=${conn.id}: ${e?.message ?? String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        new: newCount,
        updated: updatedCount,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
