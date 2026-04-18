import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Naval, conselheiro financeiro estratégico do William Tavares, empresário de Itajaí/SC, 39 anos.

William é Diretor Comercial da Prevensul (prevenção de incêndio e elétrica), tem 13 kitnets alugadas em 2 complexos (RWT02 - Rua Amauri de Souza e RWT03 - Rua Manoel Corrêa), energia solar nos complexos, 5 obras/terrenos em andamento (RWT04, RJW01, RJW02 com Jairo 50%, RWW01 com Walmir 50%), está construindo um SaaS chamado proposal-maker-pro, e planeja casamento em 11/12/2027 na Villa Sonali em Balneário Camboriú.

═══ META PRINCIPAL ATUALIZADA (2026+) ═══
Índice de Autonomia de 50% até 2028.
Índice = (renda passiva + eventual) / renda total × 100
Quanto menor a dependência da Prevensul, mais livre.

═══ ESTRUTURA /businesses (fonte canônica) ═══
Os negócios cadastrados no sistema são APENAS:
- KITNETS (recorrente, passiva) — 13 unidades, R$16-20k/mês
- PREVENSUL (recorrente, ativa) — salário + comissões, ~R$60-70k/mês
- CW7 (crescimento) — energia solar residencial/comercial
- T7 (crescimento) — T7 Sales / consultoria
- HR7 (crescimento) — Henrique Rial consultoria fitness
- PROMAX (crescimento) — Mercado Livre
- OUTROS (eventual) — receitas pontuais que não se encaixam

REGRA INVIOLÁVEL: NUNCA sugira vetores de receita fora desta lista. Se quiser mencionar Brava Comex, AppAltPerformance, ou qualquer outro projeto — diga explicitamente que NÃO ESTÁ CADASTRADO em /businesses e sugira cadastrar antes de usar como alavanca estratégica.

═══ NOMENCLATURA DE CLASSIFICAÇÃO ═══
- Renda ATIVA: PREVENSUL (salário/comissões trocando tempo por dinheiro)
- Renda PASSIVA: KITNETS + negócios recorrentes não-Prevensul (CW7 se recorrente)
- Renda EVENTUAL: OUTROS + incubados (freelas, vendas avulsas, reembolsos)

═══ DADOS EM TEMPO REAL ═══
Quando o usuário (ou o sistema) incluir "Dados da página:" ou "Snapshot:" na mensagem, use esses números reais. Se não tiver dados, peça pra ele colar ou use aproximações com o disclaimer claro.

═══ MODO ESTRATÉGICO ═══
Sempre priorize:
1. Reduzir dependência Prevensul (subir Índice de Autonomia)
2. Identificar negócios abaixo da meta mensal que podem ser acelerados
3. Apontar excedente do mês como "munição de reinvestimento"
4. Cruzar evolução 12m pra detectar tendências (caindo, estagnado, subindo)
5. Sugerir ações concretas e mensuráveis — NUNCA genéricas

Responda SEMPRE em português, direto e executivo. Use **negrito** em números e pontos-chave. Trate William pelo nome. Máximo 4 parágrafos por resposta a não ser que ele peça mais detalhes.`;

const AUTONOMY_ANALYSIS_PROMPT = `Você é o Naval em modo análise estratégica. Você receberá um snapshot financeiro estruturado do William e deve gerar uma leitura estratégica do mês.

FORMATO OBRIGATÓRIO da resposta (markdown, máximo 250 palavras):

**📊 Diagnóstico**
[1-2 frases: estado do Índice de Autonomia e tendência vs meses anteriores]

**⚡ Prioridades do mês**
1. [Prioridade mais urgente — negócio específico abaixo da meta ou alerta crítico]
2. [Segunda prioridade]
3. [Terceira, se aplicável]

**💰 Munição**
[O que fazer com o excedente do mês — percentual sugerido pra reinvestir, em qual vetor da lista de businesses cadastrados]

