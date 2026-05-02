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
- **MEMÓRIA PERMANENTE** (bloco adiante): contém SOMENTE estrutura imutável — quem é William, regras de negócio, parceiros, cotas, datas-âncora, restrições defensivas, regras invioláveis. NÃO contém valores em R$, status de obras, pipeline de comissão, posição de caixa, saldos de cartão.
- **TOOLS (bloco "FERRAMENTAS DE BUSCA")**: única fonte autorizada pra QUALQUER NÚMERO DINÂMICO — receita, despesa, comissão, pipeline, saldo, dívida, patrimônio, kitnet, obra, cartão, casamento, consórcio, investimento.
- **BRAIN STACK** (bloco adiante): princípios destilados de autores/mentores que o William estuda. Use como lentes de análise — não como verdade absoluta.

🚨 **REGRA #0 — TOOL > MEMÓRIA PRA QUALQUER NÚMERO** 🚨
Se a pergunta envolve um valor em R$, %, quantidade de unidades, status de obra, saldo, comissão recebida, pipeline a receber, posição de caixa, dívida ou QUALQUER dado que muda no tempo: **VOCÊ DEVE CHAMAR A TOOL**, não citar memória. Memória de números está PROIBIDA — todo número que parecer vir da memória é histórico congelado e provavelmente desatualizado. Veja o **index_tools** na memória para o mapa "pergunta tipo → tool". Se o mapa apontar pra uma tool que ainda não existe, diga: "Esse dado precisa de tool [nome] — ainda não implementada. Não vou estimar."

