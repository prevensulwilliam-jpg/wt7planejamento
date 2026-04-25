-- ══════════════════════════════════════════════════════════════════
-- Conciliação automática de pagamentos de cartão (igual kitnets)
--
-- Modelo: 1 invoice → N payments (suporta pagamento parcial/parcelado)
--
-- Fluxo:
--   bank_transactions (extrato OFX/Pluggy) → trigger detecta padrão de
--   pagamento de cartão (BB / XP / Credifoz) → busca invoice fechada com
--   saldo restante → cria payment automático → atualiza paid_at/paid_amount
--   na invoice (cache pra hooks atuais).
--
-- Backfill: processa tx legadas + cria payments manuais pra invoices que
-- já tinham paid_at preenchido antes da tabela existir.
-- ══════════════════════════════════════════════════════════════════

-- 1) ─── Tabela ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES card_invoices(id) ON DELETE CASCADE,
  bank_tx_id uuid REFERENCES bank_transactions(id) ON DELETE SET NULL,
  paid_at date NOT NULL,
  paid_amount numeric(12,2) NOT NULL CHECK (paid_amount > 0),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('auto','manual')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 1 bank_tx só pode ligar 1 payment (evita dupla contagem)
CREATE UNIQUE INDEX IF NOT EXISTS card_inv_payments_bank_tx_unique
  ON card_invoice_payments (bank_tx_id)
  WHERE bank_tx_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS card_inv_payments_invoice_idx
  ON card_invoice_payments (invoice_id);

CREATE INDEX IF NOT EXISTS card_inv_payments_paid_at_idx
  ON card_invoice_payments (paid_at);

-- 2) ─── RLS ───────────────────────────────────────────────────────
ALTER TABLE card_invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all card_invoice_payments" ON card_invoice_payments;
CREATE POLICY "admin all card_invoice_payments" ON card_invoice_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) ─── Função reusável: match bank_tx → card_invoice ────────────
-- Pode ser chamada pelo trigger (NEW.id) ou pelo backfill (id legado)
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
  v_desc_upper text;
BEGIN
  SELECT * INTO v_tx FROM bank_transactions WHERE id = p_bank_tx_id;

  IF v_tx IS NULL OR v_tx.amount >= 0 OR v_tx.type != 'debit' THEN
    RETURN NULL;
  END IF;

  -- Já vinculado a algum payment?
  IF EXISTS (SELECT 1 FROM card_invoice_payments WHERE bank_tx_id = p_bank_tx_id) THEN
    RETURN NULL;
  END IF;

  v_desc_upper := UPPER(COALESCE(v_tx.description, ''));

  -- Detecta o cartão pelo padrão da descrição (extrato BB, XP, Credifoz)
  IF v_desc_upper ~ 'PAGTO\s*CART(ÃO|AO)\s*CR(É|E)DITO|PG.*CART(ÃO|AO).*BB|BB\s*SALDO\s*DIA' THEN
    SELECT id INTO v_card_id FROM cards WHERE bank = 'BB' LIMIT 1;
  ELSIF v_desc_upper ~ 'BANCO\s*XP|XP\s*S\s*A.*CREDIFOZ' THEN
    SELECT id INTO v_card_id FROM cards WHERE bank = 'XP' LIMIT 1;
  ELSIF v_desc_upper ~ 'PGT.*FATURA.*CART.*CREDIFOZ|FATURA.*CART(ÃO|AO).*CREDIFOZ' THEN
    SELECT id INTO v_card_id FROM cards WHERE bank = 'Credifoz' LIMIT 1;
  END IF;

  IF v_card_id IS NULL THEN RETURN NULL; END IF;

  v_amount_abs := ABS(v_tx.amount);

  -- Busca a invoice candidata: closed_at NOT NULL, com saldo restante.
  -- FIFO: prioriza a invoice mais antiga (closed_at ASC).
  SELECT ci.id, ci.total_amount, COALESCE(SUM(p.paid_amount), 0)
  INTO v_inv_id, v_inv_total, v_paid_so_far
  FROM card_invoices ci
  LEFT JOIN card_invoice_payments p ON p.invoice_id = ci.id
  WHERE ci.card_id = v_card_id
    AND ci.closed_at IS NOT NULL
  GROUP BY ci.id, ci.total_amount, ci.closed_at
  HAVING COALESCE(SUM(p.paid_amount), 0) < ci.total_amount
  ORDER BY ci.closed_at ASC
  LIMIT 1;

  IF v_inv_id IS NULL THEN RETURN NULL; END IF;

  -- Tolerância de R$ 0,01 (centavo de arredondamento)
  IF v_amount_abs > (v_inv_total - v_paid_so_far + 0.01) THEN
    -- Pagamento maior que saldo restante — não atribui (suspeita de match errado)
    RETURN NULL;
  END IF;

  -- Cria o payment automático
  INSERT INTO card_invoice_payments (invoice_id, bank_tx_id, paid_at, paid_amount, source)
  VALUES (v_inv_id, p_bank_tx_id, v_tx.date, v_amount_abs, 'auto')
  RETURNING id INTO v_payment_id;

  -- Atualiza cache na invoice (paid_at = último pagamento, paid_amount = soma)
  UPDATE card_invoices
  SET paid_at = (
        SELECT MAX(paid_at) FROM card_invoice_payments WHERE invoice_id = v_inv_id
      ),
      paid_amount = (
        SELECT COALESCE(SUM(paid_amount), 0) FROM card_invoice_payments WHERE invoice_id = v_inv_id
      )
  WHERE id = v_inv_id;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql;

-- 4) ─── Trigger AFTER INSERT em bank_transactions ────────────────
CREATE OR REPLACE FUNCTION trg_auto_match_card_invoice_payment()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM match_card_invoice_payment_for_bank_tx(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_match_card_payment ON bank_transactions;
CREATE TRIGGER auto_match_card_payment
  AFTER INSERT ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION trg_auto_match_card_invoice_payment();

-- 5) ─── Backfill 1: processa tx legadas via função ─────────────────
-- Pra cada bank_tx existente, tenta vincular a uma invoice fechada.
-- Ordena por data ASC (FIFO — match cronológico).
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id FROM bank_transactions
    WHERE type = 'debit' AND amount < 0
      AND COALESCE(status, '') != 'ignored'
    ORDER BY date ASC
  LOOP
    PERFORM match_card_invoice_payment_for_bank_tx(rec.id);
  END LOOP;
END $$;

-- 6) ─── Backfill 2: invoices com paid_at preenchido mas SEM payment ──
-- Cria 1 payment manual fictício (sem bank_tx_id) pra preservar o histórico
-- de pagamentos já marcados antes desta migration existir.
INSERT INTO card_invoice_payments (invoice_id, bank_tx_id, paid_at, paid_amount, source, notes)
SELECT
  ci.id,
  ci.bank_tx_id,
  ci.paid_at,
  COALESCE(ci.paid_amount, ci.total_amount),
  'manual',
  'backfill: paid_at preenchido manualmente antes da tabela payments existir'
FROM card_invoices ci
WHERE ci.paid_at IS NOT NULL
  AND COALESCE(ci.paid_amount, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM card_invoice_payments p WHERE p.invoice_id = ci.id);
