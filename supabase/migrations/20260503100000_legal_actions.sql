-- ════════════════════════════════════════════════════════════════════════════
-- Módulo Jurídico/Legal V1 — tabela legal_actions
-- ════════════════════════════════════════════════════════════════════════════
-- Centraliza ações jurídicas/contábeis pendentes do William: briefings,
-- contratos, formalizações, planejamentos. Cada ação tem checklist de
-- progresso, custo estimado vs real, profissional responsável e briefing
-- detalhado em markdown.
--
-- V2 (próximos sprints): legal_contracts, legal_documents, legal_templates.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.legal_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  title text NOT NULL,
  description text,
  area text NOT NULL CHECK (area IN (
    'societario', 'tributario', 'familiar', 'sucessorio',
    'imobiliario', 'ppci', 'trabalhista', 'consumidor', 'outro'
  )),

  -- Status e prioridade
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN (
    'pendente', 'em_reuniao', 'contratado', 'em_execucao',
    'concluido', 'arquivado', 'bloqueado'
  )),
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baixa')),

  -- Prazos
  deadline date,
  started_at date,
  completed_at date,

  -- Profissional responsável
  professional_name text,
  professional_type text CHECK (professional_type IN (
    'advogado', 'contador', 'despachante', 'cartorio', 'corretor', 'outro'
  )),
  professional_contact text,

  -- Briefing e notas
  briefing_md text,
  notes text,

  -- Checklist de execução (jsonb pra flexibilidade)
  -- Formato: [{step: "Mandar briefing", done: true, done_at: "2026-05-03", notes: "..."}]
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Custos
  cost_estimated_min numeric(12, 2),
  cost_estimated_max numeric(12, 2),
  cost_real numeric(12, 2),

  -- Vínculos opcionais (relaciona com outras tabelas se relevante)
  related_construction_id uuid REFERENCES public.constructions(id) ON DELETE SET NULL,
  related_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  related_kitnet_id uuid REFERENCES public.kitnets(id) ON DELETE SET NULL,

  -- Anexos (links/paths pra documentos no storage ou externos)
  attachments jsonb DEFAULT '[]'::jsonb,
  -- Formato: [{name: "Contrato.pdf", url: "...", uploaded_at: "..."}]

  -- Auditoria
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_actions_status_idx ON public.legal_actions (status);
CREATE INDEX IF NOT EXISTS legal_actions_deadline_idx ON public.legal_actions (deadline) WHERE status NOT IN ('concluido', 'arquivado');
CREATE INDEX IF NOT EXISTS legal_actions_priority_idx ON public.legal_actions (priority);

-- RLS — só admin
ALTER TABLE public.legal_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage legal_actions" ON public.legal_actions;
CREATE POLICY "Admin can manage legal_actions" ON public.legal_actions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_legal_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS legal_actions_updated_at ON public.legal_actions;
CREATE TRIGGER legal_actions_updated_at
  BEFORE UPDATE ON public.legal_actions
  FOR EACH ROW EXECUTE FUNCTION public.tg_legal_actions_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- SEEDS — importa os 4 briefings já criados em wt7/briefings_juridicos/
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.legal_actions (
  title, description, area, status, priority, deadline,
  professional_type, briefing_md, checklist,
  cost_estimated_min, cost_estimated_max
) VALUES (
  'T7 Sales — formalização societária com Diego',
  'Formalizar sociedade T7 com irmão Diego antes de jul/2026 (TDI ← TIM começar a faturar). Hoje é sociedade em comum (CC art. 986) — patrimônio pessoal exposto.',
  'societario',
  'pendente',
  'alta',
  '2026-07-01',
  'advogado',
  E'Briefing completo em wt7/briefings_juridicos/01_T7_formalizacao_societaria.md\n\nResumo: estruturar T7 (William 50% + Diego 50%) antes de jul/2026 quando TDI começa a faturar contrato TIM. Risco atual: sociedade em comum = responsabilidade ilimitada PF.',
  jsonb_build_array(
    jsonb_build_object('step', 'Mandar briefing pro advogado societário', 'done', false),
    jsonb_build_object('step', 'Marcar reunião inicial', 'done', false),
    jsonb_build_object('step', 'Receber proposta de estrutura (LTDA / SCP / outro)', 'done', false),
    jsonb_build_object('step', 'Definir cláusulas críticas (morte, saída, distribuição lucros)', 'done', false),
    jsonb_build_object('step', 'Definir regime tributário (Simples Anexo III + Fator R)', 'done', false),
    jsonb_build_object('step', 'Aprovação final + assinar contrato social', 'done', false),
    jsonb_build_object('step', 'Registro na junta comercial + CNPJ', 'done', false),
    jsonb_build_object('step', 'Abrir conta PJ + integração financeira', 'done', false)
  ),
  2000.00, 4000.00
);

