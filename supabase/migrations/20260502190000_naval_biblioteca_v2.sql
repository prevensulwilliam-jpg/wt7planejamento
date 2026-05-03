-- ════════════════════════════════════════════════════════════════════════════
-- Sprint v43 — Biblioteca Naval v2 (proposta revisada por William 02/05/2026)
-- ════════════════════════════════════════════════════════════════════════════
-- Adiciona 6 sources novos com 86 princípios destilados em 4 tipos:
--   • principio_pessoal (peso 5) — regras validadas pela vivência do William
--   • preferencia_estrategica (peso 4) — direção preferencial revisável
--   • heuristica_operacional (peso 3-4) — regra prática útil
--   • alerta_validacao (peso 2-3) — tema externo/jurídico/tributário
--
-- Hierarquia de aplicação (system prompt do Naval vai refletir):
--   1. Princípios pessoais
--   2. Restrições estratégicas (caixa, reputação, risco)
--   3. Heurísticas operacionais
--   4. Dados externos atualizados
--   5. Alertas jurídicos com validação profissional
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Atualiza match_principles RPC pra retornar metadados extras ────────────
-- Cada princípio agora pode ser objeto JSON com {text, type, priority, tags,
-- requires_validation, is_hard_constraint, is_operational_checklist,
-- temporal_validity_months, cross_references}.
-- A RPC extrai esses campos do JSON em naval_sources.principles[principle_idx].
DROP FUNCTION IF EXISTS match_principles(vector, float, int);

