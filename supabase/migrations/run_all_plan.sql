-- ════════════════════════════════════════════════════════════════════════
-- CONCATENADO — rodar 1× no Lovable SQL Editor
-- Ordem: 020 round_amounts → 030 plan_items → 040 adjustments → 050 receitas
-- Idempotente: pode rodar de novo sem quebrar (ON CONFLICT DO NOTHING + IF NOT EXISTS)
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- [020] FIX FLOAT PRECISION
-- ════════════════════════════════════════════════════════════════════════
UPDATE public.revenues            SET amount = ROUND(amount::numeric, 2) WHERE amount IS NOT NULL;
UPDATE public.expenses            SET amount = ROUND(amount::numeric, 2) WHERE amount IS NOT NULL;
UPDATE public.bank_transactions   SET amount = ROUND(amount::numeric, 2) WHERE amount IS NOT NULL;
UPDATE public.card_transactions   SET amount = ROUND(amount::numeric, 2) WHERE amount IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════
-- [030] CRIA plan_items + SEEDS INICIAIS (obras, viagens, casamento placeholder)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,
  kind text NOT NULL,
  category text,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  is_revenue boolean NOT NULL DEFAULT false,
  notes text,
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_items_kind_check') THEN
    ALTER TABLE public.plan_items
      ADD CONSTRAINT plan_items_kind_check
      CHECK (kind IN ('obra','viagem','casamento','custo_fixo','receita_travada','receita_projetada','imposto','outro'));
  END IF;
END$$;

ALTER TABLE public.plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read plan_items" ON public.plan_items;
CREATE POLICY "admin read plan_items" ON public.plan_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin modify plan_items" ON public.plan_items;
CREATE POLICY "admin modify plan_items" ON public.plan_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_plan_items_month ON public.plan_items(month);
CREATE INDEX IF NOT EXISTS idx_plan_items_kind ON public.plan_items(kind);

INSERT INTO public.plan_items (month, kind, category, description, amount, locked, notes) VALUES
  ('2027-12','obra','jw7_sonho_f1','JW7 Praia do Sonho — Fase 1 (cota W, pagar ao Jairo)', 85000.00, true,  'Cota total R$150k sobre obra de R$300k; já gastos R$52k (metade cada). Diluir ao longo de 2026.'),
  ('2028-06','obra','jw7_sonho_f2','JW7 Praia do Sonho — Fase 2 (cota W)',                  150000.00, false, 'Início jan/2028, entrega meio de 2028. Total R$300k 50/50.'),
  ('2026-12','obra','rwt05_f1',     'RWT05 & Corrêa — Fase 1 (cota W c/ mobília)',            62500.00, false, 'Total R$130k (50/50 com Walmir). Mão de obra já contratada R$40k. Já gastos ~R$2,5k cota.'),
  ('2027-12','obra','rwt05_f2',     'RWT05 & Corrêa — Fase 2 (cota W)',                        50000.00, false, 'Início set/2027. Total R$100k 50/50.'),
  ('2027-12','obra','jw7_itaipava', 'JW7 Itaipava — cota W (50%)',                            175000.00, false, 'Início 2027, entrega fim 2027. Total R$350k 50/50.'),
  ('2027-12','obra','rwt04',        'RWT04 — construção solo (caixa próprio)',                350000.00, false, 'Início 2027, entrega fim 2027. 100% William. ALERTA: pesado, requer T7 estourar pra caber.'),
  ('2026-06','viagem','eua',        'EUA (19/jun → 04/jul 2026, 2 semanas)',                   20000.00, false, 'Já tem USD 2.500 guardados; gasto adicional estimado R$15-20k.'),
  ('2027-03','viagem','china_japao','China + Japão com Camila',                                50000.00, false, 'Viagem âncora antes do casamento.'),
  ('2027-12','casamento','casamento','Casamento 11/12/2027 Villa Sonali BC (placeholder)',      80000.00, false, 'AJUSTAR: valor exato virá do módulo /wedding. Placeholder conservador.')
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════
-- [040] AJUSTES pós-entrevista bloco 2 (casamento real + IR + custo vida + Rampage)
-- ════════════════════════════════════════════════════════════════════════
UPDATE public.plan_items
   SET amount = 150378.00,
       description = 'Casamento 11/12/2027 — a desembolsar (Villa R$78.488 + extras R$71.890)',
       notes = 'Orçamento total R$170k; já pagos R$19.622 (fora do plano, já em expenses). Detalhe completo em /wedding.'
 WHERE kind = 'casamento' AND category = 'casamento';

