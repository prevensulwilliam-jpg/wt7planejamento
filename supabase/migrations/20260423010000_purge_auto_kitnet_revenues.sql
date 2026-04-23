-- Limpeza DEFINITIVA de receitas auto-geradas por fechamento de kitnet.
-- Regra canônica (a partir de 23/04/2026):
--   - Fechamento de kitnet NUNCA gera receita.
--   - Receita de aluguel vem APENAS de: extrato bancário importado OU lançamento manual em /revenues.
--
-- Padrão do legado auto-gerado:
--   source      = 'kitnets'
--   description LIKE 'Repasse RWT%'   (prefixo criado pelo código antigo)
--
-- Segurança:
--   - FK bank_transactions.matched_revenue_id já é ON DELETE SET NULL (migration 20260418180000)
--     → apagar essas revenues só desfaz o match; a transação bancária volta pra fila de conciliação.
--   - Apaga TODAS as receitas no padrão, tenham ou não gêmeo no extrato.
--     Se faltar receita correspondente, o extrato continua lá pra importar depois.
--
-- Idempotente: rodar de novo só retorna 0 linhas afetadas.

BEGIN;

-- (Opcional) Preview antes do DELETE. Descomente pra conferir:
-- SELECT id, reference_month, description, amount, received_at
--   FROM public.revenues
--  WHERE source = 'kitnets'
--    AND description LIKE 'Repasse RWT%'
--  ORDER BY reference_month DESC, description;

-- DELETE definitivo
WITH deleted AS (
  DELETE FROM public.revenues
   WHERE source = 'kitnets'
     AND description LIKE 'Repasse RWT%'
  RETURNING id
)
SELECT COUNT(*) AS receitas_apagadas FROM deleted;

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- Prevenção pra casos futuros: trigger que BLOQUEIA qualquer INSERT
-- no padrão "source='kitnets' AND description LIKE 'Repasse %'".
-- Se algum código antigo tentar reinserir, a transação aborta com erro claro.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_auto_kitnet_revenue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source = 'kitnets' AND NEW.description LIKE 'Repasse %' THEN
    RAISE EXCEPTION 'Receita auto-gerada por fechamento de kitnet foi removida do sistema. Use extrato bancário ou lançamento manual em /revenues. (description: %)', NEW.description
      USING HINT = 'Se quiser lançar manualmente um repasse de kitnet, use outro prefixo na descrição (ex: "Aluguel RWT02-01 Jorge").';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_auto_kitnet_revenue ON public.revenues;
CREATE TRIGGER trg_block_auto_kitnet_revenue
  BEFORE INSERT ON public.revenues
  FOR EACH ROW EXECUTE FUNCTION public.block_auto_kitnet_revenue();
