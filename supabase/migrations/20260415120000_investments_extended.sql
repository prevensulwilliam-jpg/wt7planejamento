ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS rescue_amount   numeric(14,2),
  ADD COLUMN IF NOT EXISTS cdi_percent     numeric(6,2)  DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_cdi_linked   boolean       DEFAULT true,
  ADD COLUMN IF NOT EXISTS inclusion_date  date,
  ADD COLUMN IF NOT EXISTS product_code    text,
  ADD COLUMN IF NOT EXISTS notes           text;
