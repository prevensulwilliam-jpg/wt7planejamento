-- ═══════════════════════════════════════════════════════════════════
-- Migration B: expenses ganham flag counts_as_investment + vector
-- + flag is_card_payment pra evitar duplicação com card_transactions
--
-- Contexto: custeio abril/2026 estava inflado em R$ ~20k:
--   - R$ 11.121 duplicação (pagamento fatura cartão contado 2×)
--   - R$ 8.838 aportes em obra/consórcio virando custeio
--
-- Data: 2026-04-21
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS counts_as_investment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vector text,
  ADD COLUMN IF NOT EXISTS is_card_payment boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.expenses.counts_as_investment IS
  '💎 Conta como Sobra Reinvestida (meta ≥50% em metas.md). Aportes, consórcios, cursos, ferramentas.';
COMMENT ON COLUMN public.expenses.vector IS
  'Vetor de investimento quando counts_as_investment=true. Valores: aporte_obra, dev_profissional_agora, dev_pessoal_futuro, produtividade_ferramentas, consorcios_aporte, outros_invest.';
COMMENT ON COLUMN public.expenses.is_card_payment IS
  'Marcação: é pagamento de fatura de cartão? Se sim, exclui do cálculo de custeio (as compras já estão em card_transactions).';

-- ── BACKFILL ────────────────────────────────────────────────

-- 1. Pagamentos de fatura de cartão — NÃO contar no custeio (duplicação)
UPDATE public.expenses SET is_card_payment = true
WHERE category IN ('cartao_de_credito', 'cartao');

-- 2. Aportes em obra (terrenos = NRSX Empreendimentos, obras = empreiteiro)
UPDATE public.expenses SET counts_as_investment = true, vector = 'aporte_obra'
WHERE category IN ('terrenos', 'obras');

-- 3. Consórcios patrimoniais (Ademicon = imóveis)
UPDATE public.expenses SET counts_as_investment = true, vector = 'consorcios_aporte'
WHERE category = 'consorcio';

-- Nota: Randon entra aqui também se estiver na categoria 'consorcio'.
-- Se você usa 'consorcio_randon' separado, rodar manualmente:
--   UPDATE expenses SET counts_as_investment = true, vector = 'consorcios_aporte'
--   WHERE category ILIKE '%randon%';

-- ── ÍNDICES úteis pra hook useSobraReinvestida ──────────────
CREATE INDEX IF NOT EXISTS idx_expenses_ref_invest
  ON public.expenses (reference_month, counts_as_investment)
  WHERE is_card_payment = false;

-- ── Audit ───────────────────────────────────────────────────
DO $$
DECLARE
  v_card_payment_count int;
  v_invest_count int;
  v_card_payment_sum numeric;
  v_invest_sum numeric;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_card_payment_count, v_card_payment_sum
  FROM expenses WHERE is_card_payment = true;

  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_invest_count, v_invest_sum
  FROM expenses WHERE counts_as_investment = true;

  RAISE NOTICE 'Backfill: % pagamentos de cartão (R$ %) | % aportes 💎 (R$ %)',
    v_card_payment_count, v_card_payment_sum, v_invest_count, v_invest_sum;
END $$;
