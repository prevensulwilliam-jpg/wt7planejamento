-- Tabela de vínculos entre fechamentos e transações bancárias
-- Suporta múltiplos depósitos parciais formando o total de um fechamento

CREATE TABLE IF NOT EXISTS public.kitnet_entry_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kitnet_entry_id     uuid NOT NULL REFERENCES public.kitnet_entries(id) ON DELETE CASCADE,
  bank_transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  amount              numeric(12,2) NOT NULL,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (kitnet_entry_id, bank_transaction_id)
);

ALTER TABLE public.kitnet_entry_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access kitnet_entry_transactions"
  ON public.kitnet_entry_transactions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
