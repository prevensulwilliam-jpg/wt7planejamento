-- Adiciona expense_kind em construction_expenses pra separar
-- aquisição de TERRENO da execução da OBRA.
--
-- Por quê: hoje terreno (one-shot, valor fechado, parcelas pré-definidas)
-- e obra (fluxo, mão de obra, materiais variáveis) ficam misturados,
-- inflando "% executado" da obra com pagamento de terreno.
--
-- Modelo: 1 enum check ('obra' | 'terreno'), default 'obra' pra preservar
-- todos os lançamentos existentes. Lançamentos de terreno passam a ser
-- inseridos com kind='terreno'.

ALTER TABLE construction_expenses
  ADD COLUMN IF NOT EXISTS expense_kind text NOT NULL DEFAULT 'obra'
  CHECK (expense_kind IN ('obra', 'terreno'));

-- Tudo o que já existe é gasto de obra (mão de obra, materiais, terraplenagem
-- de execução). Backfill explícito pra eliminar NULLs caso a default não
-- tenha sido aplicada em ambientes que rodaram a migration parcial.
UPDATE construction_expenses
SET expense_kind = 'obra'
WHERE expense_kind IS NULL OR expense_kind = '';

-- Index pra acelerar filtros por kind dentro de uma obra (UI lê 1 dos 2)
CREATE INDEX IF NOT EXISTS idx_construction_expenses_construction_kind
  ON construction_expenses (construction_id, expense_kind);

COMMENT ON COLUMN construction_expenses.expense_kind IS
  'Tipo do gasto: obra (execução) ou terreno (aquisição). Default obra.';
