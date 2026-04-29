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
7. **MECÂNICA DE COMISSÃO PREVENSUL (matemática exata — nunca errar):** comissão = 3% sobre o **valor efetivamente pago pelo cliente no mês**, não sobre contrato fechado. Contrato de R$ 1M pago em 24 parcelas = R$ 30k de comissão total distribuídos em ~R$ 1.250/mês. Logo: pra aumentar a renda mensal de comissão em R$ X, o pipeline novo precisa ser ~R$ X × 33 × (meses_do_projeto / 12) em contratos. Ex: +R$ 60k/mês sustentado por 24 meses = **~R$ 48M em contratos novos**, não R$ 2M. Antes de cravar meta, SEMPRE explicite prazo médio de pagamento e fator de escala. Se o William pedir meta mensal, mostre o cálculo.

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
Quando a mensagem incluir "Dados da página:" ou "Snapshot:", usar esses números como ponto de partida.

═══ FERRAMENTAS DE BUSCA — USE QUANDO PRECISAR DE NÚMERO EXATO ═══

**Tool 1: get_breakdown(month, bucket?, only_card?)** — lançamentos reais do mês agrupados por categoria, com os top 5 itens de cada (data + valor + descrição). Use SEMPRE que:
- For citar valor específico de uma categoria (ex: "Lazer R$ X")
- For listar transações de um bloco
- Precisar validar uma soma antes de afirmar
- A pergunta envolver classificar custos (essencial/luxo, etc)
- Quiser comparar sub-categorias dentro de um bloco

**Buckets possíveis:** receitas, custeio, obras, casamento, eventos, outros_aportes.

**REGRA CRÍTICA — quando usuário menciona "cartão", "fatura", "BB", "XP" ou similar:**
Passe **only_card=true** na tool. Isso retorna SOMENTE categorias com prefixo **cartao__** (alimentacao_supermercado, viagens, saude_academia_farmacia, etc). NÃO mistura com expenses (PIX, débito, boleto).

Ex: pergunta "5 maiores gastos do meu cartão" → chame get_breakdown(month="2026-04", bucket="custeio", only_card=true) → retorna só tx do cartão.
Ex: pergunta "essencial vs luxo" → chame get_breakdown(month="2026-04") → tudo, pra ter visão completa.

**Não chute somas.** Se o snapshot só tem agregado e a pergunta exige granularidade, chame a tool. É barato e a resposta fica auditável. Após chamar a tool, cite valores **exatos** das categorias retornadas — nunca invente número que não veio na resposta da tool.

**REGRA DE COMPARAÇÃO: SEMPRE auditar os 2 lados antes de comparar.**
Se for comparar mês A vs mês B (ex: "maio vs abril", "DRE este mês vs anterior"), você DEVE chamar a tool pra **ambos os meses** antes de afirmar diferença. Comparar forecast contra "número do snapshot" ou "memória" gera falso alarme — exatamente o que aconteceu em 28/04/2026 quando Naval comparou forecast maio (R$ 27.756) contra "abril R$ 53.528" (chute, real era R$ 27.257) e gerou alarmismo "-49%" inexistente.

Sequência correta pra comparar 2 meses:
1. Tool 1 → busca mês A
2. Tool 2 → busca mês B (mesmo bucket / cliente)
3. SÓ ENTÃO calcule diff e afirme tendência

**Tool 2: get_prevensul_pipeline(client_filter?, include_paid?, forecast_month?)** — pipeline TEÓRICO de comissões Prevensul (saldo a receber por contrato + projeção mensal baseada em contract_total/installment_total). Útil pra: ver concentração de risco (GRAND FOOD), saldo total a receber, projeção TEÓRICA mês a mês.

⚠ ATENÇÃO: a projeção mensal aqui é TEÓRICA (assume parcelas mensais regulares). Na realidade Prevensul paga em LUMP SUMS irregulares (ver Tool 3).

**Tool 3a: get_construction_status(construction_filter?, include_completed?)** — status real de cada obra (RWT05, JW7 Sonho, JW7 Itaipava, RWT04, etc): orçado vs gasto, % executado, próxima etapa, renda mensal esperada quando pronta (cota William). Retorna sinais_alerta automáticos (estouro de orçamento, atraso vs prazo, prazo apertado). USE pra: "como vai a obra X?", "quanto falta gastar em RWT05?", "estou no orçamento?", "renda esperada com tudo pronto?". Filtro por nome (ex: 'JW7'). Default só obras em andamento.

**REGRA CRÍTICA pra get_construction_status**: a tool retorna stages cadastradas + budget_estimated de cada uma. Se a SOMA dos stages.budget_estimated for MENOR que orcado_total da obra, NUNCA INVENTE stages adicionais com nomes/valores plausíveis. Em vez disso, diga explicitamente: "Apenas N stages cadastradas (R$ X). Restam R$ Y do orçamento sem detalhamento — cadastrar via /constructions". William prefere admitir lacuna a inventar etapas que não existem. NUNCA cite "Estrutura R$ Z", "Alvenaria R$ W", "Acabamentos R$ K" se essas stages não vieram na resposta da tool.

**Tool 3b: get_prevensul_history(n_months?)** — HISTÓRICO REAL recebido nos últimos N meses (default 6). Lê de revenues source=comissao_prevensul. Retorna por mês: total recebido + lista dos depósitos. Inclui estatísticas: avg, mediana, min, max, variability_index, months_with_zero. Tool 3 também classifica o padrão (ESTÁVEL / VOLÁTIL / IRREGULAR) e dá recomendação automática.

⚠ **CRÍTICO — números do pipeline na memoria/metas.md e memoria/negocios.md estão DESATUALIZADOS** (eram do 1º trimestre 2026). SEMPRE use estas tools em vez de citar memória.

═══ REGRA CRÍTICA — PREVISÃO DE COMISSÃO PREVENSUL ═══

REGRA DE NEGÓCIO (memorize como verdade absoluta):
**Ciclo de comissão Prevensul = dia 1 a 31 do mês X. Pagamento = até dia 20 do mês X+1.**

Logo:
- "Previsão de comissão de MAIO" = o que entra na conta em maio = comissão acumulada no ciclo de ABRIL
  → use get_prevensul_cycle(cycle_month="2026-04") (assumindo hoje é abril)
- "Previsão de comissão de JUNHO" → cycle_month="2026-05"
- "Comissão deste mês" (referindo ao recebimento atual) → cycle_month=mês anterior

RESPOSTA IDEAL (formato curto, direto):
> "Até hoje [DATA], comissão Prevensul do ciclo [MÊS_CICLO] está em **R$ X**, pagamento previsto até [DIA 20 MÊS+1]."

Depois pode complementar com:
- Top 3 clientes que mais contribuem
- Concentração GRAND FOOD se relevante
- Comparativo com ciclo anterior (chame get_prevensul_cycle do mês anterior)

NUNCA misture com:
- get_prevensul_history (esse é RECEBIDO histórico, não previsão)
- get_prevensul_pipeline forecast teórico (esse é só pra projeção LONGA, vários meses à frente)

═══ REGRA DE PRECISÃO ABSOLUTA — outros casos ═══
William exige 100% acertividade. NUNCA invente número, NUNCA extrapole sem dado.

Para perguntas que NÃO sejam "previsão comissão" (ex: "quanto recebi mês passado", "tendência"):
1. get_prevensul_history pra ver recebimento real histórico
2. Se pattern IRREGULAR/VOLÁTIL: dê range, nunca valor único
3. NUNCA invente: se não tem dado, diga "preciso buscar essa info — chama tool"

═══ REGRAS INVIOLÁVEIS DE CONFLITO COM CENÁRIOS DO USUÁRIO ═══
Quando o William perguntar "e se eu vender X" ou "e se eu fizer Y" e a memória/metas.md tiver regra inviolável contra essa ação, NÃO MODELE O CENÁRIO ainda. Em vez:
1. CITE A REGRA EXPLICITAMENTE ("memoria/metas.md regra #4: nunca recomendar vender Blumenau nos próximos 3 anos — colateral de fogo estratégico")
2. PERGUNTE se ele quer revisar a premissa
3. SÓ DEPOIS de confirmação, modele o cenário hipotético

Regras-âncora pra cruzar antes de qualquer recomendação:
- Caixa < R$ 100k → não esvazie
- Vender Blumenau antes de 2029 → não recomende
- Comprometer liquidez casamento dez/2027 → não recomende
- Largar comercial Prevensul antes de SDR rodar → não recomende
- Qualquer ação que viole memoria/metas.md "Restrições defensivas" → cite a regra primeiro

