-- ═══════════════════════════════════════════════════════════════════
-- Reformula meta dos negócios: de "Meta 12 meses (acumulado)" para
-- "Meta MENSAL alvo numa data específica".
--
-- Antes:
--   target_12m = 480.000  (interpretação ambígua: anual? mensal × 12?)
--
-- Depois:
--   target_year_end      = 50.000     (R$/mês alvo)
--   target_year_end_date = 2026-12-31 (data alvo da meta mensal)
--
-- KPI Acumulado YTD passa a ser CALCULADO (sum revenues YTD vs sum
-- monthly_target × meses_decorridos), não mais cadastrado.
--
-- Quando target_year_end_date passar, sistema dispara alerta pra
-- William cadastrar próxima meta (ex: dez/27).
-- ═══════════════════════════════════════════════════════════════════

-- 1) Adiciona data alvo (default fim de 2026)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS target_year_end_date DATE DEFAULT '2026-12-31';

-- 2) Renomeia coluna semântica
ALTER TABLE businesses
  RENAME COLUMN target_12m TO target_year_end;

COMMENT ON COLUMN businesses.target_year_end IS
  'Meta MENSAL alvo (R$/mês) para a data target_year_end_date. NÃO é acumulado anual.';

COMMENT ON COLUMN businesses.target_year_end_date IS
  'Data alvo da meta mensal. Geralmente fim do ano fiscal. Quando passa, William cadastra próximo alvo.';

-- 3) Customizar T7 pra dez/2027 (TDI rampa até lá, conforme metas.md)
UPDATE businesses
SET target_year_end_date = '2027-12-31'
WHERE code = 'T7';
