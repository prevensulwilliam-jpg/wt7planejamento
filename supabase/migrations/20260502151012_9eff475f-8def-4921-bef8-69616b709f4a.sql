-- ═══ Sprint 1.1 ═══
CREATE TABLE IF NOT EXISTS daily_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  due_date date NOT NULL,
  due_time time,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','done','postponed','cancelled')),
  vector text,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','naval_promoted','recurrence','crm_agendor')),
  recurrence_rule_id uuid,
  related_alert_id uuid,
  related_entity_type text,
  related_entity_id uuid,
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_due ON daily_tasks (due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_daily_tasks_status ON daily_tasks (status, due_date);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_source ON daily_tasks (source);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_alert ON daily_tasks (related_alert_id) WHERE related_alert_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS task_recurrence_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  vector text,
  frequency text NOT NULL
    CHECK (frequency IN ('daily','weekly','monthly','yearly','weekdays','custom_cron')),
  weekday integer,
  monthly_day integer,
  due_time time,
  cron_expression text,
  active boolean NOT NULL DEFAULT true,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  last_generated_until date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recur_active ON task_recurrence_rules (active, start_date) WHERE active = true;

DO $$ BEGIN
  ALTER TABLE daily_tasks ADD CONSTRAINT fk_recurrence
    FOREIGN KEY (recurrence_rule_id) REFERENCES task_recurrence_rules(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE daily_tasks ADD CONSTRAINT fk_alert
    FOREIGN KEY (related_alert_id) REFERENCES naval_alerts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth full access daily_tasks" ON daily_tasks;
CREATE POLICY "auth full access daily_tasks" ON daily_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE task_recurrence_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth full access recurrence" ON task_recurrence_rules;
CREATE POLICY "auth full access recurrence" ON task_recurrence_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══ Sprint 1.2 ═══
ALTER TABLE prevensul_billing
  ADD COLUMN IF NOT EXISTS pipeline_stage text
    CHECK (pipeline_stage IN ('quente','proposta','fechando','perdido','ganho'));
CREATE INDEX IF NOT EXISTS idx_pb_stage ON prevensul_billing (pipeline_stage) WHERE pipeline_stage IS NOT NULL;

-- ═══ Sprint 1.3 ═══
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS period_type text
    CHECK (period_type IN ('monthly','quarterly','semestral','yearly','3y','5y','10y','custom')),
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS metric text
    CHECK (metric IN ('revenue','patrimony','savings','profit','renda_passiva','custom')),
  ADD COLUMN IF NOT EXISTS auto_calculated boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_goals_period ON goals (period_start, period_end) WHERE period_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_metric ON goals (metric) WHERE metric IS NOT NULL;

INSERT INTO goals (name, type, target_value, deadline, period_type, period_start, period_end, metric, notes)
SELECT 'Receita Anual 2026', 'renda', 720000, '2026-12-31', 'yearly',
       '2026-01-01', '2026-12-31', 'revenue',
       'Meta agressiva: R$ 720k em 12 meses.'
WHERE NOT EXISTS (SELECT 1 FROM goals WHERE name = 'Receita Anual 2026');

-- ═══ Sprint 1.4 ═══
CREATE TABLE IF NOT EXISTS whatsapp_notifications_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone text NOT NULL,
  template text NOT NULL
    CHECK (template IN ('briefing_daily','alert_critical','weekly_summary','custom')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sent','failed','cancelled')),
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  evolution_message_id text,
  retries integer NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_queue_pending ON whatsapp_notifications_queue (scheduled_for) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_wa_queue_status ON whatsapp_notifications_queue (status, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_wa_queue_template ON whatsapp_notifications_queue (template);

CREATE TABLE IF NOT EXISTS whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  evolution_instance text,
  evolution_api_url text,
  primary_phone text NOT NULL,
  notify_briefing_daily boolean NOT NULL DEFAULT true,
  notify_alerts_critical boolean NOT NULL DEFAULT true,
  notify_weekly_summary boolean NOT NULL DEFAULT true,
  briefing_send_hour integer NOT NULL DEFAULT 8,
  weekly_summary_weekday integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE whatsapp_notifications_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth full wa queue" ON whatsapp_notifications_queue;
CREATE POLICY "auth full wa queue" ON whatsapp_notifications_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth full wa config" ON whatsapp_config;
CREATE POLICY "auth full wa config" ON whatsapp_config FOR ALL TO authenticated USING (true) WITH CHECK (true);