-- ═══════════════════════════════════════════════════════════════════
-- Migration: travel_plans — tabela dedicada para viagens planejadas
--
-- Contexto: auditoria 24/04/2026. William tem 2 viagens confirmadas
-- que não encaixam em wedding_vendors (viagem comercial/lazer ≠ fornecedor
-- de casamento):
--   - Canton Fair + Japão (abr/2027, 15-20d com Camila) — R$ 50k, misto
--   - Lua de mel Itália (jul/2028, pós-casamento) — R$ 50k
--
-- Decisão arquitetural: criar tabela dedicada. Escalável (mais viagens
-- aparecerão), conceitualmente correta, separada do wedding_vendors.
--
-- Data: 2026-04-24
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.travel_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  destination text NOT NULL,
  start_date date,
  end_date date,
  purpose text NOT NULL DEFAULT 'leisure',
  estimated_cost numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  counts_as_investment boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'planned',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT travel_plans_purpose_check
    CHECK (purpose IN ('leisure', 'business', 'honeymoon', 'mixed')),
  CONSTRAINT travel_plans_status_check
    CHECK (status IN ('planned', 'booked', 'in_progress', 'completed', 'cancelled'))
);

COMMENT ON TABLE public.travel_plans IS
  'Viagens planejadas — business (ex: Canton Fair), leisure, honeymoon ou mixed.
   Usado pelo plano de caixa pra projetar saídas grandes.
   counts_as_investment=true permite que parte do custo entre em Sobra Reinvestida
   (ex: parte business de viagem mista).';

COMMENT ON COLUMN public.travel_plans.purpose IS
  'leisure | business | honeymoon | mixed';
COMMENT ON COLUMN public.travel_plans.status IS
  'planned | booked | in_progress | completed | cancelled';

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_travel_plans_start_date ON public.travel_plans (start_date);
CREATE INDEX IF NOT EXISTS idx_travel_plans_status ON public.travel_plans (status);

-- RLS — só admin acessa (William)
ALTER TABLE public.travel_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin full travel_plans" ON public.travel_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── Seed: 2 viagens conhecidas ──────────────────────────────────────

-- 1) Canton Fair + Japão 2027 (negócio + lazer + pré-wedding potencial)
INSERT INTO public.travel_plans
  (name, destination, start_date, end_date, purpose, estimated_cost, status, notes, counts_as_investment)
VALUES (
  'Canton Fair + Japão 2027',
  'Guangzhou (CN) + Japão',
  '2027-04-01',
  '2027-04-20',
  'mixed',
  50000,
  'planned',
  'Canton Fair primeira semana (negócio/sourcing) + Japão com Camila. '
  || 'Possível pré-wedding shoot em algum ponto do Japão. '
  || 'ATENÇÃO DE CAIXA: abril/2027 também tem parcela Villa Sonali R$ 7.848,80 (17/04).',
  false  -- se parte for classificada como negócio comprovado, William flagga depois
);

-- 2) Lua de mel Itália (migração do wedding_vendors)
INSERT INTO public.travel_plans
  (name, destination, start_date, end_date, purpose, estimated_cost, status, notes)
VALUES (
  'Lua de mel — Itália',
  'Itália',
  '2028-07-01',
  '2028-07-15',
  'honeymoon',
  50000,
  'planned',
  'Pós-casamento (dez/2027). Orçamento R$ 50.000.'
);

-- 3) Remover a lua de mel do wedding_vendors (agora mora em travel_plans)
DELETE FROM public.wedding_vendors
WHERE service ILIKE 'Lua de mel%' AND estimated_value = 50000;

-- ── Audit ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_tp int; v_wv int; v_total_viagem numeric;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(estimated_cost), 0)
    INTO v_tp, v_total_viagem FROM public.travel_plans;
  SELECT COUNT(*) INTO v_wv FROM public.wedding_vendors;

  RAISE NOTICE 'Pós-migration: travel_plans=% registros (R$ %), wedding_vendors=% registros',
    v_tp, v_total_viagem, v_wv;
END $$;
