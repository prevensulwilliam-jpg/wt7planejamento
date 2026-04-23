-- ═══════════════════════════════════════════════════════════════════
-- Migration: expenses.nature — classificação canônica de despesas
--
-- Contexto: dashboard (useDashboardKPIs) estava somando TUDO em
-- expenses.amount como "custeio", inflando o gasto real com:
--   - Transferências entre contas próprias (ajuste de caixa)
--   - Aportes em obra (são investimento, não despesa)
--   - Pagamentos de fatura de cartão (duplica com card_transactions)
--
-- Solução definitiva: mesmo padrão já adotado em revenues.nature
-- (income | transfer | reimbursement | refund).
--
-- Em expenses: expense | transfer | investment | card_payment.
--
-- Data: 2026-04-23
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS nature text NOT NULL DEFAULT 'expense';

-- Constraint: nature só pode ser um dos 4 valores canônicos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_nature_check'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_nature_check
      CHECK (nature IN ('expense', 'transfer', 'investment', 'card_payment'));
  END IF;
END$$;

COMMENT ON COLUMN public.expenses.nature IS
  'Natureza do lançamento:
   - expense (default): despesa real, conta no custeio
   - transfer: transferência entre contas próprias, ajuste de caixa (não conta)
   - investment: aporte em obra, consórcio patrimonial, investimento (não conta no custeio, conta na Sobra Reinvestida)
   - card_payment: pagamento de fatura de cartão (não conta — as compras já estão em card_transactions)';

-- ── BACKFILL a partir das flags existentes ──────────────────────────
-- Prioridade: card_payment > investment > expense

-- 1) Pagamentos de fatura de cartão (já marcados is_card_payment=true)
UPDATE public.expenses
SET nature = 'card_payment'
WHERE is_card_payment = true
  AND nature = 'expense';

-- 2) Aportes/investimentos (já marcados counts_as_investment=true)
UPDATE public.expenses
SET nature = 'investment'
WHERE counts_as_investment = true
  AND nature = 'expense';

-- 3) Transferências entre contas — heurística por descrição
--    Pix entre contas próprias (William → William), PIX MESMA TITULARIDADE, etc.
UPDATE public.expenses
SET nature = 'transfer'
WHERE nature = 'expense'
  AND (
    description ILIKE '%MESMA TITULARIDADE%'
    OR description ILIKE '%TRANSFERENCIA ENTRE%'
    OR description ILIKE '%TRANSF PROPRIA%'
    OR description ILIKE '%WILLIAM TAVARES%'   -- pix W → W
    OR description ILIKE '%TRANSF INTERNA%'
  );

-- ── Índice pra filtros do dashboard ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_expenses_nature_ref
  ON public.expenses (reference_month, nature);

-- ── Audit ───────────────────────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT nature, COUNT(*) AS qtd, COALESCE(SUM(amount), 0) AS total
    FROM public.expenses
    GROUP BY nature
    ORDER BY total DESC
  LOOP
    RAISE NOTICE 'expenses.nature=% : % lançamentos, total R$ %',
      r.nature, r.qtd, r.total;
  END LOOP;
END $$;
