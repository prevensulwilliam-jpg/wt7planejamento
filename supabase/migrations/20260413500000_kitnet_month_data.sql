-- ─── Dados por mês por kitnet ────────────────────────────────────────────────
-- Armazena snapshots mensais de tenant_name, tenant_phone e rent_value.
-- Lógica de herança: se não há registro para o mês X, usa o mais recente ≤ X.
-- Mudanças num mês só criam um snapshot naquele mês — não afetam o passado.

CREATE TABLE IF NOT EXISTS kitnet_month_data (
  kitnet_id       uuid NOT NULL REFERENCES kitnets(id) ON DELETE CASCADE,
  reference_month text NOT NULL,
  tenant_name     text,
  tenant_phone    text,
  rent_value      numeric(10,2),
  updated_at      timestamptz DEFAULT now(),
  PRIMARY KEY (kitnet_id, reference_month)
);

ALTER TABLE kitnet_month_data ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kitnet_month_data'
      AND policyname = 'authenticated full access kitnet_month_data'
  ) THEN
    CREATE POLICY "authenticated full access kitnet_month_data"
      ON kitnet_month_data
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
