-- Histórico de perguntas/respostas do Naval
-- Auto-limpa após 7 dias via pg_cron
-- RLS: cada user só vê os próprios chats

CREATE TABLE IF NOT EXISTS public.naval_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  asked_at timestamptz NOT NULL DEFAULT now(),
  tools_used text[] DEFAULT NULL,
  tokens_in integer,
  tokens_cache_read integer,
  tokens_cache_write integer,
  tokens_out integer,
  version text,
  feedback text CHECK (feedback IN ('good', 'bad') OR feedback IS NULL)
);

CREATE INDEX IF NOT EXISTS naval_chats_user_at
  ON public.naval_chats (user_id, asked_at DESC);

-- Busca textual em português
CREATE INDEX IF NOT EXISTS naval_chats_search
  ON public.naval_chats
  USING GIN (to_tsvector('portuguese', question || ' ' || answer));

-- RLS
ALTER TABLE public.naval_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "naval_chats_select_own" ON public.naval_chats;
CREATE POLICY "naval_chats_select_own" ON public.naval_chats
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "naval_chats_insert_own" ON public.naval_chats;
CREATE POLICY "naval_chats_insert_own" ON public.naval_chats
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "naval_chats_delete_own" ON public.naval_chats;
CREATE POLICY "naval_chats_delete_own" ON public.naval_chats
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "naval_chats_update_own" ON public.naval_chats;
CREATE POLICY "naval_chats_update_own" ON public.naval_chats
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Função de limpeza (>7 dias)
CREATE OR REPLACE FUNCTION public.naval_chats_cleanup_old()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.naval_chats
  WHERE asked_at < now() - interval '7 days';
$$;

-- Agenda diária via pg_cron (se extensão estiver habilitada)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove agendamento antigo se existir
    PERFORM cron.unschedule('naval_chats_cleanup_daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'naval_chats_cleanup_daily');

    -- Agenda nova execução: todo dia às 03:00
    PERFORM cron.schedule(
      'naval_chats_cleanup_daily',
      '0 3 * * *',
      'SELECT public.naval_chats_cleanup_old();'
    );
  END IF;
END $$;
