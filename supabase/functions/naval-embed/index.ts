// naval-embed — gera embeddings dos princípios de uma fonte (ou de um texto avulso)
//
// Modos:
//   1) { source_id: "..." } → embeda TODOS os princípios da source_id
//      (deleta antigos primeiro, insere novos em naval_principle_vectors)
//
//   2) { query: "texto livre" } → retorna embedding único do texto
//      (usado pelo wisely-ai pra busca semântica em tempo real)
//
// Modelo: google/text-embedding-004 via Lovable AI Gateway (768 dims).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMBED_MODEL = "text-embedding-004";
const EMBED_DIM = 768;

// API nativa do Gemini (Lovable gateway não suporta embeddings ainda)
async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((t) => ({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: t }] },
      })),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini embeddings error ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json() as { embeddings: Array<{ values: number[] }> };
  return data.embeddings.map((e) => e.values);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase env missing");

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Modo 1: embedding pontual (usado pelo wisely-ai pra busca) ──
    if (typeof body.query === "string" && body.query.trim()) {
      const [vec] = await embedTexts([body.query.trim()], GEMINI_API_KEY);
      if (!vec || vec.length !== EMBED_DIM) {
        throw new Error(`embedding dim inesperada: ${vec?.length}`);
      }
      return new Response(JSON.stringify({ ok: true, embedding: vec }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Modo 2: embedding em lote de uma source ──
    const sourceId = body.source_id as string | undefined;
    if (!sourceId) {
      return new Response(JSON.stringify({
        error: "Parâmetro obrigatório: source_id (string) ou query (string)",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Lê a source
    const { data: source, error: sErr } = await sb
      .from("naval_sources")
      .select("id, title, lens, principles")
      .eq("id", sourceId)
      .single();
    if (sErr || !source) throw new Error(`source não encontrada: ${sErr?.message}`);

    const principles = Array.isArray(source.principles)
      ? (source.principles as string[]).filter((p) => typeof p === "string" && p.trim())
      : [];

    // 2. Deleta vetores antigos (idempotente — roda de novo se editou)
    const { error: delErr } = await sb
      .from("naval_principle_vectors")
      .delete()
      .eq("source_id", sourceId);
    if (delErr) throw new Error(`delete antigo falhou: ${delErr.message}`);

    if (principles.length === 0) {
      return new Response(JSON.stringify({ ok: true, embedded: 0, note: "source sem princípios" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Embeda tudo em lote (Gemini aceita até ~100 por request sem problema)
    const vectors = await embedTexts(principles, GEMINI_API_KEY);
    if (vectors.length !== principles.length) {
      throw new Error(`embeddings retornados ${vectors.length} != princípios ${principles.length}`);
    }

    // 4. Insere todos
    const rows = principles.map((text, idx) => ({
      source_id: sourceId,
      principle_idx: idx,
      text,
      lens: source.lens,
      embedding: vectors[idx],
    }));

    const { error: insErr } = await sb.from("naval_principle_vectors").insert(rows);
    if (insErr) throw new Error(`insert falhou: ${insErr.message}`);

    return new Response(JSON.stringify({
      ok: true,
      source_id: sourceId,
      embedded: rows.length,
      lens: source.lens,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("naval-embed error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Erro desconhecido",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
