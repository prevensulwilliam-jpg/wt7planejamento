-- Módulo de Negócios — mapeia as frentes de geração de renda como entidades estratégicas
-- Kitnets (agregado), CW7, T7, HR7, ProMax, Prevensul, etc.

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,                -- CW7, T7, HR7, PROMAX, KITNETS, PREVENSUL
  name text NOT NULL,
  description text,
  partner_name text,                        -- Claudio Sergio Maba, Diego Tavares, Henrique Rial
  ownership_pct numeric(5,2) NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'ativo',     -- ativo, incubado, encerrado
  category text NOT NULL DEFAULT 'crescimento', -- recorrente, crescimento, incubado
  monthly_target numeric(14,2) NOT NULL DEFAULT 0,
  target_12m numeric(14,2) NOT NULL DEFAULT 0,
  icon text DEFAULT '💼',
  color text DEFAULT '#C9A84C',
  notes text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_revenue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  reference_month text NOT NULL,            -- YYYY-MM
  amount_william numeric(14,2) NOT NULL,    -- o que entra pro William (pós split)
  amount_total numeric(14,2),               -- receita total do negócio (antes do split)
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (business_id, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_bre_business_month
  ON public.business_revenue_entries (business_id, reference_month DESC);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_revenue_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages businesses"
  ON public.businesses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin manages business_revenue_entries"
  ON public.business_revenue_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Seed inicial baseado no mapa atual do William
INSERT INTO public.businesses (code, name, partner_name, ownership_pct, status, category, monthly_target, target_12m, icon, color, order_index, notes) VALUES
  ('KITNETS',   'Kitnets (RWT02 + RWT03)',     NULL,                      100, 'ativo',    'recorrente',  20000,  20000, '🏠', '#10B981', 1, '13 unidades. Renda passiva consolidada.'),
  ('PREVENSUL', 'Prevensul (salário + comissões)', NULL,                  100, 'ativo',    'recorrente',  15000,  15000, '🔥', '#F43F5E', 2, 'Dependência estratégica. Objetivo: reduzir com o tempo.'),
  ('CW7',       'CW7 Energia Solar',           'Claudio Sergio Maba',      50, 'ativo',    'crescimento', 10000,  10000, '⚡', '#EAB308', 3, 'Sócio: Claudio. Foco atual = estabilização em R$10k/mês.'),
  ('T7',        'T7 Sales & Service',          'Diego Tavares',            50, 'ativo',    'crescimento',   5000,  50000, '💼', '#3B82F6', 4, 'Sócio: Diego. Investimento 100% William. Meta 2º sem: R$5k/mês cada, 12m: R$50k/mês cada.'),
  ('HR7',       'HR7 Consultoria Fitness',     'Henrique Rial',            50, 'incubado', 'incubado',        0,      0, '💪', '#A78BFA', 5, 'No papel. Sócio: Henrique (personal trainer).'),
  ('PROMAX',    'ProMax Ferramentas (ML)',     NULL,                      100, 'incubado', 'incubado',        0,      0, '🛒', '#F59E0B', 6, 'No papel. E-commerce Mercado Livre.')
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.businesses IS 'Negócios/frentes de renda do William — usado pelo cockpit estratégico.';
COMMENT ON TABLE public.business_revenue_entries IS 'Receita mensal realizada por negócio (parte do William). Usado para tracking vs monthly_target.';
