-- ═══════════════════════════════════════════════════════════════════
-- Sprint 1.4: whatsapp_notifications_queue (encanamento Evolution API)
-- ═══════════════════════════════════════════════════════════════════
-- Encanamento pronto pra Sprint 4 conectar Evolution API.
-- Hoje a tabela existe, edge function `send-whatsapp` enfileira aqui,
-- worker (futuro) consome e dispara via Evolution API.
--
-- Mensagens-modelo:
--   • Briefing diário 8h
--   • Alerta crítico audit
--   • Resumo semanal domingo

CREATE TABLE IF NOT EXISTS whatsapp_notifications_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone text NOT NULL,                -- E.164 (+55479...)
  template text NOT NULL                 -- 'briefing_daily', 'alert_critical', 'weekly_summary', 'custom'
    CHECK (template IN ('briefing_daily','alert_critical','weekly_summary','custom')),
  message text NOT NULL,                 -- corpo já formatado em markdown WhatsApp
  status text NOT NULL DEFAULT 'queued'  -- queued/sent/failed/cancelled
    CHECK (status IN ('queued','sent','failed','cancelled')),
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  evolution_message_id text,             -- id retornado pela Evolution API após send
  retries integer NOT NULL DEFAULT 0,
  metadata jsonb,                        -- contexto extra (alert_id, briefing_date, etc)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_queue_pending
  ON whatsapp_notifications_queue (scheduled_for)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_wa_queue_status
  ON whatsapp_notifications_queue (status, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_wa_queue_template
  ON whatsapp_notifications_queue (template);

-- Configuração Evolution API por usuário (futuro multi-user)
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  evolution_instance text,               -- nome da instância Evolution
  evolution_api_url text,                -- ex: https://evo.suaapi.com.br
  -- evolution_api_key fica em Supabase secrets (não em texto)
  primary_phone text NOT NULL,           -- E.164 do William
  notify_briefing_daily boolean NOT NULL DEFAULT true,
  notify_alerts_critical boolean NOT NULL DEFAULT true,
  notify_weekly_summary boolean NOT NULL DEFAULT true,
  briefing_send_hour integer NOT NULL DEFAULT 8,  -- hora local (Brasília)
  weekly_summary_weekday integer NOT NULL DEFAULT 0,  -- 0=domingo
  active boolean NOT NULL DEFAULT false,  -- false = encanamento pronto, conexão desativada
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE whatsapp_notifications_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full wa queue" ON whatsapp_notifications_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full wa config" ON whatsapp_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE whatsapp_notifications_queue IS
  'Fila de mensagens WhatsApp pendentes. Edge function send-whatsapp enfileira; worker Evolution dispara. Sprint 4 ativa o worker (cereja final).';
COMMENT ON TABLE whatsapp_config IS
  'Config Evolution API por usuário. active=false na fundação, true quando William conectar Evolution.';
