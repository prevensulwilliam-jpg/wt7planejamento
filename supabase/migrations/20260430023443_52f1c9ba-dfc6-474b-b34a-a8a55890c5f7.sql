ALTER TABLE constructions
  ADD COLUMN IF NOT EXISTS land_total_amount numeric(14,2);

COMMENT ON COLUMN constructions.land_total_amount IS
  'Valor total contratado do terreno (entrada + parcelas/cheques). Opcional. Quando preenchido, card calcula % pago = SUM(construction_expenses kind=terreno) / land_total_amount.';