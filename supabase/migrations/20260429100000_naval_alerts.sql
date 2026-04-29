-- Alertas proativos do Naval — gerados por cron diário
-- 7 detectores rodam todo dia 06:00. Inserem alert se condição True.
-- William vê na UI (badge no header + página /naval/alertas).

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

-- Limpa alertas resolvidos com mais de 30 dias
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

-- Agendamento via pg_cron
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Cleanup diário 03:30
    PERFORM cron.unschedule('naval_alerts_cleanup')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'naval_alerts_cleanup');
    PERFORM cron.schedule('naval_alerts_cleanup', '30 3 * * *',
      'SELECT public.naval_alerts_cleanup_old();');

    -- Detector diário 06:00 — chama edge function via pg_net
    -- (descomentado quando edge function naval-daily-check estiver deployada)
    -- PERFORM cron.unschedule('naval_daily_check')
    --   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'naval_daily_check');
    -- PERFORM cron.schedule('naval_daily_check', '0 6 * * *',
    --   'SELECT net.http_post(url := ''https://hbyzmuxkgsogbxhykhhu.supabase.co/functions/v1/naval-daily-check'')');
  END IF;
END $$;
