CREATE TABLE IF NOT EXISTS construction_partner_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  construction_id uuid NOT NULL REFERENCES constructions(id) ON DELETE CASCADE,
  partner_name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('partner_to_william', 'william_to_partner')),
  payment_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method text,
  bank_tx_id uuid REFERENCES bank_transactions(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpp_construction
  ON construction_partner_payments (construction_id);
CREATE INDEX IF NOT EXISTS idx_cpp_partner
  ON construction_partner_payments (partner_name);
CREATE INDEX IF NOT EXISTS idx_cpp_bank_tx
  ON construction_partner_payments (bank_tx_id)
  WHERE bank_tx_id IS NOT NULL;

ALTER TABLE construction_partner_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated full access" ON construction_partner_payments;
CREATE POLICY "authenticated full access"
  ON construction_partner_payments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE construction_expenses
  ADD COLUMN IF NOT EXISTS excluded_from_partner_balance boolean
    NOT NULL DEFAULT false;

COMMENT ON COLUMN construction_expenses.excluded_from_partner_balance IS
  'Se true, este gasto não conta pro cálculo de saldo entre sócios (cota partner). Use pra registros legados onde o reembolso já aconteceu fora do sistema.';

COMMENT ON TABLE construction_partner_payments IS
  'Cash flow entre sócios em obras compartilhadas. NÃO É despesa de obra — é reembolso/adiantamento entre os parceiros.';