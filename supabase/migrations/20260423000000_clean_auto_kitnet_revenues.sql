-- Limpeza de receitas auto-geradas a partir de fechamentos de kitnet.
-- Fechamento NÃO é mais fonte de receita — receita vem do extrato bancário ou lançamento manual.
--
-- Estratégia conservadora:
--   1. Identifica receitas com padrão auto-gerado: source='kitnets' E description LIKE 'Repasse RWT%'
--   2. Apaga SÓ as que têm gêmeo do extrato no mesmo mês e mesmo valor
--      (ou seja, duplicatas confirmadas). As "Repasse" isoladas ficam pro William decidir.
--
-- Passo 1: ver as candidatas antes de rodar o DELETE
-- Descomenta pra listar:
/*
SELECT r.id, r.description, r.amount, r.reference_month, r.received_at,
       (SELECT COUNT(*) FROM public.revenues r2
         WHERE r2.source <> 'kitnets'
           AND r2.amount = r.amount
           AND r2.reference_month = r.reference_month) AS extrato_match
FROM public.revenues r
WHERE r.source = 'kitnets'
  AND r.description LIKE 'Repasse RWT%'
ORDER BY r.reference_month DESC, r.amount DESC;
*/

-- Passo 2: DELETE das duplicatas confirmadas
-- Apaga receita "Repasse RWT*" quando existe outra revenue (não-kitnets) com mesmo valor e mesmo mês.
DELETE FROM public.revenues r
WHERE r.source = 'kitnets'
  AND r.description LIKE 'Repasse RWT%'
  AND EXISTS (
    SELECT 1 FROM public.revenues r2
    WHERE r2.id <> r.id
      AND r2.source <> 'kitnets'
      AND r2.amount = r.amount
      AND r2.reference_month = r.reference_month
  );

-- Receitas "Repasse RWT*" que NÃO têm gêmeo do extrato ficam preservadas.
-- William pode revisar manualmente em /revenues com filtro source='kitnets'.
