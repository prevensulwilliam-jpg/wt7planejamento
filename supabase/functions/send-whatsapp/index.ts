/**
 * send-whatsapp — Edge Function (Sprint 1 = stub)
 *
 * STATUS atual: ENFILEIRA mensagens em whatsapp_notifications_queue.
 * NÃO envia ainda — Evolution API conecta na Sprint 4 (cereja).
 *
 * Quando ativado (Sprint 4):
 *   1. Recebe POST com { template, message, to_phone? }
 *   2. Insere row em whatsapp_notifications_queue (status='queued')
 *   3. Worker pg_cron (a configurar) puxa rows pendentes a cada 5min
 *   4. Worker chama Evolution API com {to_phone, message}
 *   5. Atualiza status='sent' + evolution_message_id ou status='failed'
 *
 * Uso atual (Sprint 1):
 *   POST /functions/v1/send-whatsapp
 *   {
 *     "template": "briefing_daily" | "alert_critical" | "weekly_summary" | "custom",
 *     "message": "🧭 *WT7 · Hoje 02/05*\n\n💰 Faturamento...",
 *     "to_phone": "+5547999999999",       // opcional, default = whatsapp_config.primary_phone
 *     "metadata": { ... }                  // opcional, contexto extra
 *   }
 *
 * Resposta:
 *   { ok: true, queued_id, status: "queued (Evolution não ativo ainda)" }
 *
 * Próximos passos (Sprint 4):
 *   - Worker pg_cron a cada 5min
 *   - Conexão real com Evolution API (usar EVOLUTION_API_URL + EVOLUTION_API_KEY secrets)
 *   - Retry automático até 3x
 *   - Confirmação de entrega
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERSION = "2026.05.02-v1-stub";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log(`[send-whatsapp] ▶ versão ${VERSION} (stub mode)`);

  try {
    const body = await req.json();
    const { template, message, to_phone, metadata = {} } = body;

    // Validação
    if (!template || !message) {
      return new Response(
        JSON.stringify({ ok: false, error: "template e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const validTemplates = ["briefing_daily", "alert_critical", "weekly_summary", "custom"];
    if (!validTemplates.includes(template)) {
      return new Response(
        JSON.stringify({ ok: false, error: `template inválido. Use: ${validTemplates.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Resolver to_phone: default = primary_phone do whatsapp_config
    let phone = to_phone;
    if (!phone) {
      const { data: config } = await sb
        .from("whatsapp_config")
        .select("primary_phone, active")
        .limit(1)
        .single();
      phone = config?.primary_phone;
    }

    if (!phone) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Nenhum telefone configurado. Cadastre whatsapp_config.primary_phone primeiro.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Enfileira
    const { data: queueRow, error: insErr } = await sb
      .from("whatsapp_notifications_queue")
      .insert({
        to_phone: phone,
        template,
        message,
        status: "queued",
        metadata,
        scheduled_for: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insErr) {
      return new Response(
        JSON.stringify({ ok: false, error: `enqueue failed: ${insErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── ENVIO REAL via Evolution API (Sprint 4.5 — cereja) ─────────
    // Só envia se whatsapp_config.active = true E secrets EVOLUTION_*
    // estão configurados. Caso contrário fica como queued (fallback stub).
    const { data: configData } = await sb
      .from("whatsapp_config")
      .select("evolution_instance, evolution_api_url, active")
      .limit(1)
      .single();

    const evoApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const isActive = configData?.active === true;
    const evoUrl = configData?.evolution_api_url ?? Deno.env.get("EVOLUTION_API_URL");
    const evoInstance = configData?.evolution_instance;

    if (!isActive || !evoApiKey || !evoUrl || !evoInstance) {
      return new Response(
        JSON.stringify({
          ok: true,
          version: VERSION,
          queued_id: queueRow.id,
          status: "queued",
          note: "Mensagem na fila. Evolution API não ativa ainda (whatsapp_config.active=false ou secrets faltando).",
          to_phone: phone,
          template,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Tenta enviar via Evolution API
    try {
      const evoRes = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
        method: "POST",
        headers: {
          "apikey": evoApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: phone.replace(/\D/g, ""), // só números
          text: message,
        }),
      });

      if (!evoRes.ok) {
        const errText = await evoRes.text().catch(() => "");
        await sb.from("whatsapp_notifications_queue")
          .update({
            status: "failed",
            error_message: `Evolution ${evoRes.status}: ${errText.slice(0, 300)}`,
          })
          .eq("id", queueRow.id);
        return new Response(
          JSON.stringify({
            ok: false,
            queued_id: queueRow.id,
            status: "failed",
            error: `Evolution API ${evoRes.status}`,
            details: errText.slice(0, 300),
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const evoData = await evoRes.json().catch(() => ({}));
      const evolutionMessageId = evoData?.key?.id ?? evoData?.id ?? null;

      // Marca como enviada
      await sb.from("whatsapp_notifications_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          evolution_message_id: evolutionMessageId,
        })
        .eq("id", queueRow.id);

      return new Response(
        JSON.stringify({
          ok: true,
          version: VERSION,
          queued_id: queueRow.id,
          status: "sent",
          evolution_message_id: evolutionMessageId,
          to_phone: phone,
          template,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (sendErr) {
      const errMsg = sendErr instanceof Error ? sendErr.message : "send failed";
      await sb.from("whatsapp_notifications_queue")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", queueRow.id);
      return new Response(
        JSON.stringify({ ok: false, queued_id: queueRow.id, status: "failed", error: errMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro desconhecido";
    console.error("[send-whatsapp] error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