INSERT INTO public.plan_items (month, kind, category, description, amount, locked, notes) VALUES
  ('2026-04','imposto','ir_anual','IR Pessoa Física 2026 (placeholder)', 25000.00, false, 'Estimativa conservadora. Validar com DIRPF real.'),
  ('2027-04','imposto','ir_anual','IR Pessoa Física 2027 (placeholder)', 30000.00, false, 'Estimativa com crescimento receita (Prevensul + aluguéis novos).'),
  ('2028-04','imposto','ir_anual','IR Pessoa Física 2028 (placeholder)', 35000.00, false, 'Estimativa considerando T7/TDI maduro.')
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_items (month, kind, category, description, amount, locked, notes) VALUES
  ('2026-12','custo_fixo','custo_vida','Custo de vida 2026 — abr-dez (9 × R$ 43.816)', 394344.00, false, 'Base abr/2026. Sem inflação no ano corrente.'),
  ('2027-12','custo_fixo','custo_vida','Custo de vida 2027 (12 × R$ 45.787, IPCA 4,5%)', 549444.00, false, 'Inflação IPCA média 2024-2025 = 4,5% a.a.'),
  ('2028-12','custo_fixo','custo_vida','Custo de vida 2028 (12 × R$ 47.848, IPCA 9,2% acum)', 574176.00, false, 'Inflação composta 2 anos a 4,5% a.a.')
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_items (month, kind, category, description, amount, is_revenue, locked, notes) VALUES
  ('2028-06','receita_projetada','venda_rampage','Venda Rampage (sem compra carro novo até metade 2028)',
   134800.00, true, false,
   'Valor líquido estimado (memoria/metas.md). Sem data exata — William pretende vender até metade de 2028, sem reposição.')
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════
-- [050] RECEITAS PROJETADAS (aluguéis novos + T7/TDI + Prevensul pipeline + aluguéis atuais)
-- ════════════════════════════════════════════════════════════════════════

