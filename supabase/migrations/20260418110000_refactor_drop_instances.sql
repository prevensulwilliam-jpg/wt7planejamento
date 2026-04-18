-- Refactor: remove monthly_bill_instances (duplicação com bank_transactions)
-- Status agora é derivado on-the-fly na query, bank_transactions é fonte única de verdade

DROP TABLE IF EXISTS public.monthly_bill_instances CASCADE;

-- Vincular recurring_bill ao pattern que a gerou (opcional, melhora match determinístico)
ALTER TABLE public.recurring_bills
  ADD COLUMN IF NOT EXISTS linked_pattern_id uuid;

COMMENT ON COLUMN public.recurring_bills.linked_pattern_id IS
  'Pattern que originou a auto-promoção (ou vinculado manualmente). Usado pra match determinístico com bank_transactions.';