PT-BR, direto, executivo. **Negrito** em números. Trate William pelo nome. Máximo 4 parágrafos — a menos que ele peça profundidade.`;

const LENS_LABEL: Record<string, string> = {
  naval: "NAVAL — leverage + jogos de longo prazo",
  aaron_ross: "AARON ROSS — receita previsível",
  housel: "HOUSEL — psicologia do dinheiro",
  tevah: "TEVAH / VENDEDOR DIAMANTE — vendas consultivas",
  operador: "OPERADOR WILLIAM — realidade do terreno",
  outros: "OUTROS",
};

// Embedding de uma query (usado pelo RAG) — API nativa do Gemini
// apiKey aqui é GEMINI_API_KEY (Lovable gateway não suporta embeddings)
// Modelo: gemini-embedding-001 (text-embedding-004 foi descontinuado em 2026)
async function embedQuery(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text: text.slice(0, 8000) }] },
        // 768 dims — bate com naval_principle_vectors indexado pelo naval-embed
        outputDimensionality: 768,
      }),
    });
    if (!res.ok) {
      console.error("embed query status:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json() as { embedding?: { values: number[] } };
    return data.embedding?.values ?? null;
  } catch (e) {
    console.error("embedQuery error:", e);
    return null;
  }
}

interface MatchedPrinciple {
  source_id: string;
  source_title: string;
  source_author: string | null;
  source_summary: string | null;
  lens: string;
  principle_idx: number;
  text: string;
  similarity: number;
}

/**
 * Constrói o system prompt do Naval:
 *   - MEMÓRIA PERMANENTE (.md sempre carrega, é pequena e é contexto fixo)
 *   - BRAIN STACK via RAG: se userQuery fornecida, busca top-K princípios
 *     mais próximos semanticamente. Caso contrário, cai pro fallback:
 *     carrega TODAS as sources ativas (modo legado pra primeira mensagem / snapshots).
 *
 *   Modo "isso se aplica ao meu caso?": detectado no wisely-ai, aumenta K e
 *   reduz threshold pra pegar mais contexto.
 */
// Retorna duas partes pra permitir prompt caching:
//   - fixed: BASE_SYSTEM_PROMPT + naval_memory → estável entre chamadas, cacheável
//   - variable: brain stack RAG semântico (varia por query) → não cachear
async function buildSystemPrompt(opts?: { userQuery?: string; apiKey?: string; topK?: number; threshold?: number }): Promise<{ fixed: string; variable: string }> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return { fixed: BASE_SYSTEM_PROMPT, variable: "" };

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Memória permanente (.md) — sempre carrega, é pequena
    const memoryRes = await sb.from("naval_memory")
      .select("slug,title,content,priority")
      .order("priority", { ascending: true });
    const memory = memoryRes.data ?? [];

    let fixed = BASE_SYSTEM_PROMPT;

    if (memory.length > 0) {
      const memoryBlock = memory
        .map((m: any) => `\n### ${m.title} (${m.slug}.md)\n${m.content}`)
        .join("\n");
      fixed += `\n\n═══════════════════════════════════════\nMEMÓRIA PERMANENTE (fonte única de verdade)\n═══════════════════════════════════════\n${memoryBlock}\n═══════════════════════════════════════\nFIM DA MEMÓRIA PERMANENTE\n═══════════════════════════════════════`;
    }

    // 2. Brain stack — modo RAG (se temos query + apiKey) OU fallback total
    let brainMarkdown = "";
    let ragMode = false;

    if (opts?.userQuery && opts?.apiKey && opts.userQuery.trim().length >= 10) {
      const embedding = await embedQuery(opts.userQuery, opts.apiKey);
      if (embedding) {
        const topK = opts.topK ?? 10;
        const threshold = opts.threshold ?? 0.3; // relaxado — Gemini embeddings vêm com similarity menor
        const { data: matched, error } = await sb.rpc("match_principles", {
          query_embedding: embedding as unknown as string, // pgvector aceita array via JSON
          match_threshold: threshold,
          match_count: topK,
        });
        if (!error && Array.isArray(matched) && matched.length > 0) {
          ragMode = true;
          // Agrupa por source pra contexto mais limpo
          const bySource = (matched as MatchedPrinciple[]).reduce((acc, m) => {
            const key = m.source_id;
            if (!acc[key]) {
              acc[key] = {
                title: m.source_title,
                author: m.source_author,
                summary: m.source_summary,
                lens: m.lens,
                principles: [] as Array<{ text: string; similarity: number }>,
              };
            }
            acc[key].principles.push({ text: m.text, similarity: m.similarity });
            return acc;
          }, {} as Record<string, { title: string; author: string | null; summary: string | null; lens: string; principles: Array<{ text: string; similarity: number }> }>);

          const blocks = Object.values(bySource)
            .sort((a, b) => Math.max(...b.principles.map(p => p.similarity)) - Math.max(...a.principles.map(p => p.similarity)))
            .map((s) => {
              const lensTag = LENS_LABEL[s.lens] ?? s.lens.toUpperCase();
              const author = s.author ? ` — ${s.author}` : "";
              const bullets = s.principles
                .map((p) => `  - ${p.text} [${(p.similarity * 100).toFixed(0)}%]`)
                .join("\n");
              return `**[${lensTag}] ${s.title}${author}**\n${bullets}`;
            })
            .join("\n\n");
          brainMarkdown = blocks;
        } else if (error) {
          console.error("match_principles error:", error);
        }
      }
    }

    // Fallback: carrega brain stack inteira (modo antigo)
    if (!ragMode) {
      const sourcesRes = await sb.from("naval_sources")
        .select("slug,title,author,lens,summary,principles,priority")
        .eq("active", true)
        .order("priority", { ascending: true });
      const sources = sourcesRes.data ?? [];
      if (sources.length > 0) {
        const byLens = sources.reduce((acc: Record<string, any[]>, s: any) => {
          (acc[s.lens] ??= []).push(s);
          return acc;
        }, {});
        const lensOrder = ["naval", "aaron_ross", "housel", "tevah", "operador", "outros"];
        brainMarkdown = lensOrder
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
      }
    }

    let variable = "";
    if (brainMarkdown) {
      const header = ragMode
        ? `BRAIN STACK (lentes de análise — TOP ${brainMarkdown.split("\n  -").length - 1} princípios mais relevantes pra esta pergunta, ranqueados por similaridade semântica)`
        : `BRAIN STACK (lentes de análise — biblioteca completa)`;
      variable = `\n\n═══════════════════════════════════════\n${header}\n═══════════════════════════════════════\nUse os princípios abaixo como ângulos mentais. Eles estão em linguagem destilada — NUNCA reproduza texto longo de livros. Cruze lentes quando útil.\n\n${brainMarkdown}\n═══════════════════════════════════════\nFIM DA BRAIN STACK\n═══════════════════════════════════════`;
    }

    return { fixed, variable };
  } catch (e) {
    console.error("Naval prompt build failed:", e);
    return { fixed: BASE_SYSTEM_PROMPT, variable: "" };
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

// ─── Naval Tools — funções que Claude Haiku pode chamar pra buscar dado real ──
// MVP: só get_breakdown(month, bucket?) — retorna lançamentos do DRE agrupados
// por categoria. Replica a lógica de useDRE.ts (regime caixa pra cartão, Modelo A
// pra kitnets) pra Naval ter os mesmos números que aparecem em /dre.

const NAVAL_TOOLS: ClaudeTool[] = [
  {
    name: "get_breakdown",
    description:
      "Retorna o detalhe dos lançamentos do mês, agrupados por categoria, dentro de um bloco do DRE. " +
      "Use sempre que precisar citar valores específicos, listar transações de uma categoria, ou validar somas. " +
      "Regime caixa: cartão = fatura paga no mês (paid_at). Kitnets = entries reconciled (Modelo A). " +
      "Retorna JSON com totais por categoria + top 5 itens de cada categoria (data/valor/descrição). " +
      "IMPORTANTE: se a pergunta do William mencionar 'cartão' ou 'fatura', passe only_card=true pra filtrar SÓ tx do cartão (categorias com prefixo cartao__).",
    input_schema: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: "Mês no formato YYYY-MM (ex: 2026-04). Sempre obrigatório.",
        },
        bucket: {
          type: "string",
          enum: ["receitas", "custeio", "obras", "casamento", "eventos", "outros_aportes"],
          description:
            "Bloco do DRE pra detalhar. Omitir = retorna todos os blocos (resposta maior).",
        },
        only_card: {
          type: "boolean",
          description:
            "Se true, retorna SOMENTE categorias com prefixo cartao__ (transações do cartão de crédito). " +
            "Use quando a pergunta envolver gastos de cartão/fatura especificamente.",
        },
      },
      required: ["month"],
    },
  },
  {
    name: "compare_months",
    description:
      "Compara 2 meses lado a lado: totais por bloco DRE (receitas, custeio, obras, " +
      "casamento, eventos, outros_aportes) + diff por categoria + outliers (categorias " +
      "que apareceram só em um dos meses) + top variações. " +
      "USE pra perguntas tipo: 'por que abril foi diferente de março?', 'onde explodi gasto?', " +
      "'comparar Q1', 'maior diferença entre os 2 meses'. " +
      "Retorna ranking dos itens que MAIS variaram pra William saber rápido onde olhar.",
    input_schema: {
      type: "object",
      properties: {
        month_a: {
          type: "string",
          description: "Mês A (referência). Formato YYYY-MM.",
        },
        month_b: {
          type: "string",
          description: "Mês B (comparação). Formato YYYY-MM.",
        },
      },
      required: ["month_a", "month_b"],
    },
  },
  {
    name: "get_history",
    description:
      "Série temporal de uma métrica financeira nos últimos N meses. " +
      "Retorna valor por mês + estatísticas (média, mediana, min, max, tendência). " +
      "USE pra perguntas tipo: 'como está a sobra nos últimos meses?', 'tendência de custeio', " +
      "'aluguel está crescendo?', 'receita Q1 vs Q2', 'comparar últimos 3 meses'. " +
      "Métricas suportadas (uma por chamada). Pra comparar 2 meses específicos, prefira " +
      "compare_months (quando existir) ou get_breakdown 2x.",
    input_schema: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: [
            "receita_total",
            "custeio_total",
            "sobra_liquida",
            "aluguel_kitnets",
            "comissao_prevensul_recebida",
            "obras_aporte",
            "outros_aportes",
          ],
          description:
            "Qual métrica buscar. " +
            "receita_total = renda ativa + passiva + comissões extras + avulsas. " +
            "custeio_total = custeio puro (expenses + cartão, sem obras/casamento/eventos/outros_aportes). " +
            "sobra_liquida = receita - todas as saídas. " +
            "aluguel_kitnets = renda passiva (kitnet_entries reconciled, Modelo A). " +
            "comissao_prevensul_recebida = revenues source=comissao_prevensul (regime caixa real, lump sums). " +
            "obras_aporte = aporte em obras (cota William). " +
            "outros_aportes = consórcios + dev profissional + ferramentas.",
        },
        n_months: {
          type: "number",
          description: "Quantos meses pra trás. Default 6. Min 3, max 24.",
        },
      },
      required: ["metric"],
    },
  },
  {
    name: "get_construction_status",
    description:
      "Status real de cada obra (constructions) — orçado vs gasto, % executado, próxima etapa, " +
      "renda mensal esperada (cota William). USE pra perguntas tipo: 'Como vai a obra X?', " +
      "'Quanto falta gastar em RWT05?', 'Estou no orçamento?', 'Quanto vai entrar de aluguel quando " +
      "todas obras estiverem prontas?'. Cruza constructions + construction_expenses (com cota William) " +
      "+ construction_stages. Filtro opcional pelo nome da obra.",
    input_schema: {
      type: "object",
      properties: {
        construction_filter: {
          type: "string",
          description:
            "Filtra por nome da obra (busca parcial, case-insensitive). " +
            "Ex: 'RWT05', 'JW7', 'Sonho'. Omitir = retorna todas as obras em andamento.",
        },
        include_completed: {
          type: "boolean",
          description: "Se true, inclui obras já entregues (status=concluida). Default false.",
        },
      },
    },
  },
  {
    name: "get_prevensul_cycle",
    description:
      "Retorna a comissão Prevensul ACUMULADA num ciclo específico (mês X) que SERÁ PAGA até dia 20 do mês X+1. " +
      "REGRA DE NEGÓCIO PREVENSUL: ciclo de comissão = dia 1 a 31 do mês, recebimento até dia 20 do mês seguinte. " +
      "USE SEMPRE que a pergunta envolver: 'previsão de comissão maio', 'quanto vou receber', " +
      "'comissão do mês', 'comissão a pagar'. A resposta direta é: olhar o ciclo correspondente. " +
      "Pergunta 'previsão maio' → cycle_month='2026-04' (ciclo abril paga em maio). " +
      "Pergunta 'previsão junho' → cycle_month='2026-05'. " +
      "Lê prevensul_billing.commission_value por reference_month. Esse é o número CORRETO " +
      "pra previsão de comissão — não use get_prevensul_history (recebido) nem forecast teórico.",
    input_schema: {
      type: "object",
      properties: {
        cycle_month: {
          type: "string",
          description:
            "Mês do CICLO (não do recebimento) no formato YYYY-MM. Default = mês atual. " +
            "Pra pergunta 'comissão maio': cycle_month='2026-04' (ciclo abril → paga maio).",
        },
      },
    },
  },
  {
    name: "get_prevensul_history",
    description:
      "Retorna o HISTÓRICO REAL de comissão Prevensul recebida nos últimos N meses, " +
      "lendo de revenues com source=comissao_prevensul + business_id=Prevensul. " +
      "USE SEMPRE pra responder 'quanto vou receber em [mês]', 'tendência de comissão', " +
      "'média mensal'. O pagamento Prevensul vem em LUMP SUMS irregulares (CREDIFOZ DEPOSITO BLOQ), " +
      "não em parcelas mensais regulares — alguns meses zeram, outros vêm 2x. NÃO use forecast " +
      "teórico de get_prevensul_pipeline isoladamente. SEMPRE cruzar com este histórico real.",
    input_schema: {
      type: "object",
      properties: {
        n_months: {
          type: "number",
          description: "Quantos meses pra trás buscar. Default 6. Min 3, max 24.",
        },
      },
    },
  },
  {
    name: "get_prevensul_pipeline",
    description:
      "Retorna o pipeline de comissões Prevensul direto da tabela prevensul_billing. " +
      "Modos: " +
      "(1) AGREGADO — saldo a receber + comissão futura por cliente, concentração de risco. " +
      "(2) PROJEÇÃO MENSAL — passe forecast_month=YYYY-MM pra estimar quanto entra de comissão naquele mês. " +
      "Cada linha em prevensul_billing representa 1 MÊS do contrato (installment_current de N), " +
      "então a projeção usa contract_total/installment_total como parcela mensal esperada. " +
      "USE SEMPRE pra perguntas de pipeline/comissões futuras/saldo a receber. " +
      "Os números da memória (negocios.md, metas.md) estão DESATUALIZADOS.",
    input_schema: {
      type: "object",
      properties: {
        client_filter: {
          type: "string",
          description:
            "Filtra por nome do cliente (busca parcial, case-insensitive). " +
            "Ex: 'GRAND' retorna só GRAND FOOD. Omitir = todos.",
        },
        include_paid: {
          type: "boolean",
          description:
            "Se true, inclui linhas com balance_remaining=0 (já pagas). Default false (só pendentes).",
        },
        forecast_month: {
          type: "string",
          description:
            "Mês YYYY-MM pra projeção. Quando passado, calcula estimativa de comissão " +
            "que deve cair NESSE mês baseado em contract_total/installment_total de cada contrato " +
            "ainda dentro do prazo. Ex: forecast_month='2026-05' estima maio.",
        },
      },
    },
  },
];

