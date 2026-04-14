-- Cria alertas retroativos para fechamentos com total_liquid = 0
-- Apenas insere se não existe alerta já criado para o par (kitnet_id, source_month)
-- Requer: tabela kitnet_alerts já existente (migration 20260413300000)

INSERT INTO kitnet_alerts (kitnet_id, source_entry_id, alert_month, source_month, pending_amount, alert_type, resolved)
SELECT
  ke.kitnet_id,
  ke.id,
  -- Mês seguinte ao fechamento zerado
  TO_CHAR(TO_DATE(ke.reference_month, 'YYYY-MM') + INTERVAL '1 month', 'YYYY-MM'),
  ke.reference_month,
  COALESCE(k.rent_value, 0),
  'pending_balance',
  false
FROM kitnet_entries ke
JOIN kitnets k ON k.id = ke.kitnet_id
WHERE ke.total_liquid = 0
  AND COALESCE(k.rent_value, 0) > 0
  AND k.status = 'occupied'
  AND NOT EXISTS (
    SELECT 1 FROM kitnet_alerts ka
    WHERE ka.kitnet_id = ke.kitnet_id
      AND ka.source_month = ke.reference_month
      AND ka.resolved = false
  );