**🎯 Próximo passo concreto**
[UMA ação mensurável pra semana, não mês — ex: "Ligar pra cliente X pra fechar proposta Y"]

REGRAS:
- NUNCA invente vetores fora da lista: KITNETS, PREVENSUL, CW7, T7, HR7, PROMAX, OUTROS
- Seja específico com números do snapshot
- Se o índice caiu vs mês anterior, explique a CAUSA (Prevensul subiu? Kitnet caiu?)
- Se houve excedente, diga quanto e onde alocar
- Cada prioridade deve ter um valor em R$ envolvido
- NÃO use jargão financeiro genérico ("diversifique", "tenha disciplina") — entregue análise cirúrgica baseada nos números`;

const RECONCILE_PROMPT = `Você é o Naval, assistente de conciliação financeira do William Tavares.

William tem múltiplas fontes de receita: kitnets (aluguéis), comissões Prevensul, energia solar, T7 (telecom), laudos técnicos, dividendos/rendimentos XP, e eventualmente outras entradas (consórcios, vendas, reembolsos, transferências entre contas próprias).

Analise TODAS as transações bancárias pendentes — créditos e débitos — e gere um relatório de conciliação completo.

REGRAS PARA CRÉDITOS:
1. Tente identificar automaticamente apenas quando bater exatamente com um valor esperado (kitnet, comissão lançada, etc.)
2. Para TODO crédito sem identificação clara, pergunte diretamente o que é — nunca assuma
3. Seja específico: mencione data, valor e descrição do extrato em cada pergunta
4. Possíveis origens a considerar: kitnet, comissão Prevensul, solar, T7, laudo, dividendo XP, transferência própria, reembolso, venda, outro

REGRAS PARA DÉBITOS:
1. Para débitos com descrição clara (cartão, conta de luz, supermercado), sugira a categoria
2. Para débitos sem identificação (PIX enviado, TED saída, cheque), pergunte o que é
3. Possíveis categorias: obras, terreno, casamento, alimentação, lazer, saúde, academia, gasolina, assinaturas, impostos, transferência própria, outro

REGRAS GERAIS:
1. Agrupe transações do mesmo tipo quando fizer sentido (ex: 10 depósitos de ~R$1.540 = kitnets)
2. Calcule o saldo do mês e compare com o esperado (~R$40k/mês)
3. Aponte desvios importantes: recebeu menos do que esperava? Gastou mais do que deveria?

FORMATO DA RESPOSTA:
## Conciliação — [mês]

**Resumo do mês:**
- Total créditos: R$X
- Total débitos: R$X  
- Saldo: R$X
- Conciliado: N transações | Aguardando identificação: N transações

**✅ Identificado automaticamente:**
[lista resumida por grupo]

**❓ William, me confirma o que são essas entradas:**
[para cada crédito não identificado: Dia XX/XX — R$X.XXX — [descrição do extrato] — o que é isso?]

**❓ E essas saídas:**
[para cada débito não identificado: Dia XX/XX — R$X.XXX — [descrição] — qual categoria?]

**⚠️ Pontos de atenção:**
[desvios, valores abaixo do esperado, gastos fora do padrão]

Responda SEMPRE em português. Direto e executivo. William precisa resolver isso em minutos.`;

const CONSTRUCTION_EXTRACT_PROMPT = (today: string) => `Você é um extrator de dados de planilhas de custos de construção civil brasileira.

Analise este PDF e retorne APENAS JSON puro, sem markdown, sem explicação.

{
  "expenses": [
    {
      "date": "DD/MM/YYYY",
      "description": "descrição original",
      "value": 1234.56,
      "category": "Terreno|Terraplenagem|Materiais|Mão de Obra|Instalações|Acabamento|Taxas/Cartório|Outros",
      "is_future": false
    }
  ],
  "stages": [
    {
      "name": "nome da etapa",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD ou null",
      "status": "pendente|em_andamento|concluida",
      "pct_complete": 0
    }
  ]
}