// Classifica expense em bucket DRE (idêntico ao classifyExpense do useDRE.ts)
function classifyExpense(e: any): "obras" | "casamento" | "eventos" | "outros_aportes" | "custeio" {
  const c = (e.category || "").toLowerCase();
  const d = (e.description || "").toLowerCase();
  const v = e.vector || "";
  if (c === "obras" || c === "aporte_obra" || c === "terrenos") return "obras";
  if (v === "WT7_Holding" || v === "aporte_obra") return "obras";
  if (c === "casamento" || c === "casamento_2027") return "casamento";
  if (d.includes("villa sonali") || d.includes("casamento")) return "casamento";
  if (c.startsWith("evento_")) return "eventos";
  if (e.counts_as_investment === true) return "outros_aportes";
  if (c === "consorcio" || c === "consorcios_aporte") return "outros_aportes";
  if (c === "kitnets_manutencao" || c === "manutencao_kitnets") return "outros_aportes";
  if (c === "dev_profissional_agora" || c === "dev_pessoal_futuro" || c === "produtividade_ferramentas") return "outros_aportes";
  return "custeio";
}

function classifyCardTx(t: any): "obras" | "casamento" | "eventos" | "outros_aportes" | "custeio" | "ignorar" {
  const slug = t.custom_categories?.slug || "";
  if (slug === "ignorar") return "ignorar";
  if (slug === "aporte_obra") return "obras";
  if (slug === "casamento_2027") return "casamento";
  if (slug.startsWith("evento_")) return "eventos";
  if (slug === "manutencao_kitnets") return "outros_aportes";
  if (slug === "consorcios_aporte" || slug === "dev_profissional_agora" || slug === "dev_pessoal_futuro" || slug === "produtividade_ferramentas") return "outros_aportes";
  if (t.counts_as_investment) return "outros_aportes";
  return "custeio";
}

