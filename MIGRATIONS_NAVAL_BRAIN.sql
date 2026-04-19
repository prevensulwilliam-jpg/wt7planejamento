-- ═══════════════════════════════════════════════════════════════════
-- MIGRATIONS_NAVAL_BRAIN.sql — Sprint A (Brain Stack do Naval)
-- ═══════════════════════════════════════════════════════════════════
-- Rodar no Lovable → SQL Editor APÓS MIGRATIONS_TO_RUN.sql e
-- SEED_NAVAL_MEMORY.sql já estarem aplicados.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1) naval_sources — biblioteca de fontes (livros, vídeos, notas)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.naval_sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  author        text,
  source_type   text NOT NULL CHECK (source_type IN ('book','video','article','podcast','note','course')),
  source_url    text,
  lens          text NOT NULL CHECK (lens IN ('naval','aaron_ross','housel','tevah','operador','outros')),
  summary       text,
  principles    jsonb NOT NULL DEFAULT '[]'::jsonb,
  active        boolean NOT NULL DEFAULT true,
  priority      int NOT NULL DEFAULT 100,
  raw_content   text,           -- conteúdo bruto opcional (pra RAG futuro)
  ingested_at   timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.naval_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin full access naval_sources" ON public.naval_sources;
CREATE POLICY "admin full access naval_sources"
  ON public.naval_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_naval_sources_lens ON public.naval_sources(lens) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_naval_sources_active ON public.naval_sources(active, priority);