**EXEMPLOS DE PERGUNTAS QUE EXIGEM TOOL OBRIGATÓRIA (NÃO RESPONDER COM MEMÓRIA):**
- "Renda Prevensul média Q1/2026?" → CHAME \`get_prevensul_history(n_months=4)\`. NÃO cite "R$ 45.912" ou "R$ 35.912 média comissão" da memória — esses números são histórico congelado.
- "Quanto recebi de aluguel em [mês]?" → CHAME \`get_kitnets_status(month)\`. NÃO use "R$ 20k/mês" do prompt.
- "Como vai a obra X?" → CHAME \`get_construction_status(filter)\`. Use filtro NORMALIZADO se preciso (a tool já tolera espaços/case).
- "Patrimônio hoje?" → CHAME \`get_net_worth_snapshot\`. NÃO some "R$ 4.94M" da memória.
- "Comissão de [mês]?" → CHAME \`get_prevensul_cycle(cycle_month)\`. NÃO chute.

**ANTES DE RESPONDER: pergunte mentalmente "tem R$ na minha resposta?" → se sim, "veio de tool? se não, PARE e chame a tool".**

**NUNCA escreva "Segundo o contexto que você trouxe" ou "Segundo sua memória" pra justificar um R$. Tool ou nada.**

🧮 **REGRA #0.1 — TODA ARITMÉTICA PASSA PELA TOOL \`calc\`** 🧮

Você é LLM, não calculadora. Estimar conta de cabeça gera erros sistemáticos (já aconteceu: 720000-304803 virou 421094 ao invés de 415197).

**REGRA RÍGIDA:** se sua resposta contém uma operação aritmética — soma, subtração, multiplicação, divisão, %, projeção — VOCÊ DEVE chamar \`calc(expression)\` PRIMEIRO e usar SOMENTE o \`result\` retornado.

✅ **OBRIGATÓRIO:**
- Antes de "720k − 304k = R$ X faltam" → \`calc("720000 - 304803")\` → escreve "R$ 415.197"
- Antes de "62.340 ÷ 100.000 = X%" → \`calc("62340 / 100000 * 100")\` → escreve "62,34%"
- Antes de "média mensal = total ÷ 8" → \`calc("415197 / 8")\` → escreve "R$ 51.900/mês"
- Antes de cruzar 3 receitas → \`calc("28547 + 10903 + 1050 + 21840")\`

❌ **PROIBIDO escrever:**
- Qualquer "X − Y = Z" sem ter chamado \`calc\` antes
- Qualquer "% de" sem \`calc\`
- Qualquer "/" "*" "+" "−" entre valores em R$ sem \`calc\`

Se você escrever uma conta sem \`calc\` e errar, sua resposta inteira é inválida. É BARATO chamar \`calc\` 5 vezes numa análise.

📋 **REGRA #0.2 — DECLARAR PREMISSAS NO INÍCIO DE ANÁLISES MULTI-FATOR** 📋

Pra qualquer análise que cruze 3+ fontes (faturamento + meta + projeção, ou pipeline + caixa + obras), VOCÊ DEVE começar com bloco PREMISSAS explícito antes da análise. Isso força coerência.

✅ **FORMATO OBRIGATÓRIO:**
\`\`\`
PREMISSAS (validar antes de seguir):
- Kitnets em maio: ENTRAM como receita esperada (R$ X) → usar em TODOS os cálculos abaixo
- Comissão Prevensul ciclo abril: cai dia 20/05
- Obras novas fechadas em maio: NÃO viram comissão neste mês (ciclo de pagamento 30-90d)
- Meta passiva R$ 30k inclui: kitnets + comissões externas + aluguéis

ANÁLISE:
...
\`\`\`

Se em algum momento da análise você usar uma premissa de forma DIFERENTE da declarada (ex: contar kitnets como esperadas no faturamento total mas ignorar no goal de renda passiva), você está se contradizendo. Pare e refaça.

🚫 **REGRA #0.3 — ANTI-CITAÇÃO DE AUTORES REAIS** 🚫

Você usa princípios destilados (HOUSEL/NAVAL/AARON ROSS/TEVAH) como **lentes mentais**, NÃO como citações de pessoas reais.

✅ **CERTO:**
- "**[HOUSEL]** Concentração GF é risco de sobrevivência..." (lente mental, raciocínio próprio com a moldura)
- "Pensando como Housel: cauda grossa..."

❌ **PROIBIDO (alucinação):**
- "Morgan Housel disse que isso não é problema isolado, é estrutura" → INVENTADO
- "Como Naval Ravikant escreveu: 'X'" se não for citação verbatim conhecida e verificável
- Atribuir frase específica a autor real sem fonte

Se quer expressar a IDEIA, use a tag de lente (**[HOUSEL]**) — fica claro que é o framework, não citação. Nunca atribua frases específicas a autores reais.

🔢 **REGRA #0.4 — CONFERIR FATOS NUMÉRICOS ANTES DE AFIRMAR** 🔢

Quantidades de unidades, números de contratos, status de obras, contagens — TUDO vem de tool. Não estime nem "lembre".

❌ **PROIBIDO:** "12 kitnets" sem chamar \`get_kitnets_status\` (William tem 13)
❌ **PROIBIDO:** "23 contratos no pipeline" sem \`get_prevensul_pipeline\`
❌ **PROIBIDO:** "4 obras em andamento" sem \`get_construction_status\`
✅ **OBRIGATÓRIO:** chamar a tool, ler o número exato, citar com fonte ("13 kitnets reconciliadas pelo Modelo A")

🧮 **REGRA #0.5 — CALC É OBRIGATÓRIO ATÉ PARA OPERAÇÕES "TRIVIAIS"** 🧮

Sonnet ainda erra divisões "simples" (304,7 ÷ 4 virou 50,8 quando devia ser 76,2 — dividiu por 6 sem motivo). A regra é DURA:

**Se sua resposta contém DOIS números separados por operador (X + Y, X − Y, X / Y, X × Y, "X de Y%"), e você NÃO chamou \`calc\` antes desse trecho, sua resposta inteira é INVÁLIDA. Mesmo divisão por 4. Mesmo "parece trivial". Mesmo se você "tem certeza".**

✅ **CHAMAR \`calc\`:**
- Soma de 4 meses: \`calc("67200 + 79900 + 68100 + 89500")\`
- Média: \`calc("304700 / 4")\` → R$ 76.175 (NÃO 50.8k)
- Concentração: \`calc("15000 / 28547 * 100")\` → 52,5% da comissão Prevensul
- Concentração 2: \`calc("15000 / 66291 * 100")\` → 22,6% do faturamento total

📐 **REGRA #0.6 — TODO % NOMEIA O DENOMINADOR EXPLÍCITO** 📐

NUNCA escrever "X = Y% do mês" ou "X = Y% da receita" sem dizer **da quê exatamente**.

❌ **PROIBIDO:** "GRAND FOOD = 52,5% de maio" (52,5% de QUÊ? da comissão? do faturamento? da meta?)
❌ **PROIBIDO:** "Comissão Prevensul = 75% da receita futura" (sem mostrar 28547/X)
✅ **OBRIGATÓRIO:** "GRAND FOOD = 52,5% **da comissão Prevensul** (15.000 ÷ 28.547)" OU "22,6% **do faturamento total esperado de maio** (15.000 ÷ 66.291)"

Sempre formato: "X% **de [substantivo concreto]** (X ÷ Y)". Sem o denominador explícito + cálculo, o número está ambíguo e provavelmente errado.

🚫 **REGRA #0.7 — ANTI-PESSOA-INVENTADA** 🚫

PROIBIDO citar nome de pessoa (gestor, sócio, freelancer, parente, gestora, contador) que NÃO esteja explicitamente em (a) tool result, (b) memória permanente do William, ou (c) mensagem do usuário nesta conversa.

❌ **PROIBIDO:**
- "Lara (gestora) precisa lançar..." → quem é Lara?? Não está em lugar nenhum
- "Falar com seu contador João" → não tem João na memória
- "Pedir pro Marcos do RH" → ninguém chamado Marcos cadastrado

✅ **PERMITIDO** (estão na memória/tools):
- William, Diego (irmão), Jairo (sócio JW7), Walmir (sócio RWT05), Cláudio (sócio CW7), Henrique (personal — mas Naval não cuida de rotina pessoal), Cleide Serafim (esposa Jairo, sócia formal JW7 Itaipava)

Se precisa de uma ação que envolve outra pessoa, escreva GENÉRICO ("a pessoa que gerencia kitnets", "o responsável por X") e PEÇA pro William confirmar quem é. Inventar nome é alucinação grave.

🎯 **REGRA #0.8 — METAS EM R$ SÃO MENSAIS POR PADRÃO** 🎯

Quando a meta vem como "Renda Mensal R$ 100k", "Renda Passiva R$ 30k", "Sobra Reinvestida R$ X" — esses valores **JÁ SÃO MENSAIS**. NÃO dividir por 12.

❌ **PROIBIDO** (erro fatal observado em 02/05/2026):
- "Meta mensal de renda = R$ 100k ÷ 12 = R$ 8.333/mês" → ABSURDO. R$ 100k já é mensal.
- "R$ 30k passiva ÷ 12 = R$ 2.500/mês" → idem

✅ **CERTO:**
- "Renda Mensal R$ 100k" → meta = R$ 100.000/mês. Sem divisão.
- "Receita Anual 2026 R$ 720k" → AQUI sim divide: \`calc("720000 / 12")\` = R$ 60.000/mês piso
- "Patrimônio R$ 70M até 2041" → meta de FIM (não mensal, não anual — meta acumulada até data)

**Heurística:**
- Tem "mensal" no nome ou "R$ X / mês" ou "renda" → JÁ é mensal
- Tem "anual" / "/ano" / "Receita Anual" → DIVIDE por 12 pra ter piso mensal
- Tem "até [ano]" / "patrimônio total" → meta de chegada, não mensal nem anual

Antes de dividir QUALQUER meta por 12, mentalmente pergunte: "essa meta já tem 'mensal' no nome?"

🔍 **REGRA #0.9 — INTERPRETAR TOOL RESULT ANTES DE USAR (ANTI-PRO-RATA-CEGO)** 🔍

Quando uma tool retorna valor estranhamente baixo ou parcial, NUNCA usar cegamente. Cite o valor cru, explique o significado, e use o valor REAL.

❌ **PROIBIDO** (erro observado em 02/05/2026):
- Tool retornou "CLT R$ 1.720 (5% do mês)" — Naval USOU 1.720 nos cenários
- Mas CLT real é R$ 10.903/mês inteiro. R$ 1.720 era forecast pro-rata pelos dias restantes
- Resultado: cenário "Otimista R$ 60k" ficou irreal (subestimou em ~R$ 9k)

✅ **CERTO:**
- Tool retorna número parcial → CITA o valor cru, EXPLICA o que significa, BUSCA outra tool com valor real
- "Forecast mostra R$ 1.720 (parcial pro-rata) mas CLT mensal cheio é R$ 10.903 — vou usar R$ 10.903 nos totais"

**Sinais de tool retornando parcial/forecast (NÃO usar direto):**
- Valor MUITO menor que histórico recente (>50% abaixo da média sem causa óbvia)
- Forecast com label "parcial", "restante", "pro-rata", "% do mês"
- Cashflow projetando dias restantes em vez de mês cheio

**Quando em dúvida, chama tool com nome diferente** (\`get_prevensul_history\` vs \`get_cashflow_forecast\`) e cruza os 2.

⚖️ **REGRA #0.10 — COERÊNCIA INTERNA: MESMO CONCEITO = MESMO NÚMERO** ⚖️

Em uma mesma resposta, o MESMO conceito não pode aparecer com VALORES DIFERENTES.

❌ **PROIBIDO** (erro observado em 02/05/2026):
- Parágrafo 1: "Aluguel kitnets R$ 21.841"
- Parágrafo 3: "forecast mostra R$ 19.406 em aluguel"
- → Inconsistente. Qual é? Naval tem que escolher 1 e justificar.

✅ **CERTO:**
- Escolher 1 número. Se 2 fontes divergem, EXPLICAR: "Modelo A registra R$ 21.841 esperado; cashflow_forecast estima R$ 19.406 (pro-rata pelos dias restantes). Vou usar R$ 21.841 (Modelo A é a fonte autoritativa)."

Antes de finalizar resposta, releia mentalmente os números R$ citados. Cada conceito ("aluguel", "comissão", "caixa", "CLT") deve aparecer com UM valor. Se for diferente, ESCOLHER e JUSTIFICAR.

📚 **REGRA #-1 — FONTES DA VERDADE (consultar SEMPRE primeiro)** 📚

A memória \`fontes_da_verdade\` (priority 0) tem o mapa canônico de TODOS os tipos de dado financeiro do sistema → fonte → tabela WT7 → tool Naval. ANTES de qualquer análise, identifique:

1. **Que tipo de dado é a pergunta?** (comissão, salário, aluguel, despesa, kitnet, obra, etc)
2. **Qual a fonte canônica?** (portal externo / tela interna)
3. **Qual tabela WT7 reflete essa fonte?**
4. **Qual tool acessa essa tabela?**

Só DEPOIS de identificar isso → chame a tool.

**SEMPRE cite a fonte na resposta.** Ex: "Pelo portal de comissões..." / "Modelo A kitnets..." / "Saldo Balancete solar..." / "Pipeline em prevensul_billing..."

⚠ **Regra anti-divergência**: se projeção mensal divergir do histórico recente em mais de 5×, PARE. Provavelmente a fonte está dessincronizada (tabela WT7 desatualizada vs portal externo). NÃO construa análise em cima — chame \`audit_data_sources\` ou avise o usuário.

⚠ **Regra anti-divisão preguiçosa**: NUNCA divida pipeline_total ÷ 12 cegamente. Cada contrato em \`prevensul_billing\` tem \`installment_total\` próprio com prazos diferentes (alguns 12, outros 24, 48). Itere contrato a contrato. Se a tool retornar agregado, calcule por contrato individualmente usando \`installment_total - installment_current = parcelas restantes\`. Cap em 12 quando a janela for 12m.

🚨 **REGRA OBRIGATÓRIA — PERGUNTAS MULTI-MÊS / PROJEÇÃO** 🚨

Se a pergunta envolver fluxo de N meses, projeção, "quanto recebo em X meses", "como estarei em Y", VOCÊ DEVE OBRIGATORIAMENTE:

1. **Chamar \`audit_data_sources\` PRIMEIRO** — detecta se prevensul_billing está dessincronizado, bancos stale, etc. Se houver issues criticas, AVISE o usuário ANTES de seguir.

2. **Chamar \`get_cashflow_forecast(n_months)\`** — essa tool já ITERA contrato a contrato em prevensul_billing (não divide por 12). Use como fonte primária de receita futura.

3. **Confirmar comissão = 3% (NUNCA 12%)** — comissão Prevensul = 3% sobre pago pelo cliente. Pra contrato de R$ X em N parcelas: comissão mensal = (X/N) × 0.03. Ex: R$ 4M / 12 = R$ 333k cliente/mês × 3% = R$ 10k comissão. NÃO R$ 40k. NÃO R$ 480k. SEMPRE 3%.

3b. **NUNCA arredondar CLT pra R$ 10.000** — valor REAL é ~R$ 10.903 (varia por reajuste, 13º). Em projeções 12m a diferença é R$ 10.836 (10.903×12 - 10.000×12). Use SEMPRE o \`salary_clt\` retornado pelas tools (\`get_prevensul_history\` ou \`get_cashflow_forecast\`), não fallback fixo.

4. **Range / faixa só se baseado em histórico real** — se for dar range "R$ X a R$ Y", PRECISA ter chamado \`get_prevensul_history\` antes pra ver variabilidade. Cravar range sem fonte é PROIBIDO.

5. **Sempre citar a fonte** — "Pelo CSV portal: R$ X" / "Iterando prevensul_billing por contrato: R$ Y" / "Histórico médio (audit): R$ Z". Nunca devolver número sem dizer DE ONDE veio.

❌ **PROIBIDO** em respostas multi-mês:
- "R$ 65k–80k pipeline mensal" sem mostrar de onde saiu
- "R$ 40k contrato 4M" (matemática errada)
- "Pipeline tem R$ X" sem chamar get_prevensul_pipeline antes
- Distribuir saldo cliente ÷ N meses sem ver installment_total individual

✅ **OBRIGATÓRIO** em respostas multi-mês:
- Mostrar de onde cada número veio (tool + linha de raciocínio)
- Mostrar matemática (R$ 4M / 12 = R$ 333k cliente, × 3% = R$ 10k comissão)
- Validar: total estimado bate com média histórica recente?

🔴 **Anti-divergência reforçada (regra do 2×)**: se sua projeção mensal divergir do histórico recente em mais de **2× pra cima ou 2× pra baixo**, PARE. Não devolva resposta. Avise o usuário e chame \`audit_data_sources\`. Antes era 5× — ficou frouxo demais. Agora 2×.

🚀 **MODO PROATIVO — TOOL-FIRST, PERGUNTE DEPOIS** 🚀
Pra perguntas factuais sobre status atual ("estou no trilho?", "vou cobrir cheques?", "como vão as kitnets?", "saldo?", "comissão de junho?"), você DEVE:

1. **CHAMAR AS TOOLS RELEVANTES IMEDIATAMENTE** — não pergunte ao William saldo/data/valor que está no banco. Tool primeiro, resposta com base no que voltou.
2. **Cruzar 2-3 tools quando necessário** — fluxo de caixa = get_bank_balances + get_debts_status + get_prevensul_cycle (ou similar). Cobertura de cheques = mesma combinação.
3. **Só pergunte ao William o que NÃO ESTÁ no banco** — premissa nova ("e se eu fizer X?"), parâmetro de cenário ("quanto você quer aportar?"), confirmação de violação de regra inviolável.

❌ **EXEMPLOS DO QUE NÃO FAZER:**
- "Preciso saber o saldo BB" → ERRADO. CHAME get_bank_balances.
- "Quanto valem os cheques?" → ERRADO se a obra existe. CHAME get_debts_status + get_construction_status.
- "Quando vencem?" → ERRADO. As datas estão em debts ou construction_expenses. CHAME tool.

✅ **EXEMPLO DO QUE FAZER:**
Pergunta: "Tenho 3 cheques RWT05 a vencer. Vou cobrir?"
→ Chama get_bank_balances (saldo) + get_debts_status (cheques) + get_prevensul_cycle (próxima comissão) + get_kitnets_status (aluguel próximo mês). Depois responde com números reais cruzados.

**Confiança > confirmação.** Se você tem 8 tools cobrindo o assunto, USE-AS antes de fazer qualquer pergunta.

📅 **PRECISÃO TEMPORAL — SEMPRE confira o que é Q1/Q2/Q3/Q4:**
- Q1 = janeiro, fevereiro, março (não os últimos 3 meses)
- Q2 = abril, maio, junho
- Q3 = julho, agosto, setembro
- Q4 = outubro, novembro, dezembro
- "últimos N meses" = N meses contados a partir do mês atual pra trás

Se William perguntar "Q1/2026" e o mês atual for abril/2026, você puxa **jan+fev+mar/2026**, NUNCA fev+mar+abr.

REGRAS INVIOLÁVEIS (quebrar qualquer uma = resposta inválida):
1. **Nunca invente vetores de renda** fora da estrutura em \`negocios.md\` (WT7 Holding + T7 Sales + Prevensul empregador). Se surgir algo novo, diga: "isso não está na estrutura — pergunte ao William antes de eu considerar".
2. **Nunca invente metas ou números.** Meta-fim (R$ 70M / 2041 / R$ 200k mês) e regras invioláveis vêm de \`metas.md\`. **Qualquer número dinâmico (saldo, comissão, kitnet, obra, cartão) vem APENAS de tool — nunca da memória.** Se faltar tool ou dado, peça/avise. NUNCA estime.
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

⚠ **CRÍTICO — memórias \`metas.md\` e \`negocios.md\` foram limpas de números dinâmicos.** Se você "lembrar" de algum valor em R$ específico (R$ 272k pipeline, R$ 45k mês Prevensul, R$ 20k aluguel etc), isso é cache antigo do prompt — IGNORE e chame a tool. Memória só tem estrutura, datas, cotas e regras.

**Tools de POSIÇÃO ATUAL E TRAJETÓRIA (S1+S2):**
- **get_bank_balances** — saldo HOJE em cada banco + investimentos. USE pra "posso aportar X?", "quanto disponível?". Alerta saldos desatualizados >7d.
- **get_debts_status** — dívidas ativas + cronograma. USE pra "quanto pago de dívida este mês?", "quando termino financiamento?".
- **get_net_worth_snapshot** — patrimônio líquido total atual com breakdown. USE pra "qual meu patrimônio?".
- **get_milestone_gap** — distância vs marcos R$ 70M/2041. USE pra "estou no trilho?", "falta quanto pra próximo marco?", "CAGR exigido?", "estou atrasado?". RETORNA status atras/no_trilho/a_frente automático.

**REGRA pra perguntas de DECISÃO** ("posso aportar X?", "vendo isso?"):
1. SEMPRE chame get_bank_balances + get_debts_status PRIMEIRO
2. Cruze: caixa disponível − próxima parcela dívida = caixa real pra movimentar
3. Respeite piso R$ 100k (regra inviolável metas.md)
4. Se decisão grande, complementa com get_milestone_gap pra ver impacto na trajetória

**Tool simulate_scenario** — pra cenários "e se?":
USE quando William perguntar "e se eu fizer X?", "vale a pena Y?". Tipos:
- aportar_extra({amount, target}) — saída de caixa
- vender_imovel({amount, asset_name}) — entrada caixa, alerta automático se Blumenau
- novo_contrato_prevensul({amount, months}) — gera comissão futura mensal
- atrasar_obra({months, renda_esperada}) — perda de renda acumulada
- gastar_extra({amount}) — consome patrimônio

Retorna: posicao_antes/depois (caixa + patrimonio + cagr_2027 + cagr_2041) + impacto_mensal + alerts. Se cenário viola regra inviolável, alert é gerado mas a simulação ainda calcula — William pode ver a consequência mesmo da decisão proibida.

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
    name: "simulate_scenario",
    description:
      "Simula impacto de uma DECISÃO HIPOTÉTICA no patrimônio + caixa + trajetória vs marcos. " +
      "Cenários suportados: aportar_extra, vender_imovel, novo_contrato_prevensul, atrasar_obra, gastar_extra. " +
      "USE quando William perguntar 'e se eu fizer X?', 'vale a pena vender Y?', 'aporto Z?'. " +
      "RETORNA: caixa antes/depois, patrimônio antes/depois, impacto em CAGR, alerta se viola regra (piso R$ 100k, vender Blumenau, etc). " +
      "ATENÇÃO: NÃO modela cenários que violam regras invioláveis sem o William confirmar (ver regra de cenários).",
    input_schema: {
      type: "object",
      properties: {
        scenario_type: {
          type: "string",
          enum: ["aportar_extra", "vender_imovel", "novo_contrato_prevensul", "atrasar_obra", "gastar_extra"],
          description:
            "Tipo de cenário. " +
            "aportar_extra = cliente põe X em obra/investimento (sai do caixa). " +
            "vender_imovel = vende ativo X, entra Y no caixa. " +
            "novo_contrato_prevensul = fecha contrato R$ X, gera comissão Y/mês por Z meses. " +
            "atrasar_obra = obra X atrasa N meses, perde N×renda_esperada. " +
            "gastar_extra = gasto único de X (custeio, viagem, evento).",
        },
        params: {
          type: "object",
          description:
            "Parâmetros do cenário. Variam por tipo: " +
            "{amount, target?, months?, asset_name?}. " +
            "Ex aportar_extra: {amount: 30000, target: 'RWT05'}. " +
            "Ex vender_imovel: {amount: 1000000, asset_name: 'Blumenau'}. " +
            "Ex novo_contrato_prevensul: {amount: 600000, months: 24} (gera amount × 3% / months / mês de comissão).",
        },
      },
      required: ["scenario_type", "params"],
    },
  },
  {
    name: "get_bank_balances",
    description:
      "Saldo ATUAL em todas as contas + investimentos líquidos. " +
      "USE pra perguntas tipo: 'quanto tenho disponível agora?', 'posso aportar X?', 'meu caixa cobre Y?'. " +
      "Separa: caixa imediato (conta corrente) × aplicações líquidas (RDC, CDI). " +
      "Mostra last_updated de cada — alerta se algum saldo está desatualizado >7 dias.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_debts_status",
    description:
      "Lista todas as dívidas ativas + cronograma quando disponível. " +
      "Cada dívida pode ter 'installments' (parcelas detalhadas, ex: cheques RWT05) ou só monthly_payment + due_date (mensais regulares: Rampage, NRSX 288 parcelas, Jairo). " +
      "Quando há installments cadastrados, Naval mostra: próxima parcela pendente + total pago + total pendente + status de cada (paga/pendente/atrasada). " +
      "Sem installments, use monthly_payment + due_date pra derivar cronograma virtual (mensal). " +
      "USE pra: 'quanto pago de dívida este mês?', 'próximo cheque RWT05 vence quando?', 'cronograma de pagamentos?', 'tem parcela atrasada?', 'qual minha exposição total a dívida?'. " +
      "Sempre verifique 'installments' antes de inferir vencimentos — é fonte mais precisa que due_date+monthly_payment.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_net_worth_snapshot",
    description:
      "Patrimônio líquido ATUAL: bens (imóveis, terrenos, carros) + investimentos + saldo bancário + consórcios pagos − dívidas. " +
      "USE pra: 'qual meu patrimônio agora?', 'quanto já cresci?', composição. " +
      "Retorna breakdown por classe + total bruto + total dívidas + líquido.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_milestone_gap",
    description:
      "Distância vs marcos da meta R$ 70M / 2041. Calcula: patrimônio atual vs trajetória esperada por marco (2027=R$6,5M, 2030=R$7,75M, 2035=R$15M, 2041=R$70M). " +
      "USE pra: 'estou no trilho?', 'falta quanto pra próximo marco?', 'CAGR exigido?', 'estou atrasado?'. " +
      "Retorna por marco: gap R$, dias restantes, CAGR exigido pra esse trecho, status (no_trilho/atras/a_frente).",
    input_schema: { type: "object", properties: {} },
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
      "renda mensal esperada (cota William). Retorno tem 2 blocos: " +
      "(a) OBRA (execução: gasto_total, pct_executado, stages) — só conta lançamentos expense_kind='obra'. " +
      "(b) TERRENO (aquisição: bloco 'terreno' com total_pago, cota_william_paga, n_pagamentos) — só conta expense_kind='terreno'. " +
      "Isso evita inflar '% executado' da obra com pagamento de lote. " +
      "USE pra perguntas tipo: 'Como vai a obra X?', 'Quanto falta gastar em RWT05?', 'Estou no orçamento?', " +
      "'Quanto já paguei do terreno?', 'Quando vai entrar aluguel quando obras prontas?'. " +
      "Cruza constructions + construction_expenses + construction_stages. Filtro opcional pelo nome.",
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
      "Retorna RENDA PREVENSUL REAL (CLT + comissão) recebida nos últimos N meses. " +
      "Lê revenues com source IN ('salario', 'comissao_prevensul'). " +
      "Retorna por mês: salary_clt, commission, total — SEMPRE apresente AMBOS, não só comissão. " +
      "USE pra: 'renda Prevensul de Q1?', 'quanto vou receber em [mês]?', 'tendência', 'média mensal'. " +
      "Comissão vem em LUMP SUMS irregulares (CREDIFOZ DEPOSITO BLOQ), CLT é fixo ~R$ 10.903 (valor real, NÃO arredondar pra R$ 10k — usa o salary_clt da tool sempre). " +
      "NÃO use forecast teórico de get_prevensul_pipeline isoladamente — sempre cruzar com este histórico real. " +
      "QUANDO USUÁRIO PERGUNTAR 'renda Prevensul', responda com TOTAL (CLT+comissão), não só comissão.",
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
  {
    name: "get_kitnets_status",
    description:
      "Status real do parque de kitnets (RWT02 + RWT03 + qualquer outro residencial). " +
      "Retorna por residencial: total de unidades, ocupadas/vagas, recebimento real do mês (Modelo A — kitnet_entries reconciled), " +
      "expectativa total mensal, vacância em R$, broker takings, kitnets sem entrada lançada no mês. " +
      "USE pra: 'como vão as kitnets?', 'quanto recebi de aluguel em [mês]?', 'tenho kitnet vaga?', " +
      "'algum aluguel atrasou?', 'inadimplência'. " +
      "Modelo A é fonte da verdade — bank_transactions só valida.",
    input_schema: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: "Mês YYYY-MM. Default = mês atual.",
        },
        residencial_filter: {
          type: "string",
          description:
            "Filtra por código de residencial (busca parcial). Ex: 'RWT02', 'RWT03'. Omitir = todos.",
        },
      },
    },
  },
  {
    name: "get_current_card_invoice",
    description:
      "Fatura ATUAL e/ou recente do cartão de crédito. Por padrão retorna a fatura aberta (em formação) + a última fechada de cada cartão. " +
      "Inclui: total acumulado, breakdown por categoria, top merchants, parcelados ainda em curso (próximos meses), due_date. " +
      "USE pra: 'quanto está minha fatura?', 'fatura BB / XP', 'top gastos do cartão', 'tenho parcelado em curso?', " +
      "'quando vence próxima fatura?'. " +
      "Lê card_invoices + card_transactions. Categorias com prefixo cartao__.",
    input_schema: {
      type: "object",
      properties: {
        card_filter: {
          type: "string",
          description:
            "Filtra por cardholder (William/Esposa) ou nome do banco no card (BB/XP). Busca parcial. Omitir = todos.",
        },
        month: {
          type: "string",
          description:
            "Mês YYYY-MM (reference_month da fatura). Omitir = retorna fatura aberta + última fechada.",
        },
      },
    },
  },
  {
    name: "get_wedding_status",
    description:
      "Status do casamento 11/12/2027 (Villa Sonali, BC). Retorna: total contratado, total pago, saldo pendente, " +
      "parcelas pagas vs pendentes, próximas 3 parcelas (com due_date e supplier), parcelas em atraso, dias até o casamento. " +
      "Lê wedding_installments. " +
      "USE pra: 'como está o casamento?', 'quanto falta pagar do casamento?', 'próxima parcela do casamento?', " +
      "'algum boleto do casamento atrasou?'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_dre_monthly",
    description:
      "DRE mensal canônico. Retorna receitas (avulsas + kitnets) e despesas (custeio + obras + casamento + cartão pago) agrupadas por bucket. " +
      "Replica a lógica de useDRE.ts. " +
      "USE pra: 'DRE deste mês?', 'P&L?', 'demonstração de resultado?', 'sobra deste mês?'.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "YYYY-MM. Default: mês atual." },
      },
    },
  },
  {
    name: "get_cashflow_forecast",
    description:
      "Fluxo de caixa projetado dos próximos N meses. Combina: receitas previstas (CLT, comissões pipeline, aluguéis kitnets), despesas previstas (recurring_bills, debt_installments, obras planejadas, casamento). " +
      "USE pra: 'plano de caixa próximos meses', 'vou ter saldo?', 'quanto entra/sai em [mês]?', 'fluxo previsto'.",
    input_schema: {
      type: "object",
      properties: {
        n_months: { type: "number", description: "Meses à frente. Default 6, max 24." },
        starting_cash: { type: "number", description: "Caixa inicial (default = soma bank_accounts)." },
      },
    },
  },
  {
    name: "get_projections",
    description:
      "Projeções financeiras 3/6/12/24 meses. Combina histórico (média móvel) + pipeline confirmado + recurring + obras planejadas. " +
      "USE pra: 'projeção 12 meses?', 'onde estarei em 2 anos?', 'tendência'.",
    input_schema: {
      type: "object",
      properties: {
        n_months: { type: "number", description: "Default 12. Min 3, max 24." },
      },
    },
  },
  {
    name: "get_reconciliation_status",
    description:
      "Status de conciliação bancária no mês. Retorna: nº transações pending/matched/ignored, valor não conciliado, top categorias problemáticas. " +
      "USE pra: 'tenho transações pendentes?', 'quanto falta conciliar?', 'extrato bate com lançamentos?'.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "YYYY-MM. Default: mês atual." },
      },
    },
  },
  {
    name: "get_taxes_status",
    description:
      "Status de impostos e obrigações fiscais. Lê tabela `taxes`. Retorna: vencimentos próximos, valor pendente, atrasados. " +
      "USE pra: 'tem imposto a pagar?', 'IRPF?', 'IPTU?'. " +
      "ATENÇÃO: tabela pode estar vazia — informa explicitamente.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_strategic_plan",
    description:
      "Plano estratégico 2026-2028: marcos, obras planejadas, contratos previstos, datas-âncora. " +
      "Combina: memórias `metas.md` (R$ 70M / 2041, marcos 2027/2030/2035/2041) + `goals` table + obras em construções + pipeline contratos. " +
      "USE pra: 'plano 2026-28?', 'marcos do casamento?', 'cronograma das obras?', 'estou no trilho?'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_categories",
    description:
      "Lista categorias customizadas (`custom_categories`). Útil pra Naval saber o que existe quando classificar. " +
      "USE pra: 'que categorias tenho?', 'qual categoria certa pra isso?'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "cleanup_pipeline_old_months",
    description:
      "AÇÃO: limpa reference_months antigos da prevensul_billing, mantém apenas os N mais recentes. " +
      "Útil pra evitar acúmulo de imports históricos (que inflam o saldo total ao somar múltiplos meses do mesmo cliente). " +
      "Default mantém os 3 últimos meses (suficiente pra histórico). " +
      "USE quando: audit detectar duplicação OU William pedir 'limpa o pipeline antigo' OU após importar muitos meses.",
    input_schema: {
      type: "object",
      properties: {
        keep_last_n_months: {
          type: "number",
          description: "Quantos reference_months recentes manter. Default 3.",
        },
      },
    },
  },
  {
    name: "upsert_prevensul_billing",
    description:
      "AÇÃO: importa array de rows pra prevensul_billing com DELETE+INSERT atômico por reference_month. " +
      "Usuário envia o conteúdo do CSV/PDF como rows JSON estruturado e Naval faz upsert. " +
      "Cada row precisa ter: client_name, contract_total, balance_remaining, installment_current, installment_total, amount_paid (opcional), commission_value (opcional). " +
      "USE quando: William copiar dados de uma planilha pro chat e pedir 'importa isso'.",
    input_schema: {
      type: "object",
      properties: {
        reference_month: {
          type: "string",
          description: "Mês de referência YYYY-MM (ex: '2026-04'). Obrigatório.",
        },
        rows: {
          type: "array",
          description:
            "Array de contratos. Cada um: { client_name: string, contract_total: number, balance_remaining: number, installment_current?: number, installment_total?: number, amount_paid?: number, commission_value?: number, contract_nf?: string, closing_date?: string (YYYY-MM-DD), status?: string }",
          items: { type: "object" },
        },
      },
      required: ["reference_month", "rows"],
    },
  },
  {
    name: "get_active_goals",
    description:
      "Lista todas as metas ativas (multi-período: mensal/semestral/anual/3y/5y/10y/custom). " +
      "Pra cada meta, calcula current_value automaticamente baseado em (metric, period_start, period_end): " +
      "metric='revenue' soma revenues+kitnet_entries no período; metric='patrimony' usa get_net_worth_snapshot; " +
      "metric='savings' agrega sobra reinvestida. Retorna progresso %. " +
      "USE pra: 'estou no caminho da meta?', 'quanto falta pra X?', 'metas ativas?'.",
    input_schema: {
      type: "object",
      properties: {
        metric_filter: {
          type: "string",
          description: "Filtra por métrica (revenue/patrimony/savings/profit/renda_passiva). Omitir = todas.",
        },
        period_filter: {
          type: "string",
          description: "Filtra por period_type (monthly/yearly/3y/etc). Omitir = todas.",
        },
      },
    },
  },
  {
    name: "parse_task_nlp",
    description:
      "AÇÃO: parse linguagem natural → daily_task estruturada. " +
      "Recebe texto livre tipo 'amanhã 14h ligar Premoldi' ou 'toda segunda 8h audit Naval' e retorna { title, due_date, due_time, vector, recurrence }. " +
      "Se houver palavra de recorrência ('toda', 'todo dia', 'sempre'), retorna recurrence_rule. " +
      "USE quando William digitar input no Stream do Dia. " +
      "NÃO insere no banco — só parse. Frontend faz INSERT depois de confirmar.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Texto livre do usuário (obrigatório)." },
        reference_date: { type: "string", description: "Data de referência YYYY-MM-DD pra resolver 'amanhã'/'sex'/etc. Default = hoje." },
      },
      required: ["text"],
    },
  },
  {
    name: "promote_alert_to_task",
    description:
      "AÇÃO: promove naval_alert (severity critical/warning) em daily_task pendente. " +
      "Cria row em daily_tasks com source='naval_promoted' + related_alert_id. " +
      "Stream do Dia mostra essas tasks com badge especial. " +
      "USE quando audit_data_sources retornar issues critical e William pedir 'transforma em tasks' OU automaticamente via cron diário. " +
      "Idempotente: se task já existe pra esse alert_id, retorna a existente.",
    input_schema: {
      type: "object",
      properties: {
        alert_id: { type: "string", description: "UUID do naval_alert (obrigatório)." },
        due_date: { type: "string", description: "Data alvo YYYY-MM-DD. Default = hoje." },
        due_time: { type: "string", description: "Horário HH:MM (opcional)." },
      },
      required: ["alert_id"],
    },
  },
  {
    name: "update_pipeline_stage",
    description:
      "AÇÃO: atualiza pipeline_stage de um contrato em prevensul_billing. " +
      "Stages válidos: quente, proposta, fechando, ganho, perdido. " +
      "USE quando William disser 'marca Premoldi como fechando' ou similar.",
    input_schema: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "Nome do cliente (busca parcial case-insensitive)." },
        stage: {
          type: "string",
          description: "Novo stage (quente/proposta/fechando/ganho/perdido).",
          enum: ["quente", "proposta", "fechando", "ganho", "perdido"],
        },
      },
      required: ["client_name", "stage"],
    },
  },
  {
    name: "audit_data_sources",
    description:
      "Audita sincronização de dados: detecta dessincronização entre tabelas WT7 e fontes canônicas. " +
      "Verifica: prevensul_billing (saldo dessincronizado de CSV), bank_accounts (last_updated stale), celesc_invoices (faturas atrasadas), kitnet_entries (mês corrente sem fechamento). " +
      "USE pra: 'meus dados estão atualizados?', 'tem alguma fonte stale?'. " +
      "CHAME ANTES de análises grandes pra detectar fundação podre.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "link_bank_tx_to_construction_expense",
    description:
      "AÇÃO: vincula manualmente um bank_transaction a um construction_expense quando o trigger automático não bateu (ex: data fora da janela ±10 dias, valor com diferença grande). " +
      "Ao vincular, o bank_tx NÃO gera expense duplicada no DRE — fica reconciliado direto com o gasto da obra. " +
      "USE quando o William disser 'esse pix de R$ 3k é o material da obra X', 'liga essa transferência ao gasto Y da obra Z'. " +
      "Quando possível, deixa o auto-match do trigger fazer o trabalho — usa essa tool só pra exceções.",
    input_schema: {
      type: "object",
      properties: {
        bank_tx_id: { type: "string", description: "UUID do bank_transaction (obrigatório)." },
        construction_expense_id: { type: "string", description: "UUID do construction_expense alvo (obrigatório)." },
      },
      required: ["bank_tx_id", "construction_expense_id"],
    },
  },
  {
    name: "mark_installment_paid",
    description:
      "AÇÃO DESTRUTIVA: marca uma parcela de dívida (debt_installment) como paga. " +
      "Atualiza paid_at, paid_amount, e o trigger no banco recalcula automaticamente debts.remaining_amount. " +
      "USE quando William disser 'marca o cheque 20/05 como pago', 'pago a parcela 1 do RWT05', etc. " +
      "REQUER: identificar a parcela exata (debt_id + sequence_number, ou debt_installment_id direto). " +
      "Se a parcela já foi auto-vinculada via trigger (bank_tx do extrato bateu por valor+data), não precisa chamar — Naval avisa.",
    input_schema: {
      type: "object",
      properties: {
        debt_installment_id: {
          type: "string",
          description: "ID UUID direto da debt_installment. Use se já tem.",
        },
        debt_name_filter: {
          type: "string",
          description:
            "Nome (parcial) da debt pra busca: 'RWT05', 'terreno', etc. Use junto com sequence_number.",
        },
        sequence_number: {
          type: "number",
          description: "Número da parcela (1, 2, 3...) dentro da debt. Use junto com debt_name_filter.",
        },
        paid_date: {
          type: "string",
          description: "Data do pagamento YYYY-MM-DD. Default = hoje.",
        },
        paid_amount: {
          type: "number",
          description: "Valor pago em R$. Default = amount original da parcela.",
        },
      },
    },
  },
  {
    name: "get_recurring_bills",
    description:
      "Contas fixas mensais ativas (recurring_bills): aluguel apt, internet, telefone, condomínio, academia, etc. " +
      "Agrupa por categoria, total mensal, lista os top 10 itens, alerta de vencimentos próximos. " +
      "USE pra: 'quanto pago de fixo todo mês?', 'minhas contas recorrentes', 'quais contas vencem essa semana?', " +
      "'composição do meu custeio fixo'.",
    input_schema: {
      type: "object",
      properties: {
        category_filter: {
          type: "string",
          description: "Filtra por categoria (ex: 'telefonia', 'imovel', 'consorcio'). Omitir = todas.",
        },
      },
    },
  },
  {
    name: "get_other_commissions_status",
    description:
      "Status das comissões EXTERNAS à Prevensul (other_commissions): consultorias, parcerias, indicações. " +
      "Retorna: total contratado, comissão a receber (saldo de installments pendentes), comissão recebida no histórico, " +
      "próximas 5 parcelas a vencer (data, fonte, valor), parcelas em atraso. " +
      "USE pra: 'quanto tenho de comissão extra a receber?', 'comissões fora Prevensul', 'próxima parcela R7?', " +
      "'comissões externas no mês X'.",
    input_schema: {
      type: "object",
      properties: {
        source_filter: {
          type: "string",
          description: "Filtra por fonte (ex: 'Consultoria', 'R7'). Busca parcial. Omitir = todas.",
        },
      },
    },
  },
  {
    name: "get_consortium_status",
    description:
      "Status dos consórcios ativos (Ademicon imóveis, Randon caminhões, NREG, etc). " +
      "Retorna: por consórcio, valor de crédito, total pago vs pendente, parcelas pagas / restantes, " +
      "data fim, ownership_pct (cota William em consórcio com sócio), tipo de ativo (imóveis/veículos), " +
      "fundo comum/taxa adm/seguro pagos. " +
      "USE pra: 'como está o consórcio Ademicon?', 'quanto já paguei de consórcio?', 'quando termina meu consórcio?', " +
      "'consórcios totais cota William'.",
    input_schema: {
      type: "object",
      properties: {
        name_filter: {
          type: "string",
          description: "Filtra por nome (ex: 'Ademicon', 'Randon'). Busca parcial. Omitir = todos.",
        },
      },
    },
  },
  {
    name: "calc",
    description:
      "AÇÃO: avalia expressão aritmética determinística. USE OBRIGATORIAMENTE pra QUALQUER cálculo numérico — soma, subtração, multiplicação, divisão, %, raiz, potência. " +
      "NUNCA escreva uma operação aritmética inline sem chamar esta tool antes (ex: NÃO escrever '720000-304803=415197' direto na resposta). " +
      "Se a operação envolve R$, %, contagem, projeção, divisão de pipeline, soma de comissões — passa por aqui. " +
      "Aceita expressões JS-like: '+', '-', '*', '/', '%', '(', ')', '.', ','. Ex: '720000 - 304803', '(28547 + 10903 + 1050 + 21840)', '15000 / 28547 * 100'. " +
      "Retorna { expression, result, formatted } com o número exato.",
    input_schema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Expressão matemática. Ex: '720000 - 304803' ou '(28547+10903)*0.97'",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "get_investments_status",
    description:
      "Status dos investimentos líquidos (RDC/CDI/renda fixa/etc): por investimento mostra current_amount, " +
      "rescue_amount (valor resgatável hoje, com possível haircut), rate (CDI%, fixo%), maturidade. " +
      "Total caixa imediato + total liquidez emergencial. " +
      "USE pra: 'quanto tenho aplicado?', 'qual investimento rende mais?', 'liquidez emergencial?', " +
      "'meu colchão líquido'. " +
      "OBS: get_bank_balances já dá saldo banco + investimentos resumido — esse aqui é detalhe profundo só de aplicações.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_energy_solar_status",
    description:
      "Status FINANCEIRO da Energia Solar (RWT02 + RWT03). MODELO DE NEGÓCIO: " +
      "William paga a fatura Celesc real e cobra dos inquilinos uma tarifa fixa por kWh consumido. " +
      "A diferença é LUCRO MENSAL desse vetor. Saldo Solar = cobrado_inquilinos − fatura_celesc. " +
      "Tabelas: celesc_invoices.amount_paid (custo) + SUM(energy_readings.amount_to_charge) por residencial (receita). " +
      "Retorna por residencial: saldo mensal R$, fatura, cobrança total, n leituras, histórico mês a mês. " +
      "USE pra: 'como está a energia solar?', 'quanto a solar deu de lucro este mês?', " +
      "'saldo solar?', 'fatura Celesc?', 'cobrança dos inquilinos?'. " +
      "NÃO É análise técnica de geração (kWh) — É análise FINANCEIRA do vetor.",
    input_schema: {
      type: "object",
      properties: {
        residencial_filter: {
          type: "string",
          description: "Filtra por código residencial (RWT02, RWT03). Omitir = todos.",
        },
        n_months: {
          type: "number",
          description: "Quantos meses de histórico. Default 6, max 24.",
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

// ─── Handler: simulate_scenario ──────────────────────────────────────
async function handleSimulateScenario(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const scenarioType = String(input.scenario_type ?? "");
  const params = (input.params as Record<string, unknown>) ?? {};
  const amount = Number((params as any).amount ?? 0);

  // Posição atual (reusa lógica)
  const snap = await calcNetWorth(supabaseUrl, serviceKey);

  const banksR = await sb.from("bank_accounts").select("balance");
  const invsR = await sb.from("investments").select("rescue_amount");
  const caixaImediato = (banksR.data ?? []).reduce((s: number, b: any) => s + Number(b.balance ?? 0), 0);
  const caixaResgateImediato = (invsR.data ?? []).reduce((s: number, i: any) => s + Number(i.rescue_amount ?? 0), 0);
  const caixaTotal = caixaImediato + caixaResgateImediato;

  const PISO_CAIXA = 100_000;
  const alerts: string[] = [];
  let caixaDepois = caixaTotal;
  let patrimonioDepois = snap.patrimonio_liquido;
  let impactoMensal = 0;
  let descricao = "";

  switch (scenarioType) {
    case "aportar_extra": {
      const target = String((params as any).target ?? "obra");
      caixaDepois = caixaTotal - amount;
      // Aporte em obra vira ativo: patrimônio se mantém (transfere caixa pra construção)
      // Mas como construções já estão em assets pelo valor estimado, considero patrimonio neutro
      patrimonioDepois = snap.patrimonio_liquido;
      descricao = `Aportar R$ ${amount.toLocaleString("pt-BR")} em ${target}`;
      if (caixaDepois < PISO_CAIXA) alerts.push(`⚠ VIOLA REGRA INVIOLÁVEL: caixa cairia pra R$ ${caixaDepois.toLocaleString("pt-BR")} (abaixo do piso R$ 100k). Não recomendado.`);
      break;
    }
    case "vender_imovel": {
      const asset = String((params as any).asset_name ?? "imóvel");
      caixaDepois = caixaTotal + amount;
      patrimonioDepois = snap.patrimonio_liquido; // entrada caixa = saída ativo, neutro
      descricao = `Vender ${asset} por R$ ${amount.toLocaleString("pt-BR")}`;
      if (asset.toLowerCase().includes("blumenau")) {
        alerts.push("⚠⚠ VIOLA REGRA INVIOLÁVEL #4: 'Nunca recomendar vender Blumenau nos próximos 3 anos (até 2029)'. Confirme com William antes de modelar consequências.");
      }
      break;
    }
    case "novo_contrato_prevensul": {
      const months = Number((params as any).months ?? 24);
      const comissaoTotal = amount * 0.03;
      impactoMensal = comissaoTotal / months;
      descricao = `Fechar contrato Prevensul de R$ ${amount.toLocaleString("pt-BR")} em ${months} meses → R$ ${comissaoTotal.toLocaleString("pt-BR")} comissão total = R$ ${impactoMensal.toFixed(0)}/mês`;
      break;
    }
    case "atrasar_obra": {
      const months = Number((params as any).months ?? 6);
      const rendaEsperada = Number((params as any).renda_esperada ?? 5000);
      const perdaRenda = months * rendaEsperada;
      impactoMensal = -rendaEsperada;
      descricao = `Obra atrasa ${months} meses → perde R$ ${perdaRenda.toLocaleString("pt-BR")} de renda acumulada`;
      break;
    }
    case "gastar_extra": {
      caixaDepois = caixaTotal - amount;
      patrimonioDepois = snap.patrimonio_liquido - amount; // gasto consome patrimônio
      descricao = `Gasto único de R$ ${amount.toLocaleString("pt-BR")}`;
      if (caixaDepois < PISO_CAIXA) alerts.push(`⚠ Caixa cairia pra R$ ${caixaDepois.toLocaleString("pt-BR")} (abaixo do piso R$ 100k).`);
      break;
    }
    default:
      return JSON.stringify({ error: `scenario_type '${scenarioType}' não suportado. Use: aportar_extra, vender_imovel, novo_contrato_prevensul, atrasar_obra, gastar_extra.` });
  }

  // Impacto na trajetória (CAGR vs marcos)
  const today = new Date();
  const milestone2027 = new Date("2027-12-11");
  const milestone2041 = new Date("2041-12-31");
  const yearsTo2027 = (milestone2027.getTime() - today.getTime()) / (86400000 * 365.25);
  const yearsTo2041 = (milestone2041.getTime() - today.getTime()) / (86400000 * 365.25);
  const cagr2027Antes = patrimonioDepois > 0 && yearsTo2027 > 0 ? (Math.pow(6_500_000 / snap.patrimonio_liquido, 1 / yearsTo2027) - 1) * 100 : null;
  const cagr2027Depois = patrimonioDepois > 0 && yearsTo2027 > 0 ? (Math.pow(6_500_000 / patrimonioDepois, 1 / yearsTo2027) - 1) * 100 : null;
  const cagr2041Antes = snap.patrimonio_liquido > 0 && yearsTo2041 > 0 ? (Math.pow(70_000_000 / snap.patrimonio_liquido, 1 / yearsTo2041) - 1) * 100 : null;
  const cagr2041Depois = patrimonioDepois > 0 && yearsTo2041 > 0 ? (Math.pow(70_000_000 / patrimonioDepois, 1 / yearsTo2041) - 1) * 100 : null;

  return JSON.stringify({
    scenario: descricao,
    posicao_antes: {
      caixa_total: Math.round(caixaTotal * 100) / 100,
      patrimonio_liquido: snap.patrimonio_liquido,
      cagr_2027_exigido: cagr2027Antes != null ? Math.round(cagr2027Antes * 10) / 10 : null,
      cagr_2041_exigido: cagr2041Antes != null ? Math.round(cagr2041Antes * 10) / 10 : null,
    },
    posicao_depois: {
      caixa_total: Math.round(caixaDepois * 100) / 100,
      patrimonio_liquido: Math.round(patrimonioDepois * 100) / 100,
      cagr_2027_exigido: cagr2027Depois != null ? Math.round(cagr2027Depois * 10) / 10 : null,
      cagr_2041_exigido: cagr2041Depois != null ? Math.round(cagr2041Depois * 10) / 10 : null,
    },
    impacto_mensal_caixa: Math.round(impactoMensal * 100) / 100,
    alerts,
    note: "Simulação simplificada: 'aportar_extra' assume aporte vira ativo equivalente (patrimônio neutro). 'vender_imovel' = caixa entra, ativo sai (neutro). 'gastar_extra' = consome patrimônio. CAGR exigido recalcula vs marcos R$ 6,5M/2027 e R$ 70M/2041.",
  });
}

// ─── Handler: get_bank_balances ──────────────────────────────────────
async function handleGetBankBalances(
  _input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);

  const [banks, invs] = await Promise.all([
    sb.from("bank_accounts").select("bank_name, account_type, balance, last_updated, notes").order("balance", { ascending: false }),
    sb.from("investments").select("name, type, bank, current_amount, rescue_amount, cdi_percent, maturity_date").order("current_amount", { ascending: false }),
  ]);

  const today = new Date();
  const banksOut = (banks.data ?? []).map((b: any) => {
    const days = b.last_updated ? Math.floor((today.getTime() - new Date(b.last_updated).getTime()) / 86400000) : null;
    return {
      bank: b.bank_name,
      account_type: b.account_type,
      balance: Math.round(Number(b.balance ?? 0) * 100) / 100,
      last_updated: b.last_updated,
      days_outdated: days,
      stale: days != null && days > 7,
      notes: b.notes,
    };
  });
  const totalBank = banksOut.reduce((s, b) => s + b.balance, 0);

  const invsOut = (invs.data ?? []).map((i: any) => ({
    name: i.name,
    type: i.type,
    bank: i.bank,
    current_amount: Math.round(Number(i.current_amount ?? 0) * 100) / 100,
    rescue_amount: Math.round(Number(i.rescue_amount ?? 0) * 100) / 100,
    cdi_percent: i.cdi_percent,
    maturity_date: i.maturity_date,
  }));
  const totalInv = invsOut.reduce((s, i) => s + i.current_amount, 0);
  const totalRescue = invsOut.reduce((s, i) => s + i.rescue_amount, 0);

  return JSON.stringify({
    summary: {
      caixa_imediato: Math.round(totalBank * 100) / 100,
      aplicado_marcado: Math.round(totalInv * 100) / 100,
      aplicado_resgate_imediato: Math.round(totalRescue * 100) / 100,
      total_disponivel_agora: Math.round((totalBank + totalRescue) * 100) / 100,
      n_bancos: banksOut.length,
      n_aplicacoes: invsOut.length,
      bancos_desatualizados: banksOut.filter((b) => b.stale).length,
    },
    bank_accounts: banksOut,
    investments: invsOut,
    note: "caixa_imediato = saldo bancos. aplicado_resgate_imediato = valor que pode resgatar hoje (se diferente do current pode ter perda de juros). total_disponivel = caixa + resgate.",
  });
}

// ─── Handler: get_debts_status ──────────────────────────────────────
async function handleGetDebtsStatus(
  _input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const { data } = await sb
    .from("debts")
    .select("id, name, creditor, total_amount, remaining_amount, monthly_payment, due_date, status")
    .neq("status", "paid")
    .order("remaining_amount", { ascending: false });
  const debts = data ?? [];

  // Pega installments existentes (só dívidas que TÊM cronograma cadastrado)
  const debtIds = debts.map((d: any) => d.id);
  let installmentsByDebt = new Map<string, any[]>();
  if (debtIds.length > 0) {
    const { data: insts } = await sb
      .from("debt_installments")
      .select("debt_id, sequence_number, due_date, amount, paid_at, paid_amount, notes")
      .in("debt_id", debtIds)
      .order("sequence_number", { ascending: true });
    for (const i of insts ?? []) {
      const arr = installmentsByDebt.get((i as any).debt_id) ?? [];
      arr.push(i);
      installmentsByDebt.set((i as any).debt_id, arr);
    }
  }

  const today = new Date();
  const debtsOut = debts.map((d: any) => {
    const due = d.due_date ? new Date(d.due_date) : null;
    const monthsLeft = due ? Math.max(0, Math.round((due.getTime() - today.getTime()) / (86400000 * 30))) : null;

    const insts = installmentsByDebt.get(d.id) ?? [];
    let installmentsBlock: any = null;
    let nextDue: any = null;
    if (insts.length > 0) {
      const paid = insts.filter((i: any) => i.paid_at);
      const pending = insts.filter((i: any) => !i.paid_at);
      const totalPaid = paid.reduce((s: number, i: any) => s + Number(i.paid_amount ?? i.amount ?? 0), 0);
      const totalPending = pending.reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);
      nextDue = pending.length > 0 ? pending[0] : null;

      installmentsBlock = {
        n_installments: insts.length,
        n_paid: paid.length,
        n_pending: pending.length,
        total_paid_amount: Math.round(totalPaid * 100) / 100,
        total_pending_amount: Math.round(totalPending * 100) / 100,
        schedule: insts.map((i: any) => {
          const dueDate = new Date(i.due_date);
          const diasParaVencer = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
          const isOverdue = !i.paid_at && dueDate < today;
          return {
            sequence: i.sequence_number,
            due_date: i.due_date,
            amount: Math.round(Number(i.amount ?? 0) * 100) / 100,
            paid_at: i.paid_at,
            paid_amount: i.paid_amount ? Math.round(Number(i.paid_amount) * 100) / 100 : null,
            status: i.paid_at ? "paga" : isOverdue ? "atrasada" : "pendente",
            days_until_due: i.paid_at ? null : diasParaVencer,
            notes: i.notes,
          };
        }),
      };
    }

    return {
      id: d.id,
      name: d.name,
      creditor: d.creditor,
      total_amount: Math.round(Number(d.total_amount ?? 0) * 100) / 100,
      remaining_amount: Math.round(Number(d.remaining_amount ?? 0) * 100) / 100,
      monthly_payment: Math.round(Number(d.monthly_payment ?? 0) * 100) / 100,
      due_date: d.due_date,
      months_until_due: monthsLeft,
      status: d.status,
      next_installment_due_date: nextDue?.due_date ?? null,
      next_installment_amount: nextDue ? Math.round(Number(nextDue.amount ?? 0) * 100) / 100 : null,
      installments: installmentsBlock,
    };
  });

  const totalRemaining = debtsOut.reduce((s, d) => s + d.remaining_amount, 0);
  const totalMonthly = debtsOut.reduce((s, d) => s + d.monthly_payment, 0);

  return JSON.stringify({
    summary: {
      n_debts_active: debtsOut.length,
      total_remaining: Math.round(totalRemaining * 100) / 100,
      total_monthly_payment: Math.round(totalMonthly * 100) / 100,
      n_debts_with_schedule: debtsOut.filter((d) => d.installments).length,
    },
    debts: debtsOut,
    note:
      "Dívidas com 'installments' têm cronograma detalhado por parcela (ex: RWT05). " +
      "Sem installments, use monthly_payment + due_date — Naval pode derivar cronograma virtual se a dívida é mensal regular (Rampage, NRSX). " +
      "next_installment_due_date é a próxima parcela pendente quando há schedule cadastrado.",
  });
}

// ─── Handler: get_net_worth_snapshot ─────────────────────────────────
type NetWorthSnap = {
  bens_total: number;
  investimentos_total: number;
  saldo_bancos: number;
  imoveis_total_cota_william: number;
  consorcios_pagos: number;
  bruto_total: number;
  dividas_total: number;
  patrimonio_liquido: number;
};
async function calcNetWorth(supabaseUrl: string, serviceKey: string): Promise<NetWorthSnap> {
  const sb = createClient(supabaseUrl, serviceKey);
  const [assetsR, invsR, banksR, propsR, consR, debtsR] = await Promise.all([
    sb.from("assets").select("estimated_value"),
    sb.from("investments").select("current_amount"),
    sb.from("bank_accounts").select("balance"),
    sb.from("real_estate_properties").select("property_value, ownership_pct"),
    sb.from("consortiums").select("total_paid, ownership_pct, status").in("status", ["ativo", "contemplado", "active", "paid_off"]),
    sb.from("debts").select("remaining_amount, status").neq("status", "paid"),
  ]);

  const assets = (assetsR.data ?? []).reduce((s: number, a: any) => s + Number(a.estimated_value ?? 0), 0);
  const invs = (invsR.data ?? []).reduce((s: number, i: any) => s + Number(i.current_amount ?? 0), 0);
  const banks = (banksR.data ?? []).reduce((s: number, b: any) => s + Number(b.balance ?? 0), 0);
  const props = (propsR.data ?? []).reduce((s: number, p: any) => {
    const pct = p.ownership_pct == null ? 100 : Number(p.ownership_pct);
    return s + Number(p.property_value ?? 0) * (pct / 100);
  }, 0);
  const cons = (consR.data ?? []).reduce((s: number, c: any) => {
    const pct = c.ownership_pct == null ? 100 : Number(c.ownership_pct);
    return s + Number(c.total_paid ?? 0) * (pct / 100);
  }, 0);
  const debts = (debtsR.data ?? []).reduce((s: number, d: any) => s + Number(d.remaining_amount ?? 0), 0);

  const bruto = assets + invs + banks + props + cons;
  return {
    bens_total: Math.round(assets * 100) / 100,
    investimentos_total: Math.round(invs * 100) / 100,
    saldo_bancos: Math.round(banks * 100) / 100,
    imoveis_total_cota_william: Math.round(props * 100) / 100,
    consorcios_pagos: Math.round(cons * 100) / 100,
    bruto_total: Math.round(bruto * 100) / 100,
    dividas_total: Math.round(debts * 100) / 100,
    patrimonio_liquido: Math.round((bruto - debts) * 100) / 100,
  };
}

async function handleGetNetWorthSnapshot(
  _input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const snap = await calcNetWorth(supabaseUrl, serviceKey);
  return JSON.stringify({ snapshot_at: new Date().toISOString(), ...snap });
}

// ─── Handler: get_milestone_gap ──────────────────────────────────────
async function handleGetMilestoneGap(
  _input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const snap = await calcNetWorth(supabaseUrl, serviceKey);
  const current = snap.patrimonio_liquido;

  // Marcos canônicos da memoria/metas.md
  const milestones = [
    { name: "Marco 2027 (Casamento)", date: "2027-12-11", target: 6_500_000 },
    { name: "Marco 2030 (Consolidação)", date: "2030-12-31", target: 7_750_000 },
    { name: "Marco 2035 (Meio do Caminho)", date: "2035-12-31", target: 15_000_000 },
    { name: "Marco 2041 (Destino)", date: "2041-12-31", target: 70_000_000 },
  ];

  const today = new Date();
  const out = milestones.map((m) => {
    const milestone = new Date(m.date);
    const yearsLeft = (milestone.getTime() - today.getTime()) / (86400000 * 365.25);
    const gap = m.target - current;
    const cagrExigido = current > 0 && yearsLeft > 0 ? (Math.pow(m.target / current, 1 / yearsLeft) - 1) * 100 : null;
    let status: "no_trilho" | "atras" | "a_frente" | "atingido" = "no_trilho";
    if (current >= m.target) status = "atingido";
    else if (cagrExigido != null) {
      if (cagrExigido > 25) status = "atras";
      else if (cagrExigido < 10) status = "a_frente";
    }
    return {
      milestone: m.name,
      date: m.date,
      target: m.target,
      current_net_worth: current,
      gap_remaining: Math.round(gap * 100) / 100,
      years_until: Math.round(yearsLeft * 10) / 10,
      cagr_required_pct: cagrExigido != null ? Math.round(cagrExigido * 10) / 10 : null,
      status,
      multiplier_needed: current > 0 ? Math.round((m.target / current) * 100) / 100 : null,
    };
  });

  // CAGR atual estimado: assume crescimento constante desde acquisition_date mais antigo
  // Simplificação: usa valor da memoria (R$ 5,76M abr/2026 conforme metas.md) como ancora
  return JSON.stringify({
    today: today.toISOString().slice(0, 10),
    patrimonio_liquido_atual: current,
    breakdown: snap,
    milestones: out,
    cagr_target_overall_pct: 17.3,
    note: "CAGR exigido = (target/atual)^(1/anos) - 1. status: atras=cagr>25%/aa, a_frente=cagr<10%/aa, no_trilho=resto, atingido=já passou. Pra retomar sequência, foque na ação que reduz o gap do marco mais próximo.",
  });
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

  // 1) Busca obras (sem ilike no DB — filtro robusto no JS depois pra
  // tolerar nomes com espaços/acentos/case: "RWT05" casa com "Residencial
  // RWT 05 & Corrêa", "rwt-05", "RWT 05" etc.)
  let q = sb.from("constructions").select(
    "id, name, status, ownership_pct, partner_name, total_budget, land_total_amount, total_units_planned, total_units_built, total_units_rented, estimated_rent_per_unit, start_date, estimated_completion, end_date",
  );
  if (!includeCompleted) q = q.neq("status", "concluida");

  const { data: allConstructions, error: ec } = await q;
  if (ec) return JSON.stringify({ error: `constructions query: ${ec.message}` });

  // Normaliza pra comparação: lowercase + remove acentos + remove tudo
  // que não é letra/número. Tolera "Residencial RWT 05 & Corrêa" vs "RWT05".
  const normalize = (s: string) =>
    (s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // diacríticos combinados (NFD divide acentos)
      .replace(/[^a-z0-9]/g, "");
  const filterNorm = filter ? normalize(filter) : null;

  const constructions = filterNorm
    ? (allConstructions ?? []).filter((c: any) => normalize(c.name).includes(filterNorm))
    : (allConstructions ?? []);

  if (!constructions || constructions.length === 0) {
    const allNames = (allConstructions ?? []).map((c: any) => c.name).slice(0, 10);
    return JSON.stringify({
      constructions: [],
      summary: { total: 0 },
      note: filter
        ? `Nenhuma obra encontrada com filtro '${filter}' (filtro normalizado: '${filterNorm}'). Obras existentes: ${allNames.join(" | ")}`
        : "Nenhuma obra em andamento.",
    });
  }

  // 2) Pra cada obra, busca expenses + stages
  const today = new Date();
  const out: any[] = [];
  for (const c of constructions as any[]) {
    const cota = Number(c.ownership_pct ?? 100);
    const orcadoTotal = Number(c.total_budget ?? 0);
    const terrenoTotalContratado = Number(c.land_total_amount ?? 0);

    // Expenses (lançamentos sem expense_kind = legado, contam como 'obra')
    const { data: exps } = await sb.from("construction_expenses")
      .select("total_amount, william_amount, partner_amount, expense_date, description, category, stage_id, expense_kind")
      .eq("construction_id", c.id);
    const allExps = exps ?? [];
    const obraExps    = allExps.filter((e: any) => (e.expense_kind ?? "obra") === "obra");
    const terrenoExps = allExps.filter((e: any) => e.expense_kind === "terreno");

    // Obra (execução) — alimenta orçamento/% executado
    const gastoTotal   = obraExps.reduce((s: number, e: any) => s + Number(e.total_amount ?? 0), 0);
    const gastoWilliam = obraExps.reduce((s: number, e: any) => s + Number(e.william_amount ?? 0), 0);
    const pctExecutado = orcadoTotal > 0 ? (gastoTotal / orcadoTotal) * 100 : 0;
    const orcadoCotaW = orcadoTotal * (cota / 100);
    const restanteCotaW = Math.max(0, orcadoCotaW - gastoWilliam);

    // Terreno (aquisição) — bloco separado, NÃO infla % executado
    const terrenoTotal       = terrenoExps.reduce((s: number, e: any) => s + Number(e.total_amount ?? 0), 0);
    const terrenoWilliam     = terrenoExps.reduce((s: number, e: any) => s + Number(e.william_amount ?? 0), 0);
    const terrenoPartner     = terrenoExps.reduce((s: number, e: any) => s + Number(e.partner_amount ?? 0), 0);
    const terrenoLastDate    = terrenoExps.length > 0
      ? terrenoExps.reduce((d: string, e: any) => (e.expense_date ?? "") > d ? (e.expense_date ?? "") : d, "")
      : null;

    // Stages
    const { data: stages } = await sb.from("construction_stages")
      .select("id, name, status, pct_complete, budget_estimated, order_index, start_date, end_date")
      .eq("construction_id", c.id)
      .order("order_index", { ascending: true });

    // Gasto real por stage (somando SÓ obra com stage_id — terreno não tem stage)
    const gastoPorStage = new Map<string, { total: number; william: number }>();
    for (const e of obraExps) {
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
      // OBRA (execução) — orçamento/gasto/% só consideram expense_kind='obra'
      orcado_total: Math.round(orcadoTotal * 100) / 100,
      orcado_cota_william: Math.round(orcadoCotaW * 100) / 100,
      gasto_total: Math.round(gastoTotal * 100) / 100,
      gasto_cota_william: Math.round(gastoWilliam * 100) / 100,
      restante_cota_william: Math.round(restanteCotaW * 100) / 100,
      pct_executado: Math.round(pctExecutado * 10) / 10,
      // TERRENO (aquisição) — separado pra não inflar % executado da obra
      terreno: {
        total_contratado: Math.round(terrenoTotalContratado * 100) / 100,
        total_pago: Math.round(terrenoTotal * 100) / 100,
        saldo_pendente: terrenoTotalContratado > 0
          ? Math.round((terrenoTotalContratado - terrenoTotal) * 100) / 100
          : null,
        pct_pago: terrenoTotalContratado > 0
          ? Math.round((terrenoTotal / terrenoTotalContratado) * 100 * 10) / 10
          : null,
        cota_william_paga: Math.round(terrenoWilliam * 100) / 100,
        cota_socio_paga: Math.round(terrenoPartner * 100) / 100,
        n_pagamentos: terrenoExps.length,
        last_payment_date: terrenoLastDate || null,
      },
      total_units_planned: units,
      total_units_built: c.total_units_built,
      estimated_rent_per_unit: Math.round(rentPerUnit * 100) / 100,
      renda_total_mensal_quando_pronta: Math.round(rendaTotalMensal * 100) / 100,
      renda_cota_william_mensal: Math.round(rendaCotaWMensal * 100) / 100,
      start_date: c.start_date,
      eta: c.estimated_completion,
      meses_decorridos: mesesDecorridos,
      meses_restantes: mesesRestantes,
      n_expenses_obra: obraExps.length,
      n_expenses_terreno: terrenoExps.length,
      stages: stagesOut,
      proxima_etapa: proxima ? { name: proxima.name, budget: proxima.budget_estimated, pct_complete: proxima.pct_complete } : null,
      sinais_alerta: sinais,
    });
  }

  // 3) Sumário geral
  const summary = {
    total_obras: out.length,
    // OBRA (execução)
    total_orcado_cota_william: Math.round(out.reduce((s, c) => s + c.orcado_cota_william, 0) * 100) / 100,
    total_gasto_cota_william: Math.round(out.reduce((s, c) => s + c.gasto_cota_william, 0) * 100) / 100,
    total_restante_cota_william: Math.round(out.reduce((s, c) => s + c.restante_cota_william, 0) * 100) / 100,
    // TERRENO (aquisição) — só pagamentos lançados; saldo a pagar pode estar em debts
    total_terreno_pago_cota_william: Math.round(out.reduce((s, c) => s + (c.terreno?.cota_william_paga ?? 0), 0) * 100) / 100,
    n_obras_com_pagamento_terreno: out.filter((c) => (c.terreno?.n_pagamentos ?? 0) > 0).length,
    total_units_planned: out.reduce((s, c) => s + (c.total_units_planned ?? 0), 0),
    renda_total_mensal_cota_william_quando_todas_prontas: Math.round(out.reduce((s, c) => s + c.renda_cota_william_mensal, 0) * 100) / 100,
    obras_com_alerta: out.filter((c) => c.sinais_alerta.length > 0).length,
  };

  return JSON.stringify({
    summary,
    constructions: out,
    note:
      "OBRA (orcado/gasto/% executado) considera SÓ lançamentos com expense_kind='obra' (mão de obra, materiais, execução). " +
      "TERRENO (bloco terreno{}) considera lançamentos com expense_kind='terreno' (aquisição, parcelas/cheques do lote). " +
      "Saldo a pagar do terreno (parcelas pendentes) NÃO está aqui — verifique tabela 'debts' se cadastrada.",
  });
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

  // Renda Prevensul = CLT salário + comissão. Pega ambos.
  const { data, error } = await sb.from("revenues")
    .select("amount, received_at, source, description, reference_month, business_id")
    .in("source", ["comissao_prevensul", "salario"])
    .gte("reference_month", startMonth);

  if (error) {
    return JSON.stringify({ error: `revenues query failed: ${error.message}` });
  }

  // Agrupa por reference_month + separa salário × comissão
  const byMonth = new Map<string, {
    salary: number;
    commission: number;
    total: number;
    deposits: Array<{ date: string; amount: number; description: string; tipo: string }>;
  }>();
  for (const r of data ?? []) {
    const month = (r as any).reference_month as string;
    if (!month) continue;
    const src = (r as any).source as string;
    const amt = Number((r as any).amount ?? 0);
    const cur = byMonth.get(month) ?? { salary: 0, commission: 0, total: 0, deposits: [] };
    if (src === "salario") cur.salary += amt;
    else cur.commission += amt;
    cur.total += amt;
    cur.deposits.push({
      date: (r as any).received_at,
      amount: amt,
      description: (r as any).description ?? "",
      tipo: src === "salario" ? "CLT" : "comissao",
    });
    byMonth.set(month, cur);
  }

  // Preenche meses sem nenhum recebimento (zeros explícitos)
  const months: Array<{
    month: string;
    salary_clt: number;
    commission: number;
    total: number;
    n_deposits: number;
    deposits: Array<{ date: string; amount: number; description: string; tipo: string }>;
  }> = [];
  for (let i = startIdx; i <= curIdx; i++) {
    const m = idxToMonth(i);
    const entry = byMonth.get(m);
    months.push({
      month: m,
      salary_clt: entry ? Math.round(entry.salary * 100) / 100 : 0,
      commission: entry ? Math.round(entry.commission * 100) / 100 : 0,
      total: entry ? Math.round(entry.total * 100) / 100 : 0,
      n_deposits: entry ? entry.deposits.length : 0,
      deposits: entry ? entry.deposits.sort((a, b) => b.amount - a.amount).slice(0, 5) : [],
    });
  }

  // Estatísticas (no TOTAL = CLT + comissão)
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

  // Breakdowns separados pra clareza
  const totalSalary = months.reduce((s, m) => s + m.salary_clt, 0);
  const totalCommission = months.reduce((s, m) => s + m.commission, 0);

  return JSON.stringify({
    n_months: months.length,
    note:
      "Renda Prevensul = SALÁRIO CLT (~R$ 10.903/mês — valor REAL, NÃO arredondar pra R$ 10k; source=salario) + COMISSÃO (3% sobre pagos, source=comissao_prevensul). " +
      "Sempre apresente AMBOS — não confunda renda total com só comissão.",
    by_month: months,
    statistics_total: {
      total_period: Math.round(sum * 100) / 100,
      total_salary_clt: Math.round(totalSalary * 100) / 100,
      total_commission: Math.round(totalCommission * 100) / 100,
      average_monthly_total: Math.round(avg * 100) / 100,
      median_monthly_total: Math.round(median * 100) / 100,
      min_monthly_total: Math.round(min * 100) / 100,
      max_monthly_total: Math.round(max * 100) / 100,
      months_with_zero_total: monthsWithZero,
      variability_index: Math.round(variability * 100) / 100,
    },
    interpretation: {
      pattern: monthsWithZero > 0
        ? "IRREGULAR — alguns meses zeram comissão (lump sums acumulados em outros). NÃO use média como previsão de comissão."
        : (variability > 1.5
          ? "VOLÁTIL — diferença max/min > 1.5×. Use mediana, não média. Indique range."
          : "ESTÁVEL — receita relativamente uniforme."),
      recommendation: monthsWithZero > 0 || variability > 1.5
        ? "Pra forecast: indique RANGE [min, max] em vez de valor único. Avise sobre variabilidade. CLT é estável, comissão é volátil."
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

  // CRÍTICO: pega APENAS o reference_month mais recente. Senão soma
  // imports históricos do mesmo cliente em meses diferentes = pipeline
  // inflado. Cada CSV mensal é a foto atual do pipeline.
  const { data: latestMonthRow } = await sb
    .from("prevensul_billing")
    .select("reference_month")
    .order("reference_month", { ascending: false })
    .limit(1);
  const latestMonth = (latestMonthRow ?? [])[0]?.reference_month;

  let query = sb.from("prevensul_billing")
    .select("client_name, contract_total, balance_remaining, commission_rate, commission_value, status, reference_month, installment_current, installment_total, closing_date");

  if (latestMonth) query = query.eq("reference_month", latestMonth);
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

// ─── Handler: get_kitnets_status ─────────────────────────────────────
async function handleGetKitnetsStatus(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const month = (input.month as string) || new Date().toISOString().slice(0, 7);
  const residencialFilter = (input.residencial_filter as string) || null;

  const knQuery = sb
    .from("kitnets")
    .select("id, residencial_code, unit_number, code, tenant_name, rent_value, status");
  const { data: kitnets } = await knQuery;
  const allKitnets = kitnets ?? [];

  const filtered = residencialFilter
    ? allKitnets.filter((k: any) =>
        (k.residencial_code || "").toLowerCase().includes(residencialFilter.toLowerCase()),
      )
    : allKitnets;

  // Herança de status: pega TODOS overrides ≤ month, ordena DESC, fica com o mais recente por kitnet
  // (mesma lógica do useKitnets/Opção B). Sem isso, kitnet locada em abril aparece "vacant" em maio.
  const { data: monthStatuses } = await sb
    .from("kitnet_month_status")
    .select("kitnet_id, status, reference_month")
    .lte("reference_month", month)
    .order("reference_month", { ascending: false });
  const effectiveStatusMap: Record<string, string> = {};
  for (const r of (monthStatuses ?? [])) {
    if (!(r.kitnet_id in effectiveStatusMap)) {
      effectiveStatusMap[r.kitnet_id] = r.status;
    }
  }

  const { data: entries } = await sb
    .from("kitnet_entries")
    .select("kitnet_id, total_liquid, rent_gross, reconciled, reconciled_at, period_end, tenant_name, broker_name")
    .eq("reference_month", month);
  const allEntries = entries ?? [];

  const entryByKitnet = new Map<string, any>();
  for (const e of allEntries) entryByKitnet.set(e.kitnet_id, e);

  const byResidencial = new Map<string, {
    code: string;
    total_units: number;
    occupied: number;
    vacant: number;
    entries_lancadas: number;
    entries_reconciled: number;
    received_real: number;
    received_pending: number;
    expected_total: number;
    sem_lancamento: string[];
  }>();

  for (const k of filtered) {
    const code = k.residencial_code || "?";
    if (!byResidencial.has(code)) {
      byResidencial.set(code, {
        code,
        total_units: 0,
        occupied: 0,
        vacant: 0,
        entries_lancadas: 0,
        entries_reconciled: 0,
        received_real: 0,
        received_pending: 0,
        expected_total: 0,
        sem_lancamento: [],
      });
    }
    const r = byResidencial.get(code)!;
    r.total_units++;
    // Status efetivo: override do mês > último override anterior > k.status default > "vacant"
    const status = (effectiveStatusMap[k.id] ?? k.status ?? "vacant").toLowerCase();
    if (status === "occupied") r.occupied++;
    else if (status === "vacant" || status === "available") r.vacant++;
    r.expected_total += Number(k.rent_value ?? 0);

    const entry = entryByKitnet.get(k.id);
    if (entry) {
      r.entries_lancadas++;
      const liquid = Number(entry.total_liquid ?? 0);
      if (entry.reconciled) {
        r.entries_reconciled++;
        r.received_real += liquid;
      } else {
        r.received_pending += liquid;
      }
    } else if (status === "occupied") {
      r.sem_lancamento.push(k.code || `${code}-${k.unit_number}`);
    }
  }

  const residenciais = Array.from(byResidencial.values()).map((r) => ({
    residencial: r.code,
    total_units: r.total_units,
    occupied: r.occupied,
    vacant: r.vacant,
    entries_lancadas: r.entries_lancadas,
    entries_reconciled: r.entries_reconciled,
    received_real: Math.round(r.received_real * 100) / 100,
    received_pending: Math.round(r.received_pending * 100) / 100,
    expected_total: Math.round(r.expected_total * 100) / 100,
    vacancia_perdida: Math.round((r.vacant / Math.max(r.total_units, 1)) * 100),
    kitnets_sem_lancamento: r.sem_lancamento,
  }));

  const totalReceived = residenciais.reduce((s, r) => s + r.received_real, 0);
  const totalPending = residenciais.reduce((s, r) => s + r.received_pending, 0);
  const totalExpected = residenciais.reduce((s, r) => s + r.expected_total, 0);
  const totalUnits = residenciais.reduce((s, r) => s + r.total_units, 0);
  const totalOccupied = residenciais.reduce((s, r) => s + r.occupied, 0);
  const totalVacant = residenciais.reduce((s, r) => s + r.vacant, 0);

  const allSemLancamento: string[] = [];
  for (const r of residenciais) allSemLancamento.push(...r.kitnets_sem_lancamento);

  return JSON.stringify({
    month,
    summary: {
      total_units: totalUnits,
      occupied: totalOccupied,
      vacant: totalVacant,
      occupancy_pct: totalUnits ? Math.round((totalOccupied / totalUnits) * 100) : 0,
      received_real_modelo_a: Math.round(totalReceived * 100) / 100,
      received_pending_modelo_a: Math.round(totalPending * 100) / 100,
      expected_total: Math.round(totalExpected * 100) / 100,
      gap_vs_expected: Math.round((totalReceived + totalPending - totalExpected) * 100) / 100,
      kitnets_ocupadas_sem_lancamento_no_mes: allSemLancamento.length,
      lista_sem_lancamento: allSemLancamento,
    },
    by_residencial: residenciais,
    note:
      "Modelo A (kitnet_entries reconciled) é fonte da verdade. " +
      "received_pending = lançado mas ainda não conciliado com extrato. " +
      "kitnets_ocupadas_sem_lancamento = locador não criou entry no mês — pode ser atraso ou esquecimento.",
  });
}

// ─── Handler: get_current_card_invoice ────────────────────────────────
async function handleGetCurrentCardInvoice(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const cardFilter = (input.card_filter as string) || null;
  const monthFilter = (input.month as string) || null;

  const cardsRes = await sb.from("cards").select("id, name, bank, last4, holder, holder_name").limit(50);
  const cards = cardsRes.data ?? [];
  const cardById = new Map<string, any>();
  for (const c of cards) cardById.set(c.id, c);

  let invQuery = sb
    .from("card_invoices")
    .select(
      "id, card_id, reference_month, closing_date, due_date, total_amount, paid_amount, paid_at, closed_at, file_format",
    )
    .order("reference_month", { ascending: false });
  if (monthFilter) invQuery = invQuery.eq("reference_month", monthFilter);
  else invQuery = invQuery.limit(20);
  const invRes = await invQuery;
  let invoices = invRes.data ?? [];

  if (cardFilter) {
    const f = cardFilter.toLowerCase();
    invoices = invoices.filter((inv: any) => {
      const c = cardById.get(inv.card_id);
      if (!c) return false;
      const blob = `${c.name ?? ""} ${c.bank ?? ""} ${c.holder ?? ""} ${c.holder_name ?? ""}`.toLowerCase();
      return blob.includes(f);
    });
  }

  if (!monthFilter) {
    const seen = new Set<string>();
    const filtered: any[] = [];
    for (const inv of invoices) {
      const k = inv.card_id;
      if (!seen.has(k)) {
        filtered.push(inv);
        seen.add(k);
      } else {
        const count = filtered.filter((x) => x.card_id === k).length;
        if (count < 2) filtered.push(inv);
      }
    }
    invoices = filtered;
  }

  if (invoices.length === 0) {
    return JSON.stringify({ found: 0, invoices: [], note: "Nenhuma fatura encontrada com esses filtros." });
  }

  const invoiceIds = invoices.map((i: any) => i.id);
  const { data: txs } = await sb
    .from("card_transactions")
    .select(
      "invoice_id, transaction_date, description, merchant_normalized, amount, installment_current, installment_total, category_id, vector",
    )
    .in("invoice_id", invoiceIds);
  const allTxs = txs ?? [];

  const today = new Date();

  const invoicesOut = invoices.map((inv: any) => {
    const card = cardById.get(inv.card_id);
    const invTxs = allTxs.filter((t: any) => t.invoice_id === inv.id);

    const byCategory = new Map<string, number>();
    const merchants = new Map<string, number>();
    let installmentsActive = 0;
    let installmentsRemainingTotal = 0;

    for (const t of invTxs) {
      const amt = Number(t.amount ?? 0);
      const cat = t.category_id ? String(t.category_id) : "sem_categoria";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + amt);
      const m = t.merchant_normalized || t.description || "?";
      merchants.set(m, (merchants.get(m) ?? 0) + amt);

      if (t.installment_total && t.installment_total > 1 && t.installment_current && t.installment_current < t.installment_total) {
        installmentsActive++;
        const remain = (t.installment_total - t.installment_current) * amt;
        installmentsRemainingTotal += remain;
      }
    }

    const topMerchants = Array.from(merchants.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ merchant: name, total: Math.round(total * 100) / 100 }));

    const total = Number(inv.total_amount ?? 0);
    const paid = Number(inv.paid_amount ?? 0);
    const isPaid = !!inv.paid_at;
    const isClosed = !!inv.closed_at;
    const due = inv.due_date ? new Date(inv.due_date) : null;
    const daysToDue = due ? Math.ceil((due.getTime() - today.getTime()) / 86400000) : null;
    const status = isPaid
      ? "paga"
      : isClosed
        ? daysToDue != null && daysToDue < 0
          ? "vencida"
          : "fechada_aguardando_pagamento"
        : "aberta";

    return {
      card: {
        bank: card?.bank,
        name: card?.name,
        last4: card?.last4,
        holder: card?.holder ?? card?.holder_name,
      },
      reference_month: inv.reference_month,
      status,
      total_amount: Math.round(total * 100) / 100,
      paid_amount: Math.round(paid * 100) / 100,
      paid_at: inv.paid_at,
      closing_date: inv.closing_date,
      closed_at: inv.closed_at,
      due_date: inv.due_date,
      days_until_due: daysToDue,
      n_transactions: invTxs.length,
      installments_active: installmentsActive,
      installments_remaining_amount: Math.round(installmentsRemainingTotal * 100) / 100,
      top_merchants: topMerchants,
    };
  });

  const totalAcrossInvoices = invoicesOut.reduce((s, i) => s + i.total_amount, 0);

  return JSON.stringify({
    found: invoicesOut.length,
    summary: {
      total_invoices: invoicesOut.length,
      total_amount_across: Math.round(totalAcrossInvoices * 100) / 100,
      n_unpaid: invoicesOut.filter((i) => i.status !== "paga").length,
    },
    invoices: invoicesOut,
    note:
      "Sem month_filter retorna fatura aberta + última fechada de cada cartão. " +
      "installments_remaining_amount = parcelas futuras já compradas mas ainda não cobradas em faturas seguintes.",
  });
}

// ─── Handler: get_wedding_status ──────────────────────────────────────
async function handleGetWeddingStatus(
  _input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const { data } = await sb
    .from("wedding_installments")
    .select("description, supplier, due_date, amount, paid_at, status")
    .order("due_date", { ascending: true });
  const installments = data ?? [];

  const today = new Date();
  const wedding_date = new Date("2027-12-11");
  const daysToWedding = Math.ceil((wedding_date.getTime() - today.getTime()) / 86400000);

  const total = installments.reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);
  const paid = installments.filter((i: any) => i.paid_at).reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);
  const pending = total - paid;

  const overdue = installments.filter((i: any) => {
    if (i.paid_at) return false;
    if (!i.due_date) return false;
    return new Date(i.due_date) < today;
  });
  const overdueTotal = overdue.reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);

  const upcoming = installments
    .filter((i: any) => !i.paid_at && i.due_date && new Date(i.due_date) >= today)
    .slice(0, 5)
    .map((i: any) => {
      const due = new Date(i.due_date);
      const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
      return {
        description: i.description,
        supplier: i.supplier,
        due_date: i.due_date,
        amount: Math.round(Number(i.amount ?? 0) * 100) / 100,
        days_until_due: days,
        status: i.status,
      };
    });

  const bySupplier = new Map<string, { total: number; paid: number; pending: number }>();
  for (const i of installments) {
    const s = i.supplier || "?";
    if (!bySupplier.has(s)) bySupplier.set(s, { total: 0, paid: 0, pending: 0 });
    const e = bySupplier.get(s)!;
    const amt = Number(i.amount ?? 0);
    e.total += amt;
    if (i.paid_at) e.paid += amt;
    else e.pending += amt;
  }
  const suppliersOut = Array.from(bySupplier.entries()).map(([supplier, v]) => ({
    supplier,
    total: Math.round(v.total * 100) / 100,
    paid: Math.round(v.paid * 100) / 100,
    pending: Math.round(v.pending * 100) / 100,
    pct_pago: v.total > 0 ? Math.round((v.paid / v.total) * 100) : 0,
  }));

  return JSON.stringify({
    wedding_date: "2027-12-11",
    days_until_wedding: daysToWedding,
    summary: {
      total_contratado: Math.round(total * 100) / 100,
      total_pago: Math.round(paid * 100) / 100,
      saldo_pendente: Math.round(pending * 100) / 100,
      pct_pago: total > 0 ? Math.round((paid / total) * 100) : 0,
      n_installments: installments.length,
      n_paid: installments.filter((i: any) => i.paid_at).length,
      n_pending: installments.filter((i: any) => !i.paid_at).length,
      n_overdue: overdue.length,
      total_overdue: Math.round(overdueTotal * 100) / 100,
    },
    overdue: overdue.map((i: any) => ({
      description: i.description,
      supplier: i.supplier,
      due_date: i.due_date,
      amount: Math.round(Number(i.amount ?? 0) * 100) / 100,
    })),
    upcoming_5_installments: upcoming,
    by_supplier: suppliersOut,
    note:
      "Casamento 11/12/2027 Villa Sonali, BC. Liquidez do casamento é regra inviolável (metas.md): nunca comprometer.",
  });
}

// ─── Handler: link_bank_tx_to_construction_expense ───────────────────
async function handleLinkBankTxToConstructionExpense(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const bankTxId = input.bank_tx_id as string;
  const ceId = input.construction_expense_id as string;

  if (!bankTxId || !ceId) {
    return JSON.stringify({ ok: false, error: "Forneça bank_tx_id e construction_expense_id." });
  }

  // Valida que ambos existem
  const [{ data: bt }, { data: ce }] = await Promise.all([
    sb.from("bank_transactions").select("id, amount, date, description, matched_expense_id, matched_construction_expense_id").eq("id", bankTxId).single(),
    sb.from("construction_expenses").select("id, total_amount, expense_date, description, construction_id").eq("id", ceId).single(),
  ]);

  if (!bt) return JSON.stringify({ ok: false, error: `bank_transaction ${bankTxId} não existe.` });
  if (!ce) return JSON.stringify({ ok: false, error: `construction_expense ${ceId} não existe.` });

  if ((bt as any).matched_construction_expense_id) {
    return JSON.stringify({
      ok: false,
      error: `bank_tx já está vinculado a construction_expense ${(bt as any).matched_construction_expense_id}. Desvincula manualmente antes via SQL.`,
    });
  }

  // Vincula
  const update: any = { matched_construction_expense_id: ceId };
  // Se também tem expense duplicada, desvincula (pra evitar contagem dupla no DRE)
  if ((bt as any).matched_expense_id) {
    update.matched_expense_id = null;
  }
  const { error: updErr } = await sb.from("bank_transactions").update(update).eq("id", bankTxId);
  if (updErr) return JSON.stringify({ ok: false, error: `Falha ao vincular: ${updErr.message}` });

  return JSON.stringify({
    ok: true,
    message: `bank_tx (${formatCurrencyBR((bt as any).amount)}, ${(bt as any).date}) vinculado a construction_expense da obra.`,
    bank_tx: { id: bankTxId, amount: (bt as any).amount, date: (bt as any).date, description: (bt as any).description },
    construction_expense: { id: ceId, amount: (ce as any).total_amount, date: (ce as any).expense_date, description: (ce as any).description },
    note: (bt as any).matched_expense_id
      ? "Tinha matched_expense_id antiga (duplicação) — desvinculei. Considere DELETE da expense duplicada se ainda existir."
      : "Vínculo criado. Sem duplicação detectada.",
  });
}

function formatCurrencyBR(n: number): string {
  return `R$ ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ═══════════════════════════════════════════════════════════════════
