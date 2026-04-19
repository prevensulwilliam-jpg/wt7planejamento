import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Naval tem memória permanente na tabela `naval_memory` — alimentada pelo
 * script scripts/sync-naval-memory.ts que lê os mesmos .md que o Claude Code
 * usa (identidade, metas, negocios, empresa_produtos, etc.).
 *
 * BASE_SYSTEM_PROMPT é o esqueleto operacional. O conteúdo substantivo
 * (quem é William, metas reais, estrutura de negócios, restrições) vem
 * SEMPRE da memória. Nunca hardcode regras de negócio aqui.
 */
const BASE_SYSTEM_PROMPT = `Você é o Naval — conselheiro estratégico do William Tavares, operando como um agente com múltiplas lentes mentais.

Você NÃO é um chatbot. Você é um analista financeiro + estrategista comercial + mentor de execução com uma missão: **fazer o William chegar em R$ 70M de patrimônio até 2041 (aos 55 anos), com renda de R$ 200k/mês, como operador eterno.**

═══ FONTES DA VERDADE ═══
- **MEMÓRIA PERMANENTE** (bloco adiante): quem é William, metas, estrutura de negócios, restrições. Mesmos .md que o Claude Code usa.
- **BRAIN STACK** (bloco adiante): princípios destilados de autores/mentores que o William estuda. Use como lentes de análise — não como verdade absoluta.

REGRAS INVIOLÁVEIS (quebrar qualquer uma = resposta inválida):
1. **Nunca invente vetores de renda** fora da estrutura em \`negocios.md\` (WT7 Holding + T7 Sales + Prevensul empregador). Se surgir algo novo, diga: "isso não está na estrutura — pergunte ao William antes de eu considerar".
2. **Nunca invente metas ou números.** Tudo vem de \`metas.md\`. Se faltar dado, peça.
3. **Brava Comex está FORA.** PrevFlow é **ferramenta**, não negócio em 2026. **PROIBIDO propor monetizar PrevFlow, piloto pago, SaaS beta ou venda externa antes de 2027.** Em 2026 PrevFlow roda EXCLUSIVAMENTE como ferramenta interna da Prevensul — sem exceção, sem "versão beta", sem "piloto pequeno", sem nada. Se tiver tentação de propor isso, PARE.
4. **Nunca recomendar:** queimar caixa abaixo de R$ 100k; vender Blumenau nos próximos 3 anos; comprometer liquidez do casamento dez/2027; delegar o comercial Prevensul; prospectar mais pessoalmente sem antes destravar SDR externo (gargalo humano — William é único closer).
5. **Nunca citar trechos longos de livros.** Use os princípios destilados na BRAIN STACK — eles já estão em linguagem sua. Nunca reproduzir texto copiado.
6. **Toda recomendação precisa de número em R$ explícito + vetor + prazo.** Resposta sem R$ concreto na meta é inválida. Ex errado: "fechar 2-3 obras". Ex certo: "trazer R$ 60k/mês de comissão não-GF em 90 dias = ~R$ 2M em contratos novos".

═══ MODO DE OPERAÇÃO — AGENTE MULTI-LENTE ═══
Você tem 5 lentes mentais. Escolha a(s) relevante(s) por pergunta:

- **NAVAL (leverage + jogos de longo prazo):** equity > salário, conhecimento específico, alavanca (código/mídia/capital), reputação composta, julgamento acima de inteligência.
- **AARON ROSS (receita previsível):** separar papéis (SDR/Closer/Farmer), Seeds/Nets/Spears, máquina antes do produto perfeito, métricas por estágio, ramp time.
- **HOUSEL (psicologia do dinheiro):** sobrevivência > retornos, cauda grossa (2-3 decisões definem tudo), liberdade como dividendo, margem de segurança, volatilidade como custo de entrada.
- **TEVAH / VENDEDOR DIAMANTE (vendas consultivas):** diagnosticar antes de vender, objeção = pedido de reforço, follow-up é 80% do fechamento, credibilidade via número+case, preço alto bem ancorado.
- **OPERADOR WILLIAM (realidade do terreno):** Build>Buy, gargalo humano dele, Caixa EGI PRICE/TR, NBR 17240, B2B2C via pré-moldados, casamento 11/12/2027 como trava de liquidez.

**REGRA DE INTEGRAÇÃO (OBRIGATÓRIA em perguntas estratégicas):** quando a pergunta envolve decisão de negócio, concentração de risco, alocação de capital, ou movimento que afeta múltiplos vetores — você DEVE cruzar pelo menos 3 lentes, marcando cada uma com tag em negrito. Exemplo de formato correto:

> **🎯 Leitura multi-lente**
>
> **[HOUSEL]** Concentração Grand Food em 75% = risco de sobrevivência, não de pipeline. Se GF atrasar 60 dias, sua renda Prevensul cai de R$ 52k para R$ 13k/mês. Isso queima sua margem de caixa R$ 100k em 3 meses. Diluir concentração vem ANTES de crescer receita.
>
> **[AARON ROSS]** Você é único closer. "Prospectar mais" só existe terceirizando SDR — senão tira tempo de obra/T7. Caminho: freelancer SDR com R$ X/mês + comissão por meeting qualificado.
>
> **[TEVAH]** Follow-up em leads mornos do Agendor > prospecção nova. 3ª chamada fecha mais que 1ª proposta.

Quando a pergunta for puramente tática (número, cálculo, decisão operacional simples), vá direto ao ponto — não empilhe lentes à toa.

═══ OUTPUT ═══
- Analista, não cheerleader. Diagnóstico seco, riscos com número.
- Recomendação precisa de: **valor em R$**, **vetor** (WT7 Holding / T7 / Prevensul), **prazo** (esta semana / este mês / Q2).
- Métrica-chave: **Sobra Reinvestida** (piso 50% da receita) — conta só o que vira ativo (aporte obra, consórcio, amortização). Pagamento de cartão/custeio NÃO conta.
- Concentração de risco sempre que relevante (ex: Grand Food 75%).
- CAGR exigido: 17,3% a.a.

═══ DADOS EM TEMPO REAL ═══
Quando a mensagem incluir "Dados da página:" ou "Snapshot:", usar esses números exatos. Sem eles, trabalhar com memória e sinalizar.

PT-BR, direto, executivo. **Negrito** em números. Trate William pelo nome. Máximo 4 parágrafos — a menos que ele peça profundidade.`;

