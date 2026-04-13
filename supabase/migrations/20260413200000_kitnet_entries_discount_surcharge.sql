-- Adiciona campos de desconto, acréscimo e observação em kitnet_entries

ALTER TABLE public.kitnet_entries
  ADD COLUMN IF NOT EXISTS discount_amount  numeric(12,2),
  ADD COLUMN IF NOT EXISTS discount_reason  text,
  ADD COLUMN IF NOT EXISTS surcharge_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS surcharge_reason text,
  ADD COLUMN IF NOT EXISTS notes            text;
