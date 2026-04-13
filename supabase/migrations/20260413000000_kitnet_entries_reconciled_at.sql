-- Adiciona coluna reconciled_at em kitnet_entries
-- Registra o momento exato em que o fechamento foi conciliado com o extrato bancário

ALTER TABLE public.kitnet_entries
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;
