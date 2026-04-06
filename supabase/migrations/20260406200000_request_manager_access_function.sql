-- Função SECURITY DEFINER para auto-cadastro de manager
-- Bypassa RLS — só insere com status='pending' e role='kitnet_manager'
CREATE OR REPLACE FUNCTION public.request_manager_access(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  INSERT INTO public.user_roles (user_id, role, status)
  VALUES (p_user_id, 'kitnet_manager', 'pending')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
