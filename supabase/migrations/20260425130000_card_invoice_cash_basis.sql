-- ══════════════════════════════════════════════════════════════════
-- card_invoices — preparação pro regime CAIXA + conciliação
--
-- 1) bank_tx_id  → liga fatura ao débito do extrato (1 invoice = 1 pagamento)
-- 2) closed_at   → marca quando a fatura fechou (status `closed`)
-- 3) index paid_at → useSobraReinvestida vai filtrar por paid_at no mês
--
-- Status da fatura passa a ser DERIVADO dos campos:
--   in_progress: paid_at IS NULL AND closed_at IS NULL
--   closed:      paid_at IS NULL AND closed_at IS NOT NULL
--   paid:        paid_at IS NOT NULL
-- ══════════════════════════════════════════════════════════════════

-- 1) Colunas novas
ALTER TABLE card_invoices
  ADD COLUMN IF NOT EXISTS bank_tx_id uuid REFERENCES bank_transactions(id) ON DELETE SET NULL;

ALTER TABLE card_invoices
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- 2) Index pra performance do hook (filtra por paid_at no mês)
CREATE INDEX IF NOT EXISTS card_inv_paid_at_idx
  ON card_invoices (paid_at)
  WHERE paid_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS card_inv_closed_pending_idx
  ON card_invoices (closed_at)
  WHERE closed_at IS NOT NULL AND paid_at IS NULL;

-- 3) Backfill: faturas que já têm paid_at preenchido marcam closed_at = paid_at
--    (assumimos que se foi paga, foi fechada antes — se não tem closing_date)
UPDATE card_invoices
SET closed_at = COALESCE(closing_date::timestamptz, paid_at::timestamptz)
WHERE paid_at IS NOT NULL AND closed_at IS NULL;