// HANDLERS NOVOS v31 — Cobertura completa do sidebar (DRE, Cashflow,
// Projeções, Reconciliação, Impostos, Plano Estratégico, Categorias, Audit)
// ═══════════════════════════════════════════════════════════════════

async function handleGetDREMonthly(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const month = (input.month as string) || new Date().toISOString().slice(0, 7);
  const [yy, mm] = month.split("-").map(Number);
  const nextMonth = mm === 12 ? `${yy + 1}-01` : `${yy}-${String(mm + 1).padStart(2, "0")}`;
  const monthStart = `${month}-01`;
  const nextStart = `${nextMonth}-01`;

  // RECEITAS
  const [{ data: revs }, { data: kitEntries }] = await Promise.all([
    sb.from("revenues").select("amount, source, counts_as_income").eq("reference_month", month),
    sb.from("kitnet_entries").select("total_liquid, reconciled").eq("reference_month", month),
  ]);
  const receitaAvulsa = (revs ?? [])
    .filter((r: any) => r.counts_as_income !== false && r.source !== "aluguel_kitnets")
    .reduce((s: number, r: any) => s + Number(r.amount), 0);
  const receitaKitnets = (kitEntries ?? [])
    .filter((k: any) => k.reconciled)
    .reduce((s: number, k: any) => s + Number(k.total_liquid ?? 0), 0);
  const receitaTotal = receitaAvulsa + receitaKitnets;

  // DESPESAS expenses (excluindo card_payment + investimentos)
  const { data: exps } = await sb
    .from("expenses")
    .select("amount, category, counts_as_investment, vector, is_card_payment, nature, description")
    .eq("reference_month", month);

  let custeio = 0;
  let obras = 0;
  let casamento = 0;
  let outros_aportes = 0;
  let eventos = 0;
  for (const e of exps ?? []) {
    const v = Number((e as any).amount);
    if ((e as any).is_card_payment) continue;
    if ((e as any).nature === "transfer") continue;
    const cat = ((e as any).category || "").toLowerCase();
    const vec = ((e as any).vector || "").toLowerCase();
    if (cat.includes("obra") || vec.includes("wt7") || (e as any).counts_as_investment) {
      if (cat.includes("casamento") || vec.includes("casamento")) casamento += v;
      else if (cat.includes("evento")) eventos += v;
      else if (cat.includes("obra") || vec.includes("wt7")) obras += v;
      else outros_aportes += v;
    } else {
      custeio += v;
    }
  }

  // CARTÃO regime caixa (faturas pagas no mês)
  const { data: paidInvs } = await sb
    .from("card_invoices")
    .select("id, paid_amount, total_amount")
    .gte("paid_at", monthStart)
    .lt("paid_at", nextStart);
  const paidInvIds = (paidInvs ?? []).map((i: any) => i.id);
  let custeio_cartao = 0;
  let invest_cartao = 0;
  if (paidInvIds.length > 0) {
    const { data: txs } = await sb
      .from("card_transactions")
      .select("amount, counts_as_investment, vector")
      .in("invoice_id", paidInvIds);
    for (const t of txs ?? []) {
      const v = Number((t as any).amount);
      if ((t as any).counts_as_investment) invest_cartao += v;
      else custeio_cartao += v;
    }
  }

  // CONSTRUCTION expenses do mês (cota William)
  const { data: cExps } = await sb
    .from("construction_expenses")
    .select("william_amount, expense_kind")
    .gte("expense_date", monthStart)
    .lt("expense_date", nextStart);
  const obras_william = (cExps ?? []).reduce((s: number, e: any) => s + Number(e.william_amount ?? 0), 0);

  // CASAMENTO pago no mês
  const { data: weddPaid } = await sb
    .from("wedding_installments")
    .select("amount")
    .gte("paid_at", monthStart)
    .lt("paid_at", nextStart);
  const casamento_pago_mes = (weddPaid ?? []).reduce((s: number, w: any) => s + Number(w.amount ?? 0), 0);

  const custeio_total = custeio + custeio_cartao;
  const investimento_total = obras + obras_william + invest_cartao + outros_aportes;
  const sobra_bruta = receitaTotal - custeio_total;
  const sobra_pct = receitaTotal > 0 ? (sobra_bruta / receitaTotal) * 100 : 0;
  const investido_pct = receitaTotal > 0 ? (investimento_total / receitaTotal) * 100 : 0;

  return JSON.stringify({
    month,
    fonte: "DRE canônico WT7. Modelo A para kitnets. Regime caixa para cartão.",
    receitas: {
      total: Math.round(receitaTotal * 100) / 100,
      avulsa: Math.round(receitaAvulsa * 100) / 100,
      aluguel_kitnets_modelo_a: Math.round(receitaKitnets * 100) / 100,
    },
    despesas: {
      custeio_total: Math.round(custeio_total * 100) / 100,
      custeio_expenses: Math.round(custeio * 100) / 100,
      custeio_cartao_pago: Math.round(custeio_cartao * 100) / 100,
      obras: Math.round((obras + obras_william) * 100) / 100,
      casamento: Math.round((casamento + casamento_pago_mes) * 100) / 100,
      eventos: Math.round(eventos * 100) / 100,
      outros_aportes: Math.round(outros_aportes * 100) / 100,
      invest_cartao: Math.round(invest_cartao * 100) / 100,
    },
    resultado: {
      investimento_total: Math.round(investimento_total * 100) / 100,
      sobra_bruta: Math.round(sobra_bruta * 100) / 100,
      sobra_pct_potencial: Math.round(sobra_pct * 10) / 10,
      investido_pct_real: Math.round(investido_pct * 10) / 10,
      meta_pct: 50,
      gap_meta_50pct: Math.max(0, Math.round((receitaTotal * 0.5 - investimento_total) * 100) / 100),
    },
  });
}

