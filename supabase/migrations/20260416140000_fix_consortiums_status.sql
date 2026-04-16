-- Fix: constraint de status estava em inglês, frontend envia em português
ALTER TABLE public.consortiums DROP CONSTRAINT IF EXISTS consortiums_status_check;
ALTER TABLE public.consortiums ADD CONSTRAINT consortiums_status_check
  CHECK (status IN ('ativo','contemplado','encerrado','active','contemplated','finished'));

-- Adiciona coluna total_paid para rastrear valor total pago (soma das parcelas conciliadas)
ALTER TABLE public.consortiums ADD COLUMN IF NOT EXISTS total_paid NUMERIC(14,2) DEFAULT 0;
