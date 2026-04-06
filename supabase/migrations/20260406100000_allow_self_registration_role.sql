-- Permite que o próprio usuário solicite um role com status 'pending'
-- (necessário para o fluxo de auto-cadastro em /register)
CREATE POLICY "User can request own role"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