async function handleGetCashflowForecast(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const nMonths = Math.min(Math.max(Number(input.n_months) || 6, 1), 24);

  // Saldo inicial = bank_accounts soma
  let startingCash = Number(input.starting_cash ?? 0);
  if (!startingCash) {
    const { data: banks } = await sb.from("bank_accounts").select("balance");
    startingCash = (banks ?? []).reduce((s: number, b: any) => s + Number(b.balance ?? 0), 0);
  }

  const today = new Date();
  const startIdx = today.getFullYear() * 12 + today.getMonth();

  // Receitas previstas
  // 1. Recurring bills (categoria receita? não, é despesa) — só despesas
  // 2. Aluguel kitnets — assume estável (média últimos 3m)
  const { data: kitHistory } = await sb
    .from("kitnet_entries")
    .select("total_liquid, reconciled, reference_month")
    .eq("reconciled", true);
  const monthsRecent: Record<string, number> = {};
  for (const k of kitHistory ?? []) {
    const m = (k as any).reference_month;
    monthsRecent[m] = (monthsRecent[m] ?? 0) + Number((k as any).total_liquid ?? 0);
  }
  const recentMonths = Object.values(monthsRecent).slice(-3);
  const aluguelMedia = recentMonths.length > 0 ? recentMonths.reduce((s, v) => s + v, 0) / recentMonths.length : 20000;

  // 3. CLT estimado
  const { data: clt } = await sb
    .from("revenues")
    .select("amount")
    .eq("source", "salario")
    .order("received_at", { ascending: false })
    .limit(3);
  const cltMedia = (clt ?? []).length > 0
    ? (clt ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0) / (clt ?? []).length
    : 10903;

  // 4. Comissões Prevensul futuras (calcula por contrato individual)
  const { data: pipe } = await sb
    .from("prevensul_billing")
    .select("client_name, contract_total, balance_remaining, commission_rate, installment_total, installment_current, closing_date");
  const commissionByMonth = new Map<string, number>();
  for (const p of pipe ?? []) {
    const remaining = Number((p as any).installment_total ?? 0) - Number((p as any).installment_current ?? 0);
    if (remaining <= 0) continue;
    const mensal = Number((p as any).contract_total ?? 0) / Number((p as any).installment_total ?? 1);
    const rate = Number((p as any).commission_rate ?? 0.03);
    const commPerMonth = mensal * rate;
    const closing = (p as any).closing_date ? new Date((p as any).closing_date) : today;
    for (let m = 0; m < remaining; m++) {
      const dt = new Date(closing.getFullYear(), closing.getMonth() + m + 1, 1); // +1 mês delay
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      commissionByMonth.set(key, (commissionByMonth.get(key) ?? 0) + commPerMonth);
    }
  }

  // Despesas previstas
  const { data: recurring } = await sb.from("recurring_bills").select("amount, due_day").eq("active", true);
  const fixoMensal = (recurring ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

  const { data: debtInsts } = await sb
    .from("debt_installments")
    .select("due_date, amount, paid_at")
    .is("paid_at", null);
  const debtByMonth = new Map<string, number>();
  for (const d of debtInsts ?? []) {
    const dt = new Date((d as any).due_date);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    debtByMonth.set(key, (debtByMonth.get(key) ?? 0) + Number((d as any).amount ?? 0));
  }

  const { data: weddInsts } = await sb
    .from("wedding_installments")
    .select("due_date, amount, paid_at")
    .is("paid_at", null);
  const weddByMonth = new Map<string, number>();
  for (const w of weddInsts ?? []) {
    if (!(w as any).due_date) continue;
    const dt = new Date((w as any).due_date);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    weddByMonth.set(key, (weddByMonth.get(key) ?? 0) + Number((w as any).amount ?? 0));
  }

  // Monta forecast
  const forecast: any[] = [];
  let runningCash = startingCash;
  for (let i = 0; i < nMonths; i++) {
    const idx = startIdx + i;
    const yyM = Math.floor(idx / 12);
    const mmM = (idx % 12) + 1;
    const key = `${yyM}-${String(mmM).padStart(2, "0")}`;
    const comm = commissionByMonth.get(key) ?? 0;
    const debt = debtByMonth.get(key) ?? 0;
    const wedd = weddByMonth.get(key) ?? 0;
    const entradas = aluguelMedia + cltMedia + comm;
    const saidas = fixoMensal + debt + wedd;
    const liquido = entradas - saidas;
    runningCash += liquido;
    forecast.push({
      month: key,
      entradas: {
        aluguel_kitnets: Math.round(aluguelMedia * 100) / 100,
        clt: Math.round(cltMedia * 100) / 100,
        comissao_prevensul_pipeline: Math.round(comm * 100) / 100,
        total: Math.round(entradas * 100) / 100,
      },
      saidas: {
        recurring_fixo: Math.round(fixoMensal * 100) / 100,
        debt_installments: Math.round(debt * 100) / 100,
        casamento: Math.round(wedd * 100) / 100,
        total: Math.round(saidas * 100) / 100,
      },
      liquido_mes: Math.round(liquido * 100) / 100,
      caixa_acumulado: Math.round(runningCash * 100) / 100,
    });
  }

  return JSON.stringify({
    fonte: "Cashflow forecast: aluguel_média(3m últimos) + CLT_média + comissão pipeline (por contrato) + recurring_bills + debt_installments + wedding pendente",
    starting_cash: Math.round(startingCash * 100) / 100,
    n_months: nMonths,
    forecast,
    note: "Cartão NÃO incluído no fixo (regime caixa, varia mês a mês). Custeio variável também não.",
  });
}

async function handleGetProjections(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const nMonths = Math.min(Math.max(Number(input.n_months) || 12, 3), 24);

  // Histórico últimos 6m (revenues + kitnets)
  const today = new Date();
  const startIdx = today.getFullYear() * 12 + today.getMonth() - 5;
  const histMonths: string[] = [];
  for (let i = 0; i < 6; i++) {
    const idx = startIdx + i;
    histMonths.push(`${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`);
  }

  const [{ data: revs }, { data: kits }] = await Promise.all([
    sb.from("revenues").select("amount, source, reference_month, counts_as_income").in("reference_month", histMonths),
    sb.from("kitnet_entries").select("total_liquid, reference_month, reconciled").in("reference_month", histMonths),
  ]);

  let totalReceitaHist = 0;
  for (const r of revs ?? []) {
    if ((r as any).counts_as_income !== false && (r as any).source !== "aluguel_kitnets") {
      totalReceitaHist += Number((r as any).amount);
    }
  }
  for (const k of kits ?? []) {
    if ((k as any).reconciled) totalReceitaHist += Number((k as any).total_liquid ?? 0);
  }
  const mediaReceitaMensalHist = totalReceitaHist / 6;

  // Custeio histórico (média 6m)
  const { data: exps } = await sb
    .from("expenses")
    .select("amount, counts_as_investment, is_card_payment, nature, reference_month")
    .in("reference_month", histMonths);
  let totalCusteioHist = 0;
  for (const e of exps ?? []) {
    if ((e as any).is_card_payment) continue;
    if ((e as any).nature === "transfer") continue;
    if ((e as any).counts_as_investment) continue;
    totalCusteioHist += Number((e as any).amount);
  }
  const mediaCusteioHist = totalCusteioHist / 6;

  // Projeção linear (sem inflação)
  const proj: any[] = [];
  let cumulReceita = 0;
  let cumulCusteio = 0;
  for (let i = 1; i <= nMonths; i++) {
    cumulReceita += mediaReceitaMensalHist;
    cumulCusteio += mediaCusteioHist;
    proj.push({
      mes: i,
      receita_estimada: Math.round(mediaReceitaMensalHist * 100) / 100,
      custeio_estimado: Math.round(mediaCusteioHist * 100) / 100,
      sobra_estimada: Math.round((mediaReceitaMensalHist - mediaCusteioHist) * 100) / 100,
      acumulado_receita: Math.round(cumulReceita * 100) / 100,
      acumulado_sobra: Math.round((cumulReceita - cumulCusteio) * 100) / 100,
    });
  }

  return JSON.stringify({
    fonte: "Projeção linear baseada em média 6m de histórico real (revenues + kitnet_entries reconciled - expenses custeio)",
    n_months: nMonths,
    historico_base: {
      meses_analisados: 6,
      media_receita_mensal: Math.round(mediaReceitaMensalHist * 100) / 100,
      media_custeio_mensal: Math.round(mediaCusteioHist * 100) / 100,
      media_sobra_mensal: Math.round((mediaReceitaMensalHist - mediaCusteioHist) * 100) / 100,
    },
    projecao: proj,
    avisos: [
      "Não considera inflação, novos contratos ou mudanças estruturais.",
      "Pra cenários mais sofisticados use simulate_scenario.",
      "Pra projeção de comissão Prevensul use get_cashflow_forecast (cruza pipeline real por contrato).",
    ],
  });
}

async function handleGetReconciliationStatus(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const month = (input.month as string) || new Date().toISOString().slice(0, 7);
  const [yy, mm] = month.split("-").map(Number);
  const nextMonth = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
  const monthStart = `${month}-01`;

  const { data: txs } = await sb
    .from("bank_transactions")
    .select("status, amount, type, category_intent, description")
    .gte("date", monthStart)
    .lt("date", nextMonth);

  const byStatus: Record<string, { count: number; total: number }> = {};
  for (const t of txs ?? []) {
    const s = (t as any).status || "unknown";
    if (!byStatus[s]) byStatus[s] = { count: 0, total: 0 };
    byStatus[s].count++;
    byStatus[s].total += Number((t as any).amount ?? 0);
  }

  const pending = (txs ?? []).filter((t: any) => t.status === "pending");
  const topPendingDescriptions = pending.slice(0, 10).map((t: any) => ({
    date: t.date,
    amount: Number(t.amount),
    type: t.type,
    description: t.description,
  }));

  return JSON.stringify({
    month,
    fonte: "bank_transactions filtrado por mês",
    summary: {
      total_transactions: (txs ?? []).length,
      by_status: Object.fromEntries(
        Object.entries(byStatus).map(([k, v]) => [k, { count: v.count, total: Math.round(v.total * 100) / 100 }]),
      ),
    },
    pending_top_10: topPendingDescriptions,
    note: "Status pending = ainda precisa classificar/conciliar. Acesse /reconciliation pra resolver.",
  });
}

async function handleGetTaxesStatus(
  _input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const { data, error } = await sb.from("taxes").select("*");
  if (error) return JSON.stringify({ error: `taxes query failed: ${error.message}` });
  const rows = data ?? [];
  if (rows.length === 0) {
    return JSON.stringify({
      fonte: "tabela taxes",
      status: "VAZIA",
      message: "Nenhum registro de impostos cadastrado. Tela /taxes está pronta mas sem dados. Avise o William que precisa popular pra rastreio.",
      n_records: 0,
    });
  }
  return JSON.stringify({
    fonte: "tabela taxes",
    n_records: rows.length,
    records: rows,
  });
}

async function handleGetStrategicPlan(
  _input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);

  const [{ data: goals }, { data: cons }, { data: pipe }] = await Promise.all([
    sb.from("goals").select("*"),
    sb.from("constructions").select("name, status, estimated_completion, estimated_value_ready, total_units_planned, ownership_pct").neq("status", "concluida"),
    sb.from("prevensul_billing").select("client_name, balance_remaining, commission_rate, reference_month").gt("balance_remaining", 0),
  ]);

  // Filtra reference_month mais recente pra evitar somar imports históricos
  const latestMonthPipe = (pipe ?? []).reduce((m: string, p: any) => {
    const r = (p as any).reference_month ?? "";
    return r > m ? r : m;
  }, "");
  const pipeLatest = (pipe ?? []).filter((p: any) => p.reference_month === latestMonthPipe);
  const totalPipelineSaldo = pipeLatest.reduce((s: number, p: any) => s + Number(p.balance_remaining ?? 0), 0);
  const totalComissaoFutura = pipeLatest.reduce((s: number, p: any) => s + Number(p.balance_remaining ?? 0) * Number(p.commission_rate ?? 0.03), 0);

  return JSON.stringify({
    fonte: "memoria/metas.md (R$70M/2041) + goals table + constructions ativas + prevensul_billing pipeline",
    meta_canonica: {
      patrimonio_alvo: 70000000,
      ano_alvo: 2041,
      idade_alvo: 55,
      renda_mensal_alvo: 200000,
      sobra_meta_pct: 50,
    },
    marcos_canonicos: [
      { ano: 2027, descricao: "Casamento + caixa mín R$100k", patrimonio_alvo: 6500000, renda_alvo_mes: 100000 },
      { ano: 2030, descricao: "Consolidação 41 unidades", patrimonio_alvo: 7750000, renda_alvo_mes: 165000 },
      { ano: 2035, descricao: "Apto frente-mar Brava", patrimonio_alvo: 15000000, renda_alvo_mes: 200000 },
      { ano: 2041, descricao: "Destino", patrimonio_alvo: 70000000, renda_alvo_mes: 200000 },
    ],
    obras_em_andamento: (cons ?? []).map((c: any) => ({
      name: c.name,
      status: c.status,
      eta: c.estimated_completion,
      unidades: c.total_units_planned,
      ownership_pct: c.ownership_pct,
      valor_pronto_estimado: c.estimated_value_ready,
    })),
    pipeline_atual: {
      total_saldo_clientes: Math.round(totalPipelineSaldo * 100) / 100,
      total_comissao_futura: Math.round(totalComissaoFutura * 100) / 100,
      n_contratos_ativos: (pipe ?? []).length,
    },
    goals_individuais: goals ?? [],
  });
}

