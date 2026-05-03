-- ════════════════════════════════════════════════════════════════════════════
-- naval_cost_settings — KV singleton pra calibragem manual com painel Anthropic
-- ════════════════════════════════════════════════════════════════════════════
-- Permite William sincronizar valores reais do painel Anthropic
-- (https://console.anthropic.com/settings/cost) com o WT7 esporadicamente.
--
-- Sistema mostra: estimated (gravado pelo wisely-ai v44+) vs oficial (digitado
-- pelo William). Diferença ±X% sinaliza precisão da estimativa.
--
-- Singleton: sempre 1 linha (id=1). UPSERT atualiza ela.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.naval_cost_settings (
  id integer PRIMARY KEY DEFAULT 1,
  -- Câmbio USD → BRL atual (atualizar quando relevante)
  usd_to_brl numeric(8, 4) NOT NULL DEFAULT 5.0000,
  -- Valores manuais do painel Anthropic (referência pra calibragem)
  anthropic_balance_usd numeric(12, 2),         -- Saldo de créditos restante
  anthropic_mtd_cost_usd numeric(12, 4),        -- Custo MTD da chave WT7 (NavaWT7)
  anthropic_mtd_cost_total_usd numeric(12, 4),  -- Custo MTD de TODAS as chaves
  -- Detalhes opcionais
  api_key_label text DEFAULT 'NavaWT7',
  notes text,
  last_synced_at timestamptz,
  -- Auditoria
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Garante singleton
  CONSTRAINT naval_cost_settings_singleton CHECK (id = 1)
);

-- Insere singleton inicial se não existir
INSERT INTO public.naval_cost_settings (id, usd_to_brl, api_key_label)
VALUES (1, 5.0, 'NavaWT7')
ON CONFLICT (id) DO NOTHING;

-- RLS — só admin
ALTER TABLE public.naval_cost_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage naval_cost_settings" ON public.naval_cost_settings;
CREATE POLICY "Admin can manage naval_cost_settings" ON public.naval_cost_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_naval_cost_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS naval_cost_settings_updated_at ON public.naval_cost_settings;
CREATE TRIGGER naval_cost_settings_updated_at
  BEFORE UPDATE ON public.naval_cost_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_naval_cost_settings_updated_at();

COMMENT ON TABLE public.naval_cost_settings IS
  'KV singleton pra calibragem manual de custos Naval com painel Anthropic. William atualiza esporadicamente quando vê o painel oficial.';
