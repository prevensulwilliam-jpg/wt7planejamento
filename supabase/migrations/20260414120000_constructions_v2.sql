-- ============================================================
-- Constructions V2 — vincula obras ao patrimônio (assets)
-- ============================================================

-- 1. Tabela principal: constructions
CREATE TABLE IF NOT EXISTS public.constructions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id                uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  name                    text NOT NULL,
  status                  text NOT NULL DEFAULT 'planejada',
  start_date              date,
  end_date                date,                    -- conclusão real
  estimated_completion    date,                    -- previsão
  total_units_planned     int DEFAULT 0,
  total_units_built       int DEFAULT 0,
  total_units_rented      int DEFAULT 0,
  estimated_rent_per_unit numeric(12,2) DEFAULT 0, -- projeção aluguel/unidade
  estimated_value_ready   numeric(12,2),           -- projeção valor bem pronto
  ownership_pct           numeric(5,2) DEFAULT 100,
  partner_name            text,
  partner_pct             numeric(5,2),
  notes                   text,
  created_at              timestamptz DEFAULT now()
);

-- 2. Migrar dados de real_estate_properties → constructions (preserva IDs)
INSERT INTO public.constructions (
  id, name, status, estimated_completion,
  total_units_planned, total_units_built, total_units_rented,
  estimated_rent_per_unit, ownership_pct, partner_name, partner_pct,
  created_at
)
SELECT
  rp.id,
  CASE
    WHEN rp.code IS NOT NULL AND rp.name IS NOT NULL THEN rp.code || ' — ' || rp.name
    WHEN rp.code IS NOT NULL THEN rp.code
    ELSE COALESCE(rp.name, 'Sem nome')
  END,
  COALESCE(rp.status, 'planejada'),
  rp.estimated_completion,
  COALESCE(rp.total_units_planned, 0),
  COALESCE(rp.total_units_built, 0),
  COALESCE(rp.total_units_rented, 0),
  COALESCE(rp.estimated_rent_per_unit, 0),
  COALESCE(rp.ownership_pct, 100),
  rp.partner_name,
  rp.partner_pct,
  now()
FROM public.real_estate_properties rp
ON CONFLICT (id) DO NOTHING;

-- 3. Adiciona construction_id em construction_expenses (mantém property_id)
ALTER TABLE public.construction_expenses
  ADD COLUMN IF NOT EXISTS construction_id uuid REFERENCES public.constructions(id) ON DELETE CASCADE;

-- Popula construction_id com os mesmos UUIDs migrados
UPDATE public.construction_expenses
SET construction_id = property_id
WHERE construction_id IS NULL AND property_id IS NOT NULL;

-- 4. Tabela de etapas da obra
CREATE TABLE IF NOT EXISTS public.construction_stages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  construction_id uuid NOT NULL REFERENCES public.constructions(id) ON DELETE CASCADE,
  name            text NOT NULL,
  status          text NOT NULL DEFAULT 'pendente', -- pendente | em_andamento | concluida
  pct_complete    numeric(5,2) DEFAULT 0,
  start_date      date,
  end_date        date,
  order_index     int DEFAULT 0,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- 5. RLS — constructions
ALTER TABLE public.constructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read constructions"
  ON public.constructions FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin all constructions"
  ON public.constructions FOR ALL TO authenticated
  USING  (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 6. RLS — construction_stages
ALTER TABLE public.construction_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read construction_stages"
  ON public.construction_stages FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin all construction_stages"
  ON public.construction_stages FOR ALL TO authenticated
  USING  (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
