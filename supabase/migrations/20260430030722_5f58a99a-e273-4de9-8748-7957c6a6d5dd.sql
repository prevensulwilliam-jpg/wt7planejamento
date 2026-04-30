ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS matched_construction_expense_id uuid
    REFERENCES construction_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_tx_matched_construction_expense
  ON bank_transactions (matched_construction_expense_id)
  WHERE matched_construction_expense_id IS NOT NULL;

COMMENT ON COLUMN bank_transactions.matched_construction_expense_id IS
  'FK pra construction_expenses quando o débito é pagamento de obra (mão de obra, materiais, terreno, etc). Use INSTEAD OF criar duplicata em expenses.';