-- ══════════════════════════════════════════════════════════════════
-- Cimenta "Operador William" como 5ª lente oficial no brain stack.
-- Cria source sintética (lens='operador') com princípios derivados das
-- suas próprias regras (metas.md, negocios.md, aprendizados.md).
-- O Naval vai ranquear esses princípios lado a lado com Naval/Housel/
-- Aaron Ross/Tevah via RAG semântico.
-- ══════════════════════════════════════════════════════════════════

INSERT INTO naval_sources (
  slug, title, author, source_type, lens, summary, principles, priority, active
) VALUES (
  'operador-william-regras-casa',
  'Operador William — Regras da Casa',
  'William Tavares',
  'note',
  'operador',
  'Princípios operacionais que o William já cravou como invariáveis: gargalos humanos, travas defensivas, mecânicas do terreno. Fonte única quando o Naval precisar citar "como William opera".',
  ARRAY[
    'Gargalo humano é o William — único closer Prevensul, único builder de tecnologia, único gestor das obras e das kitnets. Toda recomendação que exija mais tempo dele sem destravar algo precisa ser questionada antes de aceita.',
    'Caixa mínimo R$ 100k é piso de paz — nunca operar abaixo disso, nem pra aporte em obra, nem pra adiantar consórcio, nem pra oportunidade imperdível. Abaixo de R$ 100k o psicológico do William trava (hipocondria + TOC + ansiedade em tratamento).',
    'Treino com personal Henrique às 12h é âncora inegociável do dia. Qualquer agenda que colida com 12h é rejeitada por default. Saúde mental e física são infraestrutura, não luxo.',
    'Sobra Reinvestida ≥ 50% da receita total é a métrica-chave. Conta: aporte em obra, consórcio, amortização, investimento líquido. NÃO conta: parcela Rampage (juros zero = quitando consumo), retirada T7 pra custeio, fatura de cartão.',
    'Casa Blumenau (RWT01) é patrimônio alienável — não vender nos próximos 3 anos. Pode ser usada como garantia de alienação fiduciária em empréstimo estratégico (fogo controlado), nunca vendida em liquidez.',
    'Casamento 11/12/2027 na Villa Sonali é trava de liquidez — nenhum aporte pode comprometer o caixa do casamento. Data fixa, orçamento em gestão no módulo /wedding do WT7.',
    'Comissão Prevensul = 3% sobre valor PAGO no mês pelo cliente, não sobre contrato fechado. Contrato de R$ 1M pago em 24 meses = ~R$ 1.250/mês em comissão, não R$ 30k one-shot. Meta mensal sempre exige cálculo do fator de prazo × ticket.',
    'Concentração Grand Food = 75% do pipeline futuro é risco de sobrevivência, não de upside. Se GF atrasar 60 dias, renda Prevensul cai de R$ 46k para ~R$ 15k no mês. Diluir vem ANTES de crescer — prioridade assimétrica.',
    'CLT Prevensul é motor de caixa #1 até 2029 — nunca delegar o comercial. Saída vira transição pra PJ via T7 Sales mantendo Prevensul como cliente (não empregador). Nunca perder o cliente, só mudar o vínculo.',
    'Build > Buy quando William consegue construir melhor que o SaaS de prateleira. PrevFlow e WT7 nasceram disso. Mas delegar exige briefing detalhado pra freelancer pontual (99Freelas/Workana) — nunca delegar sem documentação completa.',
    'PrevFlow e WT7 são FERRAMENTAS, não negócios. Zero monetização, zero piloto pago, zero SaaS beta em 2026. Só vira negócio em 2027, e mesmo assim como sub-vetor da T7 Sales — nunca como venture independente.',
    'Meta R$ 70M em 2041 (aos 55 anos) exige CAGR 17,3% a.a. composto. O salto 2035-2041 (R$ 15M → R$ 70M) é o elefante — exige evento de liquidez (venda parcial T7) + valorização assimétrica de imóvel frente-mar + alavancagem pesada.',
    'Financiamento imobiliário Caixa EGI 240 meses PRICE/TR é o padrão — flexibilidade pra reduzir parcela se a renda cair vale mais que economia bruta de juros. Prazo longo + pagamento antecipado > prazo curto rígido.',
    'Brava Comex e Projeto Olga estão FORA da pauta estratégica. Qualquer proposta que traga esses nomes de volta precisa passar por William antes de virar ação — são ventures descartadas, não pausadas.',
    'TDI (TIM) começa a faturar jul/2026 no nome do Diego. Até lá, T7 Sales = R$ 0. Nenhuma projeção pode assumir receita T7 antes de julho — TDI não é promessa, é contrato em espera.',
    'Sprints curtos > planos grandes. Entregas incrementais que podem ir pra produção no mesmo dia > roadmap de 3 meses que nunca sai do PDF. Validação é feita testando, não planejando.',
    'NBR 17240: bateria de alarme = 7Ah (não 2.2Ah). Qualquer spec técnica em proposta Prevensul precisa ser auditada contra a NBR vigente antes de sair. Erro de spec queima credibilidade com bombeiros.',
    'Supabase do WT7 = ref hbyzmuxkgsogbxhykhhu via Lovable Cloud. Nunca acessar via supabase.com direto, nunca usar CLI com token pessoal (projeto errado). Migrations = SQL manual no SQL Editor do Lovable.'
  ],
  10,  -- prioridade 10 = aparece no topo da lista
  true
)
ON CONFLICT (slug) DO UPDATE SET
  principles = EXCLUDED.principles,
  summary = EXCLUDED.summary,
  updated_at = now();
