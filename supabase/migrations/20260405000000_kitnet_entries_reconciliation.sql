-- Adiciona campos de conciliação em kitnet_entries
ALTER TABLE public.kitnet_entries
  ADD COLUMN IF NOT EXISTS reconciled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL;

-- Index para busca de pendentes
CREATE INDEX IF NOT EXISTS idx_kitnet_entries_reconciled ON public.kitnet_entries(reconciled);