INSERT INTO public.legal_actions (
  title, description, area, status, priority, deadline, completed_at,
  professional_type, briefing_md, checklist
) VALUES (
  'Pacto antenupcial — separação total de bens',
  'Pacto firmado pra casamento 11/12/2027 com a noiva. Regime: separação total de bens.',
  'familiar',
  'concluido',
  'alta',
  '2027-06-01',
  '2026-05-03',
  'advogado',
  'Briefing arquivado em wt7/briefings_juridicos/02_pacto_antenupcial_dez2027.md (RESOLVIDO).

Decisão tomada: separação total de bens. Patrimônio pré e pós-casamento NÃO comunica.',
  jsonb_build_array(
    jsonb_build_object('step', 'Conversa com a noiva sobre regime', 'done', true),
    jsonb_build_object('step', 'Consulta com advogado de família', 'done', true),
    jsonb_build_object('step', 'Lavratura no cartório', 'done', true),
    jsonb_build_object('step', 'Arquivar contrato firmado', 'done', true)
  )
);

INSERT INTO public.legal_actions (
  title, description, area, status, priority, deadline,
  professional_type, briefing_md, checklist,
  cost_estimated_min, cost_estimated_max
) VALUES (
  'Doação de cotas com usufruto vitalício + janela ITCMD',
  'Estruturar doação de cotas WT7 Holding pra futuros filhos com reserva de usufruto vitalício, antes da reforma federal subir ITCMD de 8% (SC) pra 16-20%. Foco em sucessão (separação total de bens já firmada).',
  'sucessorio',
  'pendente',
  'media',
  '2026-12-31',
  'advogado',
  E'Briefing completo em wt7/briefings_juridicos/03_doacao_cotas_usufruto_ITCMD.md\n\nResumo: aproveitar janela ITCMD atual (8%) antes da reforma federal. Doação com usufruto vitalício mantém controle operacional.',
  jsonb_build_array(
    jsonb_build_object('step', 'Pedir avaliação dos imóveis (valor DIRPF)', 'done', false),
    jsonb_build_object('step', 'Estruturação holding WT7 oficial', 'done', false),
    jsonb_build_object('step', 'Integralização imóveis na holding (pelo valor histórico DIRPF)', 'done', false),
    jsonb_build_object('step', 'Decidir doação pra futuros filhos vs auto-doação com cláusulas', 'done', false),
    jsonb_build_object('step', 'Lavratura escritura de doação', 'done', false),
    jsonb_build_object('step', 'Cláusulas: incomunicabilidade + impenhorabilidade + reversibilidade + inalienabilidade', 'done', false),
    jsonb_build_object('step', 'Pagamento ITCMD', 'done', false)
  ),
  2000.00, 5000.00
);

INSERT INTO public.legal_actions (
  title, description, area, status, priority, deadline,
  professional_type, briefing_md, checklist,
  cost_estimated_min, cost_estimated_max
) VALUES (
  'Estrutura de saque de dividendos T7 + WT7 (escapar retenção 10%)',
  'Otimizar saque de lucros entre WT7 Holding e T7 Sales pra escapar da retenção 10% sobre lucros >R$ 50k/mês (vigente desde 01/2026). Splittar distribuição entre PJs.',
  'tributario',
  'pendente',
  'alta',
  '2026-07-01',
  'contador',
  E'Briefing completo em wt7/briefings_juridicos/04_estrutura_saque_dividendos_T7_WT7.md\n\nResumo: distribuir até R$ 50k/mês por cada PJ (T7 + WT7) escapa da retenção 10%. Definir pró-labore mínimo e regime tributário (Simples Anexo III + Fator R 28%).',
  jsonb_build_array(
    jsonb_build_object('step', 'Mandar briefing pro contador', 'done', false),
    jsonb_build_object('step', 'Validar Fator R ≥28% no perfil de receita atual', 'done', false),
    jsonb_build_object('step', 'Definir pró-labore mínimo legal (cada PJ)', 'done', false),
    jsonb_build_object('step', 'Estruturar splittagem WT7 + T7 (até R$ 50k cada)', 'done', false),
    jsonb_build_object('step', 'Decidir distribuição mensal vs anual de bônus', 'done', false),
    jsonb_build_object('step', 'Implementar: contabilidade completa nas 2 PJs', 'done', false)
  ),
  1000.00, 2000.00
);

-- ════════════════════════════════════════════════════════════════════════════
-- FIM
-- ════════════════════════════════════════════════════════════════════════════
COMMENT ON TABLE public.legal_actions IS
  'Módulo jurídico V1 — ações pendentes (briefings + checklist + custo). V2 adiciona contratos, documentos e templates.';
