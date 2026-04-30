-- Adiciona land_total_amount em constructions: total contratado do terreno
-- (independente de obra). Permite calcular % pago do terreno separadamente
-- do % executado da obra, gerando 2 barras de progresso no card.
--
-- Quando preenchido + houver lançamentos com expense_kind='terreno', o card
-- mostra: pago_terreno / land_total_amount × 100% = % terreno quitado.

ALTER TABLE constructions
  ADD COLUMN IF NOT EXISTS land_total_amount numeric(14,2);

COMMENT ON COLUMN constructions.land_total_amount IS
  'Valor total contratado do terreno (entrada + parcelas/cheques). Opcional. Quando preenchido, card calcula % pago = SUM(construction_expenses kind=terreno) / land_total_amount.';
