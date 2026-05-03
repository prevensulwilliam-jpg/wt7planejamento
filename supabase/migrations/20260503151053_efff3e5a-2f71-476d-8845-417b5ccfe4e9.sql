ALTER TABLE public.naval_chats
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS cost_usd_estimated numeric(12, 6);

CREATE INDEX IF NOT EXISTS naval_chats_model_used_idx
  ON public.naval_chats (model_used)
  WHERE model_used IS NOT NULL;

COMMENT ON COLUMN public.naval_chats.model_used IS
  'Modelo Anthropic real usado na chamada: ''haiku'' ou ''sonnet''. Gravado pelo wisely-ai v44+ baseado no detectModelTier que rodou.';

COMMENT ON COLUMN public.naval_chats.cost_usd_estimated IS
  'Custo USD calculado deterministicamente: tokens reais × tarifas Anthropic atuais. 6 casas decimais (microUSD). Agregar SUM() pra custo total. Multiplicar por câmbio USD→BRL na exibição.';