async function handleGetBreakdown(input: Record<string, unknown>, supabaseUrl: string, serviceKey: string): Promise<string> {
  const month = String(input.month ?? "").trim();
  const bucketFilter = input.bucket ? String(input.bucket) : null;
  const onlyCard = input.only_card === true;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return JSON.stringify({ error: "month deve ser YYYY-MM" });
  }

  const sb = createClient(supabaseUrl, serviceKey);
  const monthStart = `${month}-01`;
  const [yy, mm] = month.split("-").map(Number);
  const lastDay = new Date(yy, mm, 0).getDate();
  const monthEnd = `${yy}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const nextMonth = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;

  // ── RECEITAS (se filtro for receitas ou null) ──
  type AggItem = { date: string | null; amount: number; label: string };
  type AggCat = { total: number; count: number; items: AggItem[] };
  const buckets: Record<string, Record<string, AggCat>> = {
    receitas: {},
    custeio: {},
    obras: {},
    casamento: {},
    eventos: {},
    outros_aportes: {},
  };

  const addItem = (bucket: string, cat: string, item: AggItem) => {
    const b = buckets[bucket];
    if (!b[cat]) b[cat] = { total: 0, count: 0, items: [] };
    b[cat].total += item.amount;
    b[cat].count += 1;
    b[cat].items.push(item);
  };

  // RECEITAS
  if (!bucketFilter || bucketFilter === "receitas") {
    const { data: revs } = await sb.from("revenues")
      .select("amount, source, description, received_at, counts_as_income, business_id")
      .eq("reference_month", month);
    const { data: kit } = await sb.from("kitnet_entries")
      .select("total_liquid, tenant_name, reconciled, reconciled_at, period_end")
      .eq("reference_month", month);
    const { data: paidInst } = await (sb as any).from("other_commission_installments")
      .select("amount, paid_amount, paid_at, installment_number, other_commissions(description, source)")
      .not("paid_at", "is", null).gte("paid_at", monthStart).lte("paid_at", monthEnd);

    for (const r of revs ?? []) {
      if ((r as any).counts_as_income === false) continue;
      if ((r as any).source === "aluguel_kitnets") continue;
      const src = ((r as any).source || "").toLowerCase();
      const desc = ((r as any).description || "").toLowerCase();
      const isPrev = src.includes("prevensul") || src.includes("comiss") || src.includes("salar") || src.includes("clt") ||
                     desc.includes("prevensul") || desc.includes("salár") || desc.includes("comiss");
      addItem("receitas", isPrev ? "renda_ativa_prevensul" : "avulsas", {
        date: (r as any).received_at,
        amount: Number((r as any).amount ?? 0),
        label: (r as any).description || (r as any).source || "?",
      });
    }
    for (const k of kit ?? []) {
      if ((k as any).reconciled !== true) continue;
      addItem("receitas", "renda_passiva_kitnets", {
        date: (k as any).reconciled_at ?? (k as any).period_end ?? null,
        amount: Number((k as any).total_liquid ?? 0),
        label: `Aluguel — ${(k as any).tenant_name || "(vago)"}`,
      });
    }
    for (const p of paidInst ?? []) {
      addItem("receitas", "comissoes_extras", {
        date: (p as any).paid_at,
        amount: Number((p as any).paid_amount ?? (p as any).amount ?? 0),
        label: `${(p as any).other_commissions?.description ?? "Comissão"} · parc ${(p as any).installment_number}`,
      });
    }
  }

  // DESPESAS (expenses + cartão)
  const needExpenses = !bucketFilter || ["custeio","obras","casamento","eventos","outros_aportes"].includes(bucketFilter);
  if (needExpenses) {
    const { data: exps } = await sb.from("expenses")
      .select("amount, category, description, vector, counts_as_investment, paid_at, is_card_payment, nature")
      .eq("reference_month", month);
    for (const e of exps ?? []) {
      if ((e as any).is_card_payment) continue;
      if (((e as any).nature ?? "expense") === "transfer") continue;
      const bucket = classifyExpense(e);
      addItem(bucket, (e as any).category || "outros", {
        date: (e as any).paid_at,
        amount: Number((e as any).amount ?? 0),
        label: (e as any).description || "?",
      });
    }

    const { data: paidInvs } = await sb.from("card_invoices")
      .select("id, paid_amount, total_amount")
      .gte("paid_at", monthStart).lt("paid_at", nextMonth);
    const ratio: Record<string, number> = {};
    for (const inv of paidInvs ?? []) {
      const t = Number((inv as any).total_amount ?? 0);
      const p = Number((inv as any).paid_amount ?? t);
      ratio[(inv as any).id] = t > 0 ? Math.min(1, p / t) : 1;
    }
    const invIds = (paidInvs ?? []).map((i: any) => i.id);
    if (invIds.length > 0) {
      const { data: txs } = await sb.from("card_transactions")
        .select("amount, description, transaction_date, vector, counts_as_investment, invoice_id, custom_categories(slug, name)")
        .in("invoice_id", invIds);
      for (const t of txs ?? []) {
        const bucket = classifyCardTx(t);
        if (bucket === "ignorar") continue;
        const amt = Number((t as any).amount ?? 0) * (ratio[(t as any).invoice_id] ?? 1);
        const cat = (t as any).custom_categories?.slug || "cartao_outros";
        addItem(bucket, `cartao__${cat}`, {
          date: (t as any).transaction_date,
          amount: amt,
          label: (t as any).description || "?",
        });
      }
    }
  }

  // Monta retorno compacto
  // Se only_card=true, filtra só categorias com prefixo cartao__ (transações do cartão).
  const formatBucket = (b: Record<string, AggCat>) => {
    let entries = Object.entries(b);
    if (onlyCard) entries = entries.filter(([cat]) => cat.startsWith("cartao__"));
    const cats = entries
      .map(([cat, v]) => ({
        category: cat,
        total: Math.round(v.total * 100) / 100,
        count: v.count,
        top_items: v.items
          .sort((a, b2) => b2.amount - a.amount)
          .slice(0, 5)
          .map((i) => ({ date: i.date, amount: Math.round(i.amount * 100) / 100, label: i.label.slice(0, 70) })),
      }))
      .sort((a, b2) => b2.total - a.total);
    const total = cats.reduce((s, c) => s + c.total, 0);
    return { total: Math.round(total * 100) / 100, by_category: cats };
  };

  const out: Record<string, unknown> = { month };
  if (bucketFilter) {
    out.bucket = bucketFilter;
    out.data = formatBucket(buckets[bucketFilter]);
  } else {
    out.all_buckets = {
      receitas: formatBucket(buckets.receitas),
      custeio: formatBucket(buckets.custeio),
      obras: formatBucket(buckets.obras),
      casamento: formatBucket(buckets.casamento),
      eventos: formatBucket(buckets.eventos),
      outros_aportes: formatBucket(buckets.outros_aportes),
    };
  }
  return JSON.stringify(out);
}

// ─── Handler: get_prevensul_pipeline ──────────────────────────────────────
// Lê prevensul_billing e retorna saldo a receber + comissão futura agregados
// por cliente. Resolve o problema de Naval citar números desatualizados das
// memórias .md — a fonte da verdade é a tabela viva.
// Helper: converte YYYY-MM em índice numérico pra comparar meses
function monthToIdx(m: string | null | undefined): number | null {
  if (!m || !/^\d{4}-\d{2}$/.test(m)) return null;
  const [y, mo] = m.split("-").map(Number);
  return y * 12 + mo;
}

function idxToMonth(idx: number): string {
  const y = Math.floor((idx - 1) / 12);
  const mo = ((idx - 1) % 12) + 1;
  return `${y}-${String(mo).padStart(2, "0")}`;
}

// ─── Handler: compare_months — comparativo detalhado por categoria ───
// Retorna mapa { bucket::category: total } pra um mês.
async function getBucketCategoryMap(sb: any, month: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const add = (key: string, val: number) => {
    if (val === 0) return;
    map.set(key, (map.get(key) ?? 0) + val);
  };

  const [yy, mm] = month.split("-").map(Number);
  const mStart = `${month}-01`;
  const lastDay = new Date(yy, mm, 0).getDate();
  const mEnd = `${yy}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const nextMonth = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;

  // Receitas
  const { data: revs } = await sb.from("revenues").select("amount, source, counts_as_income, business_id, description").eq("reference_month", month);
  const businessesRes = await sb.from("businesses").select("id, code");
  const prevBiz = (businessesRes.data ?? []).find((b: any) => b.code === "PREVENSUL");
  for (const r of revs ?? []) {
    if (r.counts_as_income === false) continue;
    if (r.source === "aluguel_kitnets") continue;
    const src = (r.source || "").toLowerCase();
    const desc = (r.description || "").toLowerCase();
    const isPrev = r.business_id === prevBiz?.id || src.includes("prevensul") || src.includes("comiss") || src.includes("salar") || src.includes("clt") || desc.includes("prevensul") || desc.includes("salár");
    add(`receitas::${isPrev ? "renda_ativa_prevensul" : "avulsas"}`, Number(r.amount ?? 0));
  }

  const { data: kit } = await sb.from("kitnet_entries").select("total_liquid, reconciled").eq("reference_month", month);
  const aluguelTotal = (kit ?? []).filter((k: any) => k.reconciled).reduce((s: number, k: any) => s + Number(k.total_liquid ?? 0), 0);
  if (aluguelTotal > 0) add("receitas::aluguel_kitnets", aluguelTotal);

  const { data: paidInst } = await sb.from("other_commission_installments")
    .select("amount, paid_amount, paid_at, other_commissions(description)")
    .not("paid_at", "is", null).gte("paid_at", mStart).lte("paid_at", mEnd);
  for (const p of paidInst ?? []) {
    const desc = (p as any).other_commissions?.description ?? "comissão";
    add(`receitas::${desc.slice(0, 35)}`, Number(p.paid_amount ?? p.amount ?? 0));
  }

  // Despesas (expenses)
  const { data: exps } = await sb.from("expenses")
    .select("amount, category, vector, counts_as_investment, description, is_card_payment, nature")
    .eq("reference_month", month);
  for (const e of exps ?? []) {
    if (e.is_card_payment) continue;
    if ((e.nature ?? "expense") === "transfer") continue;
    const bloc = classifyExpense(e);
    const cat = (e.category || "outros").toLowerCase();
    add(`${bloc}::${cat}`, Number(e.amount ?? 0));
  }

  // Cartão regime caixa
  const { data: invs } = await sb.from("card_invoices").select("id, paid_amount, total_amount").gte("paid_at", mStart).lt("paid_at", nextMonth);
  const ratio: Record<string, number> = {};
  for (const inv of invs ?? []) {
    const t = Number(inv.total_amount ?? 0);
    const p = Number(inv.paid_amount ?? t);
    ratio[inv.id] = t > 0 ? Math.min(1, p / t) : 1;
  }
  const invIds = (invs ?? []).map((i: any) => i.id);
  if (invIds.length > 0) {
    const { data: txs } = await sb.from("card_transactions")
      .select("amount, vector, counts_as_investment, invoice_id, custom_categories(slug)")
      .in("invoice_id", invIds);
    for (const t of txs ?? []) {
      const bloc = classifyCardTx(t);
      if (bloc === "ignorar") continue;
      const slug = t.custom_categories?.slug || "outros";
      const v = Number(t.amount ?? 0) * (ratio[t.invoice_id] ?? 1);
      add(`${bloc}::cartao__${slug}`, v);
    }
  }
  return map;
}

async function handleCompareMonths(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const monthA = String(input.month_a ?? "");
  const monthB = String(input.month_b ?? "");
  if (!/^\d{4}-\d{2}$/.test(monthA) || !/^\d{4}-\d{2}$/.test(monthB)) {
    return JSON.stringify({ error: "month_a e month_b devem ser YYYY-MM" });
  }

  const [mapA, mapB] = await Promise.all([
    getBucketCategoryMap(sb, monthA),
    getBucketCategoryMap(sb, monthB),
  ]);

  // Totais por bucket
  const bucketsA: Record<string, number> = {};
  const bucketsB: Record<string, number> = {};
  for (const [key, val] of mapA) {
    const bucket = key.split("::")[0];
    bucketsA[bucket] = (bucketsA[bucket] ?? 0) + val;
  }
  for (const [key, val] of mapB) {
    const bucket = key.split("::")[0];
    bucketsB[bucket] = (bucketsB[bucket] ?? 0) + val;
  }

  const allBuckets = Array.from(new Set([...Object.keys(bucketsA), ...Object.keys(bucketsB)]));
  const summary: Record<string, { a: number; b: number; diff: number; pct_change: number | null }> = {};
  for (const b of allBuckets) {
    const a = Math.round((bucketsA[b] ?? 0) * 100) / 100;
    const bv = Math.round((bucketsB[b] ?? 0) * 100) / 100;
    summary[b] = {
      a,
      b: bv,
      diff: Math.round((bv - a) * 100) / 100,
      pct_change: a !== 0 ? Math.round(((bv - a) / Math.abs(a)) * 1000) / 10 : null,
    };
  }

  // Diff por categoria
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  type CatDiff = { bucket: string; category: string; a: number; b: number; diff: number; pct_change: number | null };
  const catDiffs: CatDiff[] = [];
  for (const key of allKeys) {
    const [bucket, ...rest] = key.split("::");
    const cat = rest.join("::");
    const a = Math.round((mapA.get(key) ?? 0) * 100) / 100;
    const b = Math.round((mapB.get(key) ?? 0) * 100) / 100;
    const diff = Math.round((b - a) * 100) / 100;
    if (Math.abs(diff) < 1) continue; // ignora variações <R$ 1
    catDiffs.push({
      bucket,
      category: cat,
      a,
      b,
      diff,
      pct_change: a !== 0 ? Math.round(((b - a) / Math.abs(a)) * 1000) / 10 : null,
    });
  }

  // Top 10 maiores aumentos e quedas (em valor absoluto, ignorando bucket receitas)
  const despesaDiffs = catDiffs.filter((d) => d.bucket !== "receitas");
  const topAumentos = [...despesaDiffs].filter((d) => d.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 10);
  const topQuedas = [...despesaDiffs].filter((d) => d.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 10);

  // Outliers: categorias que apareceram em só um dos meses
  const onlyInA = catDiffs.filter((d) => d.b === 0 && d.a > 100).slice(0, 5);
  const onlyInB = catDiffs.filter((d) => d.a === 0 && d.b > 100).slice(0, 5);

  return JSON.stringify({
    month_a: monthA,
    month_b: monthB,
    summary_by_bucket: summary,
    top_increases: topAumentos,
    top_decreases: topQuedas,
    only_in_a: onlyInA,
    only_in_b: onlyInB,
    note: "diff = month_b - month_a. Positivo = aumento. Categorias com variação <R$1 omitidas.",
  });
}

