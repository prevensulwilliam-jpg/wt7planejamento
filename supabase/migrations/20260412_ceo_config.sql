-- Configurações editáveis do Dashboard CEO
-- Metas mensais, investimentos, projeções de crescimento, lucro histórico

CREATE TABLE IF NOT EXISTS public.ceo_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL DEFAULT '{}',
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ceo_config ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ler
CREATE POLICY "authenticated can read ceo_config"
  ON public.ceo_config FOR SELECT TO authenticated USING (true);

-- Só admin pode modificar
CREATE POLICY "admin can modify ceo_config"
  ON public.ceo_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Dados iniciais
INSERT INTO public.ceo_config (config_key, config_value) VALUES
  ('investimento', '{"RWT02": 1000000, "RWT03": 500000}'),
  ('meta_mensal', '{"RWT02": 14400, "RWT03": 6700}'),
  ('lucro_historico', '{"valor": 405120, "nota": "Estimativa 2024+2025 a 80% da meta"}'),
  ('projecao_crescimento', '[{"ano": "Hoje", "unidades": 13}, {"ano": "2026", "unidades": 28}, {"ano": "2027", "unidades": 43}, {"ano": "2028", "unidades": 58}]'),
  ('cdi_referencia', '{"taxa": 10.5}')
ON CONFLICT (config_key) DO NOTHING;
