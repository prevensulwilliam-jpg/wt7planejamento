-- Purge v2 — cobre AMBOS os sources usados historicamente pra repasse de kitnet:
--   - 'kitnets'          (padrão antigo, criado pelo hook useCreateKitnetEntry)
--   - 'aluguel_kitnets'  (padrão atual, usado pela conciliação)
--
-- Também amplia o trigger pra bloquear reinserção em qualquer um dos dois sources.
-- Idempotente: rodar de novo não quebra.

BEGIN;

-- Preview opcional (descomenta pra ver antes):
-- SELECT id, source, reference_month, description, amount, received_at
--   FROM public.revenues
--  WHERE source IN ('kitnets','aluguel_kitnets')
--    AND description LIKE 'Repasse %'
--  ORDER BY reference_month DESC, description;

-- DELETE definitivo cobrindo os dois sources
WITH deleted AS (
  DELETE FROM public.revenues
   WHERE source IN ('kitnets','aluguel_kitnets')
     AND description LIKE 'Repasse %'
  RETURNING id, source, description
)
SELECT COUNT(*) AS receitas_apagadas,
       COUNT(*) FILTER (WHERE source = 'kitnets')         AS src_kitnets,
       COUNT(*) FILTER (WHERE source = 'aluguel_kitnets') AS src_aluguel_kitnets
  FROM deleted;

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- Trigger de bloqueio ampliado (substitui o anterior)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_auto_kitnet_revenue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source IN ('kitnets','aluguel_kitnets')
     AND NEW.description LIKE 'Repasse %' THEN
    RAISE EXCEPTION 'Receita auto-gerada por fechamento de kitnet foi removida do sistema. Use extrato bancário ou lançamento manual em /revenues. (source=%, description=%)', NEW.source, NEW.description
      USING HINT = 'Pra lançar repasse manualmente, use outro prefixo (ex: "Aluguel RWT02-01 Jorge") ou um source diferente.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_auto_kitnet_revenue ON public.revenues;
CREATE TRIGGER trg_block_auto_kitnet_revenue
  BEFORE INSERT ON public.revenues
  FOR EACH ROW EXECUTE FUNCTION public.block_auto_kitnet_revenue();
