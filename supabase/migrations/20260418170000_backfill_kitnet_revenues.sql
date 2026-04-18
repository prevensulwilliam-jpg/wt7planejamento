-- Auto-link revenues de kitnet por padrão (source, descrição, nome inquilino)
-- Não duplica no cockpit — aggregation usa kitnet_entries como fonte da verdade
-- Revenues linkadas a KITNETS são só pra classificação/limpar banner de reconciliação

-- 1) Por source
UPDATE public.revenues
SET business_id = (SELECT id FROM public.businesses WHERE code = 'KITNETS')
WHERE business_id IS NULL
  AND lower(coalesce(source,'')) IN ('kitnets', 'kitnet', 'aluguel_kitnets', 'aluguel', 'alugueis');

-- 2) Por padrão de descrição (Repasse RWT, RWT0X-XX, etc)
UPDATE public.revenues
SET business_id = (SELECT id FROM public.businesses WHERE code = 'KITNETS')
WHERE business_id IS NULL
  AND (
    coalesce(description,'') ~* '(repasse\s?rwt|rwt\s?0\d[-\s]0\d|aluguel\s?kitnet|kitnet\s?0\d|residencial\s?w\.?\s?tavares)'
  );

-- 3) Por nome de inquilino ativo (varre tabela kitnets e faz match na description)
DO $$
DECLARE
  tenant_record RECORD;
  kitnets_biz_id uuid;
BEGIN
  SELECT id INTO kitnets_biz_id FROM public.businesses WHERE code = 'KITNETS';
  IF kitnets_biz_id IS NULL THEN RETURN; END IF;

  FOR tenant_record IN
    SELECT DISTINCT tenant_name FROM public.kitnets
    WHERE tenant_name IS NOT NULL AND length(trim(tenant_name)) >= 4
  LOOP
    UPDATE public.revenues
    SET business_id = kitnets_biz_id
    WHERE business_id IS NULL
      AND lower(coalesce(description,'')) LIKE '%' || lower(split_part(trim(tenant_record.tenant_name), ' ', 1)) || '%';
  END LOOP;
END $$;

-- 3b) Depósitos de Thiago/Cláudio Sergio Maba → sempre Prevensul
UPDATE public.revenues
SET business_id = (SELECT id FROM public.businesses WHERE code = 'PREVENSUL')
WHERE business_id IS NULL
  AND (
    lower(coalesce(description,'')) ~ '(thiago\s+sergio\s+maba|thiago\s+maba|claudio\s+sergio\s+maba|cláudio\s+sergio\s+maba|claudio\s+maba|cláudio\s+maba)'
  );

-- 4) Confere resultados de abril
SELECT
  (SELECT COUNT(*) FROM public.revenues WHERE reference_month = '2026-04' AND business_id IS NULL) AS sem_vinculo_count,
  (SELECT COALESCE(SUM(amount), 0) FROM public.revenues WHERE reference_month = '2026-04' AND business_id IS NULL) AS sem_vinculo_total,
  (SELECT COALESCE(SUM(amount), 0) FROM public.revenues WHERE reference_month = '2026-04') AS total_mes;
