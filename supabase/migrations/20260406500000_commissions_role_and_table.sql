-- 1. Adicionar 'commissions' ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'commissions';

-- 2. Tabela de comissões avulsas (Comissões Outros)
CREATE TABLE IF NOT EXISTS public.other_commissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description     text NOT NULL,
  source          text,
  reference_month text NOT NULL,
  amount          numeric(12,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,4) DEFAULT 0.03,
  commission_value numeric(12,2) NOT NULL DEFAULT 0,
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.other_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access other_commissions"
  ON public.other_commissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Atualizar RPC para aceitar 'commissions'
CREATE OR REPLACE FUNCTION public.request_manager_access(p_user_id uuid, p_role text DEFAULT 'kitnet_manager')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
  IF p_role NOT IN ('kitnet_manager', 'financial', 'partner', 'commissions') THEN
    RAISE EXCEPTION 'Perfil inválido';
  END IF;
  INSERT INTO public.user_roles (user_id, role, status)
  VALUES (p_user_id, p_role::public.app_role, 'pending')
  ON CONFLICT (user_id, role) DO UPDATE SET status = 'pending';
END; $$;
