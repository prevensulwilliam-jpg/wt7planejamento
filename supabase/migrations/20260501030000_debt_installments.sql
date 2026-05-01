-- Cronograma de parcelas de dívidas com pagamento irregular ou sequência
-- de cheques (RWT05 com 3 cheques de R$ 10k). Para dívidas com pagamento
-- mensal regular (Rampage, NRSX 288 parcelas), continua usando o campo
-- monthly_payment + due_date da tabela debts (cronograma derivado virtual).
--
-- Naval lógica:
--   se debt tem installments → mostra cronograma real (próximas pendentes)
--   senão → deriva virtualmente de monthly_payment

CREATE TABLE IF NOT EXISTS debt_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id uuid NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  sequence_number int NOT NULL,           -- 1, 2, 3... (ordem na sequência)
  due_date date NOT NULL,                 -- vencimento desta parcela
  amount numeric(14,2) NOT NULL,          -- valor planejado
  paid_at date,                           -- null = pendente
  paid_amount numeric(14,2),              -- valor real pago (pode diferir por juros/multa/desconto)
  bank_tx_id uuid REFERENCES bank_transactions(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (debt_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_debt_inst_debt ON debt_installments (debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_inst_due ON debt_installments (due_date) WHERE paid_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_debt_inst_bank ON debt_installments (bank_tx_id) WHERE bank_tx_id IS NOT NULL;

ALTER TABLE debt_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access" ON debt_installments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE debt_installments IS
  'Cronograma de parcelas de dívidas com sequência irregular ou poucos pagamentos. Use só quando faz sentido — dívidas mensais regulares (Rampage, NRSX) ficam só com debts.monthly_payment.';
