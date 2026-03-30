
-- 1. Unlink bank_transactions referencing duplicate revenues before cleanup
UPDATE bank_transactions
SET matched_revenue_id = NULL
WHERE matched_revenue_id IS NOT NULL
  AND matched_revenue_id NOT IN (
    SELECT DISTINCT ON (description, reference_month, amount, source) id
    FROM revenues
    ORDER BY description, reference_month, amount, source, created_at ASC
  );

-- 2. Unlink bank_transactions referencing duplicate expenses before cleanup
UPDATE bank_transactions
SET matched_expense_id = NULL
WHERE matched_expense_id IS NOT NULL
  AND matched_expense_id NOT IN (
    SELECT DISTINCT ON (description, reference_month, amount, category) id
    FROM expenses
    ORDER BY description, reference_month, amount, category, created_at ASC
  );

-- 3. Limpar duplicatas
SELECT clean_duplicate_revenues();
SELECT clean_duplicate_expenses();

-- 4. Corrigir Camila como transferência
UPDATE bank_transactions
SET status = 'ignored',
    category_intent = 'transferencia',
    category_suggestion = 'transferencia',
    category_confirmed = 'transferencia',
    category_label = 'Transferência entre Contas'
WHERE description ILIKE '%fuenfstueck%'
  AND status != 'ignored';

-- 5. Apagar despesas de Saúde geradas pela Camila
DELETE FROM expenses
WHERE description ILIKE '%fuenfstueck%'
  AND category = 'saude';
