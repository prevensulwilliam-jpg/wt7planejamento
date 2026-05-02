-- ═══════════════════════════════════════════════════════════════════
-- Sprint 1.3: goals expandida (multi-período + métrica)
-- ═══════════════════════════════════════════════════════════════════
-- Hoje goals tem (id, name, type, target_value, current_value, deadline, notes).
-- Expandimos pra suportar metas de qualquer período: mensal, semestral,
-- anual, 3y, 5y, 10y, custom. E qualquer métrica: receita, patrimônio,
-- sobra, renda passiva, etc.
--
-- current_value passa a ser CALCULADO automaticamente pelo Naval/hooks
-- com base em (metric, period_start, period_end). Nada de update manual.

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS period_type text
    CHECK (period_type IN ('monthly','quarterly','semestral','yearly','3y','5y','10y','custom')),
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS metric text
    CHECK (metric IN ('revenue','patrimony','savings','profit','renda_passiva','custom')),
  ADD COLUMN IF NOT EXISTS auto_calculated boolean NOT NULL DEFAULT true;

-- Índices pra queries rápidas
CREATE INDEX IF NOT EXISTS idx_goals_period
  ON goals (period_start, period_end) WHERE period_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_metric
  ON goals (metric) WHERE metric IS NOT NULL;

-- Goal exemplo: receita anual 2026 R$ 720k
-- (William cadastra via UI /goals depois)
INSERT INTO goals (name, type, target_value, deadline, period_type, period_start, period_end, metric, notes)
VALUES (
  'Receita Anual 2026',
  'monthly_revenue',  -- legado, manter pra compat
  720000,
  '2026-12-31',
  'yearly',
  '2026-01-01',
  '2026-12-31',
  'revenue',
  'Meta agressiva: R$ 720k em 12 meses. Cobre Prevensul + comissões + aluguéis. Cockpit /hoje usa esta meta no anel dourado.'
)
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN goals.period_type IS
  'Tipo de período: monthly/quarterly/semestral/yearly/3y/5y/10y/custom. Define escala da meta.';
COMMENT ON COLUMN goals.metric IS
  'Métrica a comparar: revenue (receita) / patrimony (patrimônio líquido) / savings (sobra) / profit (lucro) / renda_passiva / custom.';
COMMENT ON COLUMN goals.auto_calculated IS
  'Se true, current_value é calculado por hook/tool em runtime. Se false, valor manual.';
