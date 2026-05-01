-- Auto-match: when a debit bank_transaction matches a construction expense (cash mode),
-- link them automatically (±R$5, ±10 days), unambiguous only.

ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS matched_construction_expense_id uuid
    REFERENCES public.construction_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_tx_matched_constr_exp
  ON public.bank_transactions(matched_construction_expense_id)
  WHERE matched_construction_expense_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.auto_match_construction_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate_ids uuid[];
  matched_id uuid;
BEGIN
  IF NEW.type IS DISTINCT FROM 'debit' THEN RETURN NEW; END IF;
  IF NEW.matched_construction_expense_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.matched_expense_id IS NOT NULL OR NEW.matched_debt_installment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(id) INTO candidate_ids
  FROM (
    SELECT ce.id
    FROM construction_expenses ce
    WHERE ce.bank_tx_id IS NULL
      AND ABS(ce.amount - NEW.amount) <= 5
      AND ABS(ce.paid_at - NEW.date) <= 10
    LIMIT 2
  ) c;

  IF candidate_ids IS NOT NULL AND array_length(candidate_ids, 1) = 1 THEN
    matched_id := candidate_ids[1];
    NEW.matched_construction_expense_id := matched_id;

    UPDATE construction_expenses
    SET bank_tx_id = NEW.id,
        updated_at = now()
    WHERE id = matched_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_match_construction_expense ON public.bank_transactions;
CREATE TRIGGER trg_auto_match_construction_expense
  BEFORE INSERT ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_match_construction_expense();