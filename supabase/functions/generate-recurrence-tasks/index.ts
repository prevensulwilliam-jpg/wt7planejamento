/**
 * generate-recurrence-tasks — Edge Function
 *
 * Roda diariamente (idealmente via pg_cron 7h Brasília / 10h UTC).
 * Pra cada task_recurrence_rule ATIVA, gera as instâncias dos próximos
 * 7 dias em daily_tasks. Idempotente (não duplica via UNIQUE check).
 *
 * Frequências suportadas:
 *  - daily: todos os dias
 *  - weekdays: seg-sex
 *  - weekly: dia da semana específico
 *  - monthly: dia específico do mês
 *  - yearly: mesma data anual
 *
 * Uso:
 *   POST /functions/v1/generate-recurrence-tasks
 *   {"days_ahead": 7}  // opcional, default 7
 *
 * pg_cron setup (rodar manualmente no Supabase 1x):
 *   SELECT cron.schedule(
 *     'generate-recurrence-tasks-daily',
 *     '0 10 * * *',  -- 7h Brasília
 *     $$ SELECT net.http_post(
 *       url := 'https://<project>.supabase.co/functions/v1/generate-recurrence-tasks',
 *       headers := jsonb_build_object('Authorization', 'Bearer <service_key>'),
 *       body := jsonb_build_object('days_ahead', 7)
 *     ) $$
 *   );
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERSION = "2026.05.02-v1";

function dayOfWeek(date: Date): number {
  return date.getDay(); // 0=domingo
}

function isWeekday(date: Date): boolean {
  const d = dayOfWeek(date);
  return d >= 1 && d <= 5;
}

function shouldGenerateInstance(rule: any, date: Date): boolean {
  switch (rule.frequency) {
    case "daily":
      return true;
    case "weekdays":
      return isWeekday(date);
    case "weekly":
      return rule.weekday !== null && dayOfWeek(date) === rule.weekday;
    case "monthly":
      return rule.monthly_day !== null && date.getDate() === rule.monthly_day;
    case "yearly":
      // sem data específica de start_date dia/mês: usa start_date.day como referência
      const start = new Date(rule.start_date);
      return date.getDate() === start.getDate() && date.getMonth() === start.getMonth();
    default:
      return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log(`[generate-recurrence-tasks] ▶ versão ${VERSION}`);

  try {
    const body = await req.json().catch(() => ({}));
    const daysAhead = Math.max(1, Math.min(30, Number(body.days_ahead) || 7));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Pega regras ativas
    const { data: rules } = await sb
      .from("task_recurrence_rules")
      .select("*")
      .eq("active", true);

    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "Nenhuma regra ativa", generated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let totalGenerated = 0;
    let totalSkipped = 0;

    for (const rule of rules) {
      const ruleStart = new Date(rule.start_date);
      const ruleEnd = rule.end_date ? new Date(rule.end_date) : null;
      const lastGeneratedUntil = rule.last_generated_until ? new Date(rule.last_generated_until) : null;

      for (let i = 0; i < daysAhead; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);

        // Skip se fora do range da regra
        if (date < ruleStart) continue;
        if (ruleEnd && date > ruleEnd) continue;

        // Skip se já gerou
        if (lastGeneratedUntil && date <= lastGeneratedUntil) continue;

        if (!shouldGenerateInstance(rule, date)) continue;

        const dueDateStr = date.toISOString().slice(0, 10);

        // Idempotência: confere se já existe task pra essa rule+data
        const { data: existing } = await sb
          .from("daily_tasks")
          .select("id")
          .eq("recurrence_rule_id", rule.id)
          .eq("due_date", dueDateStr)
          .maybeSingle();

        if (existing) {
          totalSkipped++;
          continue;
        }

        // Cria instância
        await sb.from("daily_tasks").insert({
          title: rule.title,
          due_date: dueDateStr,
          due_time: rule.due_time,
          status: "pending",
          vector: rule.vector,
          source: "recurrence",
          recurrence_rule_id: rule.id,
          notes: rule.notes,
        });
        totalGenerated++;
      }

      // Atualiza last_generated_until da rule
      const newLastGenerated = new Date(today);
      newLastGenerated.setDate(newLastGenerated.getDate() + daysAhead - 1);
      await sb
        .from("task_recurrence_rules")
        .update({
          last_generated_until: newLastGenerated.toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq("id", rule.id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        version: VERSION,
        rules_processed: rules.length,
        instances_generated: totalGenerated,
        instances_skipped: totalSkipped,
        days_ahead: daysAhead,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro desconhecido";
    console.error("[generate-recurrence-tasks] error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
