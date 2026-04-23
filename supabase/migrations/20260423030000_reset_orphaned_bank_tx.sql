-- Após o purge de 37 revenues "Repasse RWT*" (migrations 20260423010000 + 020000),
-- a FK ON DELETE SET NULL zerou bank_transactions.matched_revenue_id — mas deixou
-- status='matched' preso. Isso tira essas transações da fila de conciliação
-- (que filtra por status IN ('pending','auto_categorized')).
--
-- Esta migration ressuscita os extratos órfãos:
--   - status: matched → pending
--   - kitnet_entry_id: NULL (pra poder parear com fechamento novo/correto)
--   - limpa category_confirmed/intent/label (voltam pro estado pré-match)
--
-- Critério de órfão: status='matched' AND matched_revenue_id IS NULL
-- (transação estava casada, revenue foi apagada, FK zerou o link)

BEGIN;

WITH reset AS (
  UPDATE public.bank_transactions
     SET status             = 'pending',
         kitnet_entry_id    = NULL,
         category_confirmed = NULL,
         category_intent    = NULL,
         category_label     = NULL
   WHERE status = 'matched'
     AND matched_revenue_id IS NULL
  RETURNING id, amount, description, date
)
SELECT COUNT(*) AS extratos_liberados,
       MIN(date) AS primeiro,
       MAX(date) AS ultimo,
       SUM(amount) AS soma_total
  FROM reset;

COMMIT;

-- Verificação pós-reset (descomenta pra ver as transações liberadas):
-- SELECT date, amount, description, status, matched_revenue_id, kitnet_entry_id
--   FROM public.bank_transactions
--  WHERE status = 'pending'
--    AND type = 'credit'
--    AND date >= '2026-01-01'
--  ORDER BY date DESC;
