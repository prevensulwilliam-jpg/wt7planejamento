-- Tabela de configuração de tarifa de energia por complexo
CREATE TABLE IF NOT EXISTS energy_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residencial_code text NOT NULL UNIQUE,
  tariff_kwh numeric(10,4) NOT NULL DEFAULT 1.0600,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- Valores padrão
INSERT INTO energy_config (residencial_code, tariff_kwh)
  VALUES ('RWT02', 1.0600), ('RWT03', 1.0600)
  ON CONFLICT (residencial_code) DO NOTHING;

-- RLS
ALTER TABLE energy_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read energy_config"
  ON energy_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin can modify energy_config"
  ON energy_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
