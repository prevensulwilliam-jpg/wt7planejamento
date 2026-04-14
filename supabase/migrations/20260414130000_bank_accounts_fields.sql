-- Campos bancários adicionais em bank_accounts
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS agency         text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS pix_key        text;
