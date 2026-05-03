CREATE TABLE IF NOT EXISTS public.naval_cost_settings (
  id integer PRIMARY KEY DEFAULT 1,
  usd_to_brl numeric(8, 4) NOT NULL DEFAULT 5.0000,
  anthropic_balance_usd numeric(12, 2),
  anthropic_mtd_cost_usd numeric(12, 4),
  anthropic_mtd_cost_total_usd numeric(12, 4),
  api_key_label text DEFAULT 'NavaWT7',
  notes text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT naval_cost_settings_singleton CHECK (id = 1)
);

INSERT INTO public.naval_cost_settings (id, usd_to_brl, api_key_label)
VALUES (1, 5.0, 'NavaWT7')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.naval_cost_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage naval_cost_settings" ON public.naval_cost_settings;
CREATE POLICY "Admin can manage naval_cost_settings" ON public.naval_cost_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.tg_naval_cost_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS naval_cost_settings_updated_at ON public.naval_cost_settings;
CREATE TRIGGER naval_cost_settings_updated_at
  BEFORE UPDATE ON public.naval_cost_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_naval_cost_settings_updated_at();