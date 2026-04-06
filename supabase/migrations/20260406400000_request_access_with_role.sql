-- Atualiza função para aceitar qualquer role (não só kitnet_manager)
CREATE OR REPLACE FUNCTION public.request_manager_access(p_user_id uuid, p_role text DEFAULT 'kitnet_manager')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  IF p_role NOT IN ('kitnet_manager', 'financial', 'partner') THEN
    RAISE EXCEPTION 'Perfil inválido';
  END IF;

  INSERT INTO public.user_roles (user_id, role, status)
  VALUES (p_user_id, p_role::public.app_role, 'pending')
  ON CONFLICT (user_id, role) DO UPDATE SET status = 'pending';
END;
$$;
