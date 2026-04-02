import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Naval, conselheiro financeiro estratégico do William Tavares, empresário de Itajaí/SC, 39 anos.

William é Diretor Comercial da Prevensul (sistemas de prevenção de incêndio e elétrica), tem 13 kitnets alugadas em 2 complexos (RWT02 - Rua Amauri de Souza e RWT03 - Rua Manoel Corrêa), energia solar nos complexos, 5 obras/terrenos em andamento (RWT04, RJW01, RJW02 com Jairo 50%, RWW01 com Walmir 50%), está construindo um SaaS chamado proposal-maker-pro e tem meta de R$100.000/mês de renda passiva. Planeja casamento em 11/12/2027 na Villa Sonali em Balneário Camboriú.

Renda atual: ~R$40k/mês (kitnets R$20k + salário/fixo R$8k + comissões Prevensul + T7 + solar + laudos).

Quando o usuário incluir "Dados da página:" na mensagem, use esses dados reais para responder com números específicos.

MODO ESTRATÉGICO: Além de responder perguntas, identifique proativamente:
- Oportunidades que William pode estar perdendo
- Ineficiências ou custos que podem ser reduzidos
- Qual área focar para chegar mais rápido à meta de R$100k/mês
- Insights que ele talvez não esteja vendo nos próprios dados

Responda SEMPRE em português, direto e executivo. Use **negrito** para números e pontos importantes. Trate William pelo nome. Máximo 4 parágrafos por resposta, a não ser que ele peça mais detalhes.`;

const CELESC_EXTRACT_PROMPT = `Você é um extrator de dados de faturas CELESC (energia elétrica de Santa Catarina, Brasil).

Analise a imagem desta fatura e extraia os campos abaixo em JSON puro, sem markdown, sem explicações.
Se um campo não estiver visível, use null.

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
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body_req = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ── Modo extração CELESC ──
    if (body_req.action === "extract-celesc") {
      const { imageBase64, mediaType } = body_req;
      const dataUrl = `data:${mediaType || "image/jpeg"};base64,${imageBase64}`;

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 512,
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUrl } },
              { type: "text", text: CELESC_EXTRACT_PROMPT },
            ],
          }],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: "Erro no gateway", detail: err }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content ?? "";
      let extracted: Record<string, unknown> = {};
      try { extracted = JSON.parse(rawText.trim()); }
      catch { const m = rawText.match(/\{[\s\S]*\}/); if (m) extracted = JSON.parse(m[0]); }

      return new Response(JSON.stringify({ ok: true, data: extracted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Modo chat Naval (padrão) ──
    const { messages, stream } = body_req;

    const body: Record<string, unknown> = {
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream: stream ?? false,
    };
    if (!stream) body.max_tokens = 1500;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione fundos no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(
        JSON.stringify({ error: "Erro no gateway de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (stream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wisely-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
