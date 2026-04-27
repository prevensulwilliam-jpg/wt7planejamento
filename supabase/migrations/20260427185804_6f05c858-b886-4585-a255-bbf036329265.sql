-- Adicionar campos de data ao lançamento
ALTER TABLE public.other_commissions
  ADD COLUMN IF NOT EXISTS issued_at date,
  ADD COLUMN IF NOT EXISTS installments_count int NOT NULL DEFAULT 1;

-- Tabela de parcelas
CREATE TABLE IF NOT EXISTS public.other_commission_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.other_commissions(id) ON DELETE CASCADE,
  installment_number int NOT NULL,
  due_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  paid_at date,
  paid_amount numeric(12,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (commission_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_oc_inst_commission ON public.other_commission_installments(commission_id);
CREATE INDEX IF NOT EXISTS idx_oc_inst_paid_at ON public.other_commission_installments(paid_at);

ALTER TABLE public.other_commission_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access oc_installments" ON public.other_commission_installments;
CREATE POLICY "Admin full access oc_installments"
  ON public.other_commission_installments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));