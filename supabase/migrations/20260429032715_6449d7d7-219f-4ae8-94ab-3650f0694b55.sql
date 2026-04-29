-- Habilita pg_cron pra cleanup automático
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Reagenda cleanup diário
DO $$
BEGIN
  PERFORM cron.unschedule('naval_chats_cleanup_daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'naval_chats_cleanup_daily');

  PERFORM cron.schedule(
    'naval_chats_cleanup_daily',
    '0 3 * * *',
    'SELECT public.naval_chats_cleanup_old();'
  );
END $$;