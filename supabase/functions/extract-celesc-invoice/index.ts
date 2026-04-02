import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

const EXTRACT_PROMPT = `Você é um extrator de dados de faturas CELESC (companhia de energia elétrica de Santa Catarina, Brasil).

Analise a imagem desta fatura e extraia os seguintes dados em JSON. Se um campo não estiver visível ou não existir na fatura, use null.

Retorne APENAS o JSON, sem explicações, sem markdown, sem código de bloco. Apenas o objeto JSON puro.

{
  "reference_month": "YYYY-MM",         // mês de competência/referência (ex: "2026-04")
  "due_date": "YYYY-MM-DD",             // data de vencimento
  "kwh_total": number,                   // consumo total em kWh
  "invoice_total": number,              // valor total da fatura em R$
  "cosip": number,                      // valor do COSIP/taxa de iluminação pública em R$
  "pis_cofins_pct": number,             // alíquota PIS/COFINS em % (ex: 3.5 para 3,5%)
  "icms_pct": number,                   // alíquota ICMS em % (ex: 12.0 para 12%)
  "solar_kwh_offset": number,           // kWh gerado pela energia solar / créditos compensados
  "amount_paid": number                 // valor efetivamente pago / valor da conta após desconto solar
}

Dicas para localizar os dados:
- "Mês de referência" ou "Competência" → reference_month
- "Vencimento" → due_date
- "Consumo" ou "kWh" → kwh_total
- "Valor a pagar" ou "Total" → invoice_total
- "COSIP" ou "Iluminação Pública" → cosip
- "PIS/COFINS" → pis_cofins_pct
- "ICMS" → icms_pct
- "Energia Solar", "Geração", "Créditos", "GD" → solar_kwh_offset
- "Valor pago" ou valor real cobrado após compensação solar → amount_paid`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mediaType } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: EXTRACT_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: "Erro na API Claude", detail: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await response.json();
    const rawText = claudeData.content?.[0]?.text ?? "";

    // Parse JSON from response
    let extracted: Record<string, unknown> = {};
    try {
      // Try direct parse first
      extracted = JSON.parse(rawText.trim());
    } catch {
      // Try to extract JSON from text
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          extracted = JSON.parse(match[0]);
        } catch {
          return new Response(JSON.stringify({ error: "Não foi possível extrair dados da fatura", raw: rawText }), {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
