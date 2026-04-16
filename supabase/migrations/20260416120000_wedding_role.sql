-- Adiciona 'wedding' ao enum app_role (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'wedding'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'wedding';
  END IF;
END
$$;

-- ⚠️ APÓS CRIAR O USUÁRIO NO SUPABASE AUTH, rodar:
-- INSERT INTO public.user_roles (user_id, role, status)
-- VALUES ('<UUID_DA_CAMILA>', 'wedding', 'active');
