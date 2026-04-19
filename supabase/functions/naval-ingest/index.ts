// naval-ingest — destila conteúdo bruto (PDF/URL/texto) em princípios operativos
// para a brain stack do Naval. Retorna { title, author, lens, summary, principles[] }.
// Uso: supabase.functions.invoke("naval-ingest", { body: { mode, ... } })

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISTILL_PROMPT = `Você é o curador da biblioteca mental do Naval — conselheiro estratégico do William Tavares.

Sua tarefa: ler o conteúdo que vou te enviar (livro, artigo, transcrição, nota) e destilá-lo em **princípios operativos** que possam servir como lente de análise financeira/comercial/patrimonial.

Retorne APENAS JSON puro, sem markdown, sem explicação, seguindo este schema:

{
  "title": "Título curto do conteúdo (5-10 palavras)",
  "author": "Autor ou fonte (ex: 'Morgan Housel' ou 'Entrevista Ray Dalio no Lex Fridman')",
  "lens": "naval | aaron_ross | housel | tevah | operador | outros",
  "summary": "2-3 frases explicando o eixo central da obra e quando usar essa lente",
  "principles": [
    "frase 1 (1-3 linhas, português, linguagem destilada — NUNCA copiar texto literal)",
    "frase 2",
    "..."
  ]
}

REGRAS OBRIGATÓRIAS:
1. Entre **8 e 15 princípios**. Menos que 8 = superficial. Mais que 15 = diluído.
2. Cada princípio em **português natural**, tom de conselheiro — NÃO tradução literal de frase do autor.
3. **Zero texto copiado.** Princípio é sempre uma síntese na sua linguagem. Se precisar citar número específico ou conceito técnico, faz, mas sem transcrever parágrafos.
4. Princípio é **acionável ou analítico** — diz o que fazer, o que observar, ou como pensar. Jamais biografia ou contexto histórico.
5. Escolha **lens** de forma crítica:
   - \`naval\` = riqueza, alavancagem, filosofia de tempo, específico-knowledge, jogos longos, liberdade
   - \`aaron_ross\` = vendas B2B, processo comercial, receita previsível, SDR/closer, métricas de funil
   - \`housel\` = psicologia do dinheiro, comportamento, risco, sobrevivência, vieses financeiros
   - \`tevah\` = vendas consultivas pt-br, diagnóstico, follow-up, pós-venda, relacionamento
   - \`operador\` = realidade de campo brasileira, engenharia, construção civil, gestão patrimonial prática
   - \`outros\` = qualquer coisa que não encaixe nas 5 acima (estratégia, liderança, produtividade, etc)
6. **Summary** tem que responder: "quando eu acionaria essa lente numa análise?"
7. Se o conteúdo for raso/genérico, retorne principles vazio \`[]\` e coloque em summary "conteúdo insuficiente para destilação — refazer com material mais denso".

Responda APENAS o JSON, nada mais.`;

function safeParseJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch { /* ignore */ }
  }
  return {};
}

// Extrai texto útil de HTML cru (remove tags, scripts, styles)
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mode, pdfBase64, mediaType, url, rawText, hint } = body as {
      mode: "pdf" | "url" | "text";
      pdfBase64?: string;
      mediaType?: string;
      url?: string;
      rawText?: string;
      hint?: string; // opcional — ex: "livro do Tevah sobre vendas"
    };

    // Monta mensagem pro Gemini dependendo do modo
    let userContent: unknown;

    if (mode === "pdf" && pdfBase64) {
      const mime = mediaType || "application/pdf";
      userContent = [
        { type: "image_url", image_url: { url: `data:${mime};base64,${pdfBase64}` } },
        { type: "text", text: hint ? `Dica do William: ${hint}\n\nDestile conforme o prompt.` : "Destile conforme o prompt." },
      ];
    } else if (mode === "url" && url) {
      let fetchedText = "";
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; NavalIngest/1.0)" },
          redirect: "follow",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        fetchedText = stripHtml(html).slice(0, 60_000); // Gemini 2.5 Flash aguenta bem
      } catch (e) {
        return new Response(JSON.stringify({
          error: "Falha ao baixar URL",
          detail: e instanceof Error ? e.message : String(e),
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userContent = `URL: ${url}\n${hint ? `Dica: ${hint}\n\n` : ""}Conteúdo extraído:\n\n${fetchedText}`;
    } else if (mode === "text" && rawText) {
      userContent = `${hint ? `Dica: ${hint}\n\n` : ""}${rawText}`;
    } else {
      return new Response(JSON.stringify({
        error: "Parâmetros inválidos. Use mode: 'pdf' | 'url' | 'text' com o campo correspondente.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 2500,
        messages: [
          { role: "system", content: DISTILL_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Gateway error:", res.status, err);
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições. Aguarde.", rateLimited: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados.", creditsExhausted: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro no gateway", detail: err }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const rawJson = data.choices?.[0]?.message?.content ?? "";
    const parsed = safeParseJson(rawJson) as {
      title?: string;
      author?: string;
      lens?: string;
      summary?: string;
      principles?: string[];
    };

    const validLens = ["naval", "aaron_ross", "housel", "tevah", "operador", "outros"];
    if (!validLens.includes(parsed.lens ?? "")) parsed.lens = "outros";

    return new Response(JSON.stringify({
      ok: true,
      draft: {
        title: parsed.title ?? "Sem título",
        author: parsed.author ?? "",
        lens: parsed.lens,
        summary: parsed.summary ?? "",
        principles: Array.isArray(parsed.principles) ? parsed.principles : [],
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("naval-ingest error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Erro desconhecido",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
