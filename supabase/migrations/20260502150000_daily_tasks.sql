-- ═══════════════════════════════════════════════════════════════════
-- Sprint 1.1: daily_tasks + task_recurrence_rules
-- ═══════════════════════════════════════════════════════════════════
-- Fonte: William é executor, Stream do Dia precisa de tasks manuais
-- + recorrência (treino 12h, audit semanal segunda 8h, etc).
--
-- Stream MVP C cobre: auto-pop (installments) + manual + Naval-promovido
-- + recorrência. Esta migration é a fundação das partes manual + recurrence.

-- ─── DAILY TASKS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  due_date date NOT NULL,
  due_time time,                         -- horário específico (opcional)
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','done','postponed','cancelled')),
  vector text,                           -- prevensul, kitnets, naval, pessoal, t7, obras
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','naval_promoted','recurrence','crm_agendor')),
  recurrence_rule_id uuid,               -- FK pra task_recurrence_rules (se vier de regra)
  related_alert_id uuid,                 -- FK pra naval_alerts (se promovida de alerta)
  related_entity_type text,              -- 'kitnet', 'construction', 'business', 'commission', etc
  related_entity_id uuid,                -- id da entidade relacionada (link)
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_due
  ON daily_tasks (due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_daily_tasks_status
  ON daily_tasks (status, due_date);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_source
  ON daily_tasks (source);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_alert
  ON daily_tasks (related_alert_id) WHERE related_alert_id IS NOT NULL;

-- ─── TASK RECURRENCE RULES ────────────────────────────────────────────
-- Regras tipo: "Treino Henrique todo dia 12h" / "Audit Naval toda segunda 8h"
CREATE TABLE IF NOT EXISTS task_recurrence_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  vector text,
  frequency text NOT NULL
    CHECK (frequency IN ('daily','weekly','monthly','yearly','weekdays','custom_cron')),
  weekday integer,                       -- 0-6 (0=domingo) — usado quando frequency='weekly'
  monthly_day integer,                   -- 1-31 — usado quando frequency='monthly'
  due_time time,                         -- horário padrão das instâncias geradas
  cron_expression text,                  -- usado quando frequency='custom_cron'
  active boolean NOT NULL DEFAULT true,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,                         -- null = sem fim
  last_generated_until date,             -- até qual data já foi gerada instância
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recur_active
  ON task_recurrence_rules (active, start_date) WHERE active = true;

-- FK reverso (depois da rules existir)
ALTER TABLE daily_tasks
  ADD CONSTRAINT fk_recurrence
  FOREIGN KEY (recurrence_rule_id) REFERENCES task_recurrence_rules(id) ON DELETE SET NULL;

ALTER TABLE daily_tasks
  ADD CONSTRAINT fk_alert
  FOREIGN KEY (related_alert_id) REFERENCES naval_alerts(id) ON DELETE SET NULL;

-- ─── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access daily_tasks" ON daily_tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE task_recurrence_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access recurrence" ON task_recurrence_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── COMENTÁRIOS ──────────────────────────────────────────────────────
COMMENT ON TABLE daily_tasks IS
  'Stream do Dia: tasks manuais + Naval-promovidas + geradas por recurrence. Lê pelo /hoje.';
COMMENT ON TABLE task_recurrence_rules IS
  'Regras de recorrência (treino diário, audit semanal). Worker/cron diário gera instâncias em daily_tasks até last_generated_until.';
