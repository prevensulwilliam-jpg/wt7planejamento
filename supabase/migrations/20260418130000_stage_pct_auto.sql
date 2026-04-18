-- Flag que controla se pct_complete é calculado automaticamente (gasto/orçamento)
-- ou usa valor manual salvo em pct_complete.
-- Padrão: auto=true (calcula do gasto vs orçado)

ALTER TABLE public.construction_stages
  ADD COLUMN IF NOT EXISTS pct_complete_auto boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.construction_stages.pct_complete_auto IS
  'true = percentual calculado automaticamente (spent/budget_estimated × 100). false = override manual usando pct_complete.';
