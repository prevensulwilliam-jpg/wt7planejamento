// naval-daily-check — Edge function que roda detectores e cria alertas.
// Chamada via pg_cron diariamente às 06:00 (ou manualmente via fetch).
//
// Detectores ativos:
//   1. Caixa abaixo do piso R$ 100k
//   2. Sobra Reinvestida abaixo de 50% por 2+ meses
//   3. Concentração GRAND FOOD > 80%
//   4. Marco 2027 fora do trilho (CAGR exigido > 25%/ano)
//   5. Bancos com balance desatualizado >7 dias
//   6. Obra com cronograma apertado (atraso vs tempo decorrido)
//   7. Comissão Prevensul ciclo atual abaixo da mediana histórica

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

type Alert = {
  detector: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  metric_name?: string;
  metric_value?: number;
  metric_threshold?: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase env missing");
    const sb = createClient(supabaseUrl, serviceKey);

    const alerts: Alert[] = [];

    // ─── 1. Caixa abaixo do piso R$ 100k ─────────────────────────
    const banksR = await sb.from("bank_accounts").select("balance, last_updated, bank_name");
    const invsR = await sb.from("investments").select("rescue_amount");
    const caixaImediato = (banksR.data ?? []).reduce((s: number, b: any) => s + Number(b.balance ?? 0), 0);
    const caixaResgate = (invsR.data ?? []).reduce((s: number, i: any) => s + Number(i.rescue_amount ?? 0), 0);
    const caixaTotal = caixaImediato + caixaResgate;
    const PISO = 100_000;
    if (caixaTotal < PISO) {
      alerts.push({
        detector: "caixa_abaixo_piso",
        severity: "critical",
        title: "🔴 Caixa abaixo do piso R$ 100k",
        message: `Caixa total atual: R$ ${caixaTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}. Piso R$ 100k é regra inviolável (memoria/metas.md). Suspenda aportes não-críticos até voltar.`,
        metric_name: "caixa_total",
        metric_value: caixaTotal,
        metric_threshold: PISO,
      });
    } else if (caixaTotal < PISO + 20_000) {
      alerts.push({
        detector: "caixa_proximo_piso",
        severity: "warning",
        title: "🟡 Caixa próximo do piso (margem <R$ 20k)",
        message: `Caixa R$ ${caixaTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}. Margem pra piso: R$ ${(caixaTotal - PISO).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.`,
        metric_name: "caixa_total",
        metric_value: caixaTotal,
        metric_threshold: PISO,
      });
    }

    // ─── 2. Bancos com saldo desatualizado >7 dias ───────────────
    const today = new Date();
    const stale = (banksR.data ?? []).filter((b: any) => {
      if (!b.last_updated) return true;
      const days = Math.floor((today.getTime() - new Date(b.last_updated).getTime()) / 86400000);
      return days > 7;
    });
    if (stale.length > 0) {
      alerts.push({
        detector: "bancos_desatualizados",
        severity: "info",
        title: `📅 ${stale.length} banco(s) com saldo desatualizado`,
        message: `Bancos: ${stale.map((b: any) => b.bank_name).join(", ")}. Atualize via /banks pra Naval ter posição real.`,
        metric_name: "bancos_stale",
        metric_value: stale.length,
      });
    }

    // ─── 3. Marco 2027 — CAGR exigido > 25%/ano ──────────────────
    const [assetsR, propsR, consR, debtsR] = await Promise.all([
      sb.from("assets").select("estimated_value"),
      sb.from("real_estate_properties").select("property_value, ownership_pct"),
      sb.from("consortiums").select("total_paid, ownership_pct, status").in("status", ["ativo", "contemplado", "active", "paid_off"]),
      sb.from("debts").select("remaining_amount, status").neq("status", "paid"),
    ]);
    const assets = (assetsR.data ?? []).reduce((s: number, a: any) => s + Number(a.estimated_value ?? 0), 0);
    const invsTotal = (invsR.data ?? []).reduce((s: number, i: any) => s + Number((i as any).current_amount ?? (i as any).rescue_amount ?? 0), 0);
    const props = (propsR.data ?? []).reduce((s: number, p: any) => s + Number(p.property_value ?? 0) * (Number(p.ownership_pct ?? 100) / 100), 0);
    const cons = (consR.data ?? []).reduce((s: number, c: any) => s + Number(c.total_paid ?? 0) * (Number(c.ownership_pct ?? 100) / 100), 0);
    const debts = (debtsR.data ?? []).reduce((s: number, d: any) => s + Number(d.remaining_amount ?? 0), 0);
    const patrimonioLiquido = assets + invsTotal + caixaImediato + props + cons - debts;
    const milestone2027 = new Date("2027-12-11");
    const yearsTo2027 = (milestone2027.getTime() - today.getTime()) / (86400000 * 365.25);
    const cagr2027 = patrimonioLiquido > 0 && yearsTo2027 > 0
      ? (Math.pow(6_500_000 / patrimonioLiquido, 1 / yearsTo2027) - 1) * 100
      : 0;
    if (cagr2027 > 25) {
      alerts.push({
        detector: "marco_2027_fora_trilho",
        severity: "warning",
        title: "🚩 Marco 2027 (Casamento) fora do trilho",
        message: `Patrimônio atual R$ ${(patrimonioLiquido / 1_000_000).toFixed(2)}M vs alvo R$ 6,5M em ${yearsTo2027.toFixed(1)} anos. CAGR exigido: ${cagr2027.toFixed(1)}%/ano (>25% = inviável via fluxo normal). Considere acelerar T7/TDI ou reduzir meta 2027.`,
        metric_name: "cagr_2027",
        metric_value: cagr2027,
        metric_threshold: 25,
      });
    }

    // ─── 4. Concentração GRAND FOOD ───────────────────────────────
    const billR = await sb.from("prevensul_billing").select("client_name, balance_remaining").gt("balance_remaining", 0);
    const totalBalance = (billR.data ?? []).reduce((s: number, r: any) => s + Number(r.balance_remaining ?? 0), 0);
    const gfBalance = (billR.data ?? []).filter((r: any) => (r.client_name || "").toUpperCase().includes("GRAND FOOD")).reduce((s: number, r: any) => s + Number(r.balance_remaining ?? 0), 0);
    const gfPct = totalBalance > 0 ? (gfBalance / totalBalance) * 100 : 0;
    if (gfPct > 80) {
      alerts.push({
        detector: "concentracao_grand_food",
        severity: "critical",
        title: `🔴 Concentração GRAND FOOD em ${gfPct.toFixed(0)}%`,
        message: `R$ ${(gfBalance / 1_000_000).toFixed(2)}M de R$ ${(totalBalance / 1_000_000).toFixed(2)}M dependem de 1 cliente. Se atrasar 60d, comissão cai pra ~R$ 13k naquele mês. Meta: <60% até Q3/2026.`,
        metric_name: "concentracao_gf_pct",
        metric_value: gfPct,
        metric_threshold: 80,
      });
    }

    // ─── 5. Sobra Reinvestida abaixo de 50% últimos 2 meses ───────
    // Usa simplificação: olha aporte_obra + outros aportes da expenses dos 2 últimos meses
    const now = new Date();
    const months = [
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`,
    ];
    let abaixo = 0;
    for (const m of months) {
      const expsR = await sb.from("expenses").select("amount, counts_as_investment, vector").eq("reference_month", m);
      const revsR = await sb.from("revenues").select("amount, counts_as_income, source").eq("reference_month", m);
      const kitR = await sb.from("kitnet_entries").select("total_liquid, reconciled").eq("reference_month", m);
      const investido = (expsR.data ?? []).filter((e: any) => e.counts_as_investment).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
      const rendaAvulsa = (revsR.data ?? []).filter((r: any) => r.counts_as_income !== false && r.source !== "aluguel_kitnets").reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      const aluguel = (kitR.data ?? []).filter((k: any) => k.reconciled).reduce((s: number, k: any) => s + Number(k.total_liquid ?? 0), 0);
      const receita = rendaAvulsa + aluguel;
      const pct = receita > 0 ? (investido / receita) * 100 : 0;
      if (pct < 50 && receita > 1000) abaixo++;
    }
    if (abaixo >= 2) {
      alerts.push({
        detector: "sobra_reinvestida_baixa",
        severity: "warning",
        title: "📉 Sobra Reinvestida <50% por 2 meses seguidos",
        message: `Meta canônica é 50% (memoria/metas.md). Você está abaixo nos últimos 2 meses. Sem reinvestimento sustentado, R$ 70M/2041 escorrega.`,
        metric_name: "meses_abaixo_50_sobra",
        metric_value: abaixo,
        metric_threshold: 50,
      });
    }

    // ─── 6. Dívida Jairo (R$ 85k) com prazo apertado ──────────────
    const jairoR = await sb.from("debts").select("remaining_amount, due_date").eq("creditor", "Jairo Santos").maybeSingle();
    if (jairoR.data && jairoR.data.due_date) {
      const dueDate = new Date(jairoR.data.due_date);
      const monthsLeft = (dueDate.getTime() - today.getTime()) / (86400000 * 30);
      if (monthsLeft < 6 && monthsLeft > 0) {
        alerts.push({
          detector: "divida_jairo_prazo",
          severity: "warning",
          title: `⏰ Dívida Jairo R$ 85k vence em ${Math.round(monthsLeft)} meses`,
          message: `Empréstimo de R$ 85k pelo terreno JW7 Sonho — prazo final em ${jairoR.data.due_date}. Planeje quitação via JW7 Sonho fase 2 ou caixa.`,
          metric_name: "meses_ate_jairo",
          metric_value: monthsLeft,
        });
      }
    }

    // ─── Salva alertas ────────────────────────────────────────────
    let inserted = 0;
    for (const a of alerts) {
      // Evita duplicar: se já tem alert ativo do mesmo detector, atualiza em vez de inserir
      const existing = await sb.from("naval_alerts")
        .select("id")
        .eq("detector", a.detector)
        .is("dismissed_at", null)
        .maybeSingle();

      if (existing.data) {
        await sb.from("naval_alerts").update({
          message: a.message,
          metric_value: a.metric_value,
          detected_at: new Date().toISOString(),
        }).eq("id", existing.data.id);
      } else {
        await sb.from("naval_alerts").insert({
          detector: a.detector,
          severity: a.severity,
          title: a.title,
          message: a.message,
          metric_name: a.metric_name,
          metric_value: a.metric_value,
          metric_threshold: a.metric_threshold,
        });
        inserted++;
      }
    }

    // Auto-resolve alertas que não foram disparados nesta rodada
    // (condição corrigida → fecha automático)
    const activeDetectorsNow = new Set(alerts.map((a) => a.detector));
    const allActiveR = await sb.from("naval_alerts").select("id, detector").is("dismissed_at", null);
    let autoResolved = 0;
    for (const a of allActiveR.data ?? []) {
      if (!activeDetectorsNow.has((a as any).detector)) {
        await sb.from("naval_alerts").update({
          dismissed_at: new Date().toISOString(),
          dismissed_by_user: false,
        }).eq("id", (a as any).id);
        autoResolved++;
      }
    }

    console.log(`[naval-daily-check] checked=${alerts.length} inserted=${inserted} auto_resolved=${autoResolved}`);

    return new Response(JSON.stringify({
      ok: true,
      alerts_active: alerts.length,
      newly_inserted: inserted,
      auto_resolved: autoResolved,
      alerts: alerts.map((a) => ({ detector: a.detector, severity: a.severity, title: a.title })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("naval-daily-check error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