REGRAS EXPENSES:
- Use a seção "Resumo" se existir (evita duplicatas de parcelas). Senão use Lançamentos.
- is_future: true apenas para datas APÓS ${today}
- Mapeamento de categorias: aterro/terraplanagem → Terraplenagem | pedreiro/mão de obra/parcela mão → Mão de Obra | blocos/ferragens/cimento/material/pingadeira/veda/fundo → Materiais | poste/elétrica/hidráulica/instalação → Instalações | pintura/reboco/acabamento → Acabamento | terreno/escritura → Terreno | IPTU/cartório/taxa → Taxas/Cartório | trator/máquina/equipamento → Terraplenagem

REGRAS STAGES:
- Infira fases agrupando despesas por tipo e período cronológico
- Exemplos: despesas de aterro/trator em jan → etapa "Terraplenagem" start_date=primeiro dia daquele mês
- Pedreiro/blocos/ferragens em mar → etapa "Alvenaria"
- Pintura/reboco/acabamento → etapa "Acabamento"
- Poste/elétrica → etapa "Instalações Elétricas"
- Status: se todas despesas da etapa têm is_future=false → "concluida" pct_complete=100; se parte futura → "em_andamento"; se tudo futuro → "pendente"
- Máximo 6 etapas, não crie etapas com apenas 1 item trivial

Retorne APENAS o JSON.`;

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

function safeParseJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* fall through */ }
    }
    return {};
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body_req: Record<string, unknown>;
    try {
      body_req = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Request body vazio ou JSON inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ── Modo extração PDF de obra ──
    if (body_req.action === "extract-construction-pdf") {
      const { pdfBase64, isXlsx } = body_req as any;
      const today = new Date().toISOString().slice(0, 10);
      const mimeType = isXlsx
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf";
      const dataUrl = `data:${mimeType};base64,${pdfBase64}`;

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 2500,
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUrl } },
              { type: "text", text: CONSTRUCTION_EXTRACT_PROMPT(today) },
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
      const extracted = safeParseJson(rawText);

      return new Response(JSON.stringify({ ok: true, expenses: extracted.expenses ?? [], stages: extracted.stages ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Modo extração XLSX de obra (texto CSV) ──
    if (body_req.action === "extract-construction-xlsx") {
      const { xlsxText } = body_req as any;
      const today = new Date().toISOString().slice(0, 10);

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 2500,
          messages: [
            { role: "system", content: CONSTRUCTION_EXTRACT_PROMPT(today) },
            { role: "user", content: `Planilha de custos (CSV extraído):\n\n${xlsxText}` },
          ],
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
      const extracted = safeParseJson(rawText);

      return new Response(JSON.stringify({ ok: true, expenses: extracted.expenses ?? [], stages: extracted.stages ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Modo extração extrato consórcio ──
    if (body_req.action === "extract-consortium") {
      const { imageBase64, mediaType } = body_req as any;
      const dataUrl = `data:${mediaType || "application/pdf"};base64,${imageBase64}`;

      const CONSORTIUM_PROMPT = `Você é um extrator de dados de extratos de consórcio brasileiro (Ademicon, Porto Seguro, Rodobens, etc).

Analise este documento (PDF ou imagem) de extrato/boleto de consórcio e extraia os dados em JSON puro, sem markdown, sem explicações.
Se um campo não estiver visível, use null.

{
  "group_number": "000580",
  "quota": "0434-00",
  "contract_number": "0090065342",
  "admin_fee_pct": 23.50,
  "asset_type": "IMOVEIS",
  "credit_value": 428132.79,
  "adhesion_date": "2020-09-25",
  "end_date": "2035-09-25",
  "installments_total": 180,
  "installments_paid": 72,
  "installments_remaining": 108,
  "total_paid": 79923.09,
  "total_pending": 437890.51,
  "fund_paid": 52345.67,
  "admin_fee_paid": 18789.01,
  "insurance_paid": 8788.41,
  "monthly_payment": 1841.40,
  "total_value": 517813.60
}

