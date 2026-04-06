-- Adiciona status ao user_roles (pending = aguardando aprovação)
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'rejected'));

-- Garante retrocompatibilidade: registros existentes ficam 'active'
UPDATE public.user_roles SET status = 'active' WHERE status IS NULL;

-- Tabela de histórico de login (visível apenas para admin)
CREATE TABLE IF NOT EXISTS public.login_history (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  logged_at  timestamptz DEFAULT now(),
  user_agent text
);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads all login history"
  ON public.login_history FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "User inserts own login history"
  ON public.login_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);
