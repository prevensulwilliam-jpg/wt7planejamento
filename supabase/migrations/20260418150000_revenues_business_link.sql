-- Liga revenues -> businesses para agregação automática
-- Kitnets continuam via kitnet_entries (caso especial).

ALTER TABLE public.revenues
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_revenues_business_month
  ON public.revenues (business_id, reference_month DESC);

-- Backfill best-effort por palavras-chave no source/description
-- Prevensul: salario/comissao/adiantamento/pluxee
UPDATE public.revenues
SET business_id = (SELECT id FROM public.businesses WHERE code = 'PREVENSUL')
WHERE business_id IS NULL
  AND (
    lower(coalesce(source,'')) ~ '(prevensul|salario|comiss|adianta|pluxee)' OR
    lower(coalesce(description,'')) ~ '(prevensul|salario|comiss|adianta|pluxee)'
  );

-- CW7
UPDATE public.revenues
SET business_id = (SELECT id FROM public.businesses WHERE code = 'CW7')
WHERE business_id IS NULL
  AND (
    lower(coalesce(source,'')) ~ '(cw7|q7\s?solar|q7energia|energia\s?solar)' OR
    lower(coalesce(description,'')) ~ '(cw7|q7\s?solar|q7energia)'
  );

-- T7
UPDATE public.revenues
SET business_id = (SELECT id FROM public.businesses WHERE code = 'T7')
WHERE business_id IS NULL
  AND (
    lower(coalesce(source,'')) ~ '(^t7|t7\s?sales|t7service)' OR
    lower(coalesce(description,'')) ~ '(^t7|t7\s?sales|t7service)'
  );

COMMENT ON COLUMN public.revenues.business_id IS
  'FK para businesses. Usado para agregar receita realizada por negócio no cockpit estratégico.';
