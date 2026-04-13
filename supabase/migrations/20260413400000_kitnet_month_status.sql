-- ─── Status por mês por kitnet ───────────────────────────────────────────────
-- Permite registrar o status de cada kitnet em cada mês individualmente,
-- sem alterar o status global da tabela kitnets.

CREATE TABLE IF NOT EXISTS kitnet_month_status (
  kitnet_id       uuid NOT NULL REFERENCES kitnets(id) ON DELETE CASCADE,
  reference_month text NOT NULL,
  status          text NOT NULL DEFAULT 'vacant'
                  CHECK (status IN ('occupied', 'vacant', 'maintenance')),
  updated_at      timestamptz DEFAULT now(),
  PRIMARY KEY (kitnet_id, reference_month)
);

ALTER TABLE kitnet_month_status ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kitnet_month_status'
      AND policyname = 'authenticated full access kitnet_month_status'
  ) THEN
    CREATE POLICY "authenticated full access kitnet_month_status"
      ON kitnet_month_status
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
