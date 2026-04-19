-- ═══════════════════════════════════════════════════════════════════
-- MIGRATIONS_TO_RUN.sql
-- ═══════════════════════════════════════════════════════════════════
-- Rodar no Lovable → Supabase → SQL Editor (projeto hbyzmuxkgsogbxhykhhu)
-- Consolidado em: 19/04/2026
--
-- Contexto: sprint cockpit estratégico. /dashboard saiu, /hoje virou home,
-- Naval virou conselheiro financeiro com memória permanente.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1) naval_memory — memória permanente do Naval
-- ───────────────────────────────────────────────────────────────────
-- Mesma fonte .md que o Claude Code usa (C:\Users\Usuário\.claude\memoria\).
-- Sincronizada via scripts/sync-naval-memory.ts
-- wisely-ai edge function lê essa tabela e injeta no system prompt.
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.naval_memory (
  slug        text PRIMARY KEY,
  title       text NOT NULL,
  content     text NOT NULL,
  priority    int  NOT NULL DEFAULT 100,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.naval_memory ENABLE ROW LEVEL SECURITY;

-- Só admin lê/escreve
DROP POLICY IF EXISTS "admin full access naval_memory" ON public.naval_memory;
CREATE POLICY "admin full access naval_memory"
  ON public.naval_memory
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- service_role bypass RLS automaticamente (edge function usa service_role)

-- ───────────────────────────────────────────────────────────────────
-- 2) Migrations pendentes de sprints anteriores (se ainda não rodou)
-- ───────────────────────────────────────────────────────────────────

-- energy_config (tarifa por complexo)
CREATE TABLE IF NOT EXISTS public.energy_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residencial_code text NOT NULL UNIQUE,
  tariff_kwh numeric(10,4) NOT NULL DEFAULT 1.0600,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);
INSERT INTO public.energy_config (residencial_code, tariff_kwh)
  VALUES ('RWT02', 1.0600), ('RWT03', 1.0600)
  ON CONFLICT (residencial_code) DO NOTHING;
ALTER TABLE public.energy_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read energy_config" ON public.energy_config;
CREATE POLICY "authenticated can read energy_config"
  ON public.energy_config FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin can modify energy_config" ON public.energy_config;
CREATE POLICY "admin can modify energy_config"
  ON public.energy_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- payment_date em celesc_invoices
ALTER TABLE public.celesc_invoices
  ADD COLUMN IF NOT EXISTS payment_date DATE;

-- ═══════════════════════════════════════════════════════════════════
-- APÓS RODAR ESSE SQL:
-- 1. Popular naval_memory rodando o sync:
--      export SUPABASE_URL=https://hbyzmuxkgsogbxhykhhu.supabase.co
--      export SUPABASE_SERVICE_ROLE_KEY=<service_role_key do Lovable>
--      npx tsx scripts/sync-naval-memory.ts
-- 2. Redeploy da edge function wisely-ai (Lovable faz automaticamente no push)
-- 3. Testar Naval em /naval — ele já responde com memória permanente
-- ═══════════════════════════════════════════════════════════════════
