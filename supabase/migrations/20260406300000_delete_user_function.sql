-- Função SECURITY DEFINER para admin deletar usuário do auth
-- Só admin pode chamar (verificado via has_role)
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica se quem chamou é admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  -- Impede deletar a si mesmo
  IF auth.uid() = p_user_id THEN
    RAISE EXCEPTION 'Não é possível excluir o próprio usuário';
  END IF;

  -- Deleta do auth (cascata remove profiles, user_roles, login_history via FK)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
