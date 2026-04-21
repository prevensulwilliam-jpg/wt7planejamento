-- Separa "receita real" de "entrada neutra" (transferência, reembolso, estorno).
-- Motivação: dinheiro que entra na conta nem sempre é receita (ex: WCJ/Camila
-- reembolsam cartão, DEV PIX é estorno de serviço cancelado, Pix entre contas próprias).
-- Sem isso, a Sobra Reinvestida infla a receita e distorce o denominador.

ALTER TABLE public.revenues
  ADD COLUMN IF NOT EXISTS counts_as_income boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nature text NOT NULL DEFAULT 'income';

-- Constraint: nature só pode ser um dos 4 valores canônicos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'revenues_nature_check'
  ) THEN
    ALTER TABLE public.revenues
      ADD CONSTRAINT revenues_nature_check
      CHECK (nature IN ('income', 'transfer', 'reimbursement', 'refund'));
  END IF;
END$$;

-- Backfill — padrões conhecidos do William
-- Pix entre contas próprias (William → William, valores baixos)
UPDATE public.revenues
SET counts_as_income = false, nature = 'transfer'
WHERE description ILIKE '%WILLIAM TAV%'
  AND amount < 100;

-- Reembolsos de cartão (WCJ Promoção, Camila Fuenfst, padrões similares)
UPDATE public.revenues
SET counts_as_income = false, nature = 'reimbursement'
WHERE description ILIKE '%WCJ PROMOCAO%'
   OR description ILIKE '%CAMILA FUEN%';

-- Estornos de serviço (DEV PIX COBRANCA)
UPDATE public.revenues
SET counts_as_income = false, nature = 'refund'
WHERE description ILIKE '%DEV PIX%';

-- Index pra filtros do dashboard
CREATE INDEX IF NOT EXISTS idx_revenues_income_month
  ON public.revenues (reference_month, counts_as_income);
