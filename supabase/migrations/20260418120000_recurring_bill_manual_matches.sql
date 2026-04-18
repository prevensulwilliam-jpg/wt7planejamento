-- Override manual de match entre recurring_bill e bank_transaction
-- Usado quando o matcher automático não consegue casar (ex: Fatura XP paga via PIX próprio)

CREATE TABLE IF NOT EXISTS public.recurring_bill_manual_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_bill_id uuid NOT NULL REFERENCES public.recurring_bills(id) ON DELETE CASCADE,
  reference_month text NOT NULL,  -- formato YYYY-MM
  transaction_id uuid NOT NULL,    -- referência lógica pra bank_transactions.id
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (recurring_bill_id, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_rbmm_bill_month
  ON public.recurring_bill_manual_matches (recurring_bill_id, reference_month);

CREATE INDEX IF NOT EXISTS idx_rbmm_tx
  ON public.recurring_bill_manual_matches (transaction_id);

ALTER TABLE public.recurring_bill_manual_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages manual matches"
  ON public.recurring_bill_manual_matches
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

COMMENT ON TABLE public.recurring_bill_manual_matches IS
  'Vínculo manual forçado entre um recurring_bill e uma bank_transaction de um mês específico. Sobrepõe o matcher automático.';
