-- Auto-match bank_transaction (crédito) → other_commission_installment pendente
-- quando bater por valor + data. Mesma estratégia dos cheques RWT05 (debt).
--
-- Caso real: Pix do Cláudio Sergio R$ 1.050 todo dia ~5 do mês →
-- trigger marca paid_at automaticamente na parcela correspondente.

-- 1. Adiciona FK reversa em bank_transactions (se não existir)
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS matched_other_commission_installment_id uuid
    REFERENCES other_commission_installments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bt_other_commission_inst
  ON bank_transactions (matched_other_commission_installment_id)
  WHERE matched_other_commission_installment_id IS NOT NULL;

-- 2. Função de matching
CREATE OR REPLACE FUNCTION auto_match_other_commission_installment()
RETURNS TRIGGER AS $$
DECLARE
  candidate_ids uuid[];
  matched_id uuid;
BEGIN
  -- Só age em CRÉDITO (entrada de receita)
  IF NEW.type IS DISTINCT FROM 'credit' THEN RETURN NEW; END IF;
  IF NEW.matched_other_commission_installment_id IS NOT NULL THEN RETURN NEW; END IF;

  -- Procura installment pendente que bate por valor (±R$5) + data (±10 dias)
  -- E que ainda não tem bank_tx vinculado
  SELECT array_agg(id) INTO candidate_ids
  FROM (
    SELECT oci.id FROM other_commission_installments oci
    WHERE oci.paid_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM bank_transactions bt
        WHERE bt.matched_other_commission_installment_id = oci.id
      )
      AND ABS(oci.amount - NEW.amount) <= 5
      AND ABS(oci.due_date - NEW.date) <= 10
    LIMIT 2
  ) AS candidates;

  -- Match único? Vincula + marca paga
  IF candidate_ids IS NOT NULL AND array_length(candidate_ids, 1) = 1 THEN
    matched_id := candidate_ids[1];
    NEW.matched_other_commission_installment_id := matched_id;

    -- Marca installment como paga (paid_at = data do bank_tx, paid_amount = valor)
    UPDATE other_commission_installments
    SET
      paid_at = NEW.date,
      paid_amount = NEW.amount,
      updated_at = NOW()
    WHERE id = matched_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_match_other_commission_installment ON bank_transactions;
CREATE TRIGGER trg_auto_match_other_commission_installment
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION auto_match_other_commission_installment();

-- 3. Adiciona updated_at em other_commission_installments se não tiver
ALTER TABLE other_commission_installments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON FUNCTION auto_match_other_commission_installment() IS
  'BEFORE INSERT bank_transactions: vincula crédito a parcela pendente em other_commission_installments por valor (±R$5) + data (±10 dias). Marca paid_at + paid_amount automaticamente. Caso de uso: Pix recorrente Cláudio R$ 1.050.';
