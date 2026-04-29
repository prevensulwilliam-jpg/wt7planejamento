-- Alertas proativos do Naval — gerados por cron diário
CREATE TABLE IF NOT EXISTS public.naval_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  detector text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  metric_name text,
  metric_value numeric,
  metric_threshold numeric,
  detected_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  dismissed_by_user boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS naval_alerts_active
  ON public.naval_alerts (detected_at DESC)
  WHERE dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS naval_alerts_user
  ON public.naval_alerts (user_id, detected_at DESC);

ALTER TABLE public.naval_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "naval_alerts_select_own" ON public.naval_alerts;
CREATE POLICY "naval_alerts_select_own" ON public.naval_alerts
  FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "naval_alerts_update_own" ON public.naval_alerts;
CREATE POLICY "naval_alerts_update_own" ON public.naval_alerts
  FOR UPDATE TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "naval_alerts_insert_service" ON public.naval_alerts;
CREATE POLICY "naval_alerts_insert_service" ON public.naval_alerts
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.naval_alerts_cleanup_old()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.naval_alerts
  WHERE dismissed_at IS NOT NULL
    AND dismissed_at < now() - interval '30 days';
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('naval_alerts_cleanup')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'naval_alerts_cleanup');
    PERFORM cron.schedule('naval_alerts_cleanup', '30 3 * * *',
      'SELECT public.naval_alerts_cleanup_old();');
  END IF;
END $$;