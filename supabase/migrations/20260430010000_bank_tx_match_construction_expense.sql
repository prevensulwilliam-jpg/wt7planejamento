-- Adiciona reconciliação direta entre bank_transactions e construction_expenses.
--
-- Problema: hoje bank_transactions só tem matched_expense_id /
-- matched_revenue_id / kitnet_entry_id. Quando o débito do banco era pagamento
-- de obra (que vive em construction_expenses, não em expenses), a importação
-- OFX criava uma duplicata em expenses só pra ter onde apontar matched_expense_id
-- — inflando custeio e Sobra Reinvestida.
--
-- Solução: nova FK matched_construction_expense_id. ON DELETE SET NULL pra
-- bank_tx não ficar órfão se o gasto de obra for removido. Index pra performance
-- de query "bank_tx pendentes" e "construction_expense reconciliado?".

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS matched_construction_expense_id uuid
    REFERENCES construction_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_tx_matched_construction_expense
  ON bank_transactions (matched_construction_expense_id)
  WHERE matched_construction_expense_id IS NOT NULL;

COMMENT ON COLUMN bank_transactions.matched_construction_expense_id IS
  'FK pra construction_expenses quando o débito é pagamento de obra (mão de obra, materiais, terreno, etc). Use INSTEAD OF criar duplicata em expenses.';
