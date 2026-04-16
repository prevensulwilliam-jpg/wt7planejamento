-- Campos de sociedade no consórcio
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS ownership_pct NUMERIC(5,2) DEFAULT 100;
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS partner_name TEXT;
