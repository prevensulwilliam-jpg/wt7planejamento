-- Reembolso entre sócios em obras compartilhadas (RWT05/Walmir, JW7/Jairo).
--
-- Hoje construction_expenses tem william_amount + partner_amount (cota), mas
-- não rastreia QUEM DESEMBOLSOU de fato pro fornecedor. Quando William paga
-- um cheque cheio (R$ 10k) e Walmir reembolsa via Pix (R$ 5k antes), não
-- existe lugar pra registrar esse reembolso — vira receita errada no DRE
-- ou some no extrato sem reconciliar.
--
-- Esta tabela: cash flow ENTRE SÓCIOS (não despesa de obra).
-- direction = partner_to_william: Pix do Walmir pra William abate cota dele
-- direction = william_to_partner: Transf do William pro Walmir abate cota William

CREATE TABLE IF NOT EXISTS construction_partner_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  construction_id uuid NOT NULL REFERENCES constructions(id) ON DELETE CASCADE,
  partner_name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('partner_to_william', 'william_to_partner')),
  payment_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method text,                              -- 'pix', 'transferencia', 'cheque', 'dinheiro'
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

-- Policy: usuário autenticado pode tudo (mesmo padrão do projeto)
CREATE POLICY "authenticated full access"
  ON construction_partner_payments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Flag em construction_expenses ────────────────────────────────────
-- Quando o gasto NÃO deve contar pro saldo entre sócios. Ex: entrada R$ 90k
-- da RWT05 onde Walmir adiantou tudo e William reembolsou em transferências
-- históricas que não foram rastreadas — saldo já fechado.
ALTER TABLE construction_expenses
  ADD COLUMN IF NOT EXISTS excluded_from_partner_balance boolean
    NOT NULL DEFAULT false;

COMMENT ON COLUMN construction_expenses.excluded_from_partner_balance IS
  'Se true, este gasto não conta pro cálculo de saldo entre sócios (cota partner). Use pra registros legados onde o reembolso já aconteceu fora do sistema.';

COMMENT ON TABLE construction_partner_payments IS
  'Cash flow entre sócios em obras compartilhadas. NÃO É despesa de obra — é reembolso/adiantamento entre os parceiros. Saldo Walmir te deve = SUM(construction_expenses.partner_amount onde paid_by IN (william, ambos) AND NOT excluded_from_partner_balance) - SUM(direction=partner_to_william) + SUM(direction=william_to_partner)';
