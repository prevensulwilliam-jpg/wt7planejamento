// ══════════════════════════════════════════════════════════════════
// parse-card-invoice — parseia OFX (BB) / CSV (XP) / PDF (Gemini)
// Insere card_invoices + card_transactions com dedupe + auto-categoriza.
//
// Body: { card_id: string, file_format: 'ofx'|'csv'|'pdf',
//         file_content: string (OFX/CSV texto; PDF base64),
//         reference_month?: string "YYYY-MM",
//         file_url?: string (Storage URL, se já uploaded) }
// ══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ParsedTx = {
  transaction_date: string;   // YYYY-MM-DD
  description: string;
  merchant_normalized: string;
  amount: number;
  cardholder: string | null;
  installment_current: number;
  installment_total: number;
  currency: string;
  fx_rate: number | null;
  fitid: string | null;
};

// ── OFX parser (BB) ─────────────────────────────────────────────
function parseOFX(content: string): { txs: ParsedTx[], dtstart?: string, dtend?: string } {
  const txs: ParsedTx[] = [];
  const stmtRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;
  while ((match = stmtRegex.exec(content)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`));
      return m ? m[1].trim() : "";
    };
    const dt = get("DTPOSTED").substring(0, 8);  // YYYYMMDD
    const amt = parseFloat(get("TRNAMT"));
    const fitid = get("FITID");
    const memo = get("MEMO") || get("NAME");

    if (!dt || isNaN(amt) || !memo) continue;
    if (amt >= 0) continue;  // ignora créditos/pagamentos (só despesas)

    const transaction_date = `${dt.substring(0, 4)}-${dt.substring(4, 6)}-${dt.substring(6, 8)}`;
    const amount = Math.abs(amt);

    // Detecta parcela no memo (ex: "MAFRA 01/02" ou "PARC 3/10")
    let installment_current = 1, installment_total = 1;
    const parcMatch = memo.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
    if (parcMatch) {
      installment_current = parseInt(parcMatch[1]);
      installment_total = parseInt(parcMatch[2]);
    }

    txs.push({
      transaction_date,
      description: memo,
      merchant_normalized: normalizeMerchant(memo),
      amount,
      cardholder: "WILLIAM TAVARES",  // BB OFX não traz portador
      installment_current,
      installment_total,
      currency: "BRL",
      fx_rate: null,
      fitid,
    });
  }

  const dtstart = content.match(/<DTSTART>([^<\r\n]*)/)?.[1]?.substring(0, 8);
  const dtend = content.match(/<DTEND>([^<\r\n]*)/)?.[1]?.substring(0, 8);
  return { txs, dtstart, dtend };
}

// ── CSV parser (XP) ─────────────────────────────────────────────
// Header: Data;Estabelecimento;Portador;Valor;Parcela
function parseCSV(content: string): ParsedTx[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const txs: ParsedTx[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    if (cols.length < 4) continue;
    const [data, estab, portador, valorRaw, parcelaRaw] = cols;

    // Data: DD/MM/YYYY → YYYY-MM-DD
    const dm = data.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!dm) continue;
    const transaction_date = `${dm[3]}-${dm[2]}-${dm[1]}`;

    // Valor: "R$ 200,16" → 200.16; "R$ -10.829,20" → negativo (pagamento, ignorar)
    const valStr = (valorRaw || "").replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", ".").trim();
    const amount = parseFloat(valStr);
    if (isNaN(amount)) continue;
    if (amount < 0) continue;  // ignora pagamentos da fatura

    // Parcela: "2 de 6" → 2,6; "-" → 1,1
    let installment_current = 1, installment_total = 1;
    if (parcelaRaw && parcelaRaw.trim() !== "-") {
      const pm = parcelaRaw.match(/(\d+)\s*de\s*(\d+)/i);
      if (pm) {
        installment_current = parseInt(pm[1]);
        installment_total = parseInt(pm[2]);
      }
    }

    txs.push({
      transaction_date,
      description: estab.trim(),
      merchant_normalized: normalizeMerchant(estab),
      amount,
      cardholder: (portador || "").trim() || null,
      installment_current,
      installment_total,
      currency: "BRL",
      fx_rate: null,
      fitid: null,
    });
  }
  return txs;
}

// ── PDF parser via Gemini (fallback) ────────────────────────────
async function parsePDF(base64: string, geminiKey: string): Promise<ParsedTx[]> {
  const prompt = `Extraia TODAS as transações desta fatura de cartão de crédito.
Retorne JSON puro (sem markdown) no formato:
{"transactions": [{"transaction_date":"YYYY-MM-DD","description":"...","amount":123.45,"cardholder":"NOME","installment_current":1,"installment_total":1,"currency":"BRL","fx_rate":null}]}

Regras:
- Ignore pagamentos da fatura (valores negativos, "PAGAMENTO EFETUADO", "ESTORNO")
- Só despesas (valores positivos)
- Parcela "X de Y" vira installment_current:X, installment_total:Y; "-" ou vazio vira 1,1
- cardholder: nome do portador se aparecer; senão null
- currency: "USD" se compra exterior, senão "BRL"`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "application/pdf", data: base64 } }
        ]
      }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 }
    })
  });
  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(text);
  return (parsed.transactions || []).map((t: any) => ({
    ...t,
    merchant_normalized: normalizeMerchant(t.description),
    fitid: null,
  }));
}

// ── Normalize merchant (pra pattern matching) ───────────────────
function normalizeMerchant(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Handler ─────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { card_id, file_format, file_content, reference_month, file_url } = await req.json();
    if (!card_id || !file_format || !file_content) {
      return new Response(JSON.stringify({ ok: false, error: "missing_params" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1) Parse
    let txs: ParsedTx[] = [];
    let cycleEndDate: string | undefined;  // YYYY-MM-DD do fim do ciclo

    if (file_format === "ofx") {
      const { txs: parsed, dtend } = parseOFX(file_content);
      txs = parsed;
      if (dtend) cycleEndDate = `${dtend.substring(0, 4)}-${dtend.substring(4, 6)}-${dtend.substring(6, 8)}`;
    } else if (file_format === "csv") {
      txs = parseCSV(file_content);
    } else if (file_format === "pdf") {
      const key = Deno.env.get("GEMINI_API_KEY");
      if (!key) throw new Error("GEMINI_API_KEY not set");
      txs = await parsePDF(file_content, key);
    } else {
      return new Response(JSON.stringify({ ok: false, error: "invalid_format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (txs.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "no_transactions_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Buscar cartão pra pegar closing/due
    const { data: cardData, error: cardErr } = await supabase
      .from("cards")
      .select("closing_day, due_day")
      .eq("id", card_id)
      .single();
    if (cardErr) throw cardErr;
    const closing_day = cardData.closing_day || 25;
    const due_day = cardData.due_day || 5;

    // 3) Determinar reference_month = mês do próximo due_day após a maxDate
    // Regra simples: a fatura é a que vence no próximo due_day depois da transação mais recente.
    //  - BB maxDate=06/abr, due=10 → próximo dia 10 = 10/abr → ref=2026-04
    //  - BB maxDate=11/abr, due=10 → próximo dia 10 = 10/mai → ref=2026-05
    //  - XP maxDate=17/abr, due=25 → próximo dia 25 = 25/abr → ref=2026-04
    function computeDueMonth(refDate: string): string {
      const [y, m, d] = refDate.split("-").map(Number);
      let venc_y = y, venc_m = m;
      if (d > due_day) {
        venc_m = m + 1;
        if (venc_m > 12) { venc_m -= 12; venc_y += 1; }
      }
      return `${venc_y}-${String(venc_m).padStart(2, "0")}`;
    }

    let ref: string;
    if (reference_month) {
      ref = reference_month;
    } else {
      const nonParc = txs.filter(t => t.installment_total === 1);
      const pool = nonParc.length > 0 ? nonParc : txs;
      const maxDate = pool.map(t => t.transaction_date).sort().at(-1)!;
      ref = computeDueMonth(maxDate);
    }

    // 3) Upsert invoice (manual — select + update/insert)
    const total_amount = txs.reduce((s, t) => s + Number(t.amount), 0);
    const { data: existingInv } = await supabase
      .from("card_invoices")
      .select("id")
      .eq("card_id", card_id)
      .eq("reference_month", ref)
      .maybeSingle();

    let invoice: any;
    if (existingInv) {
      const { data, error } = await supabase
        .from("card_invoices")
        .update({ total_amount, file_url: file_url || null, file_format })
        .eq("id", existingInv.id)
        .select()
        .single();
      if (error) throw error;
      invoice = data;
    } else {
      const { data, error } = await supabase
        .from("card_invoices")
        .insert({
          card_id,
          reference_month: ref,
          total_amount,
          file_url: file_url || null,
          file_format,
        })
        .select()
        .single();
      if (error) throw error;
      invoice = data;
    }

    // 4) Carregar merchant_patterns pra auto-categorizar
    const { data: patterns } = await supabase
      .from("card_merchant_patterns")
      .select("merchant_pattern, category_id");
    const { data: categories } = await supabase
      .from("custom_categories")
      .select("id, counts_as_investment, vector");

    const catMap = new Map((categories || []).map((c: any) => [c.id, c]));

    function matchCategory(mn: string): { category_id: string | null, counts_as_investment: boolean, vector: string | null } {
      for (const p of patterns || []) {
        const pat = normalizeMerchant(p.merchant_pattern);
        if (mn.includes(pat)) {
          const cat: any = catMap.get(p.category_id);
          return {
            category_id: p.category_id,
            counts_as_investment: cat?.counts_as_investment || false,
            vector: cat?.vector || null,
          };
        }
      }
      // Fallback: a_investigar
      const aInv = (categories || []).find((c: any) => c.vector === null);
      return { category_id: aInv?.id || null, counts_as_investment: false, vector: null };
    }

    // 5) Inserir transações com dedupe
    const rows = txs.map(t => {
      const cat = matchCategory(t.merchant_normalized);
      return {
        invoice_id: invoice.id,
        card_id,
        transaction_date: t.transaction_date,
        description: t.description,
        merchant_normalized: t.merchant_normalized,
        amount: t.amount,
        cardholder: t.cardholder,
        installment_current: t.installment_current,
        installment_total: t.installment_total,
        currency: t.currency,
        fx_rate: t.fx_rate,
        fitid: t.fitid,
        category_id: cat.category_id,
        counts_as_investment: cat.counts_as_investment,
        vector: cat.vector,
      };
    });

    // Dedupe manual (PostgREST não aceita índices parciais em onConflict)
    let inserted = 0, skipped = 0;

    // 1) Busca existentes pro card
    const { data: existing, error: exErr } = await supabase
      .from("card_transactions")
      .select("fitid, transaction_date, description, amount, cardholder, installment_current")
      .eq("card_id", card_id);
    if (exErr) throw exErr;

    const existingFitids = new Set((existing || []).filter(e => e.fitid).map(e => e.fitid));
    const existingKeys = new Set((existing || []).filter(e => !e.fitid).map(e =>
      `${e.transaction_date}|${e.description}|${Number(e.amount).toFixed(2)}|${e.cardholder || ""}|${e.installment_current}`
    ));

    // 2) Filtra novos
    const newRows = rows.filter(r => {
      if (r.fitid) {
        if (existingFitids.has(r.fitid)) { skipped++; return false; }
        return true;
      }
      const key = `${r.transaction_date}|${r.description}|${Number(r.amount).toFixed(2)}|${r.cardholder || ""}|${r.installment_current}`;
      if (existingKeys.has(key)) { skipped++; return false; }
      return true;
    });

    // 3) Insert novos
    if (newRows.length > 0) {
      const { data, error } = await supabase
        .from("card_transactions")
        .insert(newRows)
        .select("id");
      if (error) throw error;
      inserted = data?.length || 0;
    }

    return new Response(JSON.stringify({
      ok: true,
      invoice_id: invoice.id,
      reference_month: ref,
      total_amount,
      parsed: txs.length,
      inserted,
      skipped,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("parse-card-invoice error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
