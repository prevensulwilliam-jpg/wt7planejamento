CREATE TABLE IF NOT EXISTS public.debt_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id uuid NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  sequence_number int NOT NULL,
  due_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  paid_at date,
  paid_amount numeric(14,2),
  bank_tx_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (debt_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_debt_inst_debt ON public.debt_installments (debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_inst_due ON public.debt_installments (due_date) WHERE paid_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_debt_inst_bank ON public.debt_installments (bank_tx_id) WHERE bank_tx_id IS NOT NULL;

ALTER TABLE public.debt_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON public.debt_installments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.debt_installments IS
  'Cronograma de parcelas de dívidas com sequência irregular ou poucos pagamentos. Use só quando faz sentido — dívidas mensais regulares (Rampage, NRSX) ficam só com debts.monthly_payment.';