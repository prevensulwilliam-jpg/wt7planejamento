-- Remove job antigo se existir (idempotente)
SELECT cron.unschedule('generate-recurrence-tasks-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-recurrence-tasks-daily');

-- Agenda diário às 10h UTC (7h Brasília)
SELECT cron.schedule(
  'generate-recurrence-tasks-daily',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hbyzmuxkgsogbxhykhhu.supabase.co/functions/v1/generate-recurrence-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieXptdXhrZ3NvZ2J4aHlraGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDQ4NDUsImV4cCI6MjA5MDMyMDg0NX0.p1GaPYqLRP8f8QB0wfPQssFwB_s07l2ehBjrwu2M5co'
    ),
    body := jsonb_build_object('days_ahead', 7)
  );
  $$
);