-- Nome fantasia: separa nome real (usado no matching com extrato) do apelido exibido na UI
ALTER TABLE public.recurring_bills
  ADD COLUMN IF NOT EXISTS alias text;

COMMENT ON COLUMN public.recurring_bills.name IS 'Nome real — usado para match com bank_transactions (keywords do extrato)';
COMMENT ON COLUMN public.recurring_bills.alias IS 'Apelido/nome fantasia exibido na UI. Se NULL, usa name.';
