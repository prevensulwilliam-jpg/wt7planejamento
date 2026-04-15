-- Dívida com sócio por obra
ALTER TABLE public.constructions
  ADD COLUMN IF NOT EXISTS debt_to_partner   numeric(14,2),
  ADD COLUMN IF NOT EXISTS debt_partner_name text,
  ADD COLUMN IF NOT EXISTS debt_target_date  date;
