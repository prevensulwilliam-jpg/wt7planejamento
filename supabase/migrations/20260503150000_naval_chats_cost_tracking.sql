-- ════════════════════════════════════════════════════════════════════════════
-- Naval cost tracking — adiciona model_used + cost_usd_estimated em naval_chats
-- ════════════════════════════════════════════════════════════════════════════
-- Antes: NavalMetricasPage inferia modelo via heurística por version (errado
-- em 30-50% dos casos pq detectModelTier decide pergunta a pergunta).
--
-- Agora: wisely-ai (v44+) grava em CADA chamada o modelo REAL usado e o custo
-- USD calculado com tarifas Anthropic atualizadas. Métricas viram exatas.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.naval_chats
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS cost_usd_estimated numeric(12, 6);

-- Index pra agregações rápidas por modelo
CREATE INDEX IF NOT EXISTS naval_chats_model_used_idx
  ON public.naval_chats (model_used)
  WHERE model_used IS NOT NULL;

COMMENT ON COLUMN public.naval_chats.model_used IS
  'Modelo Anthropic real usado na chamada: ''haiku'' ou ''sonnet''. Gravado pelo wisely-ai v44+ baseado no detectModelTier que rodou.';

COMMENT ON COLUMN public.naval_chats.cost_usd_estimated IS
  'Custo USD calculado deterministicamente: tokens reais × tarifas Anthropic atuais. 6 casas decimais (microUSD). Agregar SUM() pra custo total. Multiplicar por câmbio USD→BRL na exibição.';