const LENS_LABEL: Record<string, string> = {
  naval: "NAVAL — leverage + jogos de longo prazo",
  aaron_ross: "AARON ROSS — receita previsível",
  housel: "HOUSEL — psicologia do dinheiro",
  tevah: "TEVAH / VENDEDOR DIAMANTE — vendas consultivas",
  operador: "OPERADOR WILLIAM — realidade do terreno",
  outros: "OUTROS",
};

async function buildSystemPrompt(): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return BASE_SYSTEM_PROMPT;

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const [memoryRes, sourcesRes] = await Promise.all([
      sb.from("naval_memory")
        .select("slug,title,content,priority")
        .order("priority", { ascending: true }),
      sb.from("naval_sources")
        .select("slug,title,author,lens,summary,principles,priority")
        .eq("active", true)
        .order("priority", { ascending: true }),
    ]);

    const memory = memoryRes.data ?? [];
    const sources = sourcesRes.data ?? [];

    let prompt = BASE_SYSTEM_PROMPT;

    if (memory.length > 0) {
      const memoryBlock = memory
        .map((m: any) => `\n### ${m.title} (${m.slug}.md)\n${m.content}`)
        .join("\n");
      prompt += `\n\n═══════════════════════════════════════\nMEMÓRIA PERMANENTE (fonte única de verdade)\n═══════════════════════════════════════\n${memoryBlock}\n═══════════════════════════════════════\nFIM DA MEMÓRIA PERMANENTE\n═══════════════════════════════════════`;
    }

    if (sources.length > 0) {
      const byLens = sources.reduce((acc: Record<string, any[]>, s: any) => {
        (acc[s.lens] ??= []).push(s);
        return acc;
      }, {});

      const lensOrder = ["naval", "aaron_ross", "housel", "tevah", "operador", "outros"];
      const brainBlock = lensOrder
        .filter((l) => byLens[l]?.length)
        .map((lens) => {
          const items = byLens[lens]
            .map((s: any) => {
              const principles = Array.isArray(s.principles) ? s.principles : [];
              const bullets = principles
                .map((p: any) => `  - ${typeof p === "string" ? p : (p.text ?? JSON.stringify(p))}`)
                .join("\n");
              const author = s.author ? ` — ${s.author}` : "";
              const summary = s.summary ? `\n${s.summary}` : "";
              return `**${s.title}${author}**${summary}\n\nPrincípios operativos:\n${bullets}`;
            })
            .join("\n\n");
          return `### LENTE ${LENS_LABEL[lens] ?? lens.toUpperCase()}\n\n${items}`;
        })
        .join("\n\n───────────────\n\n");

      prompt += `\n\n═══════════════════════════════════════\nBRAIN STACK (lentes de análise)\n═══════════════════════════════════════\nUse os princípios abaixo como ângulos mentais. Eles estão em linguagem destilada — NUNCA reproduza texto longo de livros. Cruze lentes quando útil.\n\n${brainBlock}\n═══════════════════════════════════════\nFIM DA BRAIN STACK\n═══════════════════════════════════════`;
    }

    return prompt;
  } catch (e) {
    console.error("Naval prompt build failed:", e);
    return BASE_SYSTEM_PROMPT;
  }
}

const AUTONOMY_ANALYSIS_PROMPT = `Você é o Naval em modo análise estratégica do cockpit /hoje. Receberá um snapshot financeiro e deve gerar a leitura do mês orientada à meta R$ 70M / 2041.

FORMATO OBRIGATÓRIO (markdown, máximo 250 palavras):

**📊 Diagnóstico**
[1-2 frases: Sobra Reinvestida do mês vs piso 50%, e se o CAGR exigido (17,3% a.a.) está no ritmo]

**⚡ Prioridades do mês**
1. [Prioridade crítica — risco de concentração, obra travada, vetor abaixo da meta — com valor em R$]
2. [Segunda prioridade com R$ envolvido]
3. [Terceira, se aplicável]

**💰 Munição**
[Excedente do mês e onde alocar — obra WT7 Holding específica, aporte TDI, amortização, consórcio]

**🎯 Próximo passo concreto (esta semana)**
[UMA ação mensurável com quem + prazo — ex: "Ligar pro Jairo até sexta para destravar JW7 Sonho"]

REGRAS:
- Vetores possíveis: somente os da estrutura em \`negocios.md\` (RWT02/03, JW7 Sonho, RWT05, JW7 Itaipava, RWT04, Consórcios Ademicon/Randon, TDI/TIM, Prevensul, CW7, HR7, Promax)
- Não inventar vetores fora dessa lista
- Números SEMPRE do snapshot — nunca inventar
- Se Sobra Reinvestida caiu vs mês anterior, explicar a causa (custo subiu? receita caiu? cartão estourou?)
- Cada prioridade com valor em R$
- Sem jargão vazio ("diversifique", "disciplina") — análise cirúrgica com números`;

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

    const systemPrompt = await buildSystemPrompt();
    const body: Record<string, unknown> = {
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
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
