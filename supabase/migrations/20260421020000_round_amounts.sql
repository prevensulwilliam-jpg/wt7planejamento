-- Fix float precision legado: valores como 162.59000000000015 quebram WHERE amount = 162.59.
-- Causa: parse JS de CSV/OCR sem toFixed(2). Resolvido agora arredondando tudo pra 2 casas.
-- Idempotente: rodar de novo não quebra nada.

UPDATE public.revenues            SET amount = ROUND(amount::numeric, 2) WHERE amount IS NOT NULL;
UPDATE public.expenses            SET amount = ROUND(amount::numeric, 2) WHERE amount IS NOT NULL;
UPDATE public.bank_transactions   SET amount = ROUND(amount::numeric, 2) WHERE amount IS NOT NULL;
UPDATE public.card_transactions   SET amount = ROUND(amount::numeric, 2) WHERE amount IS NOT NULL;

-- Opcional: verificar se sobrou algum fantasma
-- SELECT 'revenues' tbl, count(*) FROM revenues WHERE amount::text ~ '\.\d{3,}'
-- UNION ALL SELECT 'expenses', count(*) FROM expenses WHERE amount::text ~ '\.\d{3,}'
-- UNION ALL SELECT 'bank_transactions', count(*) FROM bank_transactions WHERE amount::text ~ '\.\d{3,}'
-- UNION ALL SELECT 'card_transactions', count(*) FROM card_transactions WHERE amount::text ~ '\.\d{3,}';