REGRAS:
- Datas no formato YYYY-MM-DD
- Valores numéricos sem R$, sem pontos de milhar (ex: 428132.79)
- Conte o número de linhas de parcelas pagas para installments_paid
- monthly_payment = valor da última parcela paga (campo "Valor Pago" ou boleto)
- fund_paid = soma do fundo comum pago em todas as parcelas
- admin_fee_paid = soma da taxa de administração paga em todas as parcelas
- insurance_paid = soma dos seguros pagos em todas as parcelas
- total_paid = soma de todos os valores pagos (ou campo "Você já pagou X%")
- total_pending = "Valor a pagar" ou calcule: (installments_total - installments_paid) * monthly_payment. NUNCA retorne 0 ou negativo se houver parcelas restantes
- total_value = total_paid + total_pending
- credit_value = valor do crédito/bem do consórcio (ex: "Sem taxas" ou "Crédito")
- Se houver uma tabela resumo com totais, use esses valores
- Procure campos como: "Prazo", "Grupo", "Cota", "Taxa de Adm", "% a pagar", "Valor a pagar"
- Retorne APENAS o JSON`;

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUrl } },
              { type: "text", text: CONSORTIUM_PROMPT },
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
      const extracted = safeParseJson(rawText);

      return new Response(JSON.stringify({ ok: true, data: extracted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: dataUrl } },
                { type: "text", text: CELESC_EXTRACT_PROMPT },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: "Erro no gateway", detail: err }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content ?? "";
      const extracted = safeParseJson(rawText);

      return new Response(JSON.stringify({ ok: true, data: extracted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Modo conciliação automática ──
    if (body_req.action === "reconcile") {
      const { month, pendingTransactions, expectedRevenues, kitnetEntries } = body_req as any;

      const totalCredits = (pendingTransactions as any[])
        .filter((t: any) => t.type === "credit")
        .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);

      const totalDebits = (pendingTransactions as any[])
        .filter((t: any) => t.type === "debit")
        .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);

      const kitnetValues = (kitnetEntries as any[] ?? []).map((k: any) => ({
        amount: k.amount,
        kitnet: k.unit_id || k.kitnet_id,
        tenant: k.tenant_name,
      }));

      const autoMatched: any[] = [];
      const unmatched: any[] = [];

      for (const tx of (pendingTransactions as any[])) {
        if (tx.type !== "credit") continue;
        const cents = Math.round(Math.abs(tx.amount) * 100);
        const kitMatch = kitnetValues.find((k: any) => Math.round(k.amount * 100) === cents);
        if (kitMatch) {
          autoMatched.push({ ...tx, match: kitMatch });
        } else {
          unmatched.push(tx);
        }
      }

      const dataContext = `
MÊS: ${month}

TRANSAÇÕES PENDENTES NO EXTRATO:
${(pendingTransactions as any[]).map((t: any) =>
  `- ${t.date} | ${t.type === "credit" ? "CRÉDITO" : "DÉBITO"} | R$${Math.abs(t.amount).toFixed(2)} | ${t.description}`
).join("\n")}

RECEITAS ESPERADAS NESTE MÊS (cadastradas no sistema):
${(expectedRevenues as any[] ?? []).map((r: any) =>
  `- ${r.source}: R$${r.amount?.toFixed(2)} | ${r.description || ""}`
).join("\n") || "Nenhuma receita cadastrada para este mês"}

KITNETS COM VALORES ESPERADOS:
${kitnetValues.map((k: any) => `- R$${k.amount?.toFixed(2)} | ${k.tenant || "sem inquilino"}`).join("\n") || "Nenhum fechamento de kitnet lançado"}

