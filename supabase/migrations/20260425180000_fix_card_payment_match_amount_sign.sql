-- ══════════════════════════════════════════════════════════════════
-- Fix CRÍTICO: bank_transactions.amount é SEMPRE POSITIVO.
-- O sinal é dado por type ('debit' | 'credit').
--
-- A versão anterior da função retornava NULL pra TODA tx debit
-- porque a condição era `IF v_tx.amount >= 0`. Resultado: auto_count=0.
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION match_card_invoice_payment_for_bank_tx(p_bank_tx_id uuid)
RETURNS uuid AS $$
DECLARE
  v_tx RECORD;
  v_card_id uuid;
  v_inv_id uuid;
  v_inv_total numeric;
  v_paid_so_far numeric;
  v_amount_abs numeric;
  v_payment_id uuid;
  v_desc text;
BEGIN
  SELECT * INTO v_tx FROM bank_transactions WHERE id = p_bank_tx_id;

  -- Só processa débitos (type='debit'). amount já é positivo.
  IF v_tx IS NULL OR v_tx.type != 'debit' THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM card_invoice_payments WHERE bank_tx_id = p_bank_tx_id) THEN
    RETURN NULL;
  END IF;

  v_desc := COALESCE(v_tx.description, '');

  -- Detecta cartão pelo bracket fingerprint (robusto a mojibake)
  IF v_desc ILIKE '%[BANCO DO BRASIL]%' OR v_desc ILIKE '%[BB SALDO DIA]%' THEN
    SELECT id INTO v_card_id FROM cards WHERE bank = 'BB' LIMIT 1;
  ELSIF (v_desc ILIKE '%BANCO XP%' OR v_desc ILIKE '%XP S A%')
        AND v_desc ILIKE '%[CREDIFOZ]%' THEN
    SELECT id INTO v_card_id FROM cards WHERE bank = 'XP' LIMIT 1;
  ELSIF v_desc ILIKE '%FATURA%CART%[CREDIFOZ]%' AND v_desc NOT ILIKE '%BANCO XP%' THEN
    SELECT id INTO v_card_id FROM cards WHERE bank = 'Credifoz' LIMIT 1;
  END IF;

  IF v_card_id IS NULL THEN RETURN NULL; END IF;

  v_amount_abs := ABS(v_tx.amount);  -- ABS por segurança caso amount venha negativo

  SELECT ci.id, ci.total_amount, COALESCE(SUM(p.paid_amount), 0)
  INTO v_inv_id, v_inv_total, v_paid_so_far
  FROM card_invoices ci
  LEFT JOIN card_invoice_payments p ON p.invoice_id = ci.id
  WHERE ci.card_id = v_card_id AND ci.closed_at IS NOT NULL
  GROUP BY ci.id, ci.total_amount, ci.closed_at
  HAVING COALESCE(SUM(p.paid_amount), 0) < ci.total_amount
  ORDER BY ci.closed_at ASC LIMIT 1;

  IF v_inv_id IS NULL THEN RETURN NULL; END IF;

  IF v_amount_abs > (v_inv_total - v_paid_so_far + 0.01) THEN
    RETURN NULL;
  END IF;

  INSERT INTO card_invoice_payments (invoice_id, bank_tx_id, paid_at, paid_amount, source)
  VALUES (v_inv_id, p_bank_tx_id, v_tx.date, v_amount_abs, 'auto')
  RETURNING id INTO v_payment_id;

  UPDATE card_invoices
  SET paid_at = (SELECT MAX(paid_at) FROM card_invoice_payments WHERE invoice_id = v_inv_id),
      paid_amount = (SELECT COALESCE(SUM(paid_amount), 0) FROM card_invoice_payments WHERE invoice_id = v_inv_id)
  WHERE id = v_inv_id;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql;

-- Re-roda backfill com função fixada
DO $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN
    SELECT id FROM bank_transactions
    WHERE type = 'debit' AND COALESCE(status, '') != 'ignored'
    ORDER BY date ASC
  LOOP
    PERFORM match_card_invoice_payment_for_bank_tx(rec.id);
  END LOOP;
END $$;
