-- Campos de sociedade no consórcio
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS ownership_pct NUMERIC(5,2) DEFAULT 100;
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS partner_name TEXT;

-- Percentuais de composição (para cálculo automático)
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS fund_pct NUMERIC(6,2);
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS insurance_pct NUMERIC(6,2);