AUTO-MATCH REALIZADO (${autoMatched.length} transações):
${autoMatched.map((t: any) => `- R$${Math.abs(t.amount).toFixed(2)} → Kitnet ${t.match?.kitnet || ""} (${t.match?.tenant || ""})`).join("\n") || "Nenhum match automático"}

SEM IDENTIFICAÇÃO (${unmatched.length} transações — precisa de William):
${unmatched.map((t: any) => `- ${t.date} | R$${Math.abs(t.amount).toFixed(2)} | ${t.description}`).join("\n") || "Todas identificadas!"}

TOTAIS:
- Total créditos extrato: R$${totalCredits.toFixed(2)}
- Total débitos extrato: R$${totalDebits.toFixed(2)}
- Conciliado automaticamente: ${autoMatched.length} transações
- Aguardando identificação: ${unmatched.length} transações
`;

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 1500,
          messages: [
            { role: "system", content: RECONCILE_PROMPT },
            { role: "user", content: dataContext },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: "Erro no gateway", detail: err }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "";

      return new Response(JSON.stringify({
        text,
        autoMatched: autoMatched.length,
        unmatched: unmatched.length,
        totalCredits,
        totalDebits,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Modo análise de autonomia (cockpit /hoje) ──
    if (body_req.action === "analyze-autonomy") {
      const { snapshot, history, businesses } = body_req as any;
      // snapshot: { month, active, passive, eventual, total, autonomyPct, target }
      // history: array de snapshots dos últimos N meses
      // businesses: array com {code, name, category, monthly_target, realized}

      const prevSnap = history && history.length >= 2 ? history[history.length - 2] : null;
      const tendencia = prevSnap
        ? (snapshot.autonomyPct - prevSnap.autonomyPct).toFixed(1)
        : "n/a";

      const bizLines = (businesses ?? [])
        .map((b: any) => {
          const pct = b.monthly_target > 0
            ? ((b.realized / b.monthly_target) * 100).toFixed(0)
            : "sem meta";
          return `- ${b.code} (${b.category}) — meta R$${b.monthly_target.toFixed(0)} · realizado R$${b.realized.toFixed(0)} · ${pct}${b.monthly_target > 0 ? "%" : ""}`;
        })
        .join("\n");

      const historyLines = (history ?? [])
        .slice(-6)
        .map((s: any) => `${s.month}: ${s.autonomyPct.toFixed(0)}% (R$${s.total.toFixed(0)} total)`)
        .join(" → ");

      const userMsg = `Snapshot ${snapshot.month}:
- Índice de Autonomia: ${snapshot.autonomyPct.toFixed(1)}% (vs mês anterior: ${tendencia}pp)
- Renda ativa (Prevensul): R$${snapshot.active.toFixed(0)}
- Renda passiva (Kitnets + recorrentes): R$${snapshot.passive.toFixed(0)}
- Renda eventual (Outros): R$${snapshot.eventual.toFixed(0)}
- Total: R$${snapshot.total.toFixed(0)}
- Meta consolidada: R$${snapshot.target.toFixed(0)}
- Excedente/Gap: R$${(snapshot.total - snapshot.target).toFixed(0)}

Negócios:
${bizLines}

Últimos 6 meses (índice):
${historyLines}

Gere a leitura estratégica seguindo o formato obrigatório.`;

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 800,
          messages: [
            { role: "system", content: AUTONOMY_ANALYSIS_PROMPT },
            { role: "user", content: userMsg },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: "Erro no gateway", detail: err }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      return new Response(JSON.stringify({ ok: true, analysis: text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Modo chat Naval (padrão) ──
    const { messages, stream } = body_req;
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages deve ser um array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Record<string, unknown> = {
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream: stream ?? false,
    };
    if (!stream) body.max_tokens = 1500;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const status = response.status;
      const t = await response.text();
      console.error("AI gateway error:", status, t);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos.", rateLimited: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione fundos no workspace.", creditsExhausted: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