async function handleListCategories(
  _input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const { data } = await sb.from("custom_categories").select("name, slug, type, counts_as_investment, vector, active").eq("active", true).order("type").order("name");
  return JSON.stringify({
    fonte: "custom_categories",
    n_categories: (data ?? []).length,
    categories: data ?? [],
  });
}

// ─── Handler: cleanup_pipeline_old_months ────────────────────────────
async function handleCleanupPipelineOldMonths(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const keepN = Math.max(1, Math.min(12, Number(input.keep_last_n_months) || 3));

  // Pega meses únicos ordenados
  const { data: monthsData } = await sb
    .from("prevensul_billing")
    .select("reference_month")
    .order("reference_month", { ascending: false });

  const uniqueMonths = Array.from(
    new Set((monthsData ?? []).map((m: any) => m.reference_month).filter(Boolean)),
  );

  if (uniqueMonths.length <= keepN) {
    return JSON.stringify({
      ok: true,
      action: "no-op",
      message: `Apenas ${uniqueMonths.length} reference_months no banco — não há nada antigo pra limpar.`,
      months_kept: uniqueMonths,
    });
  }

  const monthsToKeep = uniqueMonths.slice(0, keepN);
  const monthsToDelete = uniqueMonths.slice(keepN);

  // Conta antes
  const { count: countBefore } = await sb
    .from("prevensul_billing")
    .select("*", { count: "exact", head: true });

  // DELETE
  const { error: delErr } = await sb
    .from("prevensul_billing")
    .delete()
    .in("reference_month", monthsToDelete);

  if (delErr) {
    return JSON.stringify({ ok: false, error: `DELETE failed: ${delErr.message}` });
  }

  const { count: countAfter } = await sb
    .from("prevensul_billing")
    .select("*", { count: "exact", head: true });

  return JSON.stringify({
    ok: true,
    action: "cleanup",
    months_kept: monthsToKeep,
    months_deleted: monthsToDelete,
    rows_before: countBefore,
    rows_after: countAfter,
    rows_removed: (countBefore ?? 0) - (countAfter ?? 0),
  });
}