-- ───────────────────────────────────────────────────────────────────
-- 2) SEED — Lente NAVAL RAVIKANT (Almanack, condensado)
-- ───────────────────────────────────────────────────────────────────
INSERT INTO public.naval_sources (slug, title, author, source_type, lens, priority, summary, principles)
VALUES (
  'almanack-naval',
  'The Almanack of Naval Ravikant',
  'Eric Jorgenson (curator) / Naval Ravikant',
  'book',
  'naval',
  10,
  'Compilado de ideias de Naval Ravikant sobre riqueza, alavancagem, conhecimento específico, jogos de longo prazo e felicidade. Base filosófica da persona Naval do WT7.',
  '[
    "Alavancagem moderna tem 3 formas: capital, trabalho humano, e produtos sem custo marginal (código + mídia). As duas últimas são permissionless — qualquer um pode começar hoje.",
    "Riqueza vem de ser dono de equity em negócios que escalam sem você. Salário compra tempo livre, equity compra liberdade.",
    "Specific knowledge (conhecimento específico) é o que você não consegue ser treinado pra fazer — nasce de curiosidade genuína. É insubstituível e imune a automação.",
    "Jogos de longo prazo com pessoas de longo prazo. Toda a riqueza (financeira, relacional, reputacional) vem do compounding. Trocar de parceiro, de cidade, de negócio a cada ano reseta o compound.",
    "Reputação é o ativo mais escasso. Construa devagar, proteja ferozmente. Uma decisão errada destrói 10 anos de confiança.",
    "Não tenha medo de ser único. Arbitragem só existe onde as pessoas não olham. Ser 100% você é a única vantagem sustentável.",
    "Produtize-se. Transforme seu conhecimento + sua reputação em um produto escalável (software, mídia, processo documentado). Custo marginal zero = alavancagem infinita.",
    "Leia o que AMAR — não o que deveria. Quantidade alta de leitura mal escolhida é desperdício. Um livro relido 10 vezes vale mais que 100 livros lidos uma vez.",
    "Julgamento vale mais que inteligência bruta. Inteligência acha o máximo local. Julgamento escolhe o problema certo — é onde mora o retorno assimétrico.",
    "Aposte em si mesmo assimetricamente. Em qualquer situação com downside limitado e upside ilimitado, sempre joga. A maioria das oportunidades é simétrica e não importa.",
    "Saúde, bem-estar mental e relacionamento vêm ANTES do patrimônio financeiro. Sem esses, R$ 70M não entrega liberdade — entrega ansiedade com mais zeros.",
    "Se você tem inveja de alguém, você inveja o pacote completo, não só o dinheiro. O CEO estressado, o fundador divorciado — sem escolher o pacote inteiro, não adianta invejar a parte.",
    "Desejo é contrato que você assina consigo mesmo pra ser infeliz até ter. Escolha 1 desejo maior, não 10 pequenos."
  ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  summary = EXCLUDED.summary,
  principles = EXCLUDED.principles,
  updated_at = now();

-- ───────────────────────────────────────────────────────────────────
-- 3) SEED — Lente AARON ROSS (Predictable Revenue)
-- ───────────────────────────────────────────────────────────────────
INSERT INTO public.naval_sources (slug, title, author, source_type, lens, priority, summary, principles)
VALUES (
  'predictable-revenue',
  'Predictable Revenue',
  'Aaron Ross & Marylou Tyler',
  'book',
  'aaron_ross',
  20,
  'Manual operacional de como transformar vendas B2B em máquina previsível. Core: especialização de papéis (SDR out ≠ SDR in ≠ closer ≠ account manager), Cold Calling 2.0, Seeds/Nets/Spears.',
  '[
    "Pare de misturar papéis: quem prospecta não fecha, quem fecha não renova. Closer sozinho é teto baixo — o ciclo todo colado em 1 pessoa nunca escala.",
    "Seeds (indicações + clientes atuais): alta conversão, baixo volume, ritmo lento. É o motor de margem — segurar e nutrir, não abandonar.",
    "Nets (inbound — site, SEO, conteúdo): médio volume, conversão variável. Só funciona se a oferta é clara e o SEO/site não é amador.",
    "Spears (outbound ativo — Cold Calling 2.0): alto volume, previsível quando bem calibrado. SDR manda e-mails curtos de referência (não vende), pede indicação interna. Closer só entra quando há interesse real.",
    "Ramp time — um SDR novo leva 3 a 6 meses pra produzir. Se você não mede ramp, contrata errado.",
    "Previsibilidade vem de métricas: leads gerados → conversas marcadas → oportunidades criadas → propostas → fechamentos. Cada etapa tem conversão conhecida. Se a conversão despenca, ache o nó.",
    "Niche first, depois expansão. Empresa que tenta vender pra todos vende pra ninguém. Defina ICP cirúrgico (setor, tamanho, dor específica).",
    "Cold Calling 2.0: e-mail de referência, 4 linhas, uma pergunta. Não vende — pede a pessoa certa pra conversar. Conversão 5-10% das respostas viram meeting.",
    "Closer faz 3-5 meetings qualificados/dia. Acima disso, cai qualidade. Volume de SDR dimensiona retro: quantos meetings qualificados eu preciso pra bater meta mensal?",
    "Comissão do SDR é pelo MEETING marcado que virou oportunidade — não pelo fechamento. Senão ele trava na lama do ciclo longo e desiste.",
    "Escalar pra R$ 10M+ em ARR exige 3 funções separadas: outbound, inbound, success. Tentar fazer tudo via 1 head só é gargalo garantido.",
    "A máquina de vendas precede o produto perfeito. Você vende a promessa validada, o produto melhora com os contratos fechados."
  ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  summary = EXCLUDED.summary,
  principles = EXCLUDED.principles,
  updated_at = now();

-- ───────────────────────────────────────────────────────────────────
-- 4) SEED — Lente MORGAN HOUSEL (Psychology of Money)
-- ───────────────────────────────────────────────────────────────────
INSERT INTO public.naval_sources (slug, title, author, source_type, lens, priority, summary, principles)
VALUES (
  'psychology-of-money',
  'The Psychology of Money',
  'Morgan Housel',
  'book',
  'housel',
  30,
  'Dinheiro é comportamento, não planilha. Quem ganha no longo prazo não é o mais inteligente — é quem não quebra. Base de gestão de risco e disciplina pra jornada de 15 anos.',
  '[
    "Sobrevivência > retornos máximos. O rico que quebrou uma vez nunca chega no rico que só comeu 8% a.a. por 40 anos. O compound só compõe se você não zera.",
    "Cauda grossa: 2-3 decisões numa vida financeira explicam 90% do resultado. Esteja presente na mesa quando elas aparecerem — não dormindo no home office.",
    "Liberdade é o dividendo mais alto do dinheiro. Ter controle sobre seu tempo bate ter mais zeros no patrimônio.",
    "Risco é o que sobra quando você achou que tinha pensado em tudo. Deixe margem de segurança em tudo — caixa, prazo, dívida, sócios.",
    "Ninguém é louco — cada decisão financeira faz sentido dada a história de quem decide. Seus vieses (TOC, hipocondria) são entradas, não bugs. Desenhe o portfolio COM eles, não contra.",
    "Riqueza é o que você NÃO gasta. Patrimônio invisível — o que ficou no bolso — é o único que compõe. Gasto virou consumo, não virou futuro.",
    "Frugalidade e ambição convivem. Poupe como paranoico, invista como otimista.",
    "Tempo no mercado > timing do mercado. Tentar prever top e bottom mata o retorno composto. Esteja dentro e não saia.",
    "A única forma de fazer dinheiro no longo prazo é suportar volatilidade sem entrar em pânico. O preço do retorno assimétrico é desconforto diário.",
    "Cuidado com o efeito ricochete: quando metas antigas viram piso e você refaz metas maiores indefinidamente. Defina O QUE é suficiente antes de começar.",
    "Compare-se com você de 5 anos atrás, nunca com pares. Inveja social é o bug mais caro da jornada patrimonial.",
    "Pessimismo soa inteligente, otimismo vende menos livros. Mas o otimista razoável é quem ganha: acredita na volatilidade do curto e no crescimento do longo."
  ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  summary = EXCLUDED.summary,
  principles = EXCLUDED.principles,
  updated_at = now();

-- ───────────────────────────────────────────────────────────────────
-- 5) SEED — Lente TEVAH (Vendedor Diamante — BR consultivo)
-- ───────────────────────────────────────────────────────────────────
INSERT INTO public.naval_sources (slug, title, author, source_type, lens, priority, summary, principles)
VALUES (
  'vendedor-diamante',
  'Vendedor Diamante',
  'Eduardo Tevah',
  'book',
  'tevah',
  40,
  'Venda consultiva no mercado brasileiro — foco em diagnóstico antes da proposta, relação de confiança e fechamento sem pressão. Já aplicado no PrevFlow (textos com IA) e direciona o pitch Prevensul.',
  '[
    "Pare de vender: comece a diagnosticar. Pergunta supera argumento. Quem pergunta melhor fecha mais.",
    "Prospect não compra produto — compra a sensação de estar em boas mãos. Transmita controle técnico + empatia antes do preço.",
    "Objecções são pedidos de reforço, não rejeições. Decodifique: ''está caro'' vira ''não enxerguei valor equivalente''.",
    "Follow-up é 80% da venda B2B. A 3ª chamada fecha mais que a 1ª proposta. Quem some na 2ª perde pro vendedor mediano que insiste.",
    "Seja o especialista visível. Conteúdo técnico + autoridade de nicho atraem cliente qualificado — pipeline enche sozinho depois de 18 meses de consistência.",
    "Credibilidade vem de números, cases e presença — não de slogan. Foto no site, LinkedIn ativo, obras entregues documentadas.",
    "Venda pra quem DECIDE E PAGA — não pro técnico influenciador. Perda de tempo crônica é ciclo longo porque você tá falando com quem não assina o cheque.",
    "Pós-venda é o próximo ciclo. Cliente satisfeito indica 3. Cliente insatisfeito custa 7. ROI do cuidado pós-contrato é o mais alto da operação.",
    "Preço alto bem explicado fecha mais que preço baixo mal posicionado. Ancoragem + justificativa técnica vira contrato fechado sem desconto.",
    "Disciplina de CRM é disciplina de caixa. Vendedor que não registra não mede. Não mede, não melhora. Não melhora, não escala."
  ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  summary = EXCLUDED.summary,
  principles = EXCLUDED.principles,
  updated_at = now();

-- ───────────────────────────────────────────────────────────────────
-- 6) SEED — Lente OPERADOR (William + realidade Prevensul/SC)
-- ───────────────────────────────────────────────────────────────────
INSERT INTO public.naval_sources (slug, title, author, source_type, lens, priority, summary, principles)
VALUES (
  'operador-william',
  'Operador: William Tavares + realidade Prevensul/SC',
  'William Tavares (síntese)',
  'note',
  'operador',
  50,
  'Lente de realidade de campo: o que funciona na prática em Itajaí/SC para prevenção, elétrica, kitnets, energia solar. Destila aprendizados que o William já validou com dinheiro na mesa.',
  '[
    "Build > Buy quando a stack é proprietária. SaaS genérico não resolve — ferramenta construída (PrevFlow, WT7) vira ativo da operação.",
    "Validação interna ANTES de mercado externo. 2026 inteiro o PrevFlow vai rodar só na Prevensul. 2027 é a janela de virar SaaS — não antes.",
    "Mentoria genérica não serve quando a tese é clara. Melhor investir em execução assistida (freelancers com briefing detalhado) do que em orientação.",
    "Financiamento Caixa EGI 240 meses PRICE/TR: paga antecipado no ritmo confortável, mantém parcela mínima como rede de segurança. Flexibilidade > economia nominal de juros.",
    "Mapeamento normativo por estado (27 estados + ITs) é o diferencial real da Prevensul. Concorrente não faz isso — e é isso que o cliente PPCI compra.",
    "B2B2C via fabricantes de pré-moldados (tipo Premoldi) é canal indireto não explorado — vender pra quem atende construtora é escalar sem CAC direto.",
    "Gargalo humano é o maior risco operacional: William = único closer + único builder + único gestor imobiliário. Cada vetor compete pelo mesmo recurso (tempo).",
    "NBR 17240 exige bateria 7Ah (não 2.2Ah). Specs técnicas são armadilhas de margem — vendedor que erra spec entrega obra no prejuízo.",
    "Kitnet RWT02 rende R$ 12k/mês com 8 unidades; RWT03 R$ 8k com 5. Ticket médio R$ 1.500. Escalar kitnet tem teto — 40 unidades é o ponto de inflexão onde gestão manual quebra e precisa de síndico/software.",
    "Sócio certo > sócio conveniente. Jairo e Walmir entregam obra. Claudio (CW7) é sociedade temporária — sai pós-2029. TDI está no nome do Diego porque TIM não permite sociedade — arquitetura jurídica pragmática vence ideologia.",
    "Casamento 11/12/2027 é data-trava: nada pode comprometer liquidez de caixa nessa janela. Qualquer proposta Naval deve respeitar esse muro.",
    "Operador eterno — William nunca aposenta. Formato muda (CLT → PJ → sócio → portfolio manager), produção não para. Propor ''parar'' é erro de leitura."
  ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  summary = EXCLUDED.summary,
  principles = EXCLUDED.principles,
  updated_at = now();

-- ═══════════════════════════════════════════════════════════════════
-- APÓS RODAR:
-- 1. Naval (edge function wisely-ai no próximo deploy) vai carregar
--    essas 5 lentes automaticamente e responder cruzando os ângulos.
-- 2. Para adicionar nova fonte: INSERT manual ou /naval/biblioteca (Sprint B).
-- 3. Para desativar uma lente temporariamente: UPDATE naval_sources SET active=false WHERE slug='...'
-- ═══════════════════════════════════════════════════════════════════
