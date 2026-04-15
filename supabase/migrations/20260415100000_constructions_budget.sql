-- ============================================================
-- Constructions Budget — orçamento por obra e etapa
-- ============================================================

-- 1. Orçamento total da obra
ALTER TABLE public.constructions
  ADD COLUMN IF NOT EXISTS total_budget numeric(14,2);

-- 2. Orçamento previsto por etapa
ALTER TABLE public.construction_stages
  ADD COLUMN IF NOT EXISTS budget_estimated numeric(14,2);

-- 3. Vínculo da despesa com etapa
ALTER TABLE public.construction_expenses
  ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.construction_stages(id) ON DELETE SET NULL;