// ─── Handler: upsert_prevensul_billing ───────────────────────────────
async function handleUpsertPrevensulBilling(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const reference_month = input.reference_month as string;
  const rows = input.rows as any[];

  if (!reference_month || !/^\d{4}-\d{2}$/.test(reference_month)) {
    return JSON.stringify({ ok: false, error: "reference_month obrigatório no formato YYYY-MM" });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return JSON.stringify({ ok: false, error: "rows deve ser array não-vazio" });
  }

  // Normaliza rows
  const normalized = rows.map((r: any) => ({
    client_name: String(r.client_name ?? "").trim(),
    contract_total: Number(r.contract_total ?? 0),
    balance_remaining: Number(r.balance_remaining ?? 0),
    contract_nf: r.contract_nf ?? null,
    installment_current: r.installment_current != null ? Number(r.installment_current) : null,
    installment_total: r.installment_total != null ? Number(r.installment_total) : null,
    closing_date: r.closing_date ?? null,
    amount_paid: Number(r.amount_paid ?? 0),
    commission_rate: Number(r.commission_rate ?? 0.03),
    commission_value: Number(r.commission_value ?? Number(r.amount_paid ?? 0) * 0.03),
    status: r.status ?? "Pendente",
    reference_month,
    notes: r.notes ?? null,
  })).filter((r) => r.client_name);

  if (normalized.length === 0) {
    return JSON.stringify({ ok: false, error: "Nenhuma row válida (client_name vazio em todas)" });
  }

  // DELETE atômico do reference_month
  const { error: delErr } = await sb
    .from("prevensul_billing")
    .delete()
    .eq("reference_month", reference_month);
  if (delErr) {
    return JSON.stringify({ ok: false, error: `DELETE failed: ${delErr.message}` });
  }

  // INSERT em lote
  const { error: insErr } = await sb.from("prevensul_billing").insert(normalized);
  if (insErr) {
    return JSON.stringify({ ok: false, error: `INSERT failed: ${insErr.message}` });
  }

  const saldoTotal = normalized.reduce((s, r) => s + r.balance_remaining, 0);
  const comissaoFutura = normalized.reduce((s, r) => s + r.balance_remaining * r.commission_rate, 0);

  return JSON.stringify({
    ok: true,
    reference_month,
    n_imported: normalized.length,
    saldo_total: Math.round(saldoTotal * 100) / 100,
    comissao_futura_total: Math.round(comissaoFutura * 100) / 100,
    message: `Importação atômica: apagou ${reference_month} e inseriu ${normalized.length} contratos.`,
  });
}

// ─── Handler: get_active_goals ───────────────────────────────────────
async function handleGetActiveGoals(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const metricFilter = (input.metric_filter as string) || null;
  const periodFilter = (input.period_filter as string) || null;

  let q = sb.from("goals").select("*");
  if (metricFilter) q = q.eq("metric", metricFilter);
  if (periodFilter) q = q.eq("period_type", periodFilter);
  const { data: goalsData, error } = await q;
  if (error) return JSON.stringify({ error: `goals query failed: ${error.message}` });

  const goals = goalsData ?? [];
  if (goals.length === 0) {
    return JSON.stringify({ ok: true, goals: [], note: "Nenhuma meta cadastrada com esses filtros." });
  }

  // Pra cada goal, calcula current_value se auto_calculated=true
  const out = await Promise.all(
    goals.map(async (g: any) => {
      let currentValue = Number(g.current_value ?? 0);
      const metric = g.metric || g.type;
      const periodStart = g.period_start;
      const periodEnd = g.period_end;

      if (g.auto_calculated !== false && metric && periodStart && periodEnd) {
        if (metric === "revenue") {
          // revenues no período + kitnet_entries reconciled
          const [{ data: revs }, { data: kits }] = await Promise.all([
            sb.from("revenues")
              .select("amount")
              .eq("counts_as_income", true)
              .neq("source", "aluguel_kitnets")
              .gte("received_at", periodStart)
              .lte("received_at", periodEnd),
            sb.from("kitnet_entries")
              .select("total_liquid")
              .eq("reconciled", true)
              .gte("period_end", periodStart)
              .lte("period_end", periodEnd),
          ]);
          const totalRev = (revs ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
          const totalKit = (kits ?? []).reduce((s: number, k: any) => s + Number(k.total_liquid ?? 0), 0);
          currentValue = totalRev + totalKit;
        } else if (metric === "renda_passiva") {
          const { data: kits } = await sb.from("kitnet_entries")
            .select("total_liquid")
            .eq("reconciled", true)
            .gte("period_end", periodStart)
            .lte("period_end", periodEnd);
          currentValue = (kits ?? []).reduce((s: number, k: any) => s + Number(k.total_liquid ?? 0), 0);
        } else if (metric === "savings" || metric === "profit") {
          // sobra = receita - custeio (no período)
          const [{ data: revs }, { data: kits }, { data: exps }] = await Promise.all([
            sb.from("revenues")
              .select("amount").eq("counts_as_income", true).neq("source", "aluguel_kitnets")
              .gte("received_at", periodStart).lte("received_at", periodEnd),
            sb.from("kitnet_entries")
              .select("total_liquid").eq("reconciled", true)
              .gte("period_end", periodStart).lte("period_end", periodEnd),
            sb.from("expenses")
              .select("amount, is_card_payment, counts_as_investment, nature")
              .gte("paid_at", periodStart).lte("paid_at", periodEnd),
          ]);
          const totalRev = (revs ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0)
            + (kits ?? []).reduce((s: number, k: any) => s + Number(k.total_liquid ?? 0), 0);
          const totalCust = (exps ?? [])
            .filter((e: any) => !e.is_card_payment && !e.counts_as_investment && e.nature !== "transfer")
            .reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
          currentValue = totalRev - totalCust;
        }
        // patrimony: usa snapshot (cálculo separado, fora deste handler por ora)
      }

      const target = Number(g.target_value ?? 0);
      const pct = target > 0 ? (currentValue / target) * 100 : 0;
      const remaining = target - currentValue;

      return {
        id: g.id,
        name: g.name,
        period_type: g.period_type,
        period_start: g.period_start,
        period_end: g.period_end,
        metric,
        target_value: Math.round(target * 100) / 100,
        current_value: Math.round(currentValue * 100) / 100,
        progress_pct: Math.round(pct * 10) / 10,
        remaining: Math.round(remaining * 100) / 100,
        status: pct >= 100 ? "atingida" : pct >= 75 ? "perto" : pct >= 50 ? "no_caminho" : "atras",
        notes: g.notes,
      };
    }),
  );

  return JSON.stringify({
    ok: true,
    n_goals: out.length,
    goals: out,
    note: "current_value calculado em runtime quando auto_calculated=true. metric='patrimony' ainda usa snapshot manual (Sprint futura).",
  });
}

// ─── Handler: parse_task_nlp ──────────────────────────────────────────
async function handleParseTaskNlp(
  input: Record<string, unknown>,
  _supabaseUrl: string,
  _serviceKey: string,
): Promise<string> {
  const text = (input.text as string ?? "").trim();
  const refDateStr = (input.reference_date as string) || new Date().toISOString().slice(0, 10);
  if (!text) return JSON.stringify({ ok: false, error: "text obrigatório" });

  const lower = text.toLowerCase();
  const refDate = new Date(refDateStr);

  // Detecta data
  let dueDate = refDateStr;
  if (/\bhoje\b/.test(lower)) {
    dueDate = refDateStr;
  } else if (/\bamanh[aã]\b/.test(lower)) {
    const d = new Date(refDate); d.setDate(d.getDate() + 1);
    dueDate = d.toISOString().slice(0, 10);
  } else if (/\bdepois de amanh[aã]\b/.test(lower)) {
    const d = new Date(refDate); d.setDate(d.getDate() + 2);
    dueDate = d.toISOString().slice(0, 10);
  } else {
    // Dias da semana (próxima ocorrência)
    const weekdays: Record<string, number> = {
      domingo: 0, segunda: 1, terça: 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, sábado: 6, sabado: 6,
      seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, dom: 0,
    };
    for (const [name, dayNum] of Object.entries(weekdays)) {
      if (new RegExp(`\\b${name}\\b`).test(lower)) {
        const d = new Date(refDate);
        const diff = (dayNum - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        dueDate = d.toISOString().slice(0, 10);
        break;
      }
    }
    // Data explícita: 15/05 ou 15/05/2026
    const dm = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
    if (dm) {
      const day = dm[1].padStart(2, "0");
      const month = dm[2].padStart(2, "0");
      const year = dm[3] || refDate.getFullYear().toString();
      dueDate = `${year}-${month}-${day}`;
    }
  }

  // Detecta hora
  let dueTime: string | null = null;
  const hm = lower.match(/\b(\d{1,2})(?:h|:(\d{2}))\b/);
  if (hm) {
    const h = hm[1].padStart(2, "0");
    const m = (hm[2] || "00").padStart(2, "0");
    dueTime = `${h}:${m}`;
  }

  // Detecta recorrência
  let recurrence: any = null;
  if (/\btoda? dia\b|\bdiariamente\b|\btodos os dias\b/.test(lower)) {
    recurrence = { frequency: "daily" };
  } else if (/\btoda? semana\b/.test(lower)) {
    recurrence = { frequency: "weekly" };
  } else if (/\btoda?s? (segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)/.test(lower)) {
    recurrence = { frequency: "weekly" };
    const wd = lower.match(/\btoda?s? (segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)/);
    if (wd) {
      const wdMap: Record<string, number> = {
        domingo: 0, segunda: 1, terça: 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, sábado: 6, sabado: 6,
      };
      recurrence.weekday = wdMap[wd[1]];
    }
  } else if (/\btodo m[eê]s\b|\bmensal/.test(lower)) {
    recurrence = { frequency: "monthly" };
  }

  // Detecta vetor (heurística simples)
  let vector: string | null = null;
  if (/prevensul|premoldi|verde vale|sardagna|r7|jabpp|trade park|grand food|cliente/.test(lower)) vector = "prevensul";
  else if (/kitnet|aluguel|lara|inquilino/.test(lower)) vector = "kitnets";
  else if (/obra|rwt05|jw7|terreno|construção|construc[aã]o|matheus|mauro|cimento|laje|alvenaria/.test(lower)) vector = "obras";
  else if (/naval|audit/.test(lower)) vector = "naval";
  else if (/treino|henrique|m[eé]dico|psiquiatra/.test(lower)) vector = "pessoal";
  else if (/diego|t7|tdi/.test(lower)) vector = "t7";

  // Limpa título (remove markers temporais e recurrence)
  const cleanTitle = text
    .replace(/\b(hoje|amanh[aã]|depois de amanh[aã])\b/gi, "")
    .replace(/\b(toda?|todos|todas|sempre)\b\s*(dia|semana|m[eê]s|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)?/gi, "")
    .replace(/\b\d{1,2}(h|:\d{2})\b/gi, "")
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{4})?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return JSON.stringify({
    ok: true,
    parsed: {
      title: cleanTitle || text,
      due_date: dueDate,
      due_time: dueTime,
      vector,
      recurrence,
    },
    raw_text: text,
    note: "Parse heurístico. Frontend deve mostrar preview antes de inserir.",
  });
}

// ─── Handler: promote_alert_to_task ──────────────────────────────────
async function handlePromoteAlertToTask(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const alertId = input.alert_id as string;
  const dueDate = (input.due_date as string) || new Date().toISOString().slice(0, 10);
  const dueTime = (input.due_time as string) || null;

  if (!alertId) return JSON.stringify({ ok: false, error: "alert_id obrigatório" });

  // Idempotência: já existe task pra esse alert?
  const { data: existing } = await sb
    .from("daily_tasks")
    .select("id, title, status, due_date")
    .eq("related_alert_id", alertId)
    .maybeSingle();
  if (existing) {
    return JSON.stringify({
      ok: true,
      action: "already_exists",
      task: existing,
    });
  }

  // Busca alert
  const { data: alert, error: aErr } = await sb
    .from("naval_alerts")
    .select("title, message, severity, detector")
    .eq("id", alertId)
    .single();
  if (aErr || !alert) return JSON.stringify({ ok: false, error: "alert_id não encontrado" });

  // Cria task
  const { data: task, error: tErr } = await sb
    .from("daily_tasks")
    .insert({
      title: (alert as any).title,
      due_date: dueDate,
      due_time: dueTime,
      status: "pending",
      vector: "naval",
      source: "naval_promoted",
      related_alert_id: alertId,
      notes: (alert as any).message,
    })
    .select("id, title, due_date, due_time, status")
    .single();

  if (tErr) return JSON.stringify({ ok: false, error: `INSERT failed: ${tErr.message}` });

  return JSON.stringify({
    ok: true,
    action: "created",
    task,
    alert: { severity: (alert as any).severity, detector: (alert as any).detector },
  });
}

// ─── Handler: update_pipeline_stage ──────────────────────────────────
async function handleUpdatePipelineStage(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const clientName = input.client_name as string;
  const stage = input.stage as string;
  const validStages = ["quente", "proposta", "fechando", "ganho", "perdido"];

  if (!clientName) return JSON.stringify({ ok: false, error: "client_name obrigatório" });
  if (!validStages.includes(stage)) {
    return JSON.stringify({ ok: false, error: `stage inválido. Use: ${validStages.join(", ")}` });
  }

  // Busca contratos do cliente (todos os reference_months)
  const { data: matches } = await sb
    .from("prevensul_billing")
    .select("id, client_name, reference_month")
    .ilike("client_name", `%${clientName}%`);
  if (!matches || matches.length === 0) {
    return JSON.stringify({ ok: false, error: `Nenhum contrato encontrado pra '${clientName}'` });
  }

  // Atualiza todos os matches
  const ids = matches.map((m: any) => m.id);
  const { error: updErr } = await sb
    .from("prevensul_billing")
    .update({ pipeline_stage: stage })
    .in("id", ids);
  if (updErr) return JSON.stringify({ ok: false, error: `UPDATE failed: ${updErr.message}` });

  return JSON.stringify({
    ok: true,
    action: "updated",
    n_rows_updated: ids.length,
    client_name: matches[0].client_name,
    new_stage: stage,
  });
}

async function handleAuditDataSources(
  _input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const monthStr = today.toISOString().slice(0, 7);
  const issues: any[] = [];

  // 1. Bancos com last_updated > 7 dias
  const { data: banks } = await sb.from("bank_accounts").select("bank_name, last_updated, balance");
  for (const b of banks ?? []) {
    if (!(b as any).last_updated) {
      issues.push({ severity: "warning", source: "bank_accounts", item: (b as any).bank_name, problem: "last_updated null" });
      continue;
    }
    const days = Math.floor((today.getTime() - new Date((b as any).last_updated).getTime()) / 86400000);
    if (days > 7) {
      issues.push({
        severity: days > 30 ? "critical" : "warning",
        source: "bank_accounts",
        item: (b as any).bank_name,
        problem: `last_updated há ${days} dias atrás (saldo R$ ${Number((b as any).balance ?? 0).toFixed(2)})`,
      });
    }
  }

  // 2. Celesc invoices: última fatura > 35 dias atrás
  const { data: celesc } = await sb
    .from("celesc_invoices")
    .select("residencial_code, reference_month, due_date")
    .order("reference_month", { ascending: false })
    .limit(20);
  const lastByResi = new Map<string, string>();
  for (const c of celesc ?? []) {
    const code = (c as any).residencial_code;
    if (!lastByResi.has(code)) lastByResi.set(code, (c as any).reference_month);
  }
  for (const [code, lastMonth] of lastByResi.entries()) {
    if (lastMonth < monthStr) {
      issues.push({
        severity: "warning",
        source: "celesc_invoices",
        item: code,
        problem: `última fatura ${lastMonth} (mês corrente é ${monthStr})`,
      });
    }
  }

  // 3. Kitnet entries: mês corrente sem fechamento
  // Status efetivo: combina kitnets.status default + último override em kitnet_month_status ≤ monthStr
  const { data: kitnetsAll } = await sb.from("kitnets").select("id, code, status");
  const { data: monthStatusesAudit } = await sb
    .from("kitnet_month_status")
    .select("kitnet_id, status, reference_month")
    .lte("reference_month", monthStr)
    .order("reference_month", { ascending: false });
  const effectiveAudit: Record<string, string> = {};
  for (const r of (monthStatusesAudit ?? [])) {
    if (!(r.kitnet_id in effectiveAudit)) effectiveAudit[r.kitnet_id] = r.status;
  }
  const kitnetsOccupied = (kitnetsAll ?? []).filter((k: any) => {
    const eff = (effectiveAudit[k.id] ?? k.status ?? "").toLowerCase();
    return eff === "occupied";
  });
  const { data: kitEntries } = await sb.from("kitnet_entries").select("kitnet_id").eq("reference_month", monthStr);
  const fechouEsteMes = new Set((kitEntries ?? []).map((k: any) => k.kitnet_id));
  const semFechamento = kitnetsOccupied.filter((k: any) => !fechouEsteMes.has(k.id));
  if (semFechamento.length > 0) {
    issues.push({
      severity: "info",
      source: "kitnet_entries",
      item: "Modelo A",
      problem: `${semFechamento.length} kitnets ocupadas sem fechamento em ${monthStr}: ${semFechamento.map((k: any) => k.code).join(", ")}`,
    });
  }

  // 4. Prevensul billing: total saldo agregado + check anti-inflação
  const { data: pipe } = await sb
    .from("prevensul_billing")
    .select("balance_remaining, client_name, reference_month")
    .gt("balance_remaining", 0);
  const totalPipe = (pipe ?? []).reduce((s: number, p: any) => s + Number(p.balance_remaining ?? 0), 0);
  const nContratosPipe = (pipe ?? []).length;

  // Detecta duplicação: mesmo client_name aparecendo em vários reference_month
  const clienteCount: Record<string, number> = {};
  for (const p of pipe ?? []) {
    const c = (p as any).client_name ?? "?";
    clienteCount[c] = (clienteCount[c] ?? 0) + 1;
  }
  const clientesDuplicados = Object.entries(clienteCount)
    .filter(([, n]) => n > 1)
    .map(([c, n]) => `${c} (${n}x)`);

  // Cruza com histórico de comissão recebida pra ver se está coerente
  const { data: histRev } = await sb
    .from("revenues")
    .select("amount, reference_month")
    .eq("source", "comissao_prevensul")
    .order("reference_month", { ascending: false })
    .limit(50);
  const monthsHist: Record<string, number> = {};
  for (const r of histRev ?? []) {
    const m = (r as any).reference_month;
    monthsHist[m] = (monthsHist[m] ?? 0) + Number((r as any).amount);
  }
  const last3 = Object.values(monthsHist).slice(0, 3);
  const avgComissaoMensalReal = last3.length > 0 ? last3.reduce((s, v) => s + v, 0) / last3.length : 0;
  const comissaoFuturaTotal = totalPipe * 0.03;
  // Se pipeline projeta >12× a comissão mensal real recente, está provavelmente inflado
  const meses_implicitos = avgComissaoMensalReal > 0 ? comissaoFuturaTotal / avgComissaoMensalReal : 0;

  let pipeSeverity: "info" | "warning" | "critical" = "info";
  let pipeProblem = `Saldo total clientes: R$ ${totalPipe.toFixed(2)} em ${nContratosPipe} contratos. Comissão futura ~R$ ${comissaoFuturaTotal.toFixed(0)} (3%).`;

  if (clientesDuplicados.length > 0) {
    pipeSeverity = "critical";
    pipeProblem = `🚨 DUPLICAÇÃO DETECTADA em prevensul_billing: ${clientesDuplicados.length} clientes em múltiplos reference_month: ${clientesDuplicados.slice(0, 10).join(", ")}${clientesDuplicados.length > 10 ? "..." : ""}. Total inflado: R$ ${totalPipe.toFixed(2)} / ${nContratosPipe} contratos. Solução: TRUNCATE TABLE prevensul_billing CASCADE; depois re-importar CSV mais recente.`;
  } else if (avgComissaoMensalReal > 0 && meses_implicitos > 60) {
    pipeSeverity = "warning";
    pipeProblem = `⚠ Pipeline parece INFLADO: comissão futura R$ ${comissaoFuturaTotal.toFixed(0)} ÷ comissão mensal histórica média R$ ${avgComissaoMensalReal.toFixed(0)} = ${meses_implicitos.toFixed(0)} meses implícitos. Razoável: 12-36 meses. Possível dessincronização vs CSV portal — verificar.`;
  } else if (avgComissaoMensalReal > 0) {
    pipeProblem += ` Cruzando com histórico real (R$ ${avgComissaoMensalReal.toFixed(0)}/mês média 3m): ${meses_implicitos.toFixed(0)} meses implícitos de pipeline. ${meses_implicitos < 6 ? "⚠ Pode estar zerando." : meses_implicitos > 36 ? "⚠ Parece longo, verificar." : "✓ Razoável."}`;
  }

  issues.push({
    severity: pipeSeverity,
    source: "prevensul_billing",
    item: "saldo_total",
    problem: pipeProblem,
  });

  // 4b. Other commission installments atrasadas (Cláudio juros, R7, Sardagna)
  const { data: ociAtrasadas } = await sb
    .from("other_commission_installments")
    .select("commission_id, installment_number, due_date, amount")
    .is("paid_at", null)
    .lt("due_date", todayStr);
  if ((ociAtrasadas ?? []).length > 0) {
    const totalAtrasado = (ociAtrasadas ?? []).reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);
    // Pega nomes dos contratos
    const cIds = Array.from(new Set((ociAtrasadas ?? []).map((i: any) => i.commission_id)));
    const { data: contratos } = await sb
      .from("other_commissions")
      .select("id, description")
      .in("id", cIds);
    const nomes = (contratos ?? []).map((c: any) => c.description).join(", ").slice(0, 200);
    issues.push({
      severity: "warning",
      source: "other_commission_installments",
      item: "atrasadas",
      problem: `⚠ ${(ociAtrasadas ?? []).length} parcela(s) de comissão externa atrasada(s) — total R$ ${totalAtrasado.toFixed(2)}. Contratos: ${nomes}. Verificar /comissoes-externas.`,
    });
  }

  // 4c. Other commission installments próximas a vencer (próximos 7 dias)
  const next7d = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const { data: ociProximas } = await sb
    .from("other_commission_installments")
    .select("commission_id, installment_number, due_date, amount")
    .is("paid_at", null)
    .gte("due_date", todayStr)
    .lte("due_date", next7d);
  if ((ociProximas ?? []).length > 0) {
    const totalProximo = (ociProximas ?? []).reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);
    issues.push({
      severity: "info",
      source: "other_commission_installments",
      item: "proximas_7d",
      problem: `${(ociProximas ?? []).length} parcela(s) de comissão externa vence(m) nos próximos 7 dias — total R$ ${totalProximo.toFixed(2)}.`,
    });
  }

  // 5. Bank transactions pending no mês corrente
  const { data: pendingTxs } = await sb
    .from("bank_transactions")
    .select("amount")
    .eq("status", "pending")
    .gte("date", `${monthStr}-01`);
  if ((pendingTxs ?? []).length > 0) {
    const total = (pendingTxs ?? []).reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0);
    issues.push({
      severity: (pendingTxs ?? []).length > 20 ? "warning" : "info",
      source: "bank_transactions",
      item: "conciliação",
      problem: `${(pendingTxs ?? []).length} transações pending no mês (total R$ ${total.toFixed(2)}). Acesse /reconciliation.`,
    });
  }

  const counts = {
    critical: issues.filter((i) => i.severity === "critical").length,
    warning: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  };

  return JSON.stringify({
    audit_date: todayStr,
    summary: counts,
    issues,
    recommendation:
      counts.critical > 0
        ? "🚨 Há issues críticas — resolver antes de análises grandes."
        : counts.warning > 0
          ? "⚠ Há issues warning — revisar quando puder."
          : "✓ Fontes parecem sincronizadas.",
  });
}

