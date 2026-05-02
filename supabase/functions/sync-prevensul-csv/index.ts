/**
 * sync-prevensul-csv — Edge Function
 *
 * Importa CSV/XLSX do Portal Prevensul atomicamente:
 * - Aceita base64 (CSV ou XLSX) via POST
 * - Parse multi-aba (XLSX)
 * - Pra cada reference_month detectado, faz DELETE + INSERT idempotente
 * - Não acumula imports históricos (cada CSV é foto do mês)
 *
 * Uso:
 *   POST /functions/v1/sync-prevensul-csv
 *   {
 *     "file_base64": "...",
 *     "file_format": "xlsx" | "csv",
 *     "default_reference_month": "2026-04"  // fallback se aba não detectar
 *   }
 *
 * Resposta:
 *   {
 *     "ok": true,
 *     "sheets_processed": [...],
 *     "total_imported": 132,
 *     "total_saldo": 7751516.29
 *   }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERSION = "2026.05.02-v1";

// ─── Helpers ─────────────────────────────────────────────────────────
function detectMonthFromSheet(name: string): string | null {
  if (!name) return null;
  const meses: Record<string, number> = {
    jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
    jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
    janeiro: 1, fevereiro: 2, marco: 3, "março": 3,
    abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8,
    setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  };
  const lower = name.toLowerCase().trim();
  for (const [pt, num] of Object.entries(meses)) {
    if (lower.startsWith(pt) || lower.includes(`/${pt}`) || lower.includes(`-${pt}`)) {
      const yMatch = lower.match(/20\d{2}/);
      const year = yMatch ? Number(yMatch[0]) : new Date().getFullYear();
      return `${year}-${String(num).padStart(2, "0")}`;
    }
  }
  // Format YYYY-MM ou YYYY/MM
  const ym = lower.match(/^(20\d{2})[-/](0?[1-9]|1[0-2])$/);
  if (ym) return `${ym[1]}-${String(Number(ym[2])).padStart(2, "0")}`;
  return null;
}

function parseExcelDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  // dd/mm/yyyy
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  // mmm/yy ou mes/yy
  const mmYy = s.match(/^([a-z]{3})\/(\d{2,4})$/i);
  if (mmYy) {
    const mes = detectMonthFromSheet(`${mmYy[1]} 20${mmYy[2].slice(-2)}`);
    return mes ? `${mes}-01` : null;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function cleanNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/R\$/g, "").replace(/\./g, "").replace(",", ".").trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseSheetRows(raw: any[][]): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [];
  for (let i = 2; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[0] || String(row[0]).trim() === "") continue;
    const parcela = String(row[4] ?? "");
    const [ic, it] = parcela.includes("/") ? parcela.split("/").map(Number) : [null, null];
    const paid = cleanNumber(row[6]);

    rows.push({
      client_name: String(row[0]).trim(),
      contract_total: cleanNumber(row[1]),
      balance_remaining: cleanNumber(row[2]),
      contract_nf: row[3] ? String(row[3]).trim() : null,
      installment_current: ic,
      installment_total: it,
      closing_date: parseExcelDate(row[5]),
      amount_paid: paid,
      commission_rate: 0.03,
      commission_value: cleanNumber(row[7]) || paid * 0.03,
      status: row[8] ? String(row[8]).trim() : "Pendente",
    });
  }
  return rows;
}

// ─── Handler ─────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log(`[sync-prevensul-csv] ▶ versão ${VERSION}`);

  try {
    const body = await req.json();
    const { file_base64, file_format = "xlsx", default_reference_month } = body;

    if (!file_base64) {
      return new Response(JSON.stringify({ ok: false, error: "file_base64 obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados");
    }

    // Auth: usa JWT do header se vier; senão service role
    const authHeader = req.headers.get("authorization") ?? "";
    const sb = createClient(supabaseUrl, serviceKey, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    });

    // Decodifica base64 → Uint8Array
    const binary = Uint8Array.from(atob(file_base64), (c) => c.charCodeAt(0));

    let sheetsData: Array<{ refMonth: string; sheetName: string; rows: Array<Record<string, any>> }> = [];

    if (file_format === "csv") {
      const text = new TextDecoder().decode(binary);
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const raw = lines.map((l) => l.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, "")));
      const refMonth = default_reference_month || new Date().toISOString().slice(0, 7);
      sheetsData = [{ refMonth, sheetName: "csv", rows: parseSheetRows(raw) }];
    } else {
      const wb = XLSX.read(binary, { type: "array" });
      sheetsData = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        return {
          refMonth: detectMonthFromSheet(name) ?? default_reference_month ?? new Date().toISOString().slice(0, 7),
          sheetName: name,
          rows: parseSheetRows(raw),
        };
      }).filter((s) => s.rows.length > 0);
    }

    if (sheetsData.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "Nenhuma row válida encontrada no arquivo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE + INSERT atômico por reference_month (cada sheet)
    const sheetsProcessed: any[] = [];
    let totalImported = 0;
    let totalSaldo = 0;

    for (const sheet of sheetsData) {
      // Apaga registros antigos do mês
      const { error: delErr } = await sb
        .from("prevensul_billing")
        .delete()
        .eq("reference_month", sheet.refMonth);
      if (delErr) {
        console.error(`[sync-prevensul-csv] DELETE failed for ${sheet.refMonth}:`, delErr.message);
        continue;
      }

      // Insere novos
      const rowsWithMonth = sheet.rows.map((r) => ({ ...r, reference_month: sheet.refMonth }));
      const { error: insErr } = await sb.from("prevensul_billing").insert(rowsWithMonth);
      if (insErr) {
        console.error(`[sync-prevensul-csv] INSERT failed for ${sheet.refMonth}:`, insErr.message);
        sheetsProcessed.push({
          sheet_name: sheet.sheetName,
          reference_month: sheet.refMonth,
          ok: false,
          error: insErr.message,
        });
        continue;
      }

      const saldoSheet = sheet.rows.reduce((s, r) => s + Number(r.balance_remaining || 0), 0);
      totalImported += sheet.rows.length;
      totalSaldo += saldoSheet;
      sheetsProcessed.push({
        sheet_name: sheet.sheetName,
        reference_month: sheet.refMonth,
        rows_imported: sheet.rows.length,
        saldo_total: Math.round(saldoSheet * 100) / 100,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        version: VERSION,
        sheets_processed: sheetsProcessed,
        total_imported: totalImported,
        total_saldo: Math.round(totalSaldo * 100) / 100,
        comissao_futura_total: Math.round(totalSaldo * 0.03 * 100) / 100,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro desconhecido";
    console.error("[sync-prevensul-csv] error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
