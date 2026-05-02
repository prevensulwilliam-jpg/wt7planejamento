/**
 * generate-recurrence-tasks — Edge Function
 *
 * Gera instâncias em daily_tasks a partir das regras ativas em task_recurrence_rules.
 * Idempotente: usa last_generated_until + check (rule_id, due_date) pra não duplicar.
 *
 * POST body (opcional): { days_ahead?: number }  — default 7, max 90
 *
 * Designed pra rodar via pg_cron diariamente às 7h Brasília (10h UTC).
 *
 * Frequencies suportadas:
 *   - daily      → todos os dias entre start e end
 *   - weekdays   → seg-sex
 *   - weekly     → só no weekday especificado (0=dom..6=sáb)
 *   - monthly    → só no monthly_day do mês
 *   - yearly     → uma vez por ano (mesmo mês/dia do start_date)
 *   - custom_cron → ignorado nesta versão (placeholder pra futuro)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERSION = "2026.05.02-v1";

type Rule = {
  id: string;
  title: string;
  vector: string | null;
  frequency: "daily" | "weekly" | "monthly" | "yearly" | "weekdays" | "custom_cron";
  weekday: number | null;
  monthly_day: number | null;
  due_time: string | null;
  active: boolean;
  start_date: string;
  end_date: string | null;
  last_generated_until: string | null;
};

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shouldGenerate(rule: Rule, date: Date): boolean {
  const dow = date.getUTCDay(); // 0=dom..6=sáb
  switch (rule.frequency) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekly":
      return rule.weekday != null && dow === rule.weekday;
    case "monthly":
      return rule.monthly_day != null && date.getUTCDate() === rule.monthly_day;
    case "yearly": {
      const start = new Date(rule.start_date + "T00:00:00Z");
      return date.getUTCMonth() === start.getUTCMonth() && date.getUTCDate() === start.getUTCDate();
    }
    case "custom_cron":
      return false; // não implementado nesta versão
    default:
      return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log(`[generate-recurrence-tasks] ▶ versão ${VERSION}`);

  try {
    let daysAhead = 7;
    try {
      const body = await req.json();
      if (typeof body?.days_ahead === "number" && body.days_ahead > 0 && body.days_ahead <= 90) {
        daysAhead = Math.floor(body.days_ahead);
      }
    } catch {
      // sem body — usa default
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const horizonDate = new Date(today);
    horizonDate.setUTCDate(horizonDate.getUTCDate() + daysAhead);

    const { data: rules, error: rulesErr } = await sb
      .from("task_recurrence_rules")
      .select("*")
      .eq("active", true);

    if (rulesErr) {
      return new Response(
        JSON.stringify({ ok: false, error: `fetch rules: ${rulesErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let totalInserted = 0;
    const ruleResults: Array<{ rule_id: string; title: string; inserted: number }> = [];

    for (const rule of (rules ?? []) as Rule[]) {
      // Início = max(today, start_date, last_generated_until + 1)
      let cursor = new Date(today);
      const start = new Date(rule.start_date + "T00:00:00Z");
      if (start > cursor) cursor = new Date(start);
      if (rule.last_generated_until) {
        const next = new Date(rule.last_generated_until + "T00:00:00Z");
        next.setUTCDate(next.getUTCDate() + 1);
        if (next > cursor) cursor = next;
      }

      const end = rule.end_date ? new Date(rule.end_date + "T00:00:00Z") : horizonDate;
      const stop = end < horizonDate ? end : horizonDate;

      const tasksToInsert: Array<Record<string, unknown>> = [];
      const iter = new Date(cursor);
      while (iter <= stop) {
        if (shouldGenerate(rule, iter)) {
          tasksToInsert.push({
            title: rule.title,
            due_date: fmtDate(iter),
            due_time: rule.due_time,
            status: "pending",
            vector: rule.vector,
            source: "recurrence",
            recurrence_rule_id: rule.id,
          });
        }
        iter.setUTCDate(iter.getUTCDate() + 1);
      }

      let inserted = 0;
      if (tasksToInsert.length > 0) {
        // Anti-duplicação: não inserir se já existe (rule_id + due_date)
        const dates = tasksToInsert.map((t) => t.due_date as string);
        const { data: existing } = await sb
          .from("daily_tasks")
          .select("due_date")
          .eq("recurrence_rule_id", rule.id)
          .in("due_date", dates);

        const existingSet = new Set((existing ?? []).map((r: { due_date: string }) => r.due_date));
        const fresh = tasksToInsert.filter((t) => !existingSet.has(t.due_date as string));

        if (fresh.length > 0) {
          const { error: insErr } = await sb.from("daily_tasks").insert(fresh);
          if (insErr) {
            console.error(`[rule ${rule.id}] insert error:`, insErr.message);
          } else {
            inserted = fresh.length;
            totalInserted += inserted;
          }
        }
      }

      // Atualiza last_generated_until pro horizon final processado
      await sb
        .from("task_recurrence_rules")
        .update({ last_generated_until: fmtDate(stop), updated_at: new Date().toISOString() })
        .eq("id", rule.id);

      ruleResults.push({ rule_id: rule.id, title: rule.title, inserted });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        version: VERSION,
        days_ahead: daysAhead,
        rules_processed: ruleResults.length,
        total_tasks_inserted: totalInserted,
        rules: ruleResults,
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