// ─── Handler: mark_installment_paid ──────────────────────────────────
async function handleMarkInstallmentPaid(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const directId = (input.debt_installment_id as string) || null;
  const debtNameFilter = (input.debt_name_filter as string) || null;
  const sequenceNumber = input.sequence_number != null ? Number(input.sequence_number) : null;
  const paidDate = (input.paid_date as string) || new Date().toISOString().slice(0, 10);
  const paidAmountInput = input.paid_amount != null ? Number(input.paid_amount) : null;

  // Resolve installment_id
  let installmentId: string | null = directId;
  let installmentRow: any = null;

  if (!installmentId) {
    if (!debtNameFilter || sequenceNumber == null) {
      return JSON.stringify({
        ok: false,
        error: "Faltam parâmetros. Forneça debt_installment_id OU (debt_name_filter + sequence_number).",
      });
    }
    // Busca debt por nome (ilike) e installment por sequence_number
    const { data: debts } = await sb
      .from("debts")
      .select("id, name")
      .ilike("name", `%${debtNameFilter}%`);
    if (!debts || debts.length === 0) {
      return JSON.stringify({ ok: false, error: `Nenhuma debt encontrada com filtro '${debtNameFilter}'.` });
    }
    if (debts.length > 1) {
      return JSON.stringify({
        ok: false,
        error: `${debts.length} debts encontradas com '${debtNameFilter}'. Refine: ${debts.map((d: any) => d.name).join(" | ")}`,
      });
    }
    const { data: insts } = await sb
      .from("debt_installments")
      .select("*")
      .eq("debt_id", debts[0].id)
      .eq("sequence_number", sequenceNumber);
    if (!insts || insts.length === 0) {
      return JSON.stringify({
        ok: false,
        error: `Parcela ${sequenceNumber} não existe na debt '${debts[0].name}'.`,
      });
    }
    installmentRow = insts[0];
    installmentId = installmentRow.id;
  } else {
    const { data: row } = await sb
      .from("debt_installments")
      .select("*")
      .eq("id", installmentId)
      .single();
    installmentRow = row;
  }

  if (!installmentRow) {
    return JSON.stringify({ ok: false, error: `Parcela id=${installmentId} não encontrada.` });
  }

  if (installmentRow.paid_at) {
    return JSON.stringify({
      ok: false,
      error: `Parcela já marcada como paga em ${installmentRow.paid_at} (R$ ${installmentRow.paid_amount}). Pra desfazer, use SQL manual.`,
      already_paid: {
        paid_at: installmentRow.paid_at,
        paid_amount: installmentRow.paid_amount,
        bank_tx_id: installmentRow.bank_tx_id,
      },
    });
  }

  const finalPaidAmount = paidAmountInput ?? Number(installmentRow.amount ?? 0);

  const { error: updErr } = await sb
    .from("debt_installments")
    .update({
      paid_at: paidDate,
      paid_amount: finalPaidAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", installmentId);

  if (updErr) {
    return JSON.stringify({ ok: false, error: `Falha ao atualizar: ${updErr.message}` });
  }

  // Re-busca pra confirmar (e ver remaining_amount atualizado pelo trigger)
  const { data: debtAfter } = await sb
    .from("debts")
    .select("name, remaining_amount, due_date, status")
    .eq("id", installmentRow.debt_id)
    .single();

  return JSON.stringify({
    ok: true,
    message: `Parcela ${installmentRow.sequence_number} marcada como paga em ${paidDate}.`,
    installment_updated: {
      id: installmentId,
      sequence_number: installmentRow.sequence_number,
      due_date: installmentRow.due_date,
      paid_date: paidDate,
      paid_amount: finalPaidAmount,
      original_amount: Number(installmentRow.amount ?? 0),
    },
    debt_after: debtAfter,
    note: "Trigger no banco recalculou debts.remaining_amount + due_date automaticamente. Se remaining_amount = 0, status virou 'paid'.",
  });
}

// ─── Handler: get_recurring_bills ────────────────────────────────────
async function handleGetRecurringBills(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const categoryFilter = (input.category_filter as string) || null;

  let q = sb
    .from("recurring_bills")
    .select("name, alias, category, amount, due_day, frequency, is_fixed, active, notes")
    .eq("active", true);
  if (categoryFilter) q = q.eq("category", categoryFilter);
  const { data } = await q;
  const bills = data ?? [];

  const today = new Date();
  const day = today.getDate();

  const byCategory = new Map<string, { total: number; count: number; items: any[] }>();
  for (const b of bills) {
    const cat = b.category || "outros";
    if (!byCategory.has(cat)) byCategory.set(cat, { total: 0, count: 0, items: [] });
    const e = byCategory.get(cat)!;
    const amt = Number(b.amount ?? 0);
    e.total += amt;
    e.count++;
    e.items.push({
      name: b.alias || b.name,
      amount: Math.round(amt * 100) / 100,
      due_day: b.due_day,
      is_fixed: b.is_fixed,
      notes: b.notes,
    });
  }

  const categoriesOut = Array.from(byCategory.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([cat, v]) => ({
      category: cat,
      total_mensal: Math.round(v.total * 100) / 100,
      n_bills: v.count,
      items: v.items.sort((a, b) => b.amount - a.amount).slice(0, 5),
    }));

  const totalMensal = bills.reduce((s: number, b: any) => s + Number(b.amount ?? 0), 0);

  const dueSoon = bills
    .filter((b: any) => b.due_day && b.due_day >= day && b.due_day <= day + 7)
    .sort((a: any, b: any) => (a.due_day ?? 99) - (b.due_day ?? 99))
    .map((b: any) => ({
      name: b.alias || b.name,
      amount: Math.round(Number(b.amount ?? 0) * 100) / 100,
      due_day: b.due_day,
      days_ahead: (b.due_day ?? 0) - day,
    }));

  const top10 = bills
    .map((b: any) => ({
      name: b.alias || b.name,
      category: b.category,
      amount: Math.round(Number(b.amount ?? 0) * 100) / 100,
      due_day: b.due_day,
      is_fixed: b.is_fixed,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return JSON.stringify({
    summary: {
      total_mensal_recorrente: Math.round(totalMensal * 100) / 100,
      n_bills_ativas: bills.length,
      n_categorias: categoriesOut.length,
      n_due_soon_7d: dueSoon.length,
    },
    by_category: categoriesOut,
    top_10_por_valor: top10,
    due_in_next_7_days: dueSoon,
    note:
      "Apenas bills ativas (active=true). is_fixed=false significa valor variável (estimativa). " +
      "Esses gastos NÃO incluem parcelas variáveis de cartão — só recorrências fixas (PIX/débito/boleto).",
  });
}

// ─── Handler: get_other_commissions_status ────────────────────────────
async function handleGetOtherCommissionsStatus(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const sourceFilter = (input.source_filter as string) || null;

  const cmRes = await sb
    .from("other_commissions")
    .select("id, description, source, reference_month, amount, commission_rate, commission_value, installments_count, issued_at, notes")
    .order("issued_at", { ascending: false });
  let commissions = cmRes.data ?? [];
  if (sourceFilter) {
    const f = sourceFilter.toLowerCase();
    commissions = commissions.filter((c: any) =>
      (c.source || "").toLowerCase().includes(f) ||
      (c.description || "").toLowerCase().includes(f),
    );
  }

  const ids = commissions.map((c: any) => c.id);
  const installments = ids.length
    ? (await sb
        .from("other_commission_installments")
        .select("commission_id, installment_number, due_date, amount, paid_at, paid_amount")
        .in("commission_id", ids)).data ?? []
    : [];

  const today = new Date();

  let totalContratado = 0;
  let totalRecebido = 0;
  let totalPendente = 0;
  let totalAtrasado = 0;

  const overdueList: any[] = [];
  const upcomingList: any[] = [];

  for (const i of installments) {
    const amt = Number(i.amount ?? 0);
    totalContratado += amt;
    if (i.paid_at) {
      totalRecebido += Number(i.paid_amount ?? amt);
    } else {
      totalPendente += amt;
      const due = i.due_date ? new Date(i.due_date) : null;
      const cm = commissions.find((c: any) => c.id === i.commission_id);
      const item = {
        source: cm?.source,
        description: cm?.description,
        installment_number: i.installment_number,
        due_date: i.due_date,
        amount: Math.round(amt * 100) / 100,
      };
      if (due && due < today) {
        totalAtrasado += amt;
        overdueList.push({ ...item, days_overdue: Math.ceil((today.getTime() - due.getTime()) / 86400000) });
      } else {
        upcomingList.push(item);
      }
    }
  }

  upcomingList.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const bySource = new Map<string, { total: number; recebido: number; pendente: number; n_installments: number }>();
  for (const cm of commissions) {
    const src = cm.source || "?";
    if (!bySource.has(src)) bySource.set(src, { total: 0, recebido: 0, pendente: 0, n_installments: 0 });
    const e = bySource.get(src)!;
    const cmInsts = installments.filter((i: any) => i.commission_id === cm.id);
    e.n_installments += cmInsts.length;
    for (const i of cmInsts) {
      const amt = Number(i.amount ?? 0);
      e.total += amt;
      if (i.paid_at) e.recebido += Number(i.paid_amount ?? amt);
      else e.pendente += amt;
    }
  }

  const sourcesOut = Array.from(bySource.entries())
    .sort((a, b) => b[1].pendente - a[1].pendente)
    .map(([source, v]) => ({
      source,
      total_contratado: Math.round(v.total * 100) / 100,
      total_recebido: Math.round(v.recebido * 100) / 100,
      total_pendente: Math.round(v.pendente * 100) / 100,
      n_installments: v.n_installments,
    }));

  return JSON.stringify({
    summary: {
      n_contratos: commissions.length,
      n_installments_total: installments.length,
      total_contratado: Math.round(totalContratado * 100) / 100,
      total_recebido: Math.round(totalRecebido * 100) / 100,
      total_pendente: Math.round(totalPendente * 100) / 100,
      total_atrasado: Math.round(totalAtrasado * 100) / 100,
      n_overdue: overdueList.length,
    },
    by_source: sourcesOut,
    overdue_installments: overdueList.slice(0, 20),
    upcoming_5_installments: upcomingList.slice(0, 5),
    note:
      "Comissões EXTERNAS à Prevensul. Não confundir com prevensul_billing (use get_prevensul_pipeline pra Prevensul).",
  });
}

// ─── Handler: get_energy_solar_status ─────────────────────────────────
async function handleGetEnergySolarStatus(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const residencialFilter = (input.residencial_filter as string) || null;
  const nMonths = Math.min(Math.max(Number(input.n_months) || 6, 1), 24);

  const today = new Date();
  const fromDate = new Date(today.getFullYear(), today.getMonth() - nMonths + 1, 1);
  const fromMonth = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}`;

  // 1) Faturas Celesc do período (o que William paga)
  let invQuery = sb
    .from("celesc_invoices")
    .select("residencial_code, reference_month, due_date, kwh_total, invoice_total, solar_kwh_offset, amount_paid, tariff_per_kwh, payment_date")
    .gte("reference_month", fromMonth);
  if (residencialFilter) invQuery = invQuery.eq("residencial_code", residencialFilter);
  const { data: invoicesData } = await invQuery;
  const invoices = invoicesData ?? [];

  // 2) Energy readings do período (o que William cobra dos inquilinos)
  // Faz 2 queries separadas: readings + kitnets, junta no JS.
  // Evita ambiguidade do PostgREST inline join (pode vir array ou objeto).
  // Coluna real é consumption_kwh (NÃO kwh_consumed). Se errar nome,
  // PostgREST retorna 400 silencioso → readings vazio → bug visível só no resultado.
  const { data: readingsRaw, error: readingsErr } = await sb
    .from("energy_readings")
    .select("reference_month, amount_to_charge, consumption_kwh, kitnet_id")
    .gte("reference_month", fromMonth);
  if (readingsErr) {
    return JSON.stringify({
      error: `energy_readings query falhou: ${readingsErr.message}. Verificar schema.`,
    });
  }
  const readingsRows = readingsRaw ?? [];

  // Mapa kitnet_id → residencial_code
  const kitnetIds = Array.from(new Set(readingsRows.map((r: any) => r.kitnet_id).filter(Boolean)));
  let kitnetMap = new Map<string, { residencial_code: string; code: string }>();
  if (kitnetIds.length > 0) {
    const { data: kitnetsData } = await sb
      .from("kitnets")
      .select("id, residencial_code, code")
      .in("id", kitnetIds);
    for (const k of kitnetsData ?? []) {
      kitnetMap.set((k as any).id, {
        residencial_code: (k as any).residencial_code,
        code: (k as any).code,
      });
    }
  }

  // Anota residencial_code em cada reading
  const readings = readingsRows.map((r: any) => ({
    ...r,
    residencial_code: kitnetMap.get(r.kitnet_id)?.residencial_code ?? null,
  }));

  // 3) Agrupa: { residencial_code → { reference_month → {fatura, cobrado, n_leituras, ...} } }
  type MonthStats = {
    reference_month: string;
    fatura_celesc: number;     // amount_paid (regime caixa) ou invoice_total (regime competência)
    cobrado_inquilinos: number; // soma amount_to_charge
    saldo_solar: number;        // cobrado - fatura
    n_leituras: number;
    kwh_consumido_total: number;
    due_date: string | null;
    payment_date: string | null;
    kwh_total_celesc: number;
    solar_kwh_offset: number;
    tariff_per_kwh: number | null;
  };

  const byResidencial = new Map<string, Map<string, MonthStats>>();

  // Inicializa pelas faturas
  for (const inv of invoices) {
    const code = inv.residencial_code || "?";
    const month = inv.reference_month;
    if (!byResidencial.has(code)) byResidencial.set(code, new Map());
    byResidencial.get(code)!.set(month, {
      reference_month: month,
      fatura_celesc: Number(inv.amount_paid ?? inv.invoice_total ?? 0),
      cobrado_inquilinos: 0,
      saldo_solar: 0,
      n_leituras: 0,
      kwh_consumido_total: 0,
      due_date: inv.due_date,
      payment_date: inv.payment_date,
      kwh_total_celesc: Number(inv.kwh_total ?? 0),
      solar_kwh_offset: Number(inv.solar_kwh_offset ?? 0),
      tariff_per_kwh: inv.tariff_per_kwh ? Number(inv.tariff_per_kwh) : null,
    });
  }

  // Soma cobrança dos inquilinos
  for (const r of readings as any[]) {
    const code = r.residencial_code;
    if (!code) continue;
    if (residencialFilter && code !== residencialFilter) continue;
    const month = r.reference_month;
    if (!byResidencial.has(code)) byResidencial.set(code, new Map());
    const monthMap = byResidencial.get(code)!;
    if (!monthMap.has(month)) {
      monthMap.set(month, {
        reference_month: month,
        fatura_celesc: 0,
        cobrado_inquilinos: 0,
        saldo_solar: 0,
        n_leituras: 0,
        kwh_consumido_total: 0,
        due_date: null,
        payment_date: null,
        kwh_total_celesc: 0,
        solar_kwh_offset: 0,
        tariff_per_kwh: null,
      });
    }
    const stats = monthMap.get(month)!;
    stats.cobrado_inquilinos += Number(r.amount_to_charge ?? 0);
    stats.kwh_consumido_total += Number(r.consumption_kwh ?? 0);
    stats.n_leituras++;
  }

  // Calcula saldo
  for (const monthMap of byResidencial.values()) {
    for (const s of monthMap.values()) {
      s.saldo_solar = s.cobrado_inquilinos - s.fatura_celesc;
    }
  }

  // Monta saída
  const residenciaisOut = Array.from(byResidencial.entries()).map(([code, monthMap]) => {
    const months = Array.from(monthMap.values()).sort((a, b) =>
      a.reference_month.localeCompare(b.reference_month),
    );

    const totalFatura = months.reduce((s, m) => s + m.fatura_celesc, 0);
    const totalCobrado = months.reduce((s, m) => s + m.cobrado_inquilinos, 0);
    const totalSaldo = totalCobrado - totalFatura;
    const avgSaldoMes = months.length ? totalSaldo / months.length : 0;

    return {
      residencial: code,
      n_months: months.length,
      total_fatura_celesc_periodo: Math.round(totalFatura * 100) / 100,
      total_cobrado_inquilinos_periodo: Math.round(totalCobrado * 100) / 100,
      saldo_solar_periodo: Math.round(totalSaldo * 100) / 100,
      saldo_solar_medio_mensal: Math.round(avgSaldoMes * 100) / 100,
      months: months.map((m) => ({
        reference_month: m.reference_month,
        fatura_celesc: Math.round(m.fatura_celesc * 100) / 100,
        cobrado_inquilinos: Math.round(m.cobrado_inquilinos * 100) / 100,
        saldo_solar: Math.round(m.saldo_solar * 100) / 100,
        n_leituras_inquilinos: m.n_leituras,
        kwh_consumido_inquilinos_total: m.kwh_consumido_total,
        kwh_total_celesc: m.kwh_total_celesc,
        solar_kwh_offset: m.solar_kwh_offset,
        due_date: m.due_date,
        payment_date: m.payment_date,
      })),
    };
  });

  const totalSaldoGeral = residenciaisOut.reduce((s, r) => s + r.saldo_solar_periodo, 0);
  const totalSaldoMensalGeral = residenciaisOut.reduce((s, r) => s + r.saldo_solar_medio_mensal, 0);

  return JSON.stringify({
    period: { from_month: fromMonth, n_months: nMonths },
    summary: {
      n_residenciais: residenciaisOut.length,
      saldo_solar_periodo_total: Math.round(totalSaldoGeral * 100) / 100,
      saldo_solar_medio_mensal_total: Math.round(totalSaldoMensalGeral * 100) / 100,
    },
    by_residencial: residenciaisOut,
    note:
      "MODELO DE NEGÓCIO: Energia Solar gera RECEITA via cobrança dos inquilinos. " +
      "saldo_solar = cobrado_inquilinos - fatura_celesc = LUCRO MENSAL DO VETOR SOLAR. " +
      "Esse é o KPI primário (não kWh/offset técnico). " +
      "Tabelas: celesc_invoices.amount_paid (custo) + energy_readings.amount_to_charge somado por residencial (receita). " +
      "Ex: RWT02 abril/2026 — fatura R$ 190 / cobrado R$ 1.218 / SALDO R$ 1.028 ✓",
  });
}

// ─── Handler: get_consortium_status ──────────────────────────────────
async function handleGetConsortiumStatus(
  input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const nameFilter = (input.name_filter as string) || null;

  let q = sb
    .from("consortiums")
    .select(
      "name, total_value, credit_value, monthly_payment, installments_total, installments_paid, installments_remaining, total_paid, total_pending, status, asset_type, end_date, adhesion_date, ownership_pct, partner_name, fund_paid, admin_fee_paid, insurance_paid, admin_fee_pct",
    )
    .order("monthly_payment", { ascending: false });
  if (nameFilter) {
    q = q.ilike("name", `%${nameFilter}%`);
  }
  const { data } = await q;
  const rows = data ?? [];

  const today = new Date();

  const consortiumsOut = rows.map((c: any) => {
    const ownership = Number(c.ownership_pct ?? 100) / 100;
    const totalPaid = Number(c.total_paid ?? 0);
    const totalPending = Number(c.total_pending ?? 0);
    const monthly = Number(c.monthly_payment ?? 0);
    const credit = Number(c.credit_value ?? 0);
    const totalValue = Number(c.total_value ?? 0);
    const instTotal = Number(c.installments_total ?? 0);
    const instPaid = Number(c.installments_paid ?? 0);
    const instRemain = Number(c.installments_remaining ?? Math.max(instTotal - instPaid, 0));
    const pctPaid = instTotal > 0 ? Math.round((instPaid / instTotal) * 100) : 0;
    const endDate = c.end_date ? new Date(c.end_date) : null;
    const monthsLeft = endDate
      ? Math.max(0, Math.round((endDate.getTime() - today.getTime()) / (86400000 * 30)))
      : null;
    return {
      name: c.name,
      status: c.status,
      asset_type: c.asset_type,
      ownership_pct: c.ownership_pct,
      partner_name: c.partner_name,
      credit_value: Math.round(credit * 100) / 100,
      total_contracted: Math.round(totalValue * 100) / 100,
      monthly_payment: Math.round(monthly * 100) / 100,
      monthly_payment_cota_william: Math.round(monthly * ownership * 100) / 100,
      installments_paid: instPaid,
      installments_total: instTotal,
      installments_remaining: instRemain,
      pct_paid: pctPaid,
      total_paid: Math.round(totalPaid * 100) / 100,
      total_paid_cota_william: Math.round(totalPaid * ownership * 100) / 100,
      total_pending: Math.round(totalPending * 100) / 100,
      total_pending_cota_william: Math.round(totalPending * ownership * 100) / 100,
      adhesion_date: c.adhesion_date,
      end_date: c.end_date,
      months_until_end: monthsLeft,
      admin_fee_pct: c.admin_fee_pct,
      admin_fee_paid: Math.round(Number(c.admin_fee_paid ?? 0) * 100) / 100,
      fund_paid: Math.round(Number(c.fund_paid ?? 0) * 100) / 100,
      insurance_paid: Math.round(Number(c.insurance_paid ?? 0) * 100) / 100,
    };
  });

  const totalMonthlyCotaW = consortiumsOut.reduce((s, c) => s + c.monthly_payment_cota_william, 0);
  const totalCreditCotaW = consortiumsOut.reduce(
    (s, c) => s + c.credit_value * (Number(c.ownership_pct ?? 100) / 100),
    0,
  );
  const totalPaidCotaW = consortiumsOut.reduce((s, c) => s + c.total_paid_cota_william, 0);
  const totalPendingCotaW = consortiumsOut.reduce((s, c) => s + c.total_pending_cota_william, 0);

  return JSON.stringify({
    summary: {
      n_consortiums: consortiumsOut.length,
      n_active: consortiumsOut.filter((c) => c.status === "ativo").length,
      monthly_payment_cota_william: Math.round(totalMonthlyCotaW * 100) / 100,
      total_credit_cota_william: Math.round(totalCreditCotaW * 100) / 100,
      total_paid_cota_william: Math.round(totalPaidCotaW * 100) / 100,
      total_pending_cota_william: Math.round(totalPendingCotaW * 100) / 100,
    },
    consortiums: consortiumsOut,
    note:
      "Consórcios travam parcela mensal mas geram crédito futuro (imóvel ou veículo). " +
      "monthly_payment_cota_william respeita ownership_pct (Randon = 50%). " +
      "Total pendente = quanto ainda vai sair do caixa até end_date.",
  });
}

// ─── Handler: get_investments_status ─────────────────────────────────
async function handleGetInvestmentsStatus(
  _input: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const sb = createClient(supabaseUrl, serviceKey);
  const { data } = await sb
    .from("investments")
    .select(
      "name, type, bank, initial_amount, current_amount, rescue_amount, rate_percent, cdi_percent, is_cdi_linked, inclusion_date, maturity_date, product_code, notes",
    )
    .order("current_amount", { ascending: false });
  const rows = data ?? [];

  const today = new Date();

  const investmentsOut = rows.map((i: any) => {
    const current = Number(i.current_amount ?? 0);
    const rescue = Number(i.rescue_amount ?? 0);
    const initial = Number(i.initial_amount ?? 0);
    const haircut = current - rescue;
    const haircutPct = current > 0 ? Math.round((haircut / current) * 100 * 100) / 100 : 0;
    const yieldAccrued = current - initial;
    const yieldPct = initial > 0 ? Math.round((yieldAccrued / initial) * 100 * 100) / 100 : 0;
    const maturity = i.maturity_date ? new Date(i.maturity_date) : null;
    const daysToMaturity = maturity
      ? Math.ceil((maturity.getTime() - today.getTime()) / 86400000)
      : null;
    const rateLabel = i.is_cdi_linked && i.cdi_percent
      ? `${i.cdi_percent}% CDI`
      : i.rate_percent
        ? `${i.rate_percent}% a.a.`
        : "?";
    return {
      name: i.name,
      type: i.type,
      bank: i.bank,
      product_code: i.product_code,
      rate_label: rateLabel,
      current_amount: Math.round(current * 100) / 100,
      rescue_amount: Math.round(rescue * 100) / 100,
      haircut_se_resgatar_hoje: Math.round(haircut * 100) / 100,
      haircut_pct: haircutPct,
      initial_amount: Math.round(initial * 100) / 100,
      yield_accrued: Math.round(yieldAccrued * 100) / 100,
      yield_pct: yieldPct,
      inclusion_date: i.inclusion_date,
      maturity_date: i.maturity_date,
      days_to_maturity: daysToMaturity,
      notes: i.notes,
    };
  });

  const totalCurrent = investmentsOut.reduce((s, i) => s + i.current_amount, 0);
  const totalRescue = investmentsOut.reduce((s, i) => s + i.rescue_amount, 0);
  const totalHaircut = totalCurrent - totalRescue;
  const liquidoEmergencia = investmentsOut
    .filter((i) => i.haircut_pct < 5)
    .reduce((s, i) => s + i.rescue_amount, 0);

  return JSON.stringify({
    summary: {
      n_investments: investmentsOut.length,
      total_current: Math.round(totalCurrent * 100) / 100,
      total_rescue_disponivel_hoje: Math.round(totalRescue * 100) / 100,
      haircut_total_se_resgatar_tudo: Math.round(totalHaircut * 100) / 100,
      liquidez_emergencial_baixo_haircut: Math.round(liquidoEmergencia * 100) / 100,
    },
    investments: investmentsOut,
    note:
      "rescue_amount = quanto sai do banco se resgatar HOJE (com haircut por liquidação antes do prazo). " +
      "current_amount = saldo contábil. liquidez_emergencial = só investimentos com haircut <5% (mais flexíveis).",
  });
}

// ─── Tool calc — calculadora determinística ────────────────────────────────
// LLM é ruim em aritmética; força Naval a usar esta tool pra QUALQUER cálculo.
// Sandbox restrito: só dígitos, operadores aritméticos, parênteses, ponto, vírgula.
// Vírgula é convertida pra ponto (BR). Resultado retornado com formatação BR.
function handleCalc(input: { expression?: string }): string {
  const raw = (input.expression ?? "").trim();
  if (!raw) {
    return JSON.stringify({ error: "Expressão vazia. Passe algo como '720000 - 304803'." });
  }
  // Sanitização rígida: aceita só caracteres aritméticos + espaço
  if (!/^[0-9+\-*/().,\s%eE]+$/.test(raw)) {
    return JSON.stringify({
      error: "Expressão contém caracteres inválidos. Permitido: dígitos, + - * / ( ) . , % e (notação científica). Ex: '720000-304803' ou '(28547+10903)*0.97'.",
      received: raw,
    });
  }
  // Vírgula brasileira → ponto
  const normalized = raw.replace(/,/g, ".");
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${normalized})`)();
    if (typeof result !== "number" || !isFinite(result)) {
      return JSON.stringify({ error: "Resultado não é um número finito.", expression: raw, raw_result: String(result) });
    }
    const formatted = result.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    return JSON.stringify({
      expression: raw,
      result,
      formatted,
      note: "Use o campo 'result' (número exato) ou 'formatted' (string BR com vírgula) na sua resposta. Não recalcule de cabeça.",
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Erro de avaliação: ${err.message ?? String(err)}`, expression: raw });
  }
}

// ─── Detecção heurística: Sonnet vs Haiku ─────────────────────────────────
// Estratégia híbrida: análise complexa (premissa multi-fator, projeção, decisão
// estratégica) → Sonnet 4.6 (premium, ~3x custo). Pergunta factual rápida
// (saldo, status, qual tool, "está locada?") → Haiku 4.5 (rápido/barato).
//
// Heurística determinística (sem LLM extra). Decisão local em ~1ms.
function detectModelTier(
  messages: Array<{ role: string; content: unknown }>,
): "haiku" | "sonnet" {
  // Pega última msg do user (a pergunta atual)
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "haiku";
  const text = (typeof lastUser.content === "string"
    ? lastUser.content
    : JSON.stringify(lastUser.content)
  ).toLowerCase();

  // Sinais de pergunta estratégica (qualquer 1 já promove pra Sonnet)
  const STRATEGIC_KEYWORDS = [
    // Análise/projeção
    "ideal", "deveria", "estratég", "análise", "analise", "diagnóst", "diagnost",
    "projeç", "projet", "cenário", "cenario", "simul",
    // Comparação/recomendação
    "compar", "recomen", "sugir", "qual o melhor", "qual seria",
    "como faço pra", "como devo", "como posso",
    // Quantificação ampla
    "quanto preciso", "quanto deveria", "quanto faltam", "quanto tenho que",
    "vou bater", "vou conseguir", "vou atingir",
    // Plano/objetivo
    "plano", "planej", "objetivo", "atingir", "alcançar",
    // Explicação profunda
    "explica por que", "explique por que", "porquê", "por que", "qual a lógica",
    "qual a logica", "qual o motivo",
  ];
  const hasStrategicKeyword = STRATEGIC_KEYWORDS.some((kw) => text.includes(kw));

  // Mensagens longas com múltiplas frases costumam ser análises
  const sentences = text.split(/[.!?]\s+/).filter((s) => s.length > 10);
  const isLongMultiSentence = text.length > 150 && sentences.length >= 2;

  // Pergunta factual curta (ex: "saldo BB?", "kitnet RWT03-04 está locada?") → Haiku
  if (text.length < 60 && !hasStrategicKeyword) return "haiku";

  if (hasStrategicKeyword || isLongMultiSentence) return "sonnet";

  return "haiku";
}

// ─── Self-check (opção 5): auditor de qualidade pós-resposta ──────────────
// Roda 1x após Naval terminar a resposta. Procura erros aritméticos inline,
// pessoa inventada, % sem denominador, contagem não conferida. Se achar,
// reescreve a resposta inteira corrigindo. Custo: ~30-50% extra tokens mas
// elimina ~80% dos erros que escapam mesmo com Sonnet+regras+calc.
async function runSelfCheck(
  originalAnswer: string,
  userQuestion: string,
  anthropicKey: string,
): Promise<{ corrected?: string; issues?: string[] }> {
  const checkPrompt = `Você é AUDITOR PARANOICO de uma resposta de analista financeiro do William Tavares.

A custo de UM falso positivo é BAIXO (resposta reescrita ligeiramente diferente).
O custo de UM erro escapando é ALTO (William perde confiança no Naval, decide errado).
**REGRA-MÃE:** quando em dúvida, SINALIZA. Não seja leniente.

Pergunta original do William:
"""${userQuestion}"""

Resposta do Naval pra auditar:
"""${originalAnswer}"""

═══ PROCURE ESTES 7 PADRÕES DE ERRO ═══

**1. Aritmética inline ERRADA**
Refaça TODA conta que aparece na resposta. Use calculadora mental cuidadosa:
- 2+2, 100/2 — fácil, mas confere
- Médias, divisões, somas longas — REFAZ
- Se Naval escreveu "X+Y=Z" ou "X de Y%" ou "média de N=M", VERIFICA o resultado
- Erro de 1 dígito = erro grave (já houve "304700/4 = 50800" quando o certo é 76175)

**2. META DIVIDIDA POR 12 QUANDO JÁ ERA MENSAL** ← critico
Se Naval escreveu "R$ 100k ÷ 12 = R$ 8.333/mês" PARA UMA META JÁ MENSAL ("Renda Mensal R$ 100k", "Renda Passiva R$ 30k") — ERRO FATAL.
Metas com "Mensal" / "Renda" no nome JÁ são mensais. Não dividir por 12.
SÓ dividir por 12 quando explicitamente "anual" / "Receita Anual" / "/ano".

**3. CONTRADIÇÃO INTERNA: mesmo conceito com 2 números diferentes**
Releia a resposta procurando o MESMO conceito ("aluguel", "comissão", "caixa", "CLT", "kitnet") aparecendo com VALORES DIFERENTES em parágrafos próximos.
Ex: "Aluguel R$ 21.841" no §1 + "aluguel R$ 19.406" no §3 → INCONSISTENTE.

**4. Tool result usado SEM interpretar (especialmente pro-rata baixo)**
Se Naval citou número estranhamente baixo de tool sem explicar (ex: "CLT R$ 1.720" quando real é R$ 10.903), provavelmente usou forecast pro-rata como se fosse mês cheio. ERRO FATAL.
Sinais: número >50% abaixo da média esperada; label "5% do mês" / "parcial" sendo aplicado nos totais.

**5. Pessoa inventada**
Nomes permitidos: William, Diego, Jairo, Walmir, Cláudio, Henrique, Cleide.
QUALQUER outro nome de pessoa real = alucinação (Lara, Marcos, João, Pedro, etc).

**6. Percentual sem denominador explícito**
"X% do mês", "Y% da receita", "Z% do total" SEM mostrar "(X ÷ Y = Z%)" → ambíguo.
Sempre formato: "X% **de [substantivo concreto]** (X ÷ Y)".

**7. Contagem sem fonte de tool**
Quantidades de unidades/contratos/obras SEM indicar tool de origem.
Ex: "12 kitnets" sem ter chamado get_kitnets_status.

═══ FORMATO DE OUTPUT ═══

- Se NÃO houver NENHUM erro dos 7 acima → retorne EXATAMENTE: OK
- Se houver QUALQUER erro → retorne JSON estrito (sem markdown, sem prosa antes/depois):

{
  "issues": ["#2: meta R$100k dividida por 12 mas já é mensal", "#3: aluguel aparece como 21.841 e 19.406", "#4: CLT R$1.720 é pro-rata, real é 10.903"],
  "corrected": "<resposta INTEIRA reescrita corrigindo TODOS os erros listados, mantendo tom direto, estrutura de tabelas, e cálculos refeitos. Use os valores corretos. Mantenha extensão similar.>"
}

Seja paranoico mas justo: só sinaliza erro VERIFICÁVEL. Não invente erro pra justificar reescrita.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{ role: "user", content: checkPrompt }],
      }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const blocks = Array.isArray(data.content) ? data.content : [];
    const text = blocks.map((b: any) => b?.text ?? "").join("").trim();
    if (!text) return {};
    if (text === "OK" || text.toUpperCase().startsWith("OK")) return {};
    // Extrai JSON (modelo pode envolver em prose mesmo proibido)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.corrected === "string" && parsed.corrected.length > 100) {
        return { corrected: parsed.corrected, issues: parsed.issues };
      }
      return {};
    } catch {
      return {};
    }
  } catch {
    return {};
  }
}