-- 1. Aluguéis novos RWT05 F1 + JW7 Sonho F1 — jan/27 → dez/28
INSERT INTO public.plan_items (month, kind, category, description, amount, is_revenue, locked, notes) VALUES
  ('2027-01','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, 'William confirmou +R$8.750/mês total cota W a partir de jan/27.'),
  ('2027-02','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2027-03','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2027-04','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2027-05','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2027-06','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2027-07','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2027-08','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2027-09','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2027-10','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2027-11','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2027-12','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2028-01','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2028-02','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2028-03','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2028-04','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2028-05','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2028-06','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2028-07','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2028-08','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2028-09','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2028-10','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2028-11','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null),
  ('2028-12','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, null)
ON CONFLICT DO NOTHING;

-- 2. T7/TDI ← TIM — base jul/26, 12%/mês até dez/27, 5%/mês em 2028
INSERT INTO public.plan_items (month, kind, category, description, amount, is_revenue, locked, notes) VALUES
  ('2026-07','receita_projetada','t7_tdi','T7/TDI ← TIM (base)',     10000.00, true, false, 'Premissa: 12%/mês composto até dez/27; 5%/mês em 2028. Revisar quando 1º mês real fechar.'),
  ('2026-08','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     11200.00, true, false, null),
  ('2026-09','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     12544.00, true, false, null),
  ('2026-10','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     14049.00, true, false, null),
  ('2026-11','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     15735.00, true, false, null),
  ('2026-12','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     17623.00, true, false, null),
  ('2027-01','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     19738.00, true, false, null),
  ('2027-02','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     22107.00, true, false, null),
  ('2027-03','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     24760.00, true, false, null),
  ('2027-04','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     27731.00, true, false, null),
  ('2027-05','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     31058.00, true, false, null),
  ('2027-06','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     34785.00, true, false, null),
  ('2027-07','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     38960.00, true, false, null),
  ('2027-08','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     43635.00, true, false, null),
  ('2027-09','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     48871.00, true, false, null),
  ('2027-10','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     54736.00, true, false, null),
  ('2027-11','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     61305.00, true, false, null),
  ('2027-12','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',     68662.00, true, false, 'Piso da faixa MD R$70-150k.'),
  ('2028-01','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',      72095.00, true, false, 'Desaceleração 2028: saturação do contrato TIM.'),
  ('2028-02','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',      75700.00, true, false, null),
  ('2028-03','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',      79485.00, true, false, null),
  ('2028-04','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',      83459.00, true, false, null),
  ('2028-05','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',      87632.00, true, false, null),
  ('2028-06','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',      92014.00, true, false, null),
  ('2028-07','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',      96615.00, true, false, null),
  ('2028-08','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',     101446.00, true, false, null),
  ('2028-09','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',     106518.00, true, false, null),
  ('2028-10','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',     111844.00, true, false, null),
  ('2028-11','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',     117436.00, true, false, null),
  ('2028-12','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',     123308.00, true, false, null)
ON CONFLICT DO NOTHING;

-- 3. Prevensul pipeline contratado — R$272.105 em 24 meses (abr/26 → mar/28)
INSERT INTO public.plan_items (month, kind, category, description, amount, is_revenue, locked, notes) VALUES
  ('2026-04','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, 'R$272.105 contratado abr/26; dilui 24 meses. 75% Grand Food. Revisar conforme cada obra paga.'),
  ('2026-05','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2026-06','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2026-07','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2026-08','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2026-09','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2026-10','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2026-11','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2026-12','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2027-01','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2027-02','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2027-03','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2027-04','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2027-05','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2027-06','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2027-07','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2027-08','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2027-09','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2027-10','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2027-11','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2027-12','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2028-01','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2028-02','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11338.00, true, true, null),
  ('2028-03','receita_travada','prevensul_pipeline','Prevensul comissão contratada (média mensal)', 11337.00, true, true, 'último mês do pipeline atual — fecha R$272.105.')
ON CONFLICT DO NOTHING;

-- 4. Aluguéis atuais recorrentes (RWT02 + RWT03) — R$20k/mês, 33 meses
INSERT INTO public.plan_items (month, kind, category, description, amount, is_revenue, locked, notes)
SELECT
  to_char(d, 'YYYY-MM') as month,
  'receita_travada' as kind,
  'aluguel_atual' as category,
  'Aluguéis RWT02 (8) + RWT03 (5) — recorrente' as description,
  20000.00 as amount,
  true as is_revenue,
  true as locked,
  'Base abr/2026. Ajustar se houver vacância ou reajuste IGP-M.' as notes
FROM generate_series('2026-04-01'::date, '2028-12-01'::date, '1 month'::interval) d
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO (opcional — rode separado pra conferir)
-- ════════════════════════════════════════════════════════════════════════
-- SELECT kind, COUNT(*), SUM(amount) FROM public.plan_items GROUP BY kind ORDER BY kind;
-- SELECT month, SUM(CASE WHEN is_revenue THEN amount ELSE 0 END) entrada,
--               SUM(CASE WHEN NOT is_revenue THEN amount ELSE 0 END) saida
-- FROM public.plan_items GROUP BY month ORDER BY month;