// ─── Handler: histórico de métrica financeira ────────────────────────
// Cada métrica tem um cálculo dedicado replicando lógica de useDRE.

async function calcReceitaMes(sb: any, month: string): Promise<number> {
  const [yy, mm] = month.split("-").map(Number);
  const mStart = `${month}-01`;
  const lastDay = new Date(yy, mm, 0).getDate();
  const mEnd = `${yy}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [revsR, kitR, paidInstR] = await Promise.all([
    sb.from("revenues").select("amount, source, counts_as_income").eq("reference_month", month),
    sb.from("kitnet_entries").select("total_liquid, reconciled").eq("reference_month", month),
    sb.from("other_commission_installments").select("amount, paid_amount, paid_at")
      .not("paid_at", "is", null).gte("paid_at", mStart).lte("paid_at", mEnd),
  ]);

  const revs = (revsR.data ?? []).filter((r: any) => r.counts_as_income !== false && r.source !== "aluguel_kitnets");
  const renda = revs.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
  const kit = (kitR.data ?? []).filter((k: any) => k.reconciled).reduce((s: number, k: any) => s + Number(k.total_liquid ?? 0), 0);
  const inst = (paidInstR.data ?? []).reduce((s: number, p: any) => s + Number(p.paid_amount ?? p.amount ?? 0), 0);
  return renda + kit + inst;
}

async function calcAluguelKitnetsMes(sb: any, month: string): Promise<number> {
  const { data } = await sb.from("kitnet_entries").select("total_liquid, reconciled").eq("reference_month", month);
  return (data ?? []).filter((k: any) => k.reconciled).reduce((s: number, k: any) => s + Number(k.total_liquid ?? 0), 0);
}

async function calcComissaoPrevensulMes(sb: any, month: string): Promise<number> {
  const { data } = await sb.from("revenues").select("amount").eq("source", "comissao_prevensul").eq("reference_month", month);
  return (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
}

// Helper compartilhado: classifica e soma despesas (expenses + card) por bucket DRE
async function calcDespesasMesDRE(sb: any, month: string): Promise<{
  custeio: number; obras: number; casamento: number; eventos: number; outros: number;
}> {
  const [yy, mm] = month.split("-").map(Number);
  const mStart = `${month}-01`;
  const nextMonth = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;

  const [expsR, invsR] = await Promise.all([
    sb.from("expenses").select("amount, category, vector, counts_as_investment, description, is_card_payment, nature").eq("reference_month", month),
    sb.from("card_invoices").select("id, paid_amount, total_amount").gte("paid_at", mStart).lt("paid_at", nextMonth),
  ]);

  const buckets = { custeio: 0, obras: 0, casamento: 0, eventos: 0, outros: 0 };
  for (const e of expsR.data ?? []) {
    if (e.is_card_payment) continue;
    if ((e.nature ?? "expense") === "transfer") continue;
    const bloc = classifyExpense(e);
    if (bloc === "obras") buckets.obras += Number(e.amount ?? 0);
    else if (bloc === "casamento") buckets.casamento += Number(e.amount ?? 0);
    else if (bloc === "eventos") buckets.eventos += Number(e.amount ?? 0);
    else if (bloc === "outros_aportes") buckets.outros += Number(e.amount ?? 0);
    else buckets.custeio += Number(e.amount ?? 0);
  }

  const invs = invsR.data ?? [];
  const invIds = invs.map((i: any) => i.id);
  const ratio: Record<string, number> = {};
  for (const inv of invs) {
    const t = Number(inv.total_amount ?? 0);
    const p = Number(inv.paid_amount ?? t);
    ratio[inv.id] = t > 0 ? Math.min(1, p / t) : 1;
  }
  if (invIds.length > 0) {
    const { data: txs } = await sb.from("card_transactions")
      .select("amount, vector, counts_as_investment, invoice_id, custom_categories(slug)")
      .in("invoice_id", invIds);
    for (const t of txs ?? []) {
      const bloc = classifyCardTx(t);
      if (bloc === "ignorar") continue;
      const v = Number(t.amount ?? 0) * (ratio[t.invoice_id] ?? 1);
      if (bloc === "obras") buckets.obras += v;
      else if (bloc === "casamento") buckets.casamento += v;
      else if (bloc === "eventos") buckets.eventos += v;
      else if (bloc === "outros_aportes") buckets.outros += v;
      else buckets.custeio += v;
    }
  }
  return buckets;
}

async function handleGetHistory(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const metric = String(input.metric ?? "");
  const nMonths = Math.max(3, Math.min(24, Number(input.n_months ?? 6)));

  const validMetrics = ["receita_total", "custeio_total", "sobra_liquida", "aluguel_kitnets", "comissao_prevensul_recebida", "obras_aporte", "outros_aportes"];
  if (!validMetrics.includes(metric)) {
    return JSON.stringify({ error: `metric inválido. Use um de: ${validMetrics.join(", ")}` });
  }

  // Gera N meses até o atual
  const now = new Date();
  const curIdx = (now.getFullYear() * 12) + (now.getMonth() + 1);
  const months: string[] = [];
  for (let i = nMonths - 1; i >= 0; i--) {
    months.push(idxToMonth(curIdx - i));
  }

  // Pra cada mês, calcula a métrica solicitada (paralelo limitado pra evitar timeout)
  const results: Array<{ month: string; value: number }> = [];
  for (const month of months) {
    let value = 0;
    if (metric === "receita_total") value = await calcReceitaMes(sb, month);
    else if (metric === "aluguel_kitnets") value = await calcAluguelKitnetsMes(sb, month);
    else if (metric === "comissao_prevensul_recebida") value = await calcComissaoPrevensulMes(sb, month);
    else if (metric === "custeio_total" || metric === "obras_aporte" || metric === "outros_aportes" || metric === "sobra_liquida") {
      const buckets = await calcDespesasMesDRE(sb, month);
      if (metric === "custeio_total") value = buckets.custeio;
      else if (metric === "obras_aporte") value = buckets.obras;
      else if (metric === "outros_aportes") value = buckets.outros;
      else if (metric === "sobra_liquida") {
        const receita = await calcReceitaMes(sb, month);
        value = receita - buckets.custeio - buckets.obras - buckets.casamento - buckets.eventos - buckets.outros;
      }
    }
    results.push({ month, value: Math.round(value * 100) / 100 });
  }

  // Estatísticas
  const values = results.map((r) => r.value);
  const sum = values.reduce((s, v) => s + v, 0);
  const avg = values.length > 0 ? sum / values.length : 0;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length > 0
    ? (sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)])
    : 0;
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;

  // Tendência: compara primeira metade × segunda metade
  const half = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, half);
  const secondHalf = values.slice(values.length - half);
  const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length : 0;
  const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length : 0;
  const trendPct = avgFirst !== 0 ? ((avgSecond - avgFirst) / Math.abs(avgFirst)) * 100 : 0;
  let trend: "crescente" | "decrescente" | "estavel" = "estavel";
  if (Math.abs(trendPct) >= 10) trend = trendPct > 0 ? "crescente" : "decrescente";

  return JSON.stringify({
    metric,
    n_months: nMonths,
    by_month: results,
    statistics: {
      sum: Math.round(sum * 100) / 100,
      avg: Math.round(avg * 100) / 100,
      median: Math.round(median * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      trend,
      trend_pct_change: Math.round(trendPct * 10) / 10,
      first_half_avg: Math.round(avgFirst * 100) / 100,
      second_half_avg: Math.round(avgSecond * 100) / 100,
    },
  });
}

// Handler: status de cada obra (constructions + expenses + stages)
async function handleGetConstructionStatus(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const filter = typeof input.construction_filter === "string" ? input.construction_filter.trim() : null;
  const includeCompleted = input.include_completed === true;

  // 1) Busca obras
  let q = sb.from("constructions").select(
    "id, name, status, ownership_pct, partner_name, total_budget, total_units_planned, total_units_built, total_units_rented, estimated_rent_per_unit, start_date, estimated_completion, end_date",
  );
  if (!includeCompleted) q = q.neq("status", "concluida");
  if (filter) q = q.ilike("name", `%${filter}%`);

  const { data: constructions, error: ec } = await q;
  if (ec) return JSON.stringify({ error: `constructions query: ${ec.message}` });

  if (!constructions || constructions.length === 0) {
    return JSON.stringify({
      constructions: [],
      summary: { total: 0 },
      note: filter ? `Nenhuma obra encontrada com filtro '${filter}'.` : "Nenhuma obra em andamento.",
    });
  }

  // 2) Pra cada obra, busca expenses + stages
  const today = new Date();
  const out: any[] = [];
  for (const c of constructions as any[]) {
    const cota = Number(c.ownership_pct ?? 100);
    const orcadoTotal = Number(c.total_budget ?? 0);

    // Expenses
    const { data: exps } = await sb.from("construction_expenses")
      .select("total_amount, william_amount, partner_amount, expense_date, description, category, stage_id")
      .eq("construction_id", c.id);
    const gastoTotal = (exps ?? []).reduce((s: number, e: any) => s + Number(e.total_amount ?? 0), 0);
    const gastoWilliam = (exps ?? []).reduce((s: number, e: any) => s + Number(e.william_amount ?? 0), 0);
    const pctExecutado = orcadoTotal > 0 ? (gastoTotal / orcadoTotal) * 100 : 0;
    const orcadoCotaW = orcadoTotal * (cota / 100);
    const restanteCotaW = Math.max(0, orcadoCotaW - gastoWilliam);

    // Stages
    const { data: stages } = await sb.from("construction_stages")
      .select("id, name, status, pct_complete, budget_estimated, order_index, start_date, end_date")
      .eq("construction_id", c.id)
      .order("order_index", { ascending: true });

    // Gasto real por stage (somando expenses com stage_id correspondente)
    const gastoPorStage = new Map<string, { total: number; william: number }>();
    for (const e of exps ?? []) {
      const sid = (e as any).stage_id;
      if (!sid) continue;
      const cur = gastoPorStage.get(sid) ?? { total: 0, william: 0 };
      cur.total += Number((e as any).total_amount ?? 0);
      cur.william += Number((e as any).william_amount ?? 0);
      gastoPorStage.set(sid, cur);
    }

    const stagesOut = (stages ?? []).map((s: any) => {
      const g = gastoPorStage.get(s.id) ?? { total: 0, william: 0 };
      return {
        name: s.name,
        status: s.status,
        order: s.order_index,
        pct_complete: s.pct_complete,
        budget_estimated: Number(s.budget_estimated ?? 0),
        executed_amount: Math.round(g.total * 100) / 100,
        executed_amount_william: Math.round(g.william * 100) / 100,
        start_date: s.start_date,
        end_date: s.end_date,
      };
    });

    const proxima = stagesOut.find((s: any) => s.status !== "concluida");

    // Renda esperada quando finalizada
    const units = Number(c.total_units_planned ?? 0);
    const rentPerUnit = Number(c.estimated_rent_per_unit ?? 0);
    const rendaTotalMensal = units * rentPerUnit;
    const rendaCotaWMensal = rendaTotalMensal * (cota / 100);

    // Tempo decorrido
    const start = c.start_date ? new Date(c.start_date) : null;
    const eta = c.estimated_completion ? new Date(c.estimated_completion) : null;
    const mesesDecorridos = start ? Math.max(0, Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30))) : null;
    const mesesRestantes = eta ? Math.max(0, Math.round((eta.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30))) : null;

    // Sinais auto-gerados
    const sinais: string[] = [];
    if (orcadoTotal > 0 && pctExecutado > 100) sinais.push(`⚠ Estouro: gasto ${pctExecutado.toFixed(1)}% do orçamento`);
    if (eta && mesesRestantes != null && mesesRestantes <= 1 && pctExecutado < 90) {
      sinais.push(`⚠ Prazo apertado: ${mesesRestantes} mês(es) até ETA, mas só ${pctExecutado.toFixed(1)}% executado`);
    }
    if (start && mesesDecorridos != null && mesesDecorridos > 0 && eta) {
      const totalMeses = Math.max(1, Math.round((eta.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
      const pctTempo = (mesesDecorridos / totalMeses) * 100;
      if (pctTempo - pctExecutado > 25) {
        sinais.push(`⚠ Atrasado: ${pctTempo.toFixed(0)}% do tempo passou, ${pctExecutado.toFixed(0)}% executado`);
      }
    }

    out.push({
      name: c.name,
      status: c.status,
      partner: c.partner_name,
      ownership_pct: cota,
      orcado_total: Math.round(orcadoTotal * 100) / 100,
      orcado_cota_william: Math.round(orcadoCotaW * 100) / 100,
      gasto_total: Math.round(gastoTotal * 100) / 100,
      gasto_cota_william: Math.round(gastoWilliam * 100) / 100,
      restante_cota_william: Math.round(restanteCotaW * 100) / 100,
      pct_executado: Math.round(pctExecutado * 10) / 10,
      total_units_planned: units,
      total_units_built: c.total_units_built,
      estimated_rent_per_unit: Math.round(rentPerUnit * 100) / 100,
      renda_total_mensal_quando_pronta: Math.round(rendaTotalMensal * 100) / 100,
      renda_cota_william_mensal: Math.round(rendaCotaWMensal * 100) / 100,
      start_date: c.start_date,
      eta: c.estimated_completion,
      meses_decorridos: mesesDecorridos,
      meses_restantes: mesesRestantes,
      n_expenses: (exps ?? []).length,
      stages: stagesOut,
      proxima_etapa: proxima ? { name: proxima.name, budget: proxima.budget_estimated, pct_complete: proxima.pct_complete } : null,
      sinais_alerta: sinais,
    });
  }

  // 3) Sumário geral
  const summary = {
    total_obras: out.length,
    total_orcado_cota_william: Math.round(out.reduce((s, c) => s + c.orcado_cota_william, 0) * 100) / 100,
    total_gasto_cota_william: Math.round(out.reduce((s, c) => s + c.gasto_cota_william, 0) * 100) / 100,
    total_restante_cota_william: Math.round(out.reduce((s, c) => s + c.restante_cota_william, 0) * 100) / 100,
    total_units_planned: out.reduce((s, c) => s + (c.total_units_planned ?? 0), 0),
    renda_total_mensal_cota_william_quando_todas_prontas: Math.round(out.reduce((s, c) => s + c.renda_cota_william_mensal, 0) * 100) / 100,
    obras_com_alerta: out.filter((c) => c.sinais_alerta.length > 0).length,
  };

  return JSON.stringify({ summary, constructions: out });
}

// Handler: comissão Prevensul do ciclo X (paga dia 20 do mês X+1)
async function handleGetPrevensulCycle(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);

  // Default = mês atual
  const now = new Date();
  const defaultCycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const cycleMonth = (typeof input.cycle_month === "string" && /^\d{4}-\d{2}$/.test(input.cycle_month))
    ? input.cycle_month
    : defaultCycle;

  // Calcula data de pagamento = dia 20 do mês seguinte
  const [y, m] = cycleMonth.split("-").map(Number);
  const payYear = m === 12 ? y + 1 : y;
  const payMonth = m === 12 ? 1 : m + 1;
  const paymentDate = `${payYear}-${String(payMonth).padStart(2, "0")}-20`;

  // Busca todas linhas do ciclo
  const { data, error } = await sb.from("prevensul_billing")
    .select("client_name, amount_paid, commission_rate, commission_value, status, contract_total, balance_remaining, installment_current, installment_total")
    .eq("reference_month", cycleMonth);

  if (error) {
    return JSON.stringify({ error: `prevensul_billing query failed: ${error.message}` });
  }

  const rows = data ?? [];
  const totalCommission = rows.reduce((s, r: any) => s + Number(r.commission_value ?? 0), 0);
  const totalAmountPaid = rows.reduce((s, r: any) => s + Number(r.amount_paid ?? 0), 0);

  // Agrupa por cliente
  const byClient = new Map<string, { commission: number; amount_paid: number; rows: number }>();
  for (const r of rows as any[]) {
    const cur = byClient.get(r.client_name) ?? { commission: 0, amount_paid: 0, rows: 0 };
    cur.commission += Number(r.commission_value ?? 0);
    cur.amount_paid += Number(r.amount_paid ?? 0);
    cur.rows += 1;
    byClient.set(r.client_name, cur);
  }
  const clientList = Array.from(byClient.entries())
    .map(([client, v]) => ({
      client,
      amount_paid_in_cycle: Math.round(v.amount_paid * 100) / 100,
      commission: Math.round(v.commission * 100) / 100,
      rows: v.rows,
    }))
    .filter((c) => c.commission > 0)
    .sort((a, b) => b.commission - a.commission);

  return JSON.stringify({
    rule: "Ciclo de comissão Prevensul: dia 1-31 do mês X, pagamento até dia 20 do mês X+1.",
    cycle_month: cycleMonth,
    payment_date_estimated: paymentDate,
    summary: {
      total_commission_to_receive: Math.round(totalCommission * 100) / 100,
      total_client_payments_in_cycle: Math.round(totalAmountPaid * 100) / 100,
      n_clients_with_commission: clientList.length,
      n_billing_rows: rows.length,
    },
    by_client: clientList,
    interpretation: clientList.length === 0
      ? `Nenhuma comissão registrada no ciclo ${cycleMonth}. Confirma se o portal /commissions/portal foi atualizado com pagamentos do mês.`
      : `Comissão total a receber em ${paymentDate}: R$ ${totalCommission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Esse é o valor consolidado do ciclo ${cycleMonth} pelo portal Prevensul.`,
  });
}

// Handler: histórico REAL de comissão Prevensul recebida (revenues)
async function handleGetPrevensulHistory(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const nMonths = Math.max(3, Math.min(24, Number(input.n_months ?? 6)));

  // Calcula mês inicial (n_months atrás do mês atual)
  const now = new Date();
  const curIdx = (now.getFullYear() * 12) + (now.getMonth() + 1);
  const startIdx = curIdx - nMonths + 1;
  const startMonth = idxToMonth(startIdx);

  const { data, error } = await sb.from("revenues")
    .select("amount, received_at, source, description, reference_month, business_id")
    .eq("source", "comissao_prevensul")
    .gte("reference_month", startMonth);

  if (error) {
    return JSON.stringify({ error: `revenues query failed: ${error.message}` });
  }

  // Agrupa por reference_month
  const byMonth = new Map<string, { total: number; deposits: Array<{ date: string; amount: number; description: string }> }>();
  for (const r of data ?? []) {
    const month = (r as any).reference_month as string;
    if (!month) continue;
    const cur = byMonth.get(month) ?? { total: 0, deposits: [] };
    cur.total += Number((r as any).amount ?? 0);
    cur.deposits.push({
      date: (r as any).received_at,
      amount: Number((r as any).amount ?? 0),
      description: (r as any).description ?? "",
    });
    byMonth.set(month, cur);
  }

  // Preenche meses sem nenhum recebimento (zeros explícitos)
  const months: Array<{ month: string; total: number; n_deposits: number; deposits: Array<{ date: string; amount: number; description: string }> }> = [];
  for (let i = startIdx; i <= curIdx; i++) {
    const m = idxToMonth(i);
    const entry = byMonth.get(m);
    months.push({
      month: m,
      total: entry ? Math.round(entry.total * 100) / 100 : 0,
      n_deposits: entry ? entry.deposits.length : 0,
      deposits: entry ? entry.deposits.sort((a, b) => b.amount - a.amount).slice(0, 5) : [],
    });
  }

  // Estatísticas
  const totals = months.map((m) => m.total);
  const sum = totals.reduce((s, v) => s + v, 0);
  const avg = totals.length > 0 ? sum / totals.length : 0;
  const sorted = [...totals].sort((a, b) => a - b);
  const median = sorted.length > 0
    ? (sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)])
    : 0;
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const monthsWithZero = totals.filter((v) => v === 0).length;

  const variability = avg > 0 ? (max - min) / avg : 0;

  return JSON.stringify({
    n_months: months.length,
    by_month: months,
    statistics: {
      total_period: Math.round(sum * 100) / 100,
      average_monthly: Math.round(avg * 100) / 100,
      median_monthly: Math.round(median * 100) / 100,
      min_monthly: Math.round(min * 100) / 100,
      max_monthly: Math.round(max * 100) / 100,
      months_with_zero: monthsWithZero,
      variability_index: Math.round(variability * 100) / 100,
    },
    interpretation: {
      pattern: monthsWithZero > 0
        ? "IRREGULAR — alguns meses zeram (lump sums acumulados em outros). NÃO use média como previsão."
        : (variability > 1.5
          ? "VOLÁTIL — diferença max/min > 1.5×. Use mediana, não média. Indique range."
          : "ESTÁVEL — receita relativamente uniforme."),
      recommendation: monthsWithZero > 0 || variability > 1.5
        ? "Pra forecast: indique RANGE [min, max] em vez de valor único. Avise sobre variabilidade."
        : "Pode usar a média como projeção razoável.",
    },
  });
}

async function handleGetPrevensulPipeline(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const clientFilter = typeof input.client_filter === "string"
    ? input.client_filter.trim().toUpperCase()
    : null;
  const includePaid = input.include_paid === true;
  const forecastMonth = typeof input.forecast_month === "string" && /^\d{4}-\d{2}$/.test(input.forecast_month)
    ? input.forecast_month
    : null;

  let query = sb.from("prevensul_billing")
    .select("client_name, contract_total, balance_remaining, commission_rate, commission_value, status, reference_month, installment_current, installment_total, closing_date");

  if (!includePaid) query = query.gt("balance_remaining", 0);

  const { data, error } = await query;
  if (error) {
    return JSON.stringify({ error: `prevensul_billing query failed: ${error.message}` });
  }

  let rows = (data ?? []) as Array<{
    client_name: string;
    contract_total: number | null;
    balance_remaining: number | null;
    commission_rate: number | null;
    commission_value: number | null;
    status: string | null;
    reference_month: string | null;
    installment_current: number | null;
    installment_total: number | null;
    closing_date: string | null;
  }>;

  if (clientFilter) {
    rows = rows.filter((r) => (r.client_name || "").toUpperCase().includes(clientFilter));
  }

  // Agrega por cliente
  type Agg = { balance: number; commFuture: number; commPaid: number; rows: number; contracts: number };
  const byClient = new Map<string, Agg>();
  for (const r of rows) {
    const name = r.client_name || "?";
    const balance = Number(r.balance_remaining || 0);
    const rate = Number(r.commission_rate || 0);
    const commPaid = Number(r.commission_value || 0);
    const cur = byClient.get(name) ?? { balance: 0, commFuture: 0, commPaid: 0, rows: 0, contracts: 0 };
    cur.balance += balance;
    cur.commFuture += balance * rate;
    cur.commPaid += commPaid;
    cur.rows += 1;
    byClient.set(name, cur);
  }

  // Totais
  const totalBalance = Array.from(byClient.values()).reduce((s, v) => s + v.balance, 0);
  const totalCommFuture = Array.from(byClient.values()).reduce((s, v) => s + v.commFuture, 0);
  const totalCommPaid = Array.from(byClient.values()).reduce((s, v) => s + v.commPaid, 0);

  // Top 15 por saldo
  const top = Array.from(byClient.entries())
    .map(([name, v]) => ({
      client: name,
      balance_remaining: Math.round(v.balance * 100) / 100,
      commission_future: Math.round(v.commFuture * 100) / 100,
      commission_already_paid: Math.round(v.commPaid * 100) / 100,
      pipeline_pct: totalBalance > 0 ? Math.round((v.balance / totalBalance) * 1000) / 10 : 0,
      installments_open: v.rows,
    }))
    .sort((a, b) => b.balance_remaining - a.balance_remaining)
    .slice(0, 15);

  // Concentração: % do top cliente
  const top1Pct = top.length > 0 ? top[0].pipeline_pct : 0;
  const top1Name = top.length > 0 ? top[0].client : null;

  // Projeção mensal — se forecast_month foi passado, estima comissão pra esse mês.
  // Lógica: cada linha tem 1 mês do contrato (installment_current de N). Calcula:
  //   - parcela_mensal = contract_total / installment_total
  //   - last_ref = max(reference_month) por cliente (último mês registrado)
  //   - meses_faltantes = installment_total - installment_current_max
  //   - se forecast_month está em (last_ref, last_ref + meses_faltantes], estima comissão
  let monthlyForecast: Record<string, unknown> | null = null;
  if (forecastMonth) {
    const forecastIdx = monthToIdx(forecastMonth)!;

    // Pega "linha mais recente" de cada cliente (maior installment_current)
    type Latest = {
      contract_total: number;
      installment_total: number;
      installment_current: number;
      commission_rate: number;
      last_ref_month: string | null;
    };
    const latestByClient = new Map<string, Latest>();
    for (const r of rows) {
      const name = r.client_name || "?";
      const cur = latestByClient.get(name);
      const cur_inst = Number(r.installment_current ?? 0);
      if (!cur || cur_inst > cur.installment_current) {
        latestByClient.set(name, {
          contract_total: Number(r.contract_total ?? 0),
          installment_total: Number(r.installment_total ?? 1),
          installment_current: cur_inst,
          commission_rate: Number(r.commission_rate ?? 0.03),
          last_ref_month: r.reference_month,
        });
      }
    }

    let totalEstPaid = 0;
    let totalEstComm = 0;
    const forecastByClient: Array<{ client: string; estimated_paid: number; estimated_commission: number; reasoning: string }> = [];

    for (const [client, latest] of latestByClient.entries()) {
      const totalInst = latest.installment_total || 1;
      const curInst = latest.installment_current;
      const monthsLeft = Math.max(0, totalInst - curInst);
      const lastRefIdx = monthToIdx(latest.last_ref_month);
      if (lastRefIdx == null) continue;

      const monthsAhead = forecastIdx - lastRefIdx;
      // forecast_month tem que ser FUTURO (>0) e dentro do prazo restante
      if (monthsAhead <= 0 || monthsAhead > monthsLeft) continue;

      const avgPerMonth = totalInst > 0 ? latest.contract_total / totalInst : 0;
      const estPaid = avgPerMonth;
      const estComm = avgPerMonth * latest.commission_rate;

      totalEstPaid += estPaid;
      totalEstComm += estComm;
      forecastByClient.push({
        client,
        estimated_paid: Math.round(estPaid * 100) / 100,
        estimated_commission: Math.round(estComm * 100) / 100,
        reasoning: `parcela ${curInst + monthsAhead}/${totalInst}, contract_total/installment_total = ${Math.round(avgPerMonth * 100) / 100}`,
      });
    }
    forecastByClient.sort((a, b) => b.estimated_commission - a.estimated_commission);

    monthlyForecast = {
      forecast_month: forecastMonth,
      assumption: "parcela mensal estimada = contract_total / installment_total. Estimativa apenas pra contratos ainda dentro do prazo (installment_current < installment_total).",
      total_estimated_paid: Math.round(totalEstPaid * 100) / 100,
      total_estimated_commission: Math.round(totalEstComm * 100) / 100,
      by_client: forecastByClient.slice(0, 15),
      clients_in_range: forecastByClient.length,
    };
  }

  return JSON.stringify({
    summary: {
      total_balance_remaining: Math.round(totalBalance * 100) / 100,
      total_commission_future: Math.round(totalCommFuture * 100) / 100,
      total_commission_already_paid: Math.round(totalCommPaid * 100) / 100,
      total_clients: byClient.size,
      total_open_rows: rows.length,
      concentration_top_client: top1Name,
      concentration_top_client_pct: top1Pct,
      filtered_by_client: clientFilter,
      included_paid: includePaid,
    },
    by_client: top,
    monthly_forecast: monthlyForecast,
  });
}

// ─── Claude Haiku 4.5 — usado pelo Naval (chat conversacional) ────────────
// Tenta Lovable Gateway primeiro (formato OpenAI-compatible). Se falhar com
// erro de modelo não suportado, faz fallback pra API Anthropic direta usando
// ANTHROPIC_API_KEY (configurada como secret do projeto).
//
// Tool-use (function calling) só funciona via API Anthropic direta — Lovable
// Gateway no formato OpenAI não tem o mesmo loop de tool_use/tool_result.
// Quando tools são passadas, callClaudeHaiku VAI direto pra API Anthropic e
// roda o loop interno até stop_reason === "end_turn".
type ClaudeTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};
type ClaudeToolHandler = (input: Record<string, unknown>) => Promise<string>;
type ClaudeUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};
type ClaudeResult =
  | { ok: true; text: string; usage?: ClaudeUsage; tools_used?: string[] }
  | { ok: false; status: number; error: string };

async function callClaudeHaiku(
  systemPrompt: string | { fixed: string; variable: string },
  messages: Array<{ role: string; content: unknown }>,
  opts: {
    maxTokens?: number;
    lovableKey?: string;
    anthropicKey?: string;
    tools?: ClaudeTool[];
    toolHandlers?: Record<string, ClaudeToolHandler>;
  },
): Promise<ClaudeResult> {
  // Normaliza pra ter sempre {fixed, variable}. String simples vai toda em "fixed".
  const sys = typeof systemPrompt === "string"
    ? { fixed: systemPrompt, variable: "" }
    : systemPrompt;
  const fullSystemForGateway = sys.fixed + sys.variable;
  const maxTokens = opts.maxTokens ?? 1500;
  const MODEL_GW = "anthropic/claude-haiku-4-5";
  const MODEL_NATIVE = "claude-haiku-4-5";
  const useTools = (opts.tools?.length ?? 0) > 0;

  // 1) Lovable Gateway — só funciona SEM tools (formato OpenAI não bate com loop Anthropic)
  if (!useTools && opts.lovableKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL_GW,
          max_tokens: maxTokens,
          messages: [{ role: "system", content: fullSystemForGateway }, ...messages],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content ?? "";
        if (text) {
          console.log("[wisely-ai] Naval via Lovable Gateway · Claude Haiku 4.5 (sem tools) ✓");
          return { ok: true, text };
        }
      } else {
        const errText = await res.text().catch(() => "");
        console.warn(`[wisely-ai] Lovable Gateway Claude falhou: ${res.status} ${errText.slice(0, 200)}`);
        if (res.status === 429 || res.status === 402) {
          return { ok: false, status: res.status, error: errText };
        }
      }
    } catch (e) {
      console.warn("[wisely-ai] Lovable Gateway exception:", e instanceof Error ? e.message : String(e));
    }
  }

  // 2) API Anthropic direta — único caminho com tool-use
  if (!opts.anthropicKey) {
    return {
      ok: false,
      status: 500,
      error: useTools
        ? "Tool-use exige ANTHROPIC_API_KEY configurada como secret do projeto."
        : "ANTHROPIC_API_KEY não configurada e Lovable Gateway falhou.",
    };
  }

  try {
    // Anthropic native: system separado, messages role user/assistant
    // Mantém content como array (necessário pra tool_use/tool_result)
    let conversation = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : (m.content as unknown),
      })) as Array<{ role: string; content: unknown }>;

    // Loop tool-use — máximo 5 iterações pra evitar runaway
    const MAX_TOOL_ITER = 5;
    const toolsUsedSet = new Set<string>();
    let lastUsage: ClaudeUsage | undefined;
    for (let iter = 0; iter < MAX_TOOL_ITER; iter++) {
      // Prompt caching split em 2 blocos:
      //   1. FIXO (BASE_SYSTEM_PROMPT + naval_memory) → cache_control:ephemeral.
      //      Estável entre chamadas. ~25k tokens. Cache hit garantido após 1ª chamada.
      //   2. VARIÁVEL (brain stack RAG) → sem cache_control. Muda por query (RAG semântico
      //      retorna princípios diferentes), então não cachea.
      // Antes a função recebia string única e cache_control ia nela inteira → como o prompt
      // mudava por query (RAG dinâmico), cache_read=0 sempre. Agora cache_read fica ~25k.
      const cachedSystem: Array<Record<string, unknown>> = [
        { type: "text", text: sys.fixed, cache_control: { type: "ephemeral" } },
      ];
      if (sys.variable && sys.variable.length > 0) {
        cachedSystem.push({ type: "text", text: sys.variable });
      }
      const reqBody: Record<string, unknown> = {
        model: MODEL_NATIVE,
        max_tokens: maxTokens,
        system: cachedSystem,
        messages: conversation,
      };
      if (useTools && opts.tools) {
        // Marca a última tool com cache_control — Anthropic cacheia até essa fronteira
        const toolsWithCache = opts.tools.map((t, idx) =>
          idx === opts.tools!.length - 1
            ? { ...t, cache_control: { type: "ephemeral" } }
            : t,
        );
        reqBody.tools = toolsWithCache;
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": opts.anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reqBody),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(`[wisely-ai] Anthropic API error (iter ${iter}): ${res.status} ${errText.slice(0, 300)}`);
        return { ok: false, status: res.status, error: errText };
      }

      const data = await res.json();
      const content = Array.isArray(data.content) ? data.content : [];
      const stopReason = data.stop_reason as string | undefined;

      // Log tokens pra monitorar cache hit ratio
      const usage = (data.usage ?? {}) as ClaudeUsage;
      lastUsage = usage; // captura pra retornar
      if (iter === 0) {
        const cacheRead = usage.cache_read_input_tokens ?? 0;
        const cacheWrite = usage.cache_creation_input_tokens ?? 0;
        const inputReg = usage.input_tokens ?? 0;
        const output = usage.output_tokens ?? 0;
        console.log(`[wisely-ai] tokens · in_reg=${inputReg} cache_read=${cacheRead} cache_write=${cacheWrite} out=${output}`);
      }

      // Se Claude pediu tool_use, executa todas as ferramentas pedidas e devolve resultados
      if (stopReason === "tool_use") {
        const toolUses = content.filter((c: any) => c.type === "tool_use");
        if (toolUses.length === 0) break;
        // captura nomes pra logging do chat
        for (const tu of toolUses) toolsUsedSet.add(tu.name);

        // Append assistant message com o conteúdo completo (texto + tool_use blocks)
        conversation = [...conversation, { role: "assistant", content }];

        // Executa cada tool e monta tool_result
        const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];
        for (const tu of toolUses) {
          const handler = opts.toolHandlers?.[tu.name];
          if (!handler) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: `ERROR: tool ${tu.name} não tem handler registrado.`,
            });
            continue;
          }
          try {
            const result = await handler(tu.input ?? {});
            toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
            console.log(`[wisely-ai] tool ${tu.name} executada · input=${JSON.stringify(tu.input).slice(0, 100)}`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "erro desconhecido";
            console.error(`[wisely-ai] tool ${tu.name} exception:`, msg);
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: `ERROR ao executar ${tu.name}: ${msg}`,
            });
          }
        }
        conversation = [...conversation, { role: "user", content: toolResults }];
        continue; // próxima iteração — Claude vê o resultado e responde
      }

      // Resposta final (end_turn ou stop_sequence)
      const text = content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
      console.log(`[wisely-ai] Naval via Anthropic API · Haiku 4.5 ${useTools ? `(tools, ${iter} iter)` : "(sem tools)"} ✓`);
      return { ok: true, text, usage: lastUsage, tools_used: Array.from(toolsUsedSet) };
    }

    return { ok: false, status: 500, error: "Loop de tool-use excedeu MAX_TOOL_ITER" };
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: e instanceof Error ? e.message : "erro desconhecido",
    };
  }
}

// Versão do código deployado — log inicial em CADA invocação pra confirmar
// que o deploy do edge function está atualizado. Bumpa toda vez que mudar
// a função (manual). Se o log abaixo NÃO aparecer, o deploy não rolou.
const WISELY_AI_VERSION = "2026.04.29-v15-pacote1-completo";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[wisely-ai] ▶ invocação · versão ${WISELY_AI_VERSION}`);

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
    // Gemini nativo só pra embeddings (Lovable gateway não suporta)
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

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

    // Extrai última mensagem do William pra RAG semântico na brain stack
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const userQueryText = typeof lastUserMsg?.content === "string"
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
        ? lastUserMsg.content.map((c: any) => c?.text ?? "").join(" ")
        : "";

    // "isso se aplica ao meu caso?" → mais princípios, threshold relaxado
    const isApplicabilityQuery = /isso se aplica|meu caso|se aplica ao|aplica pra mim|aplica no meu/i.test(userQueryText);

    const systemPrompt = await buildSystemPrompt({
      userQuery: userQueryText,
      apiKey: GEMINI_API_KEY,
      topK: isApplicabilityQuery ? 15 : 10,
      threshold: isApplicabilityQuery ? 0.2 : 0.3,
    });

    // Naval roda no Claude Haiku 4.5 — qualidade de raciocínio significativamente
    // melhor pra conselhos financeiros vs Gemini Flash (que continua nas extrações
    // de PDF, parse de fatura, reconcile, etc — mais barato e cumpre bem o papel).
    //
    // Tool-use: Naval pode chamar get_breakdown(month, bucket?) pra buscar
    // lançamentos detalhados do DRE em vez de chutar somas. Só funciona via
    // API Anthropic direta (precisa ANTHROPIC_API_KEY) — sem ela, degrada
    // gracefully pro modo sem tools via Lovable Gateway.
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const useTools = !!ANTHROPIC_API_KEY && !!supabaseUrl && !!serviceKey;
    const result = await callClaudeHaiku(systemPrompt, messages, {
      maxTokens: 2000,
      lovableKey: LOVABLE_API_KEY,
      anthropicKey: ANTHROPIC_API_KEY,
      tools: useTools ? NAVAL_TOOLS : undefined,
      toolHandlers: useTools
        ? {
            get_breakdown: (input) => handleGetBreakdown(input, supabaseUrl, serviceKey),
            get_prevensul_pipeline: (input) => handleGetPrevensulPipeline(input, supabaseUrl, serviceKey),
            get_prevensul_history: (input) => handleGetPrevensulHistory(input, supabaseUrl, serviceKey),
            get_prevensul_cycle: (input) => handleGetPrevensulCycle(input, supabaseUrl, serviceKey),
            get_construction_status: (input) => handleGetConstructionStatus(input, supabaseUrl, serviceKey),
            get_history: (input) => handleGetHistory(input, supabaseUrl, serviceKey),
            compare_months: (input) => handleCompareMonths(input, supabaseUrl, serviceKey),
          }
        : undefined,
    });

    if (!result.ok) {
      if (result.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos.", rateLimited: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (result.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione fundos no workspace ou ANTHROPIC_API_KEY.", creditsExhausted: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: result.error || "Erro ao chamar Claude Haiku" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Salva o chat no histórico (não-bloqueante) ──
    // Tenta extrair user_id do JWT pra associar ao usuário correto. Se falhar,
    // não trava a resposta — só perde o histórico daquela pergunta.
    if (supabaseUrl && serviceKey && userQueryText) {
      try {
        const authHeader = req.headers.get("authorization") ?? "";
        const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (jwt) {
          const sbAdmin = createClient(supabaseUrl, serviceKey);
          const { data: userData } = await sbAdmin.auth.getUser(jwt);
          const userId = userData?.user?.id;
          if (userId) {
            const u = result.usage ?? {};
            // Salva sem await pra não bloquear a resposta
            sbAdmin.from("naval_chats").insert({
              user_id: userId,
              question: userQueryText.slice(0, 5000),
              answer: result.text.slice(0, 30000),
              tools_used: result.tools_used && result.tools_used.length > 0 ? result.tools_used : null,
              tokens_in: u.input_tokens ?? null,
              tokens_cache_read: u.cache_read_input_tokens ?? null,
              tokens_cache_write: u.cache_creation_input_tokens ?? null,
              tokens_out: u.output_tokens ?? null,
              version: WISELY_AI_VERSION,
            }).then((r) => {
              if (r.error) console.warn("[wisely-ai] save chat error:", r.error.message);
            });
          }
        }
      } catch (e) {
        console.warn("[wisely-ai] save chat exception:", e instanceof Error ? e.message : String(e));
      }
    }

    return new Response(JSON.stringify({ text: result.text }), {
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
