DROP TABLE IF EXISTS public.construction_partner_payments CASCADE;
ALTER TABLE public.construction_expenses DROP COLUMN IF EXISTS excluded_from_partner_balance;