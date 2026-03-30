
-- Remover receitas duplicadas (mantém a mais antiga por created_at)
CREATE OR REPLACE FUNCTION public.clean_duplicate_revenues()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
DELETE FROM revenues
WHERE id NOT IN (
  SELECT DISTINCT ON (description, reference_month, amount, source) id
  FROM revenues
  ORDER BY description, reference_month, amount, source, created_at ASC
);
$$;

-- Remover despesas duplicadas (mantém a mais antiga por created_at)
CREATE OR REPLACE FUNCTION public.clean_duplicate_expenses()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
DELETE FROM expenses
WHERE id NOT IN (
  SELECT DISTINCT ON (description, reference_month, amount, category) id
  FROM expenses
  ORDER BY description, reference_month, amount, category, created_at ASC
);
$$;
