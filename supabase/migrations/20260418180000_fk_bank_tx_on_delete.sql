-- Permite deletar revenues conciliadas sem precisar soltar o vínculo manualmente.
-- bank_transactions.matched_revenue_id passa a virar NULL automaticamente quando a revenue é deletada.

ALTER TABLE public.bank_transactions
  DROP CONSTRAINT IF EXISTS bank_transactions_matched_revenue_id_fkey;

ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_matched_revenue_id_fkey
  FOREIGN KEY (matched_revenue_id)
  REFERENCES public.revenues(id)
  ON DELETE SET NULL;
