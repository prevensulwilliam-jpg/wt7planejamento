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
  "reference_month": "YYYY-MM",
  "due_date": "YYYY-MM-DD",
  "kwh_total": number,
  "invoice_total": number,
  "cosip": number,
  "pis_cofins_pct": number,
  "icms_pct": number,
  "solar_kwh_offset": number,
  "amount_paid": number
}

Dicas:
- "Mês de referência" ou "Competência" → reference_month
- "Vencimento" → due_date
- "Consumo" ou "kWh" → kwh_total
- "Valor a pagar" ou "Total" → invoice_total
- "COSIP" ou "Iluminação Pública" → cosip
- "PIS/COFINS" → pis_cofins_pct (em %, ex: 3.5)
- "ICMS" → icms_pct (em %, ex: 12.0)
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

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mime = mediaType || "image/jpeg";
    const dataUrl = `data:${mime};base64,${imageBase64}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
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
      return new Response(JSON.stringify({ error: "Erro no gateway de IA", detail: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content ?? "";

    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(rawText.trim());
    } catch {
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
