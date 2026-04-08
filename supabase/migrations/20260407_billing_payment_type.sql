-- Adiciona payment_type em prevensul_billing
ALTER TABLE public.prevensul_billing
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'equal'
  CHECK (payment_type IN ('equal', 'custom'));

-- Tabela de cronograma de pagamento personalizado
CREATE TABLE IF NOT EXISTS public.billing_payment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID REFERENCES public.prevensul_billing(id) ON DELETE CASCADE NOT NULL,
  installment_number INTEGER NOT NULL, -- 0 = entrada, 1..N = parcelas
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  paid_at DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.billing_payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can read billing_payment_schedule"
  ON public.billing_payment_schedule
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/financial/commissions can manage billing_payment_schedule"
  ON public.billing_payment_schedule
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'financial') OR
    public.has_role(auth.uid(), 'commissions')
  );
