-- ═══════════════════════════════════════════════════════════════════
-- Sprint 1.2: pipeline_stage em prevensul_billing
-- ═══════════════════════════════════════════════════════════════════
-- Decisão: híbrido. Coluna nullable; se preenchida usa, senão deriva
-- de closing_date (< 30d=fechando / 30-90d=proposta / > 90d=quente).
-- William marca os 5-6 importantes manualmente, resto deriva.

ALTER TABLE prevensul_billing
  ADD COLUMN IF NOT EXISTS pipeline_stage text
    CHECK (pipeline_stage IN ('quente','proposta','fechando','perdido','ganho'));

CREATE INDEX IF NOT EXISTS idx_pb_stage
  ON prevensul_billing (pipeline_stage)
  WHERE pipeline_stage IS NOT NULL;

COMMENT ON COLUMN prevensul_billing.pipeline_stage IS
  'Estágio CRM. Opcional. Se null, derivar de closing_date no frontend/Naval. quente=prospecção / proposta=enviada / fechando=últimos passos / ganho=virou contrato / perdido=cliente foi embora.';
