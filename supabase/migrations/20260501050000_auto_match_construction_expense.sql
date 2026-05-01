-- Auto-vincula bank_transaction a construction_expense quando débito
-- bate por valor + data. Evita duplicação tipo a do cheque RWT05 R$ 10k
-- de 27/04/2026, que virou expense ("Aporte Obra Wt7 Holding") apesar de
-- já existir construction_expense da mesma data e valor.
--
-- Regras:
-- 1. Só age em type='debit' (saídas)
-- 2. Tolerância ±R$ 5 no valor + ±10 dias na data
-- 3. Match único na PRIMEIRA construction_expense pendente que ainda não
--    está vinculada a outro bank_tx
-- 4. Match múltiplo / zero = não toca

CREATE OR REPLACE FUNCTION auto_match_construction_expense()
RETURNS TRIGGER AS $$
DECLARE
  candidate_ids uuid[];
BEGIN
  IF NEW.type IS DISTINCT FROM 'debit' THEN RETURN NEW; END IF;
  IF NEW.matched_construction_expense_id IS NOT NULL THEN RETURN NEW; END IF;

  -- Procura construction_expense que ainda não tem bank_tx vinculado,
  -- bate por valor (±R$5) + data (±10 dias).
  SELECT array_agg(id) INTO candidate_ids
  FROM (
    SELECT ce.id FROM construction_expenses ce
    WHERE NOT EXISTS (
      SELECT 1 FROM bank_transactions bt
      WHERE bt.matched_construction_expense_id = ce.id
    )
      AND ABS(ce.total_amount - NEW.amount) <= 5
      AND ABS(ce.expense_date - NEW.date) <= 10
    LIMIT 2
  ) AS candidates;

  -- Match único? Vincula.
  IF candidate_ids IS NOT NULL AND array_length(candidate_ids, 1) = 1 THEN
    NEW.matched_construction_expense_id := candidate_ids[1];
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_match_construction_expense ON bank_transactions;
CREATE TRIGGER trg_auto_match_construction_expense
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION auto_match_construction_expense();

COMMENT ON FUNCTION auto_match_construction_expense() IS
  'Trigger BEFORE INSERT bank_transactions: tenta auto-vincular débito a construction_expense pendente que bate por valor (±R$5) + data (±10 dias). Match único = vincula. Múltiplo ou zero = não toca. Roda ANTES do trg_auto_match_debt_installment.';
