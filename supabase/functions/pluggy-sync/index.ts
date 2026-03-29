import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PLUGGY_CLIENT_ID = Deno.env.get("PLUGGY_CLIENT_ID") ?? "";
    const PLUGGY_CLIENT_SECRET = Deno.env.get("PLUGGY_CLIENT_SECRET") ?? "";

    if (!PLUGGY_CLIENT_ID) {
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
    const { apiKey } = await authRes.json();

    // 2. Get active connections
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: connections } = await supabase.from("pluggy_connections").select("*").eq("status", "active");

    const imported: any[] = [];

    for (const conn of connections ?? []) {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const txRes = await fetch(
        `https://api.pluggy.ai/transactions?accountId=${conn.account_id}&from=${from.toISOString().split("T")[0]}`,
        { headers: { "X-API-KEY": apiKey } }
      );
      const { results: txs } = await txRes.json();

      const rows = (txs ?? []).map((tx: any) => ({
        external_id: tx.id,
        date: tx.date?.split("T")[0],
        description: tx.description,
        amount: Math.abs(tx.amount),
        type: tx.type === "CREDIT" ? "credit" : "debit",
        source: "pluggy",
        raw_data: tx,
        status: "pending",
      }));

      if (rows.length > 0) {
        await supabase.from("bank_transactions").upsert(rows, { onConflict: "external_id" });
        imported.push(...rows);
      }

      await supabase.from("pluggy_connections").update({ last_sync: new Date().toISOString() }).eq("id", conn.id);
    }

    return new Response(
      JSON.stringify({ success: true, imported: imported.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