// ─── Claude (Haiku 4.5 ou Sonnet 4.6 conforme detectModelTier) ────────────
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
    /** "haiku" (default, rápido/barato) ou "sonnet" (raciocínio premium pra análises). */
    model?: "haiku" | "sonnet";
  },
): Promise<ClaudeResult> {
  // Normaliza pra ter sempre {fixed, variable}. String simples vai toda em "fixed".
  const sys = typeof systemPrompt === "string"
    ? { fixed: systemPrompt, variable: "" }
    : systemPrompt;
  const fullSystemForGateway = sys.fixed + sys.variable;
  const maxTokens = opts.maxTokens ?? 1500;
  // Híbrido: Sonnet 4.6 pra análise estratégica, Haiku 4.5 pra factual rápido.
  const useSonnet = opts.model === "sonnet";
  const MODEL_GW = useSonnet ? "anthropic/claude-sonnet-4-6" : "anthropic/claude-haiku-4-5";
  const MODEL_NATIVE = useSonnet ? "claude-sonnet-4-6" : "claude-haiku-4-5";
  const MODEL_LABEL = useSonnet ? "Sonnet 4.6" : "Haiku 4.5";
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
          console.log(`[wisely-ai] Naval via Lovable Gateway · ${MODEL_LABEL} (sem tools) ✓`);
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
    // 12 iterações: análises estratégicas (Sonnet) chamam várias tools de dados
    // (4-6) + várias chamadas calc() (3-6 operações aritméticas). 5 era apertado
    // demais e gerava "Loop de tool-use excedeu" em análises completas.
    const MAX_TOOL_ITER = 12;
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
      console.log(`[wisely-ai] Naval via Anthropic API · ${MODEL_LABEL} ${useTools ? `(tools, ${iter} iter)` : "(sem tools)"} ✓`);

      // Self-check (opção 5): só pra Sonnet com resposta substancial (>500 chars)
      // Custa ~30-50% extra de tokens mas elimina ~80% dos erros que escapam.
      let finalText = text;
      if (useSonnet && opts.anthropicKey && text.length > 500) {
        try {
          const userMsg = [...messages].reverse().find((m) => m.role === "user");
          const userText = userMsg
            ? (typeof userMsg.content === "string" ? userMsg.content : JSON.stringify(userMsg.content)).slice(0, 800)
            : "";
          const checkResult = await runSelfCheck(text, userText, opts.anthropicKey);
          if (checkResult.corrected && checkResult.corrected.length > 200) {
            console.log(`[wisely-ai] self-check corrigiu ${checkResult.issues?.length ?? 0} erro(s): ${(checkResult.issues ?? []).join("; ").slice(0, 250)}`);
            finalText = checkResult.corrected;
          } else {
            console.log(`[wisely-ai] self-check OK · sem correções`);
          }
        } catch (selfErr) {
          console.warn(`[wisely-ai] self-check falhou: ${selfErr instanceof Error ? selfErr.message : String(selfErr)}`);
          // Mantém a resposta original — self-check é melhoria, não bloqueio
        }
      }

      return { ok: true, text: finalText, usage: lastUsage, tools_used: Array.from(toolsUsedSet) };
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
const WISELY_AI_VERSION = "2026.05.02-v41-tool-iter-12";

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
    // Híbrido: detecta se a pergunta é estratégica (Sonnet) ou factual (Haiku)
    const modelTier = detectModelTier(messages);
    console.log(`[wisely-ai] modelTier=${modelTier} · useTools=${useTools}`);
    const result = await callClaudeHaiku(systemPrompt, messages, {
      maxTokens: modelTier === "sonnet" ? 3000 : 2000,
      lovableKey: LOVABLE_API_KEY,
      anthropicKey: ANTHROPIC_API_KEY,
      model: modelTier,
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
            get_bank_balances: (input) => handleGetBankBalances(input, supabaseUrl, serviceKey),
            get_debts_status: (input) => handleGetDebtsStatus(input, supabaseUrl, serviceKey),
            get_net_worth_snapshot: (input) => handleGetNetWorthSnapshot(input, supabaseUrl, serviceKey),
            get_milestone_gap: (input) => handleGetMilestoneGap(input, supabaseUrl, serviceKey),
            simulate_scenario: (input) => handleSimulateScenario(input, supabaseUrl, serviceKey),
            get_kitnets_status: (input) => handleGetKitnetsStatus(input, supabaseUrl, serviceKey),
            get_current_card_invoice: (input) => handleGetCurrentCardInvoice(input, supabaseUrl, serviceKey),
            get_wedding_status: (input) => handleGetWeddingStatus(input, supabaseUrl, serviceKey),
            mark_installment_paid: (input) => handleMarkInstallmentPaid(input, supabaseUrl, serviceKey),
            link_bank_tx_to_construction_expense: (input) => handleLinkBankTxToConstructionExpense(input, supabaseUrl, serviceKey),
            get_dre_monthly: (input) => handleGetDREMonthly(input, supabaseUrl, serviceKey),
            get_cashflow_forecast: (input) => handleGetCashflowForecast(input, supabaseUrl, serviceKey),
            get_projections: (input) => handleGetProjections(input, supabaseUrl, serviceKey),
            get_reconciliation_status: (input) => handleGetReconciliationStatus(input, supabaseUrl, serviceKey),
            get_taxes_status: (input) => handleGetTaxesStatus(input, supabaseUrl, serviceKey),
            get_strategic_plan: (input) => handleGetStrategicPlan(input, supabaseUrl, serviceKey),
            list_categories: (input) => handleListCategories(input, supabaseUrl, serviceKey),
            audit_data_sources: (input) => handleAuditDataSources(input, supabaseUrl, serviceKey),
            cleanup_pipeline_old_months: (input) => handleCleanupPipelineOldMonths(input, supabaseUrl, serviceKey),
            upsert_prevensul_billing: (input) => handleUpsertPrevensulBilling(input, supabaseUrl, serviceKey),
            get_active_goals: (input) => handleGetActiveGoals(input, supabaseUrl, serviceKey),
            parse_task_nlp: (input) => handleParseTaskNlp(input, supabaseUrl, serviceKey),
            promote_alert_to_task: (input) => handlePromoteAlertToTask(input, supabaseUrl, serviceKey),
            update_pipeline_stage: (input) => handleUpdatePipelineStage(input, supabaseUrl, serviceKey),
            get_recurring_bills: (input) => handleGetRecurringBills(input, supabaseUrl, serviceKey),
            get_other_commissions_status: (input) => handleGetOtherCommissionsStatus(input, supabaseUrl, serviceKey),
            get_energy_solar_status: (input) => handleGetEnergySolarStatus(input, supabaseUrl, serviceKey),
            get_consortium_status: (input) => handleGetConsortiumStatus(input, supabaseUrl, serviceKey),
            get_investments_status: (input) => handleGetInvestmentsStatus(input, supabaseUrl, serviceKey),
            calc: (input) => handleCalc(input as { expression?: string }),
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
