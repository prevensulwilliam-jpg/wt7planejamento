-- Automação de reconciliação debt_installment ↔ bank_transaction.
--
-- Objetivo: quando OFX importa um cheque/débito que bate por valor + data
-- com uma parcela pendente em debt_installments, marca como pago automático
-- e atualiza debts.remaining_amount.
--
-- Regras:
-- 1. Só age em type='debit' (saídas)
-- 2. Tolerância ±R$ 5 no valor (centavos/arredondamentos)
-- 3. Tolerância ±10 dias na data (cheque pode compensar dias após emissão)
-- 4. Match único = vincula automático
-- 5. Match múltiplo OU zero = não toca, deixa pra revisão manual

-- ─── 1. FK reverso: bank_transactions → debt_installment ──────────────
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS matched_debt_installment_id uuid
    REFERENCES debt_installments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_tx_matched_debt_installment
  ON bank_transactions (matched_debt_installment_id)
  WHERE matched_debt_installment_id IS NOT NULL;

-- ─── 2. Função: recalcular debts.remaining_amount + due_date ──────────
CREATE OR REPLACE FUNCTION recompute_debt_remaining(p_debt_id uuid)
RETURNS void AS $$
DECLARE
  total_pending numeric;
  next_due date;
  has_installments boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM debt_installments WHERE debt_id = p_debt_id) INTO has_installments;
  -- Sem installments cadastrados, não mexer (deixa William gerenciar manual)
  IF NOT has_installments THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_pending
  FROM debt_installments
  WHERE debt_id = p_debt_id AND paid_at IS NULL;

  SELECT MIN(due_date) INTO next_due
  FROM debt_installments
  WHERE debt_id = p_debt_id AND paid_at IS NULL;

  UPDATE debts
  SET remaining_amount = total_pending,
      due_date = COALESCE(next_due, due_date),
      status = CASE WHEN total_pending = 0 THEN 'paid' ELSE status END
  WHERE id = p_debt_id;
END;
$$ LANGUAGE plpgsql;

-- ─── 3. Trigger: auto-match bank_tx ↔ debt_installment ─────────────────
CREATE OR REPLACE FUNCTION auto_match_debt_installment()
RETURNS TRIGGER AS $$
DECLARE
  candidate_ids uuid[];
  matched_id uuid;
  matched_debt_id uuid;
BEGIN
  -- Só processa débitos
  IF NEW.type IS DISTINCT FROM 'debit' THEN RETURN NEW; END IF;
  -- Já tem match com installment? Skip.
  IF NEW.matched_debt_installment_id IS NOT NULL THEN RETURN NEW; END IF;

  -- Procura installments pendentes que batem por valor (±R$5) + data (±10 dias)
  SELECT array_agg(id) INTO candidate_ids
  FROM (
    SELECT id FROM debt_installments
    WHERE paid_at IS NULL
      AND bank_tx_id IS NULL
      AND ABS(amount - NEW.amount) <= 5
      AND ABS(due_date - NEW.date) <= 10
    LIMIT 2
  ) AS candidates;

  -- Match único? Vincula.
  IF candidate_ids IS NOT NULL AND array_length(candidate_ids, 1) = 1 THEN
    matched_id := candidate_ids[1];
    NEW.matched_debt_installment_id := matched_id;

    UPDATE debt_installments
    SET paid_at = NEW.date,
        paid_amount = NEW.amount,
        bank_tx_id = NEW.id,
        updated_at = now()
    WHERE id = matched_id
    RETURNING debt_id INTO matched_debt_id;

    -- Recalcula debts.remaining_amount
    PERFORM recompute_debt_remaining(matched_debt_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_match_debt_installment ON bank_transactions;
CREATE TRIGGER trg_auto_match_debt_installment
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION auto_match_debt_installment();

-- ─── 4. Trigger inverso: quando installment é atualizado, recalcula debt ──
-- (ex: marca paga manual via UI/Naval → atualiza remaining_amount)
CREATE OR REPLACE FUNCTION on_debt_installment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM recompute_debt_remaining(NEW.debt_id);
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Só recalcula se algo financeiro mudou
    IF NEW.paid_at IS DISTINCT FROM OLD.paid_at
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.paid_amount IS DISTINCT FROM OLD.paid_amount THEN
      PERFORM recompute_debt_remaining(NEW.debt_id);
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM recompute_debt_remaining(OLD.debt_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_debt_installment_change ON debt_installments;
CREATE TRIGGER trg_debt_installment_change
  AFTER INSERT OR UPDATE OR DELETE ON debt_installments
  FOR EACH ROW EXECUTE FUNCTION on_debt_installment_change();

COMMENT ON FUNCTION auto_match_debt_installment() IS
  'Trigger BEFORE INSERT bank_transactions: tenta auto-vincular débito a debt_installment pendente que bate por valor (±R$5) + data (±10 dias). Match único = vincula. Múltiplo ou zero = não toca.';

COMMENT ON FUNCTION recompute_debt_remaining(uuid) IS
  'Recalcula debts.remaining_amount = SUM(installments unpaid) e due_date = MIN(installments unpaid). Marca status=paid se zerou. Só age se a debt tem installments cadastrados.';
