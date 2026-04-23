-- Re-reconciliação automática após o reset over-agressivo de 20260423030000.
-- O reset anterior limpou status+kitnet_entry_id de 198 transações, mas muitas eram
-- matches legítimos de DESPESAS (matched_expense_id) ou receitas não-kitnet.
--
-- Esta migration tenta re-casar automaticamente o que é unívoco:
--   1. Crédito pending → revenue mesmo valor + mesmo reference_month (1-to-1)
--   2. Crédito pending → kitnet_entry mesmo total_liquid + mesmo reference_month (1-to-1)
--   3. Débito pending  → expense mesmo valor + mesmo mês da data (1-to-1)
--
-- Só re-casa quando o match é ÚNICO (evita casar errado se tem 2 extratos do mesmo valor).
-- O que sobrar ambíguo fica pending pra conciliação manual.

BEGIN;

-- ══════════════════════════════════════════════════════════════════
-- 1. RE-MATCH CRÉDITOS × KITNET_ENTRIES (aluguéis de kitnet)
-- ══════════════════════════════════════════════════════════════════
WITH candidatos AS (
  SELECT bt.id AS bt_id, ke.id AS ke_id,
         ke.kitnet_id,
         k.code AS kitnet_code,
         k.tenant_name,
         COUNT(*) OVER (PARTITION BY ROUND(bt.amount::numeric,2), to_char(bt.date,'YYYY-MM')) AS bt_dupes,
         COUNT(*) OVER (PARTITION BY ROUND(ke.total_liquid::numeric,2), ke.reference_month) AS ke_dupes
    FROM public.bank_transactions bt
    JOIN public.kitnet_entries ke
      ON ROUND(ke.total_liquid::numeric,2) = ROUND(bt.amount::numeric,2)
     AND ke.reference_month = to_char(bt.date, 'YYYY-MM')
    JOIN public.kitnets k ON k.id = ke.kitnet_id
   WHERE bt.status = 'pending'
     AND bt.type   = 'credit'
     AND bt.kitnet_entry_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.bank_transactions bt2
       WHERE bt2.kitnet_entry_id = ke.id AND bt2.status = 'matched'
     )
),
univocos AS (
  SELECT * FROM candidatos WHERE bt_dupes = 1 AND ke_dupes = 1
),
upd_ke AS (
  UPDATE public.bank_transactions bt
     SET status             = 'matched',
         kitnet_entry_id    = u.ke_id,
         category_confirmed = 'aluguel_kitnets',
         category_intent    = 'receita',
         category_label     = u.kitnet_code || ' - ' || COALESCE(u.tenant_name,'')
    FROM univocos u
   WHERE bt.id = u.bt_id
  RETURNING bt.id
)
SELECT COUNT(*) AS credits_matched_to_kitnets FROM upd_ke;

-- ══════════════════════════════════════════════════════════════════
-- 2. RE-MATCH CRÉDITOS × REVENUES (receitas manuais + comissões etc)
-- ══════════════════════════════════════════════════════════════════
WITH candidatos AS (
  SELECT bt.id AS bt_id, r.id AS r_id,
         r.source, r.description,
         COUNT(*) OVER (PARTITION BY ROUND(bt.amount::numeric,2), to_char(bt.date,'YYYY-MM')) AS bt_dupes,
         COUNT(*) OVER (PARTITION BY ROUND(r.amount::numeric,2),  r.reference_month) AS r_dupes
    FROM public.bank_transactions bt
    JOIN public.revenues r
      ON ROUND(r.amount::numeric,2) = ROUND(bt.amount::numeric,2)
     AND r.reference_month = to_char(bt.date, 'YYYY-MM')
   WHERE bt.status = 'pending'
     AND bt.type   = 'credit'
     AND bt.matched_revenue_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.bank_transactions bt2
       WHERE bt2.matched_revenue_id = r.id AND bt2.status = 'matched'
     )
),
univocos AS (
  SELECT * FROM candidatos WHERE bt_dupes = 1 AND r_dupes = 1
),
upd_r AS (
  UPDATE public.bank_transactions bt
     SET status             = 'matched',
         matched_revenue_id = u.r_id,
         category_confirmed = COALESCE(bt.category_confirmed, u.source),
         category_intent    = 'receita'
    FROM univocos u
   WHERE bt.id = u.bt_id
  RETURNING bt.id
)
SELECT COUNT(*) AS credits_matched_to_revenues FROM upd_r;

-- ══════════════════════════════════════════════════════════════════
-- 3. RE-MATCH DÉBITOS × EXPENSES
-- ══════════════════════════════════════════════════════════════════
WITH candidatos AS (
  SELECT bt.id AS bt_id, e.id AS e_id,
         e.description,
         COUNT(*) OVER (PARTITION BY ROUND(bt.amount::numeric,2), to_char(bt.date,'YYYY-MM')) AS bt_dupes,
         COUNT(*) OVER (PARTITION BY ROUND(e.amount::numeric,2),  e.reference_month) AS e_dupes
    FROM public.bank_transactions bt
    JOIN public.expenses e
      ON ROUND(e.amount::numeric,2) = ROUND(ABS(bt.amount)::numeric,2)
     AND e.reference_month = to_char(bt.date, 'YYYY-MM')
   WHERE bt.status = 'pending'
     AND bt.type   = 'debit'
     AND bt.matched_expense_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.bank_transactions bt2
       WHERE bt2.matched_expense_id = e.id AND bt2.status = 'matched'
     )
),
univocos AS (
  SELECT * FROM candidatos WHERE bt_dupes = 1 AND e_dupes = 1
),
upd_e AS (
  UPDATE public.bank_transactions bt
     SET status             = 'matched',
         matched_expense_id = u.e_id,
         category_intent    = 'despesa'
    FROM univocos u
   WHERE bt.id = u.bt_id
  RETURNING bt.id
)
SELECT COUNT(*) AS debits_matched_to_expenses FROM upd_e;

-- ══════════════════════════════════════════════════════════════════
-- 4. Resumo do estado atual
-- ══════════════════════════════════════════════════════════════════
SELECT
  COUNT(*) FILTER (WHERE status = 'pending' AND type = 'credit') AS creditos_pendentes,
  COUNT(*) FILTER (WHERE status = 'pending' AND type = 'debit')  AS debitos_pendentes,
  COUNT(*) FILTER (WHERE status = 'matched')                     AS matched_total
FROM public.bank_transactions;

COMMIT;