CREATE OR REPLACE FUNCTION match_principles(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  source_id uuid,
  source_title text,
  source_author text,
  source_summary text,
  lens text,
  principle_idx int,
  text text,
  similarity float,
  -- Metadados v43 (extraídos do JSONB do princípio, NULL se princípio for string legado)
  principle_type text,
  principle_priority int,
  principle_tags jsonb,
  requires_validation boolean,
  is_hard_constraint boolean,
  is_operational_checklist boolean,
  temporal_validity_months int,
  cross_references jsonb
)
LANGUAGE sql STABLE
AS $$
  SELECT
    v.source_id,
    s.title AS source_title,
    s.author AS source_author,
    s.summary AS source_summary,
    v.lens,
    v.principle_idx,
    v.text,
    1 - (v.embedding <=> query_embedding) AS similarity,
    -- Tenta extrair metadados do JSON do princípio na posição idx
    -- Se for string legado, todos os campos abaixo retornam NULL
    (s.principles -> v.principle_idx ->> 'type')::text AS principle_type,
    NULLIF((s.principles -> v.principle_idx ->> 'priority'), '')::int AS principle_priority,
    (s.principles -> v.principle_idx -> 'tags')::jsonb AS principle_tags,
    NULLIF((s.principles -> v.principle_idx ->> 'requires_validation'), '')::boolean AS requires_validation,
    NULLIF((s.principles -> v.principle_idx ->> 'is_hard_constraint'), '')::boolean AS is_hard_constraint,
    NULLIF((s.principles -> v.principle_idx ->> 'is_operational_checklist'), '')::boolean AS is_operational_checklist,
    NULLIF((s.principles -> v.principle_idx ->> 'temporal_validity_months'), '')::int AS temporal_validity_months,
    (s.principles -> v.principle_idx -> 'cross_references')::jsonb AS cross_references
  FROM naval_principle_vectors v
  JOIN naval_sources s ON s.id = v.source_id
  WHERE s.active = true
    AND 1 - (v.embedding <=> query_embedding) > match_threshold
  ORDER BY v.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_principles TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- S1 · OPERADOR WT7 — OBRAS & CONSTRUÇÃO
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO naval_sources (slug, title, author, source_type, lens, summary, principles, priority, active)
VALUES (
  'operador_obras_wt7',
  'Operador WT7 — Obras & Construção',
  'William Tavares',
  'note',
  'operador',
  'Aprendizados pessoais de obras WT7/RWT/JW7: modelo construtivo, prazo, caixa, sócios e presença física. 15 princípios validados em 4 obras (RWT02 concluída, RWT03 concluída, RWT05 em construção, JW7s em construção, RWT04 terreno solo).',
  jsonb_build_array(
    jsonb_build_object(
      'tag', 'MODELO_CONSTRUTIVO_AGIL',
      'text', 'Para expansão de kitnets pequenas, o padrão WT7 deve priorizar modelos construtivos ágeis e leves — container, placas cimentícias, pré-fabricado ou soluções modulares — sempre que forem técnica e economicamente viáveis. A experiência da RWT03 mostrou que modelo leve pode terminar antes de alvenaria mesmo começando depois.',
      'type', 'principio_pessoal', 'priority', 5,
      'tags', jsonb_build_array('obra', 'modelo_construtivo', 'kitnet'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('EVOLUCAO_CONSTRUTIVA_CONFIRMADA', 'MODELO_LENTO_NAO_DEFAULT')
    ),
    jsonb_build_object(
      'tag', 'DEMOLIR_VS_REFORMAR',
      'text', 'Quando a reforma de um prédio antigo reduzir capacidade, eficiência ou receita permanente, demolir e projetar novo tende a ser superior. Adaptar 8 kitnets onde caberiam 10 pode gerar perda anual recorrente e destruir valor patrimonial de longo prazo. A decisão deve considerar caixa, prazo, risco e receita futura, não apenas o custo inicial.',
      'type', 'preferencia_estrategica', 'priority', 5,
      'tags', jsonb_build_array('obra', 'capacidade', 'NPV'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('CORAGEM_DE_DEMOLIR')
    ),
    jsonb_build_object(
      'tag', 'INFRA_AC_NA_CONSTRUCAO',
      'text', 'Infraestrutura para ar-condicionado deve ser prevista na fase de obra, mesmo quando o equipamento não for instalado inicialmente. Adicionar depois custa mais, quebra acabamento e piora a experiência do imóvel.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('obra', 'kitnet', 'infraestrutura', 'checklist'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'PADRAO_DEFAULT_KITNET_WT7',
      'text', 'Padrão default WT7 validado: móveis sob medida, energia solar quando viável, energia individualizada por consumo, alumínio em portas/portões/guarda-corpo/corrimão, geladeira frost free, paleta de cores definida e acabamento padronizado. Esse padrão deve ser replicado salvo motivo técnico, financeiro ou comercial claro para alterar.',
      'type', 'principio_pessoal', 'priority', 5,
      'tags', jsonb_build_array('kitnet', 'padrao_construtivo', 'default'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('MODELO_TAXAS_KITNET_WT7')
    ),
    jsonb_build_object(
      'tag', 'TEMPO_OBRA_VS_CUSTO',
      'text', 'Em imóveis de renda recorrente, prazo de obra pode ser mais importante que economia pontual no custo. Atraso gera perda direta de aluguel, posterga payback e reduz velocidade de crescimento patrimonial. O Naval deve calcular oportunidade perdida sempre que comparar alternativas de obra.',
      'type', 'principio_pessoal', 'priority', 5,
      'tags', jsonb_build_array('obra', 'prazo', 'oportunidade', 'NPV'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('ATRASO_TIPICO_CONFIRMAR_MODELO_CONSTRUTIVO')
    ),
    jsonb_build_object(
      'tag', 'CORAGEM_DE_DEMOLIR',
      'text', 'Decisões de capacidade que impactam décadas não devem ser bloqueadas apenas por aperto de caixa de curto prazo. O Naval deve separar trava emocional, medo de não terminar e restrição financeira real antes de recomendar reforma, demolição ou faseamento.',
      'type', 'preferencia_estrategica', 'priority', 4,
      'tags', jsonb_build_array('decisao', 'capacidade', 'psicologico'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('DEMOLIR_VS_REFORMAR')
    ),
    jsonb_build_object(
      'tag', 'EVOLUCAO_CONSTRUTIVA_CONFIRMADA',
      'text', 'A trajetória construtiva WT7 indica evolução do modelo: alvenaria tradicional → combinação com container → aproveitamento de estrutura existente + ampliação leve. O padrão futuro deve ser aproveitar o que já existe quando fizer sentido e ampliar com soluções leves.',
      'type', 'principio_pessoal', 'priority', 4,
      'tags', jsonb_build_array('obra', 'modelo_construtivo', 'evolucao'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('MODELO_CONSTRUTIVO_AGIL')
    ),
    jsonb_build_object(
      'tag', 'FASEAMENTO_VALIDA_DEMANDA',
      'text', 'Fasear obras permite validar demanda, preservar caixa e reduzir risco. Quando a primeira fase aluga rápido, a segunda fase ganha segurança. O caixa pode circular entre projetos enquanto a demanda é validada.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('obra', 'risco', 'caixa', 'demanda'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'PRESENCA_FISICA_INEGOCIAVEL',
      'text', 'Presença física do dono ou de um gestor de confiança na obra é indispensável. Gestão remota sem fiscalização ativa aumenta atraso, erro e retrabalho. O Naval deve sempre considerar agenda de presença ou delegação qualificada antes de recomendar nova obra.',
      'type', 'principio_pessoal', 'priority', 5,
      'tags', jsonb_build_array('obra', 'gestao', 'presenca'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'MODELO_LENTO_NAO_DEFAULT',
      'text', 'Alvenaria do zero não deve ser o padrão default para novas kitnets WT7. Só deve ser considerada quando houver justificativa técnica, legal, econômica ou estrutural superior ao modelo leve/modular. O Naval não deve recomendar alvenaria tradicional por inércia.',
      'type', 'principio_pessoal', 'priority', 5,
      'tags', jsonb_build_array('obra', 'modelo_construtivo', 'default'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('MODELO_CONSTRUTIVO_AGIL')
    ),
    jsonb_build_object(
      'tag', 'NAO_USAR_DIVIDA_BANCARIA_PARA_CONSTRUIR_KITNET',
      'text', 'Restrição estratégica WT7: não usar dívida bancária para construir kitnets de aluguel. O modelo preferencial é caixa próprio, sócio paciente ou entrada antecipada de parceiro. Exceções só podem ser consideradas se houver fluxo de caixa travado, risco limitado, garantia forte de receita e decisão expressa do William.',
      'type', 'principio_pessoal', 'priority', 5,
      'tags', jsonb_build_array('obra', 'caixa', 'restricao', 'divida'),
      'requires_validation', false, 'is_hard_constraint', true, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('CAIXA_PF_NAO_DEFAULT_KITNET_ALUGUEL')
    ),
    jsonb_build_object(
      'tag', 'COBRANCA_DE_CRONOGRAMA_E_DO_GESTOR',
      'text', 'Cobrar cronograma de fornecedor é responsabilidade do gestor. Sem follow-up semanal, prazos derrapam por padrão. O Naval deve sugerir rotina de cobrança, marcos e responsáveis sempre que houver fornecedor crítico.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('obra', 'gestao', 'fornecedor', 'checklist'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'HIERARQUIA_SOCIO_VS_SOLO_EM_APERTO',
      'text', 'Em aperto de caixa, compromisso com sócio/parceiro vem antes de obra solo. Preservar reputação, confiança e previsibilidade com parceiros é prioridade estratégica. Paralisar obra própria antes de prejudicar sócio é regra forte do modelo WT7.',
      'type', 'principio_pessoal', 'priority', 5,
      'tags', jsonb_build_array('socio', 'caixa', 'reputacao', 'restricao'),
      'requires_validation', false, 'is_hard_constraint', true, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'SOCIO_E_OPORTUNIDADE_NAO_ESTRATEGIA',
      'text', 'William não deve buscar sócio por necessidade emocional ou pressa. Sócio entra quando existe pacote completo: oportunidade externa clara, pessoa de confiança, capital paciente e autonomia operacional preservada. Sócio deve ser financiador/parceiro, não co-gestor do dia a dia.',
      'type', 'preferencia_estrategica', 'priority', 4,
      'tags', jsonb_build_array('socio', 'oportunidade'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('TERRENO_VEM_EM_JANELA_DINHEIRO_DEPOIS')
    ),
    jsonb_build_object(
      'tag', 'TERRENO_VEM_EM_JANELA_DINHEIRO_DEPOIS',
      'text', 'Terrenos raros aparecem em janelas curtas; caixa próprio pode levar meses. Quando a oportunidade for excepcional, parceria de capital paciente pode ser aceitável para capturar o terreno. O Naval deve diferenciar sócio paciente de sócio que cobra retorno agressivo.',
      'type', 'principio_pessoal', 'priority', 5,
      'tags', jsonb_build_array('terreno', 'socio', 'oportunidade', 'caixa'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('SOCIO_E_OPORTUNIDADE_NAO_ESTRATEGIA')
    )
  ),
  10, true
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, principles = EXCLUDED.principles,
  priority = EXCLUDED.priority, updated_at = now();

-- ════════════════════════════════════════════════════════════════════════════
-- S2 · OPERADOR WT7 — OPERAÇÃO KITNETS
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO naval_sources (slug, title, author, source_type, lens, summary, principles, priority, active)
VALUES (
  'operador_kitnets_wt7',
  'Operador WT7 — Operação Kitnets',
  'William Tavares',
  'note',
  'operador',
  'Gestão das 13 kitnets em operação (RWT02+RWT03). ICP de inquilino, problemas operacionais, fornecedores, terceirização Cláudio Domingues, modelo de cobrança de taxas.',
  jsonb_build_array(
    jsonb_build_object(
      'tag', 'ICP_INQUILINO_ASCENSAO_DE_CARREIRA',
      'text', 'ICP de inquilino WT7: solteiros ou casais sem filhos, em ascensão profissional, que veem a kitnet como fase de evolução. A pergunta-chave é: "qual seu plano profissional para os próximos 2-3 anos?". Resposta vaga não elimina, mas vira bandeira amarela.',
      'type', 'principio_pessoal', 'priority', 5,
      'tags', jsonb_build_array('kitnet', 'inquilino', 'ICP', 'filtro'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('RENDA_FILTRA_MENOS_QUE_VETOR_DE_CARREIRA')
    ),
    jsonb_build_object(
      'tag', 'RENDA_FILTRA_MENOS_QUE_VETOR_DE_CARREIRA',
      'text', 'Renda atual é importante, mas vetor de carreira pesa mais. Um inquilino com renda apenas estável e sem perspectiva pode ser mais arriscado que alguém em crescimento, com plano e disciplina.',
      'type', 'principio_pessoal', 'priority', 4,
      'tags', jsonb_build_array('kitnet', 'inquilino', 'risco'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('ICP_INQUILINO_ASCENSAO_DE_CARREIRA')
    ),
    jsonb_build_object(
      'tag', 'LIMPEZA_E_PROBLEMA_OPERACIONAL_1',
      'text', 'Limpeza é o principal gargalo operacional das kitnets WT7. Rotina profissional de limpeza, padronização e inspeção tende a gerar mais ROI operacional do que apenas tentar reduzir vacância marginalmente.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('kitnet', 'operacao', 'limpeza'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'ENTUPIMENTO_FOSSA_E_2',
      'text', 'Entupimento de fossa é manutenção recorrente relevante. O Naval deve sugerir prevenção: orientação de uso, manutenção programada e, quando viável, monitoramento de nível ou inspeção periódica.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('kitnet', 'manutencao', 'fossa'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'CLAUDIO_DOMINGUES_TIRA_COBRANCA_DO_PRATO',
      'text', 'A cobrança das kitnets administrada por Cláudio Domingues funciona como terceirização saudável. Reduz carga mental do William e libera energia para obras, Prevensul e estratégia. O Naval deve respeitar esse modelo e evitar trazer microcobrança para a rotina do William, salvo exceções relevantes.',
      'type', 'principio_pessoal', 'priority', 4,
      'tags', jsonb_build_array('kitnet', 'cobranca', 'terceirizacao', 'claudio_domingues'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'MODELO_TAXAS_KITNET_WT7',
      'text', 'Modelo preferencial WT7: água, internet e IPTU podem ser embutidos no aluguel para simplificar a experiência do inquilino; energia deve permanecer individualizada sempre que possível, pois reduz abuso, protege margem, torna o consumo mais justo e cria uma fonte adicional de lucro quando há geração solar própria. Como William gera energia solar e cobra o consumo dos inquilinos, a diferença entre o valor cobrado e o custo reduzido da fatura gera resultado operacional positivo. Por isso, energia individualizada não é apenas controle de custo: é parte da estratégia de monetização das kitnets. Modelo "tudo incluso" só deve ser usado se aumentar ticket e reduzir vacância sem eliminar essa margem energética.',
      'type', 'preferencia_estrategica', 'priority', 4,
      'tags', jsonb_build_array('kitnet', 'modelo_negocio', 'energia_solar', 'monetizacao'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('PADRAO_DEFAULT_KITNET_WT7', 'KITNET_TUDO_INCLUSO_COM_ENERGIA_SEPARADA')
    )
  ),
  10, true
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, principles = EXCLUDED.principles,
  priority = EXCLUDED.priority, updated_at = now();

-- ════════════════════════════════════════════════════════════════════════════
-- S3 · OPERADOR PREVENSUL — VENDAS TÉCNICAS
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO naval_sources (slug, title, author, source_type, lens, summary, principles, priority, active)
VALUES (
  'operador_vendas_prevensul',
  'Operador Prevensul — Vendas Técnicas',
  'William Tavares',
  'note',
  'operador',
  'Experiência comercial do William em vendas técnicas (15 anos como único closer profissional Prevensul). Contas âncora, riscos de concentração, diligência comercial, divisão T7 William↔Diego, estrutura CW7.',
  jsonb_build_array(
    jsonb_build_object(
      'tag', 'DEPENDENCIA_COMERCIAL_ESTRUTURAL_WILLIAM',
      'text', 'A Prevensul depende estruturalmente do William no comercial enquanto não houver substituto treinado, carteira descentralizada, processo comercial documentado e rotina de prospecção ativa. O risco não é apenas talento individual, mas ausência de estrutura substituta. Antes de transição total para T7/WT7, criar sucessor comercial é obrigatório.',
      'type', 'principio_pessoal', 'priority', 5,
      'tags', jsonb_build_array('prevensul', 'comercial', 'sucessao', 'gargalo_humano'),
      'requires_validation', false, 'is_hard_constraint', true, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'CONTA_ANCORA_VEM_DE_EXPANSAO_GEOGRAFICA',
      'text', 'Contas âncora tendem a surgir quando a Prevensul sai da saturação regional e busca oportunidades em outros estados. A experiência GRAND FOOD reforça que expansão geográfica pode ser mais poderosa que apenas insistir no mercado local.',
      'type', 'principio_pessoal', 'priority', 5,
      'tags', jsonb_build_array('prevensul', 'expansao', 'geografia', 'concentracao'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('NICHO_MAIS_GEOGRAFIA', 'CONCENTRACAO_CLIENTE_ACIMA_30_E_RISCO')
    ),
    jsonb_build_object(
      'tag', 'CONFIANCA_NAO_SUBSTITUI_DILIGENCIA',
      'text', 'Confiança no comprador ou no relacionamento não substitui diligência comercial. Em vendas técnicas de alto valor, o Naval deve exigir mapeamento de comprador econômico, processo decisório, risco de crédito, documentação, influência interna e segurança contratual.',
      'type', 'principio_pessoal', 'priority', 5,
      'tags', jsonb_build_array('vendas', 'diligencia', 'qualificacao', 'risco'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('MEDDIC_OBRIGATORIO_EM_TICKET_TECNICO')
    ),
    jsonb_build_object(
      'tag', 'T7_DIVISAO_NAO_TRANSPONIVEL',
      'text', 'Diego e William têm funções complementares e não totalmente substituíveis na T7. Diego é mais executor/operacional; William é mais estratégico/CEO/investidor. O Naval deve evitar planos em que William desapareça 100% da estratégia ou Diego fique sem suporte operacional.',
      'type', 'principio_pessoal', 'priority', 4,
      'tags', jsonb_build_array('t7', 'socio', 'diego', 'divisao_de_papeis'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'CW7_E_PONTE_NAO_DESTINO',
      'text', 'CW7 deve ser tratada como ponte estratégica, não como destino definitivo. O Naval não deve estruturar planos de longo prazo que dependam da CW7 após 2028/2029 sem validação explícita do William.',
      'type', 'preferencia_estrategica', 'priority', 4,
      'tags', jsonb_build_array('cw7', 'transicao', 'horizonte'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    )
  ),
  10, true
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, principles = EXCLUDED.principles,
  priority = EXCLUDED.priority, updated_at = now();

-- ════════════════════════════════════════════════════════════════════════════
-- S4 · CONSTRUÇÃO CIVIL BR/SC — REFERÊNCIAS OPERACIONAIS
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO naval_sources (slug, title, author, source_type, lens, summary, principles, priority, active)
VALUES (
  'construcao_br_sc_referencias',
  'Construção Civil BR/SC — Referências Operacionais',
  'Fontes técnicas BR/SC (CUB SC, Sienge, CBMSC, AECweb)',
  'reference',
  'operador',
  'Custos, cronograma, contingência, PPCI, hidráulica e riscos típicos de obra pequena BR/SC. Referências externas que devem ser revalidadas periodicamente, especialmente números de custo e legislação.',
  jsonb_build_array(
    jsonb_build_object(
      'tag', 'CUB_SC_REFERENCIA_ATUALIZAVEL',
      'text', 'CUB SC deve ser usado apenas como referência inicial de custo por m², nunca como orçamento final de kitnet. O Naval deve buscar valor atualizado antes de usar em decisão real.',
      'type', 'alerta_validacao', 'priority', 2,
      'tags', jsonb_build_array('obra', 'custo', 'CUB', 'sc'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 6, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'CUSTO_KITNET_BR_REFERENCIA',
      'text', 'Kitnets pequenas tendem a ter custo por m² maior que imóveis maiores, pois concentram banheiro, cozinha, hidráulica e elétrica em área reduzida. Não fazer regra de três simples por metro quadrado.',
      'type', 'heuristica_operacional', 'priority', 3,
      'tags', jsonb_build_array('obra', 'kitnet', 'custo'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('KITNET_CUSTO_M2_E_20_30_PORCENTO_MAIOR')
    ),
    jsonb_build_object(
      'tag', 'KITNET_CUSTO_M2_E_20_30_PORCENTO_MAIOR',
      'text', 'Em kitnets, o custo real por m² pode ser 20-30% maior que o de imóveis residenciais equivalentes, devido à concentração de infraestrutura. Naval deve aplicar margem de segurança ao estimar custo por unidade.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('obra', 'kitnet', 'custo', 'margem'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 24, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'RESERVA_CONTINGENCIA_10_15_PORCENTO',
      'text', 'Obras residenciais pequenas devem prever reserva de contingência mínima de 10-15%. Abaixo disso, o risco de estouro de caixa aumenta. Em projetos WT7, a reserva deve considerar também perda de aluguel por atraso.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('obra', 'caixa', 'contingencia'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'INCC_REAJUSTE_OBRA_ATUALIZAVEL',
      'text', 'Contratos de obra com duração longa devem prever mecanismo de reajuste ou proteção contra inflação de construção. Índices como INCC devem ser atualizados antes de qualquer simulação ou cláusula contratual.',
      'type', 'alerta_validacao', 'priority', 3,
      'tags', jsonb_build_array('obra', 'contrato', 'INCC'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 6, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'ATRASO_TIPICO_CONFIRMAR_MODELO_CONSTRUTIVO',
      'text', 'Obras pequenas costumam atrasar. O Naval deve sempre comparar atraso esperado do modelo tradicional com alternativas leves/modulares. Quando o atraso estimado supera o ganho de economia, a opção mais rápida pode ser financeiramente superior.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('obra', 'prazo', 'modelo_construtivo'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('TEMPO_OBRA_VS_CUSTO', 'MODELO_CONSTRUTIVO_AGIL')
    ),
    jsonb_build_object(
      'tag', 'FINANCIAMENTO_OBRA_LIBERA_POR_ETAPA',
      'text', 'Financiamento de obra costuma liberar recursos por etapas e medições. Atraso físico pode travar liberação financeira. Para WT7, este item é apenas informativo, pois a regra principal é evitar dívida bancária para construir kitnets de aluguel.',
      'type', 'alerta_validacao', 'priority', 2,
      'tags', jsonb_build_array('obra', 'financiamento', 'informativo'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array('NAO_USAR_DIVIDA_BANCARIA_PARA_CONSTRUIR_KITNET')
    ),
    jsonb_build_object(
      'tag', 'RETENCAO_FINAL_FINANCIAMENTO',
      'text', 'Algumas linhas de financiamento retêm parcela final até conclusão, documentação ou Habite-se. Se houver análise excepcional de financiamento, o Naval deve considerar caixa próprio para concluir a obra sem depender da parcela final.',
      'type', 'alerta_validacao', 'priority', 2,
      'tags', jsonb_build_array('obra', 'financiamento', 'caixa'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'CAIXA_PF_NAO_DEFAULT_KITNET_ALUGUEL',
      'text', 'Linhas PF de construção podem não se enquadrar em empreendimentos de aluguel ou comercialização. O Naval deve validar regras oficiais atualizadas antes de qualquer simulação. Para WT7, reforça a restrição de não usar dívida bancária para construir.',
      'type', 'alerta_validacao', 'priority', 2,
      'tags', jsonb_build_array('obra', 'financiamento', 'caixa', 'enquadramento'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array('NAO_USAR_DIVIDA_BANCARIA_PARA_CONSTRUIR_KITNET')
    ),
    jsonb_build_object(
      'tag', 'CBMSC_KITNET_VALIDAR_ENQUADRAMENTO',
      'text', 'O enquadramento de kitnets perante CBMSC/PPCI deve ser validado por profissional técnico conforme número de unidades, área comum, uso e norma vigente. Naval pode sinalizar possível dispensa ou exigência, mas não deve concluir sozinho.',
      'type', 'alerta_validacao', 'priority', 3,
      'tags', jsonb_build_array('obra', 'PPCI', 'CBMSC', 'sc'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'HABITE_SE_BOMBEIROS_SC_DOCUMENTACAO',
      'text', 'Processos simplificados podem reduzir prazo de Habite-se Bombeiros em SC, mas dependem de documentação completa e enquadramento correto. Usar apenas como alerta de oportunidade, não como prazo garantido.',
      'type', 'alerta_validacao', 'priority', 2,
      'tags', jsonb_build_array('obra', 'habite-se', 'sc'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'HABITE_SE_SANITARIO_E_BOMBEIROS_SEPARADOS',
      'text', 'Habite-se sanitário/prefeitura e regularização junto aos bombeiros podem ser processos separados. O Naval deve sempre listar documentos e órgãos envolvidos antes de considerar uma obra "pronta".',
      'type', 'heuristica_operacional', 'priority', 3,
      'tags', jsonb_build_array('obra', 'regularizacao', 'checklist'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'EMPREITADA_VS_DIARIA',
      'text', 'Empreitada pode dar previsibilidade, mas reduz flexibilidade e pode exigir adiantamentos. Diária pode custar mais, mas absorve mudanças. Naval deve comparar custo, flexibilidade, risco de abandono e capacidade de fiscalização.',
      'type', 'heuristica_operacional', 'priority', 3,
      'tags', jsonb_build_array('obra', 'mao_de_obra', 'contratacao'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'ERRO_HIDRAULICO_E_O_MAIS_CARO',
      'text', 'Erro hidráulico é um dos retrabalhos mais caros em obra pequena. Naval deve sempre recomendar projeto hidrossanitário, conferência técnica e teste antes de fechamento de parede ou contrapiso.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('obra', 'hidraulica', 'retrabalho'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('TESTAR_HIDRAULICA_ANTES_DE_FECHAR_PAREDE')
    ),
    jsonb_build_object(
      'tag', 'TESTAR_HIDRAULICA_ANTES_DE_FECHAR_PAREDE',
      'text', 'Teste completo de hidráulica antes de fechar parede e contrapiso é obrigatório como checklist operacional WT7. Vazamento pós-acabamento destrói cronograma, acabamento e margem.',
      'type', 'heuristica_operacional', 'priority', 5,
      'tags', jsonb_build_array('obra', 'hidraulica', 'checklist'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('ERRO_HIDRAULICO_E_O_MAIS_CARO')
    ),
    jsonb_build_object(
      'tag', 'KITNET_TUDO_INCLUSO_COM_ENERGIA_SEPARADA',
      'text', 'Modelo "tudo incluso" pode aumentar atratividade, mas energia individualizada protege margem e pode gerar lucro adicional quando há energia solar própria. Naval deve priorizar pacote híbrido: água/internet/IPTU inclusos quando fizer sentido, energia separada por consumo, preservando a monetização da energia solar.',
      'type', 'preferencia_estrategica', 'priority', 4,
      'tags', jsonb_build_array('kitnet', 'modelo_negocio', 'energia'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('MODELO_TAXAS_KITNET_WT7', 'PADRAO_DEFAULT_KITNET_WT7')
    )
  ),
  20, true
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, principles = EXCLUDED.principles,
  priority = EXCLUDED.priority, updated_at = now();

-- ════════════════════════════════════════════════════════════════════════════
-- S5 · HOLDING PATRIMONIAL / ESTRUTURA SOCIETÁRIA — ALERTAS
-- ════════════════════════════════════════════════════════════════════════════
-- DIRETRIZ: Naval NUNCA deve concluir tributário/jurídico sozinho.
-- Todos os itens são alerta_validacao com requires_validation=true.
INSERT INTO naval_sources (slug, title, author, source_type, lens, summary, principles, priority, active)
VALUES (
  'holding_patrimonial_alertas',
  'Holding Patrimonial / Estrutura Societária — Alertas',
  'Fontes jurídicas/tributárias BR (Migalhas, ConJur, STJ, IBDFAM)',
  'reference',
  'operador',
  'Temas sensíveis sobre holding, sociedade informal, ITBI, ITCMD, casamento, dividendos e blindagem patrimonial. EXIGE validação com contador/advogado — Naval deve usar como gatilho de análise, não como recomendação definitiva.',
  jsonb_build_array(
    jsonb_build_object(
      'tag', 'HOLDING_LUCRO_PRESUMIDO_ALUGUEL_AVALIAR',
      'text', 'Holding patrimonial pode reduzir tributação sobre aluguel em certos cenários, especialmente comparada ao carnê-leão PF. A decisão depende de regime tributário, CNAE, custos contábeis, ITBI, distribuição de lucros, sucessão e estrutura familiar. Naval deve sugerir simulação profissional.',
      'type', 'alerta_validacao', 'priority', 3,
      'tags', jsonb_build_array('holding', 'tributario', 'aluguel'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array('RENDA_ALUGUEL_JUSTIFICA_ESTUDO_HOLDING')
    ),
    jsonb_build_object(
      'tag', 'RENDA_ALUGUEL_JUSTIFICA_ESTUDO_HOLDING',
      'text', 'A renda imobiliária atual e futura do William já justifica estudo formal de holding patrimonial. O Naval deve orientar análise comparativa PF vs PJ, mas não concluir automaticamente que a holding é melhor sem simulação contábil e jurídica.',
      'type', 'alerta_validacao', 'priority', 4,
      'tags', jsonb_build_array('holding', 'tributario', 'wt7'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'DEDUCOES_CARNE_LEAO_PF_VALIDAR',
      'text', 'Na PF, podem existir deduções aplicáveis ao aluguel antes do carnê-leão, como taxas e despesas permitidas. O Naval deve lembrar de verificar deduções legais com contador.',
      'type', 'alerta_validacao', 'priority', 3,
      'tags', jsonb_build_array('PF', 'tributario', 'aluguel'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'REFORMA_TRIBUTARIA_ALUGUEL_ATUALIZAR',
      'text', 'Reforma tributária pode alterar carga sobre locação. O Naval deve sempre buscar regra vigente e fase de transição antes de orientar decisão.',
      'type', 'alerta_validacao', 'priority', 3,
      'tags', jsonb_build_array('reforma_tributaria', 'aluguel', 'IBS', 'CBS'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 6, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'DEDUCAO_RESIDENCIAL_POR_IMOVEL_VALIDAR',
      'text', 'Possíveis deduções ou redutores para locação residencial devem ser tratados como variável de simulação tributária, não como regra fixa. Validar legislação atual antes de aplicar.',
      'type', 'alerta_validacao', 'priority', 3,
      'tags', jsonb_build_array('tributario', 'aluguel', 'residencial'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 6, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'ITBI_INTEGRALIZACAO_IMOVEL_VALIDAR',
      'text', 'Integralização de imóveis em holding pode gerar discussão sobre ITBI, valor declarado, valor venal e imunidade. O Naval deve sinalizar risco e exigir análise jurídica antes de qualquer transferência.',
      'type', 'alerta_validacao', 'priority', 4,
      'tags', jsonb_build_array('holding', 'ITBI', 'integralizacao'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'ATIVIDADE_IMOBILIARIA_IMUNIDADE_ITBI_VALIDAR',
      'text', 'A relação entre atividade imobiliária e imunidade de ITBI deve ser validada conforme jurisprudência e município. Naval não deve assumir imunidade automática.',
      'type', 'alerta_validacao', 'priority', 3,
      'tags', jsonb_build_array('holding', 'ITBI', 'jurisprudencia'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'SOCIEDADE_INFORMAL_RISCO_ALTO',
      'text', 'Sociedade informal ou de fato pode gerar risco patrimonial, sucessório, tributário e operacional. Em relações como T7, JW7 ou parcerias de terreno/capital, o Naval deve recomendar formalização mínima com contrato, papéis, percentuais, saída, morte, responsabilidades e distribuição.',
      'type', 'alerta_validacao', 'priority', 5,
      'tags', jsonb_build_array('socio', 'risco_juridico', 'formalizacao'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('MORTE_SOCIO_INFORMAL_TRAVA_OPERACAO', 'SCP_PODE_SER_MODELO_PARA_SOCIO_CAPITAL')
    ),
    jsonb_build_object(
      'tag', 'MORTE_SOCIO_INFORMAL_TRAVA_OPERACAO',
      'text', 'Morte ou incapacidade de sócio informal pode travar operação, inventário, liquidação e continuidade da obra. Naval deve sempre sugerir cláusulas de sucessão, compra de quotas, administração e saída.',
      'type', 'alerta_validacao', 'priority', 5,
      'tags', jsonb_build_array('socio', 'sucessao', 'risco'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'SCP_PODE_SER_MODELO_PARA_SOCIO_CAPITAL',
      'text', 'SCP pode ser alternativa para parceiro que entra com terreno ou capital enquanto William executa, mas deve ser validada com advogado e contador. Naval pode sugerir SCP como hipótese, não como solução automática.',
      'type', 'alerta_validacao', 'priority', 4,
      'tags', jsonb_build_array('SCP', 'socio', 'estrutura_societaria'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'SPE_VALIDAR_ESCALA_E_SOCIOS',
      'text', 'SPE só deve ser considerada quando houver escala, sócio externo, segregação de risco ou exigência contábil/jurídica. Para projetos pequenos, centro de custos ou contrato específico pode ser suficiente.',
      'type', 'alerta_validacao', 'priority', 3,
      'tags', jsonb_build_array('SPE', 'estrutura_societaria', 'incorporacao'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'PATRIMONIO_AFETACAO_VALIDAR',
      'text', 'Patrimônio de afetação pode proteger obra específica, mas deve ser analisado juridicamente conforme tipo de empreendimento. Naval deve tratar como possibilidade de estruturação, não como regra.',
      'type', 'alerta_validacao', 'priority', 3,
      'tags', jsonb_build_array('patrimonio_afetacao', 'obra'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'COMUNHAO_PARCIAL_BENFEITORIAS_VALIDAR',
      'text', 'Regime de casamento pode afetar patrimônio, parcelas pagas, benfeitorias e frutos. Naval deve recomendar planejamento patrimonial e pacto antenupcial antes de casamento ou expansão relevante.',
      'type', 'alerta_validacao', 'priority', 4,
      'tags', jsonb_build_array('casamento', 'pacto', 'patrimonio'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array('COTAS_DIVIDENDOS_E_REINVESTIMENTO_VALIDAR')
    ),
    jsonb_build_object(
      'tag', 'VALORIZACAO_NATURAL_IMOVEL_VALIDAR',
      'text', 'Valorização natural de imóvel pré-casamento e valorização por benfeitorias podem ter tratamento diferente. Naval deve sugerir validação jurídica, especialmente em obras após casamento.',
      'type', 'alerta_validacao', 'priority', 3,
      'tags', jsonb_build_array('casamento', 'patrimonio', 'valorizacao'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'COTAS_DIVIDENDOS_E_REINVESTIMENTO_VALIDAR',
      'text', 'Cotas societárias, dividendos e reinvestimentos têm impacto patrimonial em casamento e separação. Naval deve recomendar análise jurídica antes de distribuir lucros, reinvestir ou estruturar holdings familiares.',
      'type', 'alerta_validacao', 'priority', 5,
      'tags', jsonb_build_array('cotas', 'dividendos', 'casamento'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array('COMUNHAO_PARCIAL_BENFEITORIAS_VALIDAR')
    ),
    jsonb_build_object(
      'tag', 'DOACAO_COTAS_USUFRUTO_VALIDAR',
      'text', 'Doação de cotas com usufruto pode ser ferramenta sucessória relevante, mas depende de avaliação tributária, familiar e jurídica. Naval deve tratar como hipótese de planejamento, não como recomendação automática.',
      'type', 'alerta_validacao', 'priority', 5,
      'tags', jsonb_build_array('sucessao', 'doacao', 'usufruto'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array('ITCMD_JANELA_ATUALIZAR')
    ),
    jsonb_build_object(
      'tag', 'ITCMD_JANELA_ATUALIZAR',
      'text', 'ITCMD pode mudar por estado e por reforma legislativa. Naval deve buscar regra atualizada antes de qualquer recomendação sucessória.',
      'type', 'alerta_validacao', 'priority', 4,
      'tags', jsonb_build_array('ITCMD', 'sucessao', 'sc'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 6, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'CLAUSULAS_DOACAO_VALIDAR',
      'text', 'Doações patrimoniais devem avaliar cláusulas como incomunicabilidade, impenhorabilidade, reversibilidade e inalienabilidade. Naval deve sugerir essas cláusulas para discussão com advogado.',
      'type', 'alerta_validacao', 'priority', 4,
      'tags', jsonb_build_array('doacao', 'clausulas', 'sucessao'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'PJ_COMISSAO_FATOR_R_VALIDAR',
      'text', 'Migração de comissão CLT para PJ deve considerar Fator R, anexos do Simples, risco trabalhista, pró-labore e tributação. Naval deve exigir simulação contábil antes de recomendar.',
      'type', 'alerta_validacao', 'priority', 3,
      'tags', jsonb_build_array('PJ', 'CLT', 'fator_r', 'transicao'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'DIVIDENDOS_REGRAS_2026_ATUALIZAR',
      'text', 'Tributação de dividendos e lucros distribuídos deve ser sempre atualizada antes de qualquer estratégia. Naval não deve sugerir distribuição para evitar imposto sem validação legal e contábil.',
      'type', 'alerta_validacao', 'priority', 4,
      'tags', jsonb_build_array('dividendos', 'tributario', '2026'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 6, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'VENDA_IMOVEL_PF_VS_HOLDING_VALIDAR',
      'text', 'Venda de imóveis em PF ou holding pode ter impactos tributários muito diferentes conforme classificação contábil, ganho de capital, estoque, imobilizado e finalidade do imóvel. Naval deve sugerir simulação antes da venda.',
      'type', 'alerta_validacao', 'priority', 4,
      'tags', jsonb_build_array('venda_imovel', 'tributario', 'holding'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 12, 'cross_references', jsonb_build_array('ESTOQUE_OU_IMOBILIZADO_DESDE_O_INICIO')
    ),
    jsonb_build_object(
      'tag', 'ESTOQUE_OU_IMOBILIZADO_DESDE_O_INICIO',
      'text', 'Imóveis destinados à venda devem ter finalidade e classificação contábil planejadas desde o início. Reclassificações posteriores podem gerar risco fiscal. Naval deve alertar antes de iniciar obra com intenção de venda.',
      'type', 'alerta_validacao', 'priority', 4,
      'tags', jsonb_build_array('contabilidade', 'venda_imovel', 'planejamento'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'HOLDING_NAO_CORRIGE_DIVIDA_PASSADA',
      'text', 'Holding criada depois de dívida, litígio ou passivo pode ser questionada. Planejamento patrimonial deve ser preventivo, não reação tardia. Naval deve alertar sobre risco de fraude contra credores ou desconsideração.',
      'type', 'alerta_validacao', 'priority', 4,
      'tags', jsonb_build_array('holding', 'blindagem', 'risco_juridico'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'CONFUSAO_PATRIMONIAL_RISCO_MAXIMO',
      'text', 'Confusão patrimonial destrói a proteção da estrutura. Despesas pessoais e empresariais devem ser separadas, com pró-labore, lucros, reembolsos e contratos documentados. Naval deve priorizar disciplina contábil antes de estruturas sofisticadas.',
      'type', 'alerta_validacao', 'priority', 5,
      'tags', jsonb_build_array('confusao_patrimonial', 'contabilidade', 'risco'),
      'requires_validation', true, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    )
  ),
  30, true
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, principles = EXCLUDED.principles,
  priority = EXCLUDED.priority, updated_at = now();

-- ════════════════════════════════════════════════════════════════════════════
-- S6 · VENDAS B2B TÉCNICO LONGO CICLO BR
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO naval_sources (slug, title, author, source_type, lens, summary, principles, priority, active)
VALUES (
  'vendas_b2b_tecnico_br',
  'Vendas B2B Técnico Longo Ciclo BR',
  'Fontes comerciais BR (DNA Vendas, Reev, Outbound Marketing, Meetime)',
  'reference',
  'aaron_ross',
  'Heurísticas de vendas técnicas B2B no Brasil: ciclo, cadência, MEDDIC, decisores, SDR e concentração. Calibrado pra ticket >R$25k e ciclo 3-12 meses. Cruza com S3 (vendas Prevensul pessoal).',
  jsonb_build_array(
    jsonb_build_object(
      'tag', 'CONCENTRACAO_CLIENTE_ACIMA_30_E_RISCO',
      'text', 'Nenhum cliente deveria concentrar parcela excessiva do pipeline, faturamento ou esforço comercial sem plano de mitigação. Se uma conta passa de 25-30%, o Naval deve disparar alerta de concentração e sugerir geração de 2-3 contas médias alternativas.',
      'type', 'heuristica_operacional', 'priority', 5,
      'tags', jsonb_build_array('vendas', 'concentracao', 'risco'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('CONTA_ANCORA_VEM_DE_EXPANSAO_GEOGRAFICA')
    ),
    jsonb_build_object(
      'tag', 'NICHO_MAIS_GEOGRAFIA',
      'text', 'Para Prevensul, a estratégia ideal tende a ser híbrida: replicar nichos parecidos com contas âncora, mas buscar esses clientes em novas geografias. Não é nicho local ou geografia pura; é nicho validado em território expandido.',
      'type', 'preferencia_estrategica', 'priority', 4,
      'tags', jsonb_build_array('vendas', 'nicho', 'geografia', 'prevensul'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('CONTA_ANCORA_VEM_DE_EXPANSAO_GEOGRAFICA')
    ),
    jsonb_build_object(
      'tag', 'CICLO_TICKET_ALTO_EXIGE_PACIENCIA_E_QUALIFICACAO',
      'text', 'Vendas técnicas de ticket alto têm ciclo naturalmente mais longo. O Naval deve diferenciar ciclo normal de alto valor de pipeline mal qualificado. Se o lead fica muito tempo sem avanço real, auditar descoberta, decisores e processo decisório.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('vendas', 'ciclo', 'qualificacao'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'MULTI_THREADING_MINIMO_3_CONTATOS',
      'text', 'Contas B2B complexas devem ter pelo menos três relações ativas: técnico, usuário/operacional e comprador econômico/financeiro. Sem múltiplos contatos, o negócio fica vulnerável a silêncio, troca de pessoa ou bloqueio político.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('vendas', 'multi_threading', 'decisores'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('4_PAPEIS_DE_DECISAO')
    ),
    jsonb_build_object(
      'tag', 'CADENCIA_8_TOUCHPOINTS',
      'text', 'Em vendas B2B, desistir após um ou dois contatos é erro. O Naval deve sugerir cadência estruturada de múltiplos toques, usando e-mail, telefone, WhatsApp e LinkedIn conforme contexto e relacionamento.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('vendas', 'follow_up', 'cadencia'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 24, 'cross_references', jsonb_build_array('FLUXO_MISTO_CONVERTE_MELHOR')
    ),
    jsonb_build_object(
      'tag', 'FLUXO_MISTO_CONVERTE_MELHOR',
      'text', 'Fluxos mistos costumam performar melhor que apenas e-mail. Naval deve evitar cadências 100% automatizadas para ticket técnico alto e sugerir contato humano, ligação e follow-up personalizado.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('vendas', 'follow_up', 'canais'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 24, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'WHATSAPP_FOLLOWUP_NAO_ABERTURA_FRIA',
      'text', 'WhatsApp deve ser usado prioritariamente para follow-up, alinhamento e agilidade após contexto criado. Em B2B técnico, abertura fria por WhatsApp pode parecer invasiva e reduzir credibilidade.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('vendas', 'whatsapp', 'follow_up'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 24, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', '4_PAPEIS_DE_DECISAO',
      'text', 'Em venda industrial/técnica, o Naval deve mapear quatro papéis: comprador econômico, usuário, técnico/influenciador e conselheiro interno. Cada papel tem dor, linguagem, risco e critério de decisão diferentes.',
      'type', 'heuristica_operacional', 'priority', 5,
      'tags', jsonb_build_array('vendas', 'decisores', 'mapeamento'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('CHAMPION_REAL_TEM_3_MARCADORES', 'MEDDIC_OBRIGATORIO_EM_TICKET_TECNICO')
    ),
    jsonb_build_object(
      'tag', 'CHAMPION_REAL_TEM_3_MARCADORES',
      'text', 'Champion real consegue abrir portas internas, tem opinião respeitada e ganha pessoalmente quando o projeto avança. Sem esses sinais, é apenas informante.',
      'type', 'heuristica_operacional', 'priority', 5,
      'tags', jsonb_build_array('vendas', 'champion', 'qualificacao'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('4_PAPEIS_DE_DECISAO')
    ),
    jsonb_build_object(
      'tag', 'STATUS_QUO_E_CONCORRENTE_REAL',
      'text', 'Em ciclos longos, o concorrente real muitas vezes é o status quo. Elogio sem decisão, silêncio e adiamento indicam paralisia interna. Naval deve sugerir custo da inação, urgência legítima e próximo passo concreto.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('vendas', 'status_quo', 'paralisia'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('QUANTIFICAR_CUSTO_DA_INACAO')
    ),
    jsonb_build_object(
      'tag', 'MEDDIC_OBRIGATORIO_EM_TICKET_TECNICO',
      'text', 'Para vendas técnicas complexas, Naval deve usar lógica MEDDIC: métricas, comprador econômico, critérios de decisão, processo de decisão, dor identificada e champion. Lead sem comprador econômico mapeado deve perder prioridade.',
      'type', 'heuristica_operacional', 'priority', 5,
      'tags', jsonb_build_array('vendas', 'MEDDIC', 'qualificacao'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('CONFIANCA_NAO_SUBSTITUI_DILIGENCIA', '4_PAPEIS_DE_DECISAO')
    ),
    jsonb_build_object(
      'tag', 'QUANTIFICAR_CUSTO_DA_INACAO',
      'text', 'Quantificar custo da inação em reais ajuda a envolver CFO e comprador econômico. Naval deve transformar riscos técnicos, atrasos, multas, perda produtiva ou insegurança em impacto financeiro.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('vendas', 'fechamento', 'CFO'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('STATUS_QUO_E_CONCORRENTE_REAL')
    ),
    jsonb_build_object(
      'tag', 'SDR_HIBRIDO_TICKET_ALTO',
      'text', 'Para ticket técnico alto, o modelo mais adequado tende a ser prospecção terceirizada ou híbrida, com fechamento técnico interno. SDR totalmente interno pode demorar a maturar e exigir senioridade difícil de formar.',
      'type', 'preferencia_estrategica', 'priority', 4,
      'tags', jsonb_build_array('vendas', 'SDR', 'terceirizacao'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', 24, 'cross_references', jsonb_build_array('DEPENDENCIA_COMERCIAL_ESTRUTURAL_WILLIAM')
    ),
    jsonb_build_object(
      'tag', '3_OPCOES_DE_PRECO',
      'text', 'Apresentar três opções de preço ou escopo pode melhorar negociação: básica, recomendada e premium. Naval deve usar ancoragem sem prejudicar credibilidade técnica.',
      'type', 'heuristica_operacional', 'priority', 3,
      'tags', jsonb_build_array('vendas', 'negociacao', 'ancoragem'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'INSIGHT_SETORIAL_VENCE_PERGUNTA_GENERICA',
      'text', 'Abrir conversa com insight setorial específico costuma ser melhor que pergunta genérica. Naval deve formular abordagens com diagnóstico do setor, risco típico e pergunta direcionada.',
      'type', 'heuristica_operacional', 'priority', 3,
      'tags', jsonb_build_array('vendas', 'abordagem', 'insight'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'PRAZO_PAGAMENTO_COMO_ALAVANCA',
      'text', 'Condição de pagamento pode ser alavanca de fechamento mais barata que desconto. Naval deve comparar desconto, prazo, entrada, medição, retenção e fluxo de caixa antes de sugerir reduzir preço.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('vendas', 'negociacao', 'prazo'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'STALLING_TEM_SINAIS_MENSURAVEIS',
      'text', 'Stalling deve ser medido por ausência de resposta, falta de avanço, não marcação de reunião, não envolvimento de decisores e repetição de promessas vagas. Naval deve sugerir intervenção, não apenas mais um e-mail.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('vendas', 'stalling', 'reaquecimento'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', true,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'REAQUECIMENTO_COM_VALOR_NAO_GENERICO',
      'text', 'Reaquecer oportunidade exige valor novo, urgência real ou mudança de contexto. Mensagens genéricas como "estou passando para ver" devem ser evitadas.',
      'type', 'heuristica_operacional', 'priority', 3,
      'tags', jsonb_build_array('vendas', 'reaquecimento', 'follow_up'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array()
    ),
    jsonb_build_object(
      'tag', 'COACHING_COMERCIAL_MAIS_PROCESSO_MENOS_TALENTO',
      'text', 'Alta performance comercial depende de processo, revisão de pipeline, coaching e disciplina, não apenas talento individual. Naval deve propor rotina comercial estruturada para reduzir dependência do William.',
      'type', 'preferencia_estrategica', 'priority', 3,
      'tags', jsonb_build_array('vendas', 'processo', 'coaching'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('DEPENDENCIA_COMERCIAL_ESTRUTURAL_WILLIAM')
    ),
    jsonb_build_object(
      'tag', 'AUDITAR_QUALIFICACAO_ANTES_DE_SCRIPT',
      'text', 'Quando muitas oportunidades ultrapassam prazo sem fechar, o primeiro diagnóstico deve ser qualificação e descoberta, não script de fechamento. Naval deve auditar ICP, dor, decisor, orçamento e processo antes de mexer no pitch.',
      'type', 'heuristica_operacional', 'priority', 4,
      'tags', jsonb_build_array('vendas', 'qualificacao', 'diagnostico'),
      'requires_validation', false, 'is_hard_constraint', false, 'is_operational_checklist', false,
      'temporal_validity_months', null, 'cross_references', jsonb_build_array('CICLO_TICKET_ALTO_EXIGE_PACIENCIA_E_QUALIFICACAO')
    )
  ),
  20, true
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, principles = EXCLUDED.principles,
  priority = EXCLUDED.priority, updated_at = now();

-- ════════════════════════════════════════════════════════════════════════════
-- FIM DA MIGRATION
-- ════════════════════════════════════════════════════════════════════════════
-- Próximo passo manual após aplicar:
--   1. Lovable Agent: deploy do edge function naval-embed (versão atualizada
--      pra aceitar princípios como objetos com {text, type, priority, ...})
--   2. Pra cada source novo, chamar:
--        POST /functions/v1/naval-embed { source_id: "<uuid>" }
--      Isso gera embeddings dos 86 princípios via Gemini text-embedding-004.
--   3. Lovable Agent: deploy do wisely-ai (versão v43+) que renderiza
--      metadados (type/priority/requires_validation) no system prompt do Naval.
