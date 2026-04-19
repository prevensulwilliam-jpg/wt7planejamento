-- SEED_NAVAL_MEMORY.sql
-- Popula naval_memory com o conteúdo dos .md de ~/.claude/memoria/
-- Gerado em 2026-04-19T17:22:54.283Z
-- Rodar no Lovable → SQL Editor após MIGRATIONS_TO_RUN.sql

INSERT INTO public.naval_memory (slug, title, content, priority, updated_at)
VALUES ('aprendizados', 'Aprendizados e Padrões', '# Aprendizados e Padrões

*Última atualização: 01/04/2026*

## Decisões Arquiteturais (não revisitar)

### PDF e DOCX são sistemas independentes no PrevFlow
Pipelines separados: PDF via Browserless, DOCX via docx.js. Cada formato tem requisitos visuais e estruturais próprios. **Isso é design, não débito técnico.** Não tentar unificar.

### PPTX removido definitivamente
Avaliado e eliminado do PrevFlow. Decisão final — não revisitar.

### Claude + Lovable = complementares
- Claude: ideação, validação rápida, debugging, estratégia, lógica complexa, documentos
- Lovable: frontend React de produção, componentes, deploy
- Não são concorrentes. Usar cada um no que é melhor.

### Build > Buy, mas delegar com briefing
William prefere construir, mas escala via freelancers pontuais com briefings detalhados (99Freelas/Workana). Rejeitou dois programas de mentoria por desalinhamento com stack. O modelo é: **aprender fazendo + contratar cirurgicamente.**

## Padrões Técnicos Recorrentes

### Bugs no PrevFlow: verificar lógica de detecção no preview primeiro
O `objetivo_proposta` 3 cards teve bug cuja root cause era a lógica de detecção no `ProposalPreviewPanel.tsx`. **Padrão:** quando algo não renderiza corretamente no preview, investigar primeiro o componente de preview (parsing/detecção), não o gerador de dados.

### RLS: auditar proativamente ao adicionar tabelas
Gaps descobertos nas policies de `proposal_shares`. **Regra:** sempre auditar RLS ao criar novas tabelas ou relações no Supabase. Não assumir que policies existentes cobrem novos fluxos.

### NBR 17240: bateria = 7Ah
Correção real em projeto (Fibra Papéis): norma exige 7Ah, não 2.2Ah. **Sempre validar specs de bateria contra a NBR 17240 vigente.**

### Deploy Lovable: GitHub direct file replacement
Substituição direta de arquivos no repo GitHub → auto-deploy Lovable. Funciona, requer cuidado com conflitos de merge.

## Padrões Comerciais

### Vendedor Diamante (Eduardo Tevah)
Metodologia de vendas consultivas adotada para geração de textos comerciais via IA no PrevFlow. Foco em persuasão consultiva, não vendas agressivas.

### B2B2C via fabricantes de pré-moldados
Estratégia: vender para fabricantes de pré-moldados (ex: Premoldi) que atendem construtoras → canal indireto de distribuição para serviços de prevenção. Pode escalar via SaaS.

### Seeds / Nets / Spears
Framework Predictable Revenue implementado:
- Seeds = indicações (lento, alta conversão)
- Nets = inbound/marketing (site, SEO)
- Spears = outbound ativo (Cold Calling 2.0, SDR)

### Mapeamento normativo = diferencial competitivo
PrevFlow mapeia estado → Corpo de Bombeiros correto (27 estados + ITs específicas). Concorrentes não fazem isso. É um dos maiores diferenciais do SaaS.

## Insights de Negócio

### Financiamento: prazo longo + pagamento antecipado
Caixa EGI, contrato 240 meses (PRICE/TR). Pagar no ritmo desejado, com a segurança de poder reduzir para parcela mínima se a renda cair. **Flexibilidade > economia de juros bruta.**

### SaaS: validar internamente antes de tudo
2026 inteiro = validação na Prevensul. 2027 = mercado externo. **Não pular a fase de validação interna.** O produto precisa funcionar perfeitamente para William antes de vender para outros.

### Mentoria vs. execução
Programas de mentoria genéricos não servem quando a stack é proprietária e a visão é clara. Melhor investir em **execução assistida** (freelancers com briefing) do que em **orientação genérica** (mentores).

## Regras Permanentes para o Claude

> Estas regras devem ser seguidas em TODA interação com William.

1. **Não pedir confirmação para ações óbvias** — executar e deixar William ajustar
2. **Propostas Prevensul = ReportLab + `template_proposta.py`** — modelo canônico
3. **Contratos Prevensul = docx.js + `template_contrato.js`** — modelo canônico
4. **William é técnico** — não explicar conceitos básicos, ir direto ao ponto
5. **PT-BR** — idioma padrão
6. **Agir como parceiro estratégico** — propor, questionar, sinalizar
7. **Sprints curtos** — entregas incrementais, sem planos enormes
8. **PrevFlow e WT7 = projetos prioritários** — contexto sempre relevante
9. **Não sugerir ferramentas/serviços que ele já rejeitou ou substituiu**
10. **Se identificar problema ou oportunidade, sinalizar proativamente** — não esperar ser perguntado
', 7, now())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  updated_at = now();

INSERT INTO public.naval_memory (slug, title, content, priority, updated_at)
VALUES ('empresa_produtos', 'Empresa e Produtos', '# Empresa e Produtos

*Última atualização: 19/04/2026*

> **Nota:** Prevensul é **empregador atual do William**, não é negócio dele. Estrutura de negócios reais (WT7 Holding + T7 Sales) está em `memoria/negocios.md`.

## Prevensul Comercial Elétrica

- **Sede:** Itajaí/SC
- **Mercado:** +25 anos de atuação
- **Setor:** Prevenção contra incêndio, sistemas elétricos, energia solar, materiais técnicos
- **Relação William:** Diretor Comercial CLT (10k fixo + 3% comissão). Transição planejada para PJ via T7 Sales pós-2029.

## Três Verticais de Negócio da Prevensul

### 1. Obras — Projetos de Prevenção e Elétrica
- PPCI (Plano de Prevenção Contra Incêndio) — memoriais descritivos, plantas, dimensionamento
- Projetos e instalações elétricas
- Sistemas de detecção e alarme de incêndio (NBR 17240)
- Execução de obras de prevenção
- **Quem vende:** William (único closer)

### 2. Loja — Varejo de Materiais Elétricos
- Venda de materiais elétricos e de prevenção (balcão + B2B)
- **Equipe:** Jaine, Gustavo, Rayane (3 pessoas)

### 3. Solar — Q7 Energia Solar
- Projetos fotovoltaicos residenciais e comerciais

## Clientes Típicos

- Empresas que precisam de PPCI para regularização junto ao Corpo de Bombeiros
- Construtoras e incorporadoras
- Indústrias: Fibra Papéis (sistema de alarme), Premoldi (pré-moldados de concreto), GRAND FOOD (concentração de comissões)
- Comércios e centros logísticos: Verde Vale Trade Park, Santos e Negócios (Barra Velha/SC)
- Fabricantes de pré-moldados como canal B2B2C (estratégia identificada)

## Modelo Comercial

- **CRM:** Agendor
- **Closer único:** William (acumula todo o ciclo de vendas)
- **Playbook Comercial 2026:** 9 módulos completos — MEDDIC, Challenger Sale, SDR, KPIs
- **Framework de prospecção (Predictable Revenue):**
  - Seeds = indicações (lento, alta conversão)
  - Nets = inbound (site, SEO, conteúdo)
  - Spears = outbound ativo (Cold Calling 2.0, SDR)
- **Automações exploradas:** WhatsApp → Agendor via Make

## Normas e Regulamentação

- **NBR 17240** — detecção e alarme de incêndio (referência constante)
- **Instruções Técnicas (IT)** — do Corpo de Bombeiros, mapeadas por estado (27 estados) no PrevFlow
- Classificações de risco (ex: J-2)

## Diferenciais Competitivos da Prevensul

1. +25 anos de mercado = credibilidade e base instalada
2. Expertise técnica profunda em normas (NBR, ITs de cada estado)
3. Digitalização agressiva: PrevFlow (propostas com IA), dashboards, IA — enquanto concorrentes usam Excel
4. Atendimento consultivo (Challenger Sale) vs. vendedores transacionais do setor
5. Propostas profissionais geradas por IA com custo-por-m² e textos persuasivos

## Receita William (comercial Prevensul) — Abril/2026

- **Renda média Q1/2026:** R$ 45.912/mês (R$ 10k CLT + R$ 35.912 comissão)
- **Pipeline já contratado (abril/2026):** ~R$ 272k em comissões futuras nos próximos 24 meses
- **Concentração de risco:** GRAND FOOD = 75% do pipeline futuro
- **Obra nova fechada abril/2026 (não registrada ainda):** +R$ 12k/mês × 12 meses = +R$ 144k

---

## Ferramentas Internas Desenvolvidas pelo William (não são negócios)

### PrevFlow — Gerador de Propostas
- Ferramenta interna da Prevensul
- React/TypeScript (Lovable) + Supabase Edge Functions + Browserless + Claude API + Gemini 2.5 Flash
- **Possível SaaS em 2027** — avaliação futura, não cravado
- Se virar SaaS, entra como sub-vetor da T7 Sales

### WT7 — Sistema de Gestão Financeira Pessoal
- Uso interno do William
- React 18 + TypeScript + Vite (Lovable) + Supabase + TanStack Query
- Não será comercializado
', 3, now())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  updated_at = now();

INSERT INTO public.naval_memory (slug, title, content, priority, updated_at)
VALUES ('familia', 'Família', '# Família

*Última atualização: 01/04/2026*

## Membros Conhecidos

### Irmão — Diego Tavares
- **Nascimento:** 22/04 (~1991, 5 anos mais novo que William)
- Referência em contextos pessoais e familiares

### Noiva
- Nome não registrado na memória — William pode complementar
- **Casamento:** dezembro de 2027, Villa Sonali, Balneário Camboriú/SC
- Gestão do casamento integrada ao sistema WT7 (Sprint 5)

## Patrimônio Imobiliário Familiar

### Residenciais Próprios
- **Residencial W. Tavares 2** — complexo de kitnets em Itajaí/SC (com sistema solar)
- **Residencial W. Tavares 3** — complexo de kitnets em Itajaí/SC (com sistema solar)
- **Total:** 13 unidades de aluguel → ~R$20k/mês de renda passiva
- **Imóvel patrimonial** em Blumenau/SC

### Projetos Imobiliários com Parceiros

| Projeto | Parceiro | Participação |
|---------|----------|-------------|
| RJW01 | Jairo | 50% |
| RJW02 | Jairo | 50% |
| RWW01 | Walmir | 50% |
| RWT04 | Solo (William) | 100% |

## Informações Não Registradas

> Os itens abaixo não estão na memória do Claude. William pode preencher se desejar:
> - Nome completo da noiva
> - Nomes dos pais
> - Animais de estimação
> - Outros familiares relevantes
', 9, now())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  updated_at = now();

INSERT INTO public.naval_memory (slug, title, content, priority, updated_at)
VALUES ('historico_profissional', 'Histórico Profissional', '# Histórico Profissional

*Última atualização: 19/04/2026*

## Formação

- **Graduação:** Engenharia de Telecomunicações
- Base técnica que sustenta a capacidade de William construir software, automações e sistemas sem depender de terceiros

## Trajetória

> Nota: a memória não registra empresas anteriores à Prevensul. William pode complementar.

### Prevensul Comercial Elétrica — Diretor Comercial (CLT, atual)
- Empresa com +25 anos de mercado em Itajaí/SC
- William é o principal closer e único vendedor sênior
- Construiu do zero: playbook comercial (9 módulos), métricas, processo de vendas, estrutura SDR
- Responsável por toda estratégia comercial, da prospecção ao pós-venda
- **Transição planejada:** pós-2029 sai do CLT, vira PJ e continua vendendo pra Prevensul via T7 Sales

### T7 Sales — Sócio (em estruturação)
- Sociedade informal com irmão Diego (50/50) — sem CNPJ ainda
- Guarda-chuva dos vetores comerciais do William fora da Prevensul
- TDI (empresa no nome do Diego, atende TIM) já está sob esse guarda-chuva
- Faturamento inicial previsto julho/2026

### WT7 Holding — Gestor/Proprietário
- Núcleo de patrimônio imobiliário (kitnets + construções + Blumenau)
- 13 unidades em operação (RWT02 + RWT03) + 4 obras em andamento
- Renda passiva atual: ~R$ 20k/mês → projeção 2027: ~R$ 40k/mês

## Evolução como Builder de Tecnologia

A trajetória de William mostra uma migração progressiva: **vendedor consultivo → builder de ferramentas → gestor patrimonial multi-vetor.**

### Fase 1 — Templates e Padronização de Documentos
- `template_proposta.py` (Python/ReportLab) — cover com logo, faixas vermelhas, 7 seções fixas, tabelas zebra, header/footer profissional
- `template_contrato.js` (Node.js/docx) — header com linha vermelha, 20 cláusulas fixas, tabelas vermelho/cinza
- Base reusável de TODOS os documentos Prevensul

### Fase 2 — Dashboards e Inteligência Comercial (arquivada)
- **Infinity+ Dashboard** (Chart.js, tema azul escuro) — projeto arquivado

### Fase 3 — Ferramentas Internas com IA (atual)
- **PrevFlow** — gerador de propostas comerciais com IA generativa (ferramenta interna Prevensul)
- **WT7** — gestão financeira pessoal (uso diário interno, 7+ sprints)
- Stack consolidada: Lovable + Supabase + Browserless + Claude API + Gemini 2.5 Flash

## Habilidades Acumuladas

### Vendas B2B Complexas
- Ciclo longo, múltiplos decisores, projetos técnicos de alto valor
- MEDDIC, Challenger Sale, Predictable Revenue (Seeds/Nets/Spears, Cold Calling 2.0)
- Construção de playbooks e processos do zero

### Técnico — Prevenção e Elétrica
- PPCI completo: memoriais descritivos, plantas interativas, listas de materiais
- NBR 17240, ITs do Corpo de Bombeiros (27 estados)
- Classificação de risco, dimensionamento de alarme e detecção

### Desenvolvimento de Software
- React/TypeScript (via Lovable), Supabase (Edge Functions/Deno, RLS, PostgreSQL)
- Python (ReportLab para PDFs), Node.js (docx.js para contratos)
- IA: prompting avançado, integração Claude API e Gemini
- Automação: Make/n8n, WhatsApp via Evolution API
- Deploy: GitHub → Lovable auto-deploy
- Glide (apps low-code)

### Investimentos e Finanças
- Financiamento imobiliário (Caixa EGI, PRICE/TR vs. SAC/Taxa Fixa)
- Gestão de portfólio de 13 kitnets com renda passiva
- Gestão de sociedades com parceiros (Jairo, Walmir, Diego, Claudio)
- Consórcios como alavanca patrimonial (Ademicon, Randon)

## Momentos de Virada

1. **Decidiu construir ferramentas próprias** ao invés de comprar SaaS genérico — nasceu o PrevFlow
2. **Rejeitou dois programas de mentoria** por desalinhamento com sua stack — preferiu contratar freelancers pontuais com briefings detalhados (99Freelas/Workana)
3. **Concluiu que Claude + Lovable são complementares** — não concorrentes
4. **Escolheu manter PDF e DOCX como sistemas independentes** no PrevFlow — decisão arquitetural deliberada
5. **Removeu PPTX do PrevFlow** — decisão definitiva
6. **Entrevista estratégica 19/04/2026** — cravou meta R$ 70M / 2041, estrutura WT7 Holding + T7 Sales, eliminou "Brava Comex" e reposicionou PrevFlow como ferramenta (não negócio)
', 4, now())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  updated_at = now();

INSERT INTO public.naval_memory (slug, title, content, priority, updated_at)
VALUES ('identidade', 'Identidade', '# Identidade

*Última atualização: 19/04/2026*

## Dados Pessoais

- **Nome:** William Tavares
- **Data de nascimento:** 01/11/1986 (40 anos)
- **Cidade:** Praia Brava, Itajaí — Santa Catarina, Brasil
- **Formação:** Engenheiro de Telecomunicações
- **Marco pessoal:** Casamento 11/12/2027, Villa Sonali, Balneário Camboriú/SC

## Posição Atual

- **Empresa:** Prevensul Comercial Elétrica (Itajaí/SC)
- **Cargo:** Diretor Comercial — CLT (10k fixo + 3% comissão sobre fat das suas vendas quando pago)
- **Setor:** Prevenção contra incêndio, instalações elétricas, energia solar, materiais técnicos
- **Empresa no mercado:** +25 anos
- **Renda Prevensul Q1/2026 (real):** R$ 45,9k/mês em média (CLT 10k + comissão média 35,9k)

## As Três Frentes Reais

### Frente 1 — Comercial (Prevensul e, no futuro, T7 Sales)
Único closer sênior da Prevensul. Conduz ciclo comercial completo: prospecção (Seeds/Nets/Spears), qualificação, proposta técnica, negociação, fechamento. Pipeline de comissões já contratado (abr/2026): ~R$ 272k a receber dos próximos ~24 meses. Concentração perigosa em 1 cliente (GRAND FOOD = R$ 202k dos 272k).

**Transição planejada:** pós-2029 sai do CLT, vira PJ e continua vendendo pra Prevensul **através da T7 Sales** (não perde o cliente, muda o vínculo).

### Frente 2 — Construção patrimonial (WT7 Holding)
Núcleo de acumulação de riqueza. Hoje 13 kitnets em 2 residenciais próprios (RWT02 São João + RWT03 Centro). Casa Blumenau como patrimônio alienável (R$ 1M). 4 obras em andamento aumentando portfólio pra 41 unidades até 2030.

### Frente 3 — Novo vetor comercial (T7 Sales + TDI)
Sociedade informal William + irmão Diego. TDI = empresa constituída em nome do Diego sob o guarda-chuva da T7 (contrato TIM não permite sociedade). Início do faturamento previsto julho/2026 com R$ 10k/mês + crescimento 10-15%/mês.

### Frente 4 — Construção de Tecnologia (habilidade, não frente de renda)
Constrói ferramentas internas: **WT7** (este sistema de gestão financeira) e **PrevFlow** (gerador de propostas com IA, ferramenta interna da Prevensul). Stack: React/TypeScript (Lovable), Supabase, IA via Gemini/Claude. **PrevFlow e WT7 são ferramentas, não negócios.**

## Perfil Resumido (uma frase)

Engenheiro de telecom que virou diretor comercial e construtor de patrimônio imobiliário — acumula renda ativa da Prevensul, reinveste em obras próprias, constrói a T7 Sales com o irmão como próximo vetor, e planeja virar operador eterno (não aposentado) de um portfólio de R$ 70M até 2041.

## Meta-âncora (reference rápida)

- **Patrimônio-alvo:** R$ 70M até 2041 (15 anos — 55 anos de idade)
- **Renda-alvo:** R$ 200k/mês
- **Modo:** operador eterno, formato muda (local, CLT→PJ→sócio), produção nunca para
- **Composição final:** R$ 60M imóveis+bens (apt frente-mar Brava 15-20M, casa Rosa/Guarda 5M, apt SP 5M, carros) + R$ 10M líquido investido

Detalhamento completo em `memoria/metas.md`.
', 0, now())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  updated_at = now();

INSERT INTO public.naval_memory (slug, title, content, priority, updated_at)
VALUES ('metas', 'Metas e Objetivos — William Tavares', '# Metas e Objetivos — William Tavares

*Criado: 19/04/2026. Fonte única de verdade para Claude Code + Naval (IA do WT7).*

---

## 🎯 Visão de Longo Prazo

| Item | Valor |
|---|---|
| **Patrimônio-alvo total** | R$ 70.000.000 |
| **Horizonte** | Até 2041 (15 anos a partir de 04/2026, aos 55 anos) |
| **Renda-alvo mensal** | R$ 200.000/mês |
| **Modo de vida no topo** | Operador eterno — nunca para; formato muda, produção continua |

### Composição-alvo do patrimônio (R$ 70M)

- **R$ 60M em imóveis + bens:**
  - Apt frente-mar Praia Brava, Itajaí: R$ 15-20M
  - Casa de praia Rosa ou Guarda do Embaú: R$ 5M
  - Apartamento em São Paulo: R$ 5M
  - Portfólio WT7 Holding (kitnets + construções): remanescente
  - Carros (William + esposa)
- **R$ 10M em investimentos líquidos:** ações, renda fixa, possivelmente cripto

---

## 🛡️ Patrimônio Atual (abril/2026)

| Ativo | Valor líquido (cota real) |
|---|---|
| RWT 02 São João (8 kitnets, 100%) | R$ 1.800.000 |
| RWT 03 Centro (5 kitnets, 100%) | R$ 750.000 |
| RWT 01 Casa Blumenau (100%, patrimonial, não vender 3 anos) | R$ 1.000.000 |
| RWT 04 Itaipava (terreno, 100%) | R$ 350.000 |
| RWT 05 & Corrêa (50%, sócio Walmir) | R$ 250.000 |
| JW7 Itaipava (50%, sócio Jairo) | R$ 175.000 |
| JW7 Praia do Sonho (50%, sócio Jairo) | R$ 150.000 |
| Rampage (líquida da dívida 16× R$ 3.450) | R$ 134.800 |
| Consórcio Ademicon (pago 30%) | R$ 79.924 |
| Conta corrente | R$ 50.000 |
| Consórcio Randon (50%, pago 39,5%) | R$ 22.744 |
| **TOTAL PATRIMÔNIO LÍQUIDO** | **R$ 5.762.468** |

**Observação:** Blumenau pode ser usada como garantia de alienação para empréstimo (fogo estratégico).

---

## 📊 CAGR Real Exigido

**R$ 5,76M → R$ 70M em 15 anos = 17,3% a.a. composto.**

Fase | Patrimônio | CAGR da fase
---|---|---
2026 → 2027 | 5,76M → 6,5M | 7% a.a.
2027 → 2030 | 6,5M → 7,75M | 6% a.a.
2030 → 2035 | 7,75M → 15M | 14% a.a.
**2035 → 2041** | **15M → 70M** | **🔴 29,3% a.a.**

**Elefante no caminho:** o salto 2035→2041 exige evento de liquidez (venda de T7 Sales / parte) + valorização assimétrica de imóveis frente-mar + alavancagem pesada. Naval deve pensar em **tese de saída T7** de 2032 em diante.

---

## 🏁 Marcos Intermediários

### Marco 2027 — Casamento (11/12/2027)
- **Caixa mínimo pra dormir tranquilo:** R$ 100.000
- **Renda mensal-alvo:** R$ 100.000
  - Aluguéis: R$ 40k (20k atuais + 5k JW7 Sonho + 7,5k RWT05 + 7,5k JW7 Itaipava)
  - Prevensul: R$ 40k (ritmo atual já entrega isso)
  - T7 (via TDI): R$ 20k
- **Obras conclusas até 2027:** JW7 Sonho (fase 1 de 10 kitnets), RWT05 (5 kitnets), JW7 Itaipava
- **Obras deixadas pra 2028:** RWT04 e fase 2 das demais (depende de caixa)

### Marco 2030 — Consolidação (44 anos)
- **Patrimônio-alvo:** R$ 7,75M
- **Renda mensal-alvo:** R$ 165.000
  - Aluguéis: R$ 65k (41 unidades totais)
  - Prevensul: R$ 50k (ainda CLT se não migrou ainda)
  - T7 Sales: R$ 50k
- **Portfólio imobiliário consolidado:** todas as obras da 1ª pegada concluídas

### Marco 2035 — Meio do Caminho (49 anos)
- **Patrimônio-alvo:** R$ 15M
- **Renda mensal-alvo:** R$ 200k (atinge a meta de renda)
- **Endereço:** apartamento frente-mar Praia Brava
- **T7 Sales:** empresa "vendável" com múltiplo de saída

### Marco 2041 — Destino (55 anos)
- **Patrimônio:** R$ 70M
- **Renda:** R$ 200k+ (mantida, patrimônio composto via reinvestimento)

---

## 🔥 Métrica-Chave: Sobra Reinvestida

**Fórmula:** `(Receita total − Custo de vida − Impostos − Dívidas operacionais) alocada em ativo gerador de patrimônio`

**Piso mensal alvo:** **50% da receita total**
**Meta estrelada:** 60-70% da receita em fases de aceleração

### O que CONTA como Sobra Reinvestida
- ✅ Aporte em obra própria (WT7 Holding)
- ✅ Parcela de consórcio (Ademicon + Randon)
- ✅ Aporte em T7/TDI (quando for pra expansão, não custeio)
- ✅ Amortização de financiamento imobiliário (quando houver)
- ✅ Investimento em ações/renda fixa (prioridade baixa agora, garantia de longo prazo)

### O que NÃO CONTA
- ❌ Parcelas Rampage (juros zero = consumo quitando)
- ❌ Retirada T7 para cobrir custo de vida
- ❌ Pagamento de cartão (exceto se a compra específica foi aporte)

### Situação real (abril/2026)
- Renda total estimada: **~R$ 85k/mês**
- Custo de vida real: **~R$ 42k/mês** (conforme `/recurring-bills`)
- Sobra bruta: **~R$ 43k (49%)** — já no limiar do piso de 50%
- **Desafio:** manter 50%+ ENQUANTO a receita cresce 3-4x. Essa é a jogada.

---

## 💳 Custo de Vida — Composição Abril/2026

| Categoria | Valor | % |
|---|---|---|
| **Cartão BB** | R$ 13.580 | 31% |
| **Cartão XP** | R$ 18.829 | 43% |
| **Subtotal cartões** | **R$ 32.409** | **74%** |
| Aluguel apt Aloha | R$ 5.036 | 11% |
| Consórcio Randon | R$ 598 | 1% |
| Consórcios NREG (2×) | R$ 3.272 | 7% |
| Outros (condom, academia, médico, pets...) | R$ 2.501 | 6% |
| **TOTAL ORÇADO** | **R$ 43.816** | 100% |

**Alerta Naval:** cartões = 74% do custo. Cenário A: consumo corrente inflado (problema). Cenário B: inclui aportes em obra/material disfarçados (neutro). Cenário C: mix.

**Próximo módulo no WT7 (Sprint 2):** análise granular de cartões com categorização (alimentação, obras, lazer, viagens, estudos) + tracking de milhas/pontos (BB + XP têm programas).

---

## 🚨 Restrições e Riscos Conhecidos

### Operacionais
- **Gargalo humano:** William é único closer Prevensul + único builder de tecnologia + único gestor imobiliário → todos os vetores competem pelo mesmo recurso (tempo do William).
- **Concentração Prevensul/GRAND FOOD:** 75% das comissões futuras dependem de 1 cliente. Se GRAND FOOD atrasar 60 dias, renda Prevensul cai pra ~R$ 15k naquele mês.
- **TDI ainda não fatura:** R$ 0 hoje; depende de contrato TIM + operação do Diego estar pronta.

### Psicológicas
- **Hipocondria + ansiedade + TOC:** em tratamento psiquiátrico. Treino com personal Henrique às 12h é âncora do dia — inegociável.
- **Aversão a delegar sem briefing:** prefere construir e depois delegar com documentação completa.

### Defensivas (travas que Naval nunca deve propor quebrar)
- Nunca recomendar queimar caixa abaixo de R$ 100k (piso de paz).
- Nunca sugerir vender Blumenau nos próximos 3 anos (patrimônio patrimonial, alienável).
- Nunca sugerir aporte que comprometa liquidez do casamento (dez/2027).
- Nunca sugerir delegar o comercial Prevensul (é o motor de combustível).

---

## 🗓️ Processo de Revisão

- **Revisão trimestral:** William reanalisa e ajusta valores (patrimônio, renda, marcos)
- **Mudanças registradas aqui:** sempre atualizar "Última atualização" no topo
- **Naval usa esses números como verdade atual** — se mudar aqui, muda no Naval automaticamente via `naval_memory`
', 1, now())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  updated_at = now();

INSERT INTO public.naval_memory (slug, title, content, priority, updated_at)
VALUES ('negocios', 'Negócios e Estrutura Societária — William Tavares', '# Negócios e Estrutura Societária — William Tavares

*Criado: 19/04/2026. Estrutura canônica para Claude Code + Naval (IA do WT7).*

> **REGRA INVIOLÁVEL:** Naval e Claude nunca inventam vetores de renda fora desta estrutura. Se algo novo surgir, pergunta ao William antes de registrar.

---

## 🏗️ Arquitetura Macro: Duas Holdings

```
┌─────────────────────────────────────────────────────────────┐
│  WT7 HOLDING — núcleo patrimonial (imobiliário)             │
│  100% William · sem sócios na holding                       │
│  Função: acumular patrimônio via aluguel + valorização      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  T7 SALES — holding comercial                               │
│  Sociedade informal William (50%) + Diego/irmão (50%)       │
│  Ainda não constituída no papel                             │
│  Função: gerar caixa de alta margem via vendas B2B          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏠 WT7 HOLDING — Detalhamento

### Residenciais Próprios (100% William)
| Código | Unidades | Renda atual | Status |
|---|---|---|---|
| **RWT02 São João** | 8 kitnets | ~R$ 12k/mês | Operação plena |
| **RWT03 Centro** | 5 kitnets | ~R$ 8k/mês | Operação plena |
| **RWT01 Casa Blumenau** | 1 casa | — (patrimonial) | Não alugada, alienável |
| **Total operação atual** | **13 unidades** | **~R$ 20k/mês** | |

### Construções em Andamento
| Projeto | Sócio | Cota W | Unidades previstas | Renda esperada | Prazo |
|---|---|---|---|---|---|
| **JW7 Praia do Sonho** | Jairo | 50% | 10 kitnets (fase 1), + 10 (fase 2) | R$ 1.000/un → R$ 5k/mês cota W fase 1 | 2026 / 2027-28 |
| **RWT05 & Corrêa** | Walmir | 50% | 5 kitnets (fase 1), + 5 (fase 2) | R$ 1.500/un → R$ 7,5k/mês cota W fase 1 | 2026 / 2027-28 |
| **JW7 Itaipava** | Jairo | 50% | A definir | ~R$ 7,5k/mês cota W | 2026-27 |
| **RWT04 Itaipava** | Solo (100%) | 100% | A definir | — | 2028 (depende de caixa) |

### Projeção WT7 Holding
- **2026 (fim):** ~R$ 25k/mês (conclusão fases 1 do Sonho + RWT05)
- **2027 (casamento):** ~R$ 40k/mês (JW7 Itaipava entra)
- **2030:** ~R$ 65k/mês (41 unidades totais)

### Consórcios (ativos travados → viram imóvel ou caixa)
| Consórcio | Crédito | Pago | Encerramento | Cota W |
|---|---|---|---|---|
| **Ademicon (Imóveis)** | R$ 428.132 | 30% (R$ 79.924) | 11/2037 | 100% |
| **Randon Consórcios** (sócio Paulo H. Coelho) | R$ 394.377 total / 197.188 cota | 39,5% | 09/2036 | 50% |

---

## 📞 T7 SALES — Detalhamento

### Estrutura Societária
- **T7 Sales:** William 50% + Diego 50% — sociedade informal, sem CNPJ ainda
- **TDI:** empresa constituída no nome do Diego (contrato TIM não permite sociedade) → **operacionalmente sob o guarda-chuva da T7**

### Sub-vetores da T7

#### 1. **TDI ← TIM** 🔥 (vetor principal em curto prazo)
- **Cliente:** TIM S.A.
- **Serviço:** a confirmar com William (instalação/manutenção telecom?)
- **Início faturamento:** julho/2026
- **Ritmo projetado:** R$ 10k base + 10-15%/mês composto
  - Dez/2026: ~R$ 18-20k/mês
  - Dez/2027: ~R$ 70-150k/mês (dependendo da taxa)
- **Estratégia:** o William projetou conservadoramente R$ 20k em dez/2027 — **pode estourar muito acima**
- **Risco:** dependência de 1 cliente (TIM). Contrato de concessão pode ser cancelado/trocado.

#### 2. **Prevensul (pós-2029) — cliente, não empregador**
- Hoje: William é CLT da Prevensul (10k fixo + comissão 3%)
- Transição pós-2029: sai do CLT, vira PJ via T7 Sales
- Continua vendendo pra Prevensul **como cliente da T7** — não perde o cliente, muda o vínculo
- Pode vender também pra outras empresas do ramo (elétrica + preventivo galpão)
- **Não é saída do cliente — é saída do vínculo CLT**

#### 3. **CW7** (sociedade temporária)
- Sociedade com Claudio
- William pretende sair da CW7 **quando sair do CLT Prevensul** (post-2029)
- Até lá, é receita complementar

#### 4. **HR7**
- Detalhes operacionais ainda não claros — William confirma

#### 5. **Promax Ferramentas**
- Detalhes operacionais ainda não claros — William confirma

#### 6. **B2B Services Nacionais**
- TIM (já via TDI)
- Prevensul Energia Solar (cliente atual)
- **Expansão planejada:** venda nacional de serviços B2B do mesmo ramo (telecom / solar / elétrica)

### Política de Distribuição T7 (conforme William)
- Quando T7 estourar (projeção fim de 2027: ~R$ 100k/mês)
- **Retirada William + Diego:** ~R$ 40-50k/mês (cobrem custos pessoais)
- **Reinvestimento:** ~R$ 50k/mês (expansão + novos negócios)

---

## 💼 Prevensul Comercial Elétrica

**Importante:** Prevensul **não é negócio do William** — é empregador atual. Mas é **cliente estratégico** da T7 no futuro e é a **principal fonte de caixa** hoje.

### Posição Atual
- Diretor Comercial (CLT)
- Salário fixo: R$ 10.000/mês
- Comissão: 3% do valor pago no mês das vendas fechadas pelo William
- Renda média Q1/2026: **R$ 45.912/mês** (10k CLT + 35,9k comissão média)

### Pipeline Prevensul (comissões já contratadas, abril/2026)
- Total de saldos não pagos: **R$ 8,99M**
- Comissão futura garantida: **R$ 272.105** (3%)
- Concentração: **GRAND FOOD = 75% (R$ 202.200)** — risco alto
- **Novo contrato fechado (março/2026): JABPP R$ 760.660** (R$ 22.820 comissão entrando)
- **Nova obra (abril/2026, ainda não registrada):** + R$ 12k/mês × 12 meses = R$ 144k adicional

### Status no Banco de Dados (WT7)
- **Tabela:** `prevensul_billing` (137 linhas, Q1/2026 importado)
- **Portal:** `/commissions/portal` (admin) e `/commissions/external` (other_commissions = comissões externas à Prevensul)
- **Naval usa para:** cálculo de pipeline, concentração por cliente, meta do mês

---

## 🛠️ Ferramentas (NÃO são negócios)

### WT7 — Sistema de Gestão Financeira Pessoal
- Uso interno do William
- Não será comercializado
- Evoluções contínuas

### PrevFlow — Gerador de Propostas com IA
- Ferramenta interna da Prevensul
- Possível SaaS em 2027 (avaliação futura, não cravado)
- **Se virar SaaS, entra como sub-vetor da T7 Sales** (não como vetor independente)

---

## ❌ NÃO FAZ MAIS PARTE DA ESTRUTURA

- **Brava Comex** — removida. Não é mais venture ativa.
- **Projeto Olga** — loja de roupas, status desconhecido. Remover da pauta estratégica até William confirmar.
- **Infinity+ Dashboard** — projeto arquivado (era dashboard para Unifique/Ligga/Elévie), não está em operação.
- **AppAltPerformance** — app pessoal de saúde, não é negócio.

---

## 🗺️ Mapa de Dependência de Tempo do William

```
Hoje (abril/2026):
├── 70% tempo → Prevensul (comercial ativo)
├── 15% tempo → WT7 Holding (gestão obras + aluguéis)
├── 10% tempo → T7 Sales (estruturação TDI)
└── 5% tempo  → tecnologia (WT7, PrevFlow)

Transição ideal (fim de 2027):
├── 50% tempo → T7 Sales (TDI + Prevensul PJ + outros)
├── 30% tempo → WT7 Holding
├── 10% tempo → Fazer Prevensul rodar sem ele
└── 10% tempo → Novos vetores (expansão)

Destino (pós-2030):
├── 40% T7 Sales (executivo/estratégico)
├── 30% WT7 Holding (portfolio manager)
├── 30% Novos projetos (diversificação, eventos de liquidez)
```

---

## 📝 Atualizações Registradas

- **19/04/2026 (criação):** Primeira versão após entrevista estratégica com William. Consolidação de WT7 Holding + T7 Sales como estrutura real. Remoção de Brava Comex. Reposicionamento do PrevFlow como ferramenta, não negócio.
', 2, now())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  updated_at = now();

INSERT INTO public.naval_memory (slug, title, content, priority, updated_at)
VALUES ('preferencias', 'Preferências', '# Preferências

*Última atualização: 01/04/2026*

## Comunicação com o Claude

### O que funciona
- **Direto e sem rodeios.** Executar ações óbvias sem pedir confirmação — William corrige se necessário
- **Estruturado e acionável.** Próximos passos explícitos, código pronto (não pseudo-código)
- **Parceiro estratégico.** Propor soluções, questionar premissas, sinalizar riscos e oportunidades proativamente
- **Contexto técnico incluído.** Mencionar nomes de arquivo, função, tabela do Supabase — não resumir
- **Quando há opções:** apresentar trade-offs claros com recomendação
- **Português brasileiro** como idioma padrão

### O que irrita / evitar
- Pedir confirmação para ações óbvias
- Respostas genéricas que ignoram o contexto específico do William
- Explicações longas quando uma resposta curta resolve
- Repetir informações que William já sabe
- Tratar como iniciante — William é técnico e entende stack, arquitetura e negócios
- Sugerir ferramentas/serviços quando ele já tem stack definida
- Pedir "quer que eu continue?" ou "posso ajudar com mais alguma coisa?"

## Ferramentas do Dia a Dia

### Desenvolvimento
| Ferramenta | Função |
|---|---|
| **Lovable** | Frontend React/TypeScript — ferramenta principal de produção |
| **Supabase** | Backend: Edge Functions (Deno), PostgreSQL, RLS, auth |
| **Claude (claude.ai / API)** | Parceiro de dev + geração de conteúdo IA no PrevFlow |
| **Claude Code** | Ferramenta de dev em terminal (configuração em andamento) |
| **Gemini 2.5 Flash** | Via Lovable gateway para funções no PrevFlow |
| **GitHub** | Deploy via file replacement → Lovable auto-deploy |
| **Browserless** | Geração de PDF no PrevFlow |

### Comercial e Gestão
| Ferramenta | Função |
|---|---|
| **Agendor** | CRM comercial da Prevensul |
| **Make / n8n** | Automações (WhatsApp → CRM, etc.) |
| **Evolution API** | WhatsApp business (planejado: AI SDR + chatbot) |

### Outros
| Ferramenta | Função |
|---|---|
| **Glide** | AppAltPerformance (app de rotina/saúde) |
| **99Freelas / Workana** | Contratação pontual de freelancers com briefings |

## Padrões de Trabalho

- **Sprints curtos:** Entregas incrementais > planejamentos longos
- **Build > Buy:** Constrói ferramentas próprias quando pode fazer melhor
- **Validação interna primeiro:** Testa na Prevensul antes de escalar para mercado
- **Briefings detalhados para delegação:** Quando contrata freelancer, entrega documentação completa
- **Decisões arquiteturais são deliberadas:** Ex: PDF e DOCX independentes no PrevFlow = design, não acidente

## Templates Canônicos Prevensul

Sempre usar estes modelos como base. Não inventar formatos novos.

### Propostas Comerciais
- **Tecnologia:** Python + ReportLab
- **Modelo:** `template_proposta.py`
- **Estrutura:** Cover com logo e faixas vermelhas → 7 seções fixas → tabelas zebra → header/footer profissional
- **Dados requeridos:** cliente, logo, itens/valores, dados da proposta

### Contratos
- **Tecnologia:** Node.js + docx.js
- **Modelo:** `template_contrato.js`
- **Estrutura:** Header com linha vermelha → 20 cláusulas fixas → tabelas vermelho/cinza (partes, pagamento, materiais, marcos) → footer paginado
- **Dados requeridos:** cliente, objeto, escopo, materiais, condições de pagamento, marcos
', 6, now())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  updated_at = now();

INSERT INTO public.naval_memory (slug, title, content, priority, updated_at)
VALUES ('projetos_atuais', 'Projetos Atuais', '# Projetos Atuais

*Última atualização: 19/04/2026*

> **Nota canônica:** estrutura de negócios em `memoria/negocios.md`. Metas em `memoria/metas.md`.
> PrevFlow e WT7 são **ferramentas**, não negócios — não geram riqueza direta.

---

## 🔴 Prioridade Máxima — Vetores de Renda Real

### 1. Prevensul Comercial (fonte de caixa #1 — hoje)
- William = único closer. Renda média Q1/2026: R$ 45,9k/mês (CLT 10k + comissão média 35,9k).
- Pipeline contratado (abr/2026): R$ 272k em comissões futuras ao longo de ~24 meses.
- **Risco:** Grand Food = 75% do pipeline → concentração perigosa.
- **Ação do trimestre:** fechar obras novas para diluir Grand Food; obra nova abril/2026 adiciona R$ 144k.

### 2. WT7 Holding — Construções em Andamento
| Obra | Parceiro | Cota W | Entrega fase 1 | Renda esperada |
|---|---|---|---|---|
| JW7 Praia do Sonho | Jairo | 50% | 2026 | R$ 5k/mês (fase 1, 10 kitnets) |
| RWT05 & Corrêa | Walmir | 50% | 2026 | R$ 7,5k/mês (fase 1, 5 kitnets) |
| JW7 Itaipava | Jairo | 50% | 2026-27 | R$ 7,5k/mês |
| RWT04 Itaipava | Solo | 100% | 2028 | — (depende caixa) |

Financiamento Caixa EGI 240 meses PRICE/TR → flexibilidade > economia de juros.

### 3. T7 Sales / TDI (vetor emergente)
- TDI ← TIM: início jul/2026, R$ 10k base + 10-15%/mês composto.
- Projeção conservadora dez/2027: R$ 70-150k/mês.
- Estruturação operacional: Diego executa, William faz estratégia.

---

## 🟡 Ferramentas Internas (não são negócios)

### PrevFlow — Gerador de Propostas Prevensul
- Stack: React/TypeScript (Lovable) + Supabase Edge Functions + Browserless + Claude API + Gemini 2.5 Flash.
- Uso: ferramenta interna Prevensul. Entrega propostas com IA ("Vendedor Diamante"), 5 temas visuais, custo-por-m², mapeamento normativo 27 estados.
- Status SaaS: **avaliação futura em 2027** — não cravado como negócio. Se virar SaaS, entra como sub-vetor da T7.
- Roadmap módulos: AI SDR WhatsApp, chatbot normativo RAG, analyze-project edge function (freelancer pendente).

### WT7 — Cockpit Financeiro Pessoal
- URL: https://wt7planejamento.lovable.app · Repo: github.com/prevensulwilliam-jpg/wt7planejamento
- Stack: React 18 + TypeScript + Vite (Lovable) + shadcn/ui + Tailwind + Supabase + TanStack Query.
- Supabase ref correto: `hbyzmuxkgsogbxhykhhu` (Lovable Cloud, **nunca** CLI).
- 7 sprints entregues (kitnets, comissões, construções, parceiros, casamento, reconciliação, pattern learning).
- Evolução abril/2026: Portal Manager, Energia Solar 3 abas, MonthPicker/DatePicker universal, KitnetModal 3 abas, wisely-ai com modo extract-celesc.
- **Sprint atual (04/2026):** cockpit estratégico — /hoje substitui /dashboard, Naval vira analista financeiro com memória, /goals editável.
- **Sprint 2 (futuro):** módulo Cartões (BB + XP, OCR fatura, categorização, tracking milhas/pontos).

---

## 🧱 Projetos Técnicos Prevensul (obras em execução)

- **Santos e Negócios** (Barra Velha/SC): PPCI J-2 ~2.009m² — memorial + planta HTML.
- **Fibra Papéis:** sistema de alarme (bateria NBR 17240 = 7Ah).
- **Verde Vale Trade Park:** landing Proposta Nº 22.
- **Premoldi:** landing Proposta Nº 34.
- **JABPP:** contrato fechado mar/2026, R$ 760k (R$ 22,8k comissão).

---

## 🟢 Pessoais

- **Casamento:** 11/12/2027, Villa Sonali, Balneário Camboriú — gestão via WT7 Sprint 5.
- **Projeto 8% BF:** meta corporal.
- **AppAltPerformance:** app Glide de rotina/saúde (uso pessoal, não negócio).

---

## ❌ Fora da pauta

- **Brava Comex** — removida (19/04/2026). Não é venture ativa.
- **Projeto Olga** — status desconhecido, fora até William confirmar.
- **Infinity+ Dashboard** — arquivado.
- **PrevFlow como negócio** — é ferramenta. Só entra como negócio se virar SaaS em 2027, e mesmo assim sub-vetor T7.

---

## Metas Q2 2026

1. Diluir concentração Grand Food (fechar 2+ obras novas)
2. Destravar TDI ← TIM para faturar em julho
3. Cockpit WT7 operacional com Naval conselheiro
4. Avançar fases 1 de JW7 Sonho + RWT05 (entregar até fim 2026)
5. Manter Sobra Reinvestida ≥ 50% da receita

## Desafios Centrais

1. **Gargalo humano:** William = único closer Prevensul + único builder + único gestor patrimonial.
2. **Concentração Grand Food:** 75% do pipeline em 1 cliente.
3. **TDI ainda em R$ 0:** depende de Diego destravar operação.
4. **Custo de vida 74% em cartões:** precisa análise granular (Sprint 2).
', 5, now())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  updated_at = now();

INSERT INTO public.naval_memory (slug, title, content, priority, updated_at)
VALUES ('vida_pessoal', 'Vida Pessoal', '# Vida Pessoal

*Última atualização: 01/04/2026*

## Rotina Diária

- **Manhã:** Bloco de trabalho profundo — desenvolvimento de ferramentas, propostas, estratégia comercial
- **12h (fixo):** Treino com personal trainer **Henrique** — compromisso inegociável, âncora do dia
- **Tarde:** Reuniões comerciais, follow-ups, fechamentos, gestão de projetos
- **Surf:** Sessões frequentes — mora na Praia Brava (Itajaí), acesso direto à praia

## Saúde

- Acompanhamento psiquiátrico ativo para **ansiedade, hipocondria e TOC**
- Treino físico diário como pilar de saúde mental e performance
- **Projeto 8% BF:** Meta pessoal de redução de gordura corporal para 8%
- **AppAltPerformance:** App em desenvolvimento (Glide) para tracking de saúde, finanças e rotina com IA

## Como Prefere Trabalhar

- **Executor intenso:** Faz antes de delegar — quando delega, entrega briefing completo
- **Builder solo:** Constrói ferramentas, processos e automações ele mesmo, depois valida e escala
- **Sprints curtos:** Entregas incrementais com iteração rápida (padrão usado no WT7 e PrevFlow)
- **Comunicação direta:** Sem rodeios, sem confirmações desnecessárias, orientado a ação
- **Multitarefa controlada:** Opera 5+ projetos simultaneamente com priorização rigorosa

## Interesses

- Surf
- Tecnologia e IA aplicada a negócios
- Investimentos imobiliários e renda passiva
- Importação internacional (China)
- Desenvolvimento de SaaS
- Metodologias de vendas (MEDDIC, Challenger Sale, Predictable Revenue)
- Fitness e alta performance física

## Valores Centrais

- **Independência financeira** — aposentadoria antecipada via renda passiva é o norte
- **Autonomia** — constrói suas próprias ferramentas, não depende de soluções prontas
- **Execução > Planejamento** — ação e resultado acima de teoria e preparação infinita
- **Rigor técnico** — engenheiro de formação, exige qualidade e precisão
- **Build > Buy** — se pode construir melhor, constrói

## Marco Pessoal Próximo

- **Casamento:** Dezembro de 2027, Villa Sonali, Balneário Camboriú/SC
- Planejamento em andamento via módulo dedicado no WT7 (Sprint 5)
', 8, now())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  updated_at = now();
