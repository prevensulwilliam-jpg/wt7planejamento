-- ═══════════════════════════════════════════════════════════════════
-- Auto-detect e neutralização de pares PIX estornado
--
-- Problema: quando um PIX é estornado pelo banco, o extrato OFX traz
-- 2 lançamentos: 1 débito original + 1 crédito ESTORNO. Sem tratamento,
-- o débito gera um expense fantasma e o crédito é só ignored — saldo
-- líquido zero, mas a despesa do mês fica inflada.
--
-- Solução:
--   1. Trigger BEFORE INSERT em bank_transactions:
--      - Se a NOVA tx é CRÉDITO + descrição contém "ESTORNO":
--        → procura DÉBITO ativo de mesmo valor em ±7 dias na mesma conta
--        → se achar EXATAMENTE 1 candidato (sem ambiguidade):
--          - marca ambos como status='ignored'
--          - deleta o expense que o débito gerou (matched_expense_id)
--      - Se houver 0 ou >1 candidatos: deixa para revisão manual
--
--   2. Backfill: aplica a mesma regra retroativamente em bank_tx
--      já existentes que tenham descrição "ESTORNO" e status != 'ignored'
--      OU cujo débito-par ainda esteja ativo.
--
-- Idempotente: rodar várias vezes não duplica efeitos (filtros por
-- status NOT 'ignored' garantem isso).
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1) Função de detecção de par estornado ───
CREATE OR REPLACE FUNCTION public.detect_estorno_pair()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate_count INT;
  v_debit_id UUID;
  v_expense_id UUID;
BEGIN
  -- Só processa CRÉDITO com palavra "estorno" na descrição
  IF NEW.type IS DISTINCT FROM 'credit' OR NEW.description IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.description !~* 'estorno' THEN
    RETURN NEW;
  END IF;

  -- Conta débitos ativos candidatos (mesmo valor, mesma conta, ±7 dias)
  SELECT COUNT(*)
  INTO v_candidate_count
  FROM bank_transactions
  WHERE bank_account_id IS NOT DISTINCT FROM NEW.bank_account_id
    AND amount = NEW.amount
    AND type = 'debit'
    AND status IS DISTINCT FROM 'ignored'
    AND date BETWEEN (NEW.date::date - INTERVAL '7 days')
                 AND (NEW.date::date + INTERVAL '7 days');

  -- Ambiguidade ou ausência → não automatiza, deixa pro William
  IF v_candidate_count != 1 THEN
    RETURN NEW;
  END IF;

  -- Pega o débito candidato (único)
  SELECT id, matched_expense_id
  INTO v_debit_id, v_expense_id
  FROM bank_transactions
  WHERE bank_account_id IS NOT DISTINCT FROM NEW.bank_account_id
    AND amount = NEW.amount
    AND type = 'debit'
    AND status IS DISTINCT FROM 'ignored'
    AND date BETWEEN (NEW.date::date - INTERVAL '7 days')
                 AND (NEW.date::date + INTERVAL '7 days')
  LIMIT 1;

  -- 1) Marca o CRÉDITO entrante como ignored (BEFORE INSERT — só edita NEW)
  NEW.status := 'ignored';

  -- 2) Marca o DÉBITO existente como ignored + remove vínculo
  UPDATE bank_transactions
  SET status = 'ignored',
      matched_expense_id = NULL
  WHERE id = v_debit_id;

  -- 3) Deleta o expense gerado (despesa fantasma)
  IF v_expense_id IS NOT NULL THEN
    DELETE FROM expenses WHERE id = v_expense_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.detect_estorno_pair() IS
'Auto-neutraliza par PIX estornado: débito + crédito ESTORNO viram ignored, expense fantasma é deletado. Só atua em ambiguidade zero (1 candidato exato).';

-- ─── 2) Trigger BEFORE INSERT em bank_transactions ───
DROP TRIGGER IF EXISTS trg_detect_estorno_on_insert ON bank_transactions;
CREATE TRIGGER trg_detect_estorno_on_insert
BEFORE INSERT ON bank_transactions
FOR EACH ROW
EXECUTE FUNCTION public.detect_estorno_pair();

-- ─── 3) Backfill: processa estornos já existentes no banco ───
-- Para cada bank_tx CRÉDITO com "ESTORNO" na descrição que ainda esteja
-- ativa (status != ignored) OU cujo débito-par ainda gere expense:
--   roda a mesma lógica do trigger (mas via UPDATE ao invés de TG NEW).
DO $$
DECLARE
  estorno_rec RECORD;
  v_candidate_count INT;
  v_debit_id UUID;
  v_expense_id UUID;
  v_processed INT := 0;
BEGIN
  FOR estorno_rec IN
    SELECT id, bank_account_id, amount, date, status
    FROM bank_transactions
    WHERE type = 'credit'
      AND description IS NOT NULL
      AND description ~* 'estorno'
    ORDER BY date
  LOOP
    -- Conta candidatos do débito-par
    SELECT COUNT(*)
    INTO v_candidate_count
    FROM bank_transactions
    WHERE bank_account_id IS NOT DISTINCT FROM estorno_rec.bank_account_id
      AND amount = estorno_rec.amount
      AND type = 'debit'
      AND status IS DISTINCT FROM 'ignored'
      AND date BETWEEN (estorno_rec.date::date - INTERVAL '7 days')
                   AND (estorno_rec.date::date + INTERVAL '7 days');

    -- Skip se 0 ou >1 (ambiguidade) ou se já está tudo ignored
    IF v_candidate_count != 1 THEN
      CONTINUE;
    END IF;

    SELECT id, matched_expense_id
    INTO v_debit_id, v_expense_id
    FROM bank_transactions
    WHERE bank_account_id IS NOT DISTINCT FROM estorno_rec.bank_account_id
      AND amount = estorno_rec.amount
      AND type = 'debit'
      AND status IS DISTINCT FROM 'ignored'
      AND date BETWEEN (estorno_rec.date::date - INTERVAL '7 days')
                   AND (estorno_rec.date::date + INTERVAL '7 days')
    LIMIT 1;

    -- Marca crédito estorno como ignored (se ainda não)
    IF estorno_rec.status IS DISTINCT FROM 'ignored' THEN
      UPDATE bank_transactions
      SET status = 'ignored'
      WHERE id = estorno_rec.id;
    END IF;

    -- Marca débito como ignored e remove link
    UPDATE bank_transactions
    SET status = 'ignored',
        matched_expense_id = NULL
    WHERE id = v_debit_id;

    -- Deleta expense fantasma
    IF v_expense_id IS NOT NULL THEN
      DELETE FROM expenses WHERE id = v_expense_id;
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RAISE NOTICE 'Backfill estorno: % pares neutralizados', v_processed;
END $$;
