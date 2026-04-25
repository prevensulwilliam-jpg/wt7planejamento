-- ═══════════════════════════════════════════════════════════════════
-- Migration: trigger pra normalizar flags em expenses
--
-- Contexto: descobri hoje (24/04) que a caçamba TS4 R$ 450 estava com
-- vector NULL, counts_as_investment=false, mas description marcava RWT05
-- aporte. Inconsistência que fez a query de aporte_obra pular a caçamba.
--
-- Causa: import OFX/Pluggy não setava esses flags juntos. Quando o usuário
-- atualizava description ou category manualmente, os flags ficavam órfãos.
--
-- Solução: trigger BEFORE INSERT/UPDATE que sincroniza:
--   - nature = 'investment'   → counts_as_investment = true,  is_card_payment = false
--   - nature = 'card_payment' → counts_as_investment = false, is_card_payment = true
--   - nature = 'transfer'     → counts_as_investment = false, is_card_payment = false
--   - nature = 'expense'      → counts_as_investment = false (a menos de override)
--   - se vector = 'aporte_obra' → forçar nature = 'investment'
--
-- Data: 2026-04-24
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.normalize_expense_flags()
RETURNS TRIGGER AS $$
BEGIN
  -- Se vector = 'aporte_obra', então é investimento (sobreescreve nature)
  IF NEW.vector = 'aporte_obra' THEN
    NEW.nature := 'investment';
    NEW.counts_as_investment := true;
    NEW.is_card_payment := false;
    RETURN NEW;
  END IF;

  -- Se counts_as_investment = true sem vector, mantém mas alinha nature
  IF NEW.counts_as_investment = true AND (NEW.nature IS NULL OR NEW.nature = 'expense') THEN
    NEW.nature := 'investment';
    NEW.is_card_payment := false;
    RETURN NEW;
  END IF;

  -- Sincronia por nature (fonte canônica)
  IF NEW.nature = 'investment' THEN
    NEW.counts_as_investment := true;
    NEW.is_card_payment := false;
  ELSIF NEW.nature = 'card_payment' THEN
    NEW.counts_as_investment := false;
    NEW.is_card_payment := true;
  ELSIF NEW.nature = 'transfer' THEN
    NEW.counts_as_investment := false;
    NEW.is_card_payment := false;
  ELSIF NEW.nature = 'expense' THEN
    -- Para 'expense' default, mantém o que veio mas garante is_card_payment respeita seu próprio campo
    -- (não força counts_as_investment a false, caso usuário queira marcar manualmente)
    NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_expense_flags ON public.expenses;

CREATE TRIGGER trg_normalize_expense_flags
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_expense_flags();

COMMENT ON FUNCTION public.normalize_expense_flags() IS
  'Garante coerência entre nature, counts_as_investment, is_card_payment e vector em expenses.
   Auditoria 24/04/2026 identificou registros com vector aporte_obra mas counts_as_investment=false.';

-- ── Backfill: corrigir registros existentes inconsistentes ──────────
-- 1) Quem tem vector = aporte_obra mas nature/counts_as_investment errados
UPDATE public.expenses
SET nature = 'investment',
    counts_as_investment = true,
    is_card_payment = false
WHERE vector = 'aporte_obra'
  AND (nature != 'investment' OR counts_as_investment IS NOT TRUE);

-- 2) Quem tem counts_as_investment = true mas nature = 'expense'
UPDATE public.expenses
SET nature = 'investment'
WHERE counts_as_investment = true
  AND nature = 'expense';

-- 3) Quem tem is_card_payment = true mas nature != 'card_payment'
UPDATE public.expenses
SET nature = 'card_payment'
WHERE is_card_payment = true
  AND nature != 'card_payment';

-- ── Audit ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_invest int; v_card int; v_transfer int; v_expense int;
BEGIN
  SELECT COUNT(*) INTO v_invest FROM public.expenses WHERE nature = 'investment';
  SELECT COUNT(*) INTO v_card FROM public.expenses WHERE nature = 'card_payment';
  SELECT COUNT(*) INTO v_transfer FROM public.expenses WHERE nature = 'transfer';
  SELECT COUNT(*) INTO v_expense FROM public.expenses WHERE nature = 'expense';
  RAISE NOTICE 'Pós-trigger: investment=% | card_payment=% | transfer=% | expense=%',
    v_invest, v_card, v_transfer, v_expense;
END $$;
