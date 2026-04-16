-- Extensão da tabela consortiums para dados detalhados do extrato

-- Novas colunas
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS total_paid NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS group_number TEXT;           -- ex: 000580
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS quota TEXT;                  -- ex: 0434-00
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS contract_number TEXT;        -- ex: 0090065342
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS admin_fee_pct NUMERIC(6,4);  -- ex: 23.5000
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS asset_type TEXT;             -- ex: IMOVEIS
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS credit_value NUMERIC(14,2);  -- valor do crédito
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS adhesion_date DATE;          -- data adesão
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS end_date DATE;               -- data encerramento prevista
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS fund_paid NUMERIC(14,2) DEFAULT 0;    -- fundo comum pago
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS admin_fee_paid NUMERIC(14,2) DEFAULT 0; -- taxa adm paga
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS insurance_paid NUMERIC(14,2) DEFAULT 0; -- seguros pagos
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS total_pending NUMERIC(14,2) DEFAULT 0;  -- total a pagar
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS installments_remaining INTEGER DEFAULT 0;
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS extrato_file_url TEXT;
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS extrato_file_name TEXT;
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS extrato_updated_at TIMESTAMPTZ;

-- Tabela de histórico de parcelas do consórcio
CREATE TABLE IF NOT EXISTS public.consortium_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consortium_id UUID NOT NULL REFERENCES public.consortiums(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  transaction_type TEXT DEFAULT 'RECBTO. PARCELA',
  accounting_date DATE,
  payment_date DATE,
  amount_due NUMERIC(14,2),
  amount_paid NUMERIC(14,2),
  fc_pct NUMERIC(8,4) DEFAULT 0,
  admin_pct NUMERIC(8,4) DEFAULT 0,
  insurance_pct NUMERIC(8,6) DEFAULT 0,
  penalty NUMERIC(14,2) DEFAULT 0,
  interest NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(consortium_id, installment_number, payment_date)
);

ALTER TABLE public.consortium_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage consortium_installments"
  ON public.consortium_installments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
