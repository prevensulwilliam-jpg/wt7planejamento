-- Receitas projetadas do plano 2026-2028 (bloco 3 da entrevista 21/04/2026):
--   1. Aluguéis novos RWT05 F1 + JW7 Sonho F1 — R$8.750/mês cota W, jan/2027 → dez/2028
--   2. T7/TDI — R$10k base jul/2026, composto 12%/mês até dez/2027, depois 5%/mês em 2028
--   3. Prevensul pipeline contratado — R$272.105 diluído em 24 meses (abr/2026 → mar/2028)

-- ═══ 1. Aluguéis novos (RWT05 F1 + JW7 Sonho F1) — jan/27 → dez/28 ═══
INSERT INTO public.plan_items (month, kind, category, description, amount, is_revenue, locked, notes) VALUES
  ('2027-01','receita_projetada','aluguel_novo','RWT05 F1 + JW7 Sonho F1 (cota W)', 8750.00, true, false, 'R$7.500 RWT05 + R$1.250 Sonho? Ver detalhe — William confirmou +R$8.750/mês total cota W a partir de jan/27.'),
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

-- ═══ 2. T7/TDI ← TIM — R$10k base jul/26, composto 12%/mês até dez/27, depois 5%/mês em 2028 ═══
-- Curva conservadora-média. MD prevê dez/27 entre R$70-150k. A 12% composto dá R$68.662 em dez/27 ≈ piso da faixa.
INSERT INTO public.plan_items (month, kind, category, description, amount, is_revenue, locked, notes) VALUES
  ('2026-07','receita_projetada','t7_tdi','T7/TDI ← TIM (base)',                          10000.00, true, false, 'Premissa: 12%/mês composto até dez/27; 5%/mês em 2028. Revisar quando 1º mês real fechar.'),
  ('2026-08','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          11200.00, true, false, null),
  ('2026-09','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          12544.00, true, false, null),
  ('2026-10','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          14049.00, true, false, null),
  ('2026-11','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          15735.00, true, false, null),
  ('2026-12','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          17623.00, true, false, null),
  ('2027-01','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          19738.00, true, false, null),
  ('2027-02','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          22107.00, true, false, null),
  ('2027-03','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          24760.00, true, false, null),
  ('2027-04','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          27731.00, true, false, null),
  ('2027-05','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          31058.00, true, false, null),
  ('2027-06','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          34785.00, true, false, null),
  ('2027-07','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          38960.00, true, false, null),
  ('2027-08','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          43635.00, true, false, null),
  ('2027-09','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          48871.00, true, false, null),
  ('2027-10','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          54736.00, true, false, null),
  ('2027-11','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          61305.00, true, false, null),
  ('2027-12','receita_projetada','t7_tdi','T7/TDI ← TIM (+12%)',                          68662.00, true, false, 'Piso da faixa MD R$70-150k.'),
  ('2028-01','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',                           72095.00, true, false, 'Desaceleração 2028: saturação do contrato TIM.'),
  ('2028-02','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',                           75700.00, true, false, null),
  ('2028-03','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',                           79485.00, true, false, null),
  ('2028-04','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',                           83459.00, true, false, null),
  ('2028-05','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',                           87632.00, true, false, null),
  ('2028-06','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',                           92014.00, true, false, null),
  ('2028-07','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',                           96615.00, true, false, null),
  ('2028-08','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',                          101446.00, true, false, null),
  ('2028-09','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',                          106518.00, true, false, null),
  ('2028-10','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',                          111844.00, true, false, null),
  ('2028-11','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',                          117436.00, true, false, null),
  ('2028-12','receita_projetada','t7_tdi','T7/TDI ← TIM (+5%)',                          123308.00, true, false, null)
ON CONFLICT DO NOTHING;

-- ═══ 3. Prevensul pipeline — R$272.105 diluído em 24 meses ═══
-- Média R$11.338/mês. Registrado como receita_travada (já contratado) dos 24 meses a partir de abr/2026.
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

-- ═══ 4. Aluguéis atuais recorrentes (RWT02 + RWT03) — R$20k/mês, 33 meses ═══
-- Já é caixa recorrente hoje. Registra como locked (travado) para o timeline ficar honesto.
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
