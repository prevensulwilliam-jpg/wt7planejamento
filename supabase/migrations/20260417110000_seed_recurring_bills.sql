-- ============================================
-- SEED: Despesas Recorrentes (análise extratos Jan-Abr/2026)
-- Versão ENXUTA (17 itens) — CELESC e SEMASA ficam de fora
-- (já gerenciados em /energy e fechamentos de kitnet)
-- ============================================
-- Total esperado: ~R$ 17.024/mês
-- user_id vem automático via DEFAULT auth.uid() — rodar logado como admin

INSERT INTO public.recurring_bills
  (name, category, amount, due_day, frequency, is_fixed, auto_promoted, active, notes)
VALUES
  ('Financiamento Stellantis',       'veiculo',        3427.12, 18, 'monthly', true,  false, true, 'Valor exato confirmado em 4 meses (jan-abr/26)'),
  ('Consórcio Ademicon',             'veiculo',        1841.40, 15, 'monthly', true,  false, true, 'Valor fixo R$ 1.841,40 todo mês'),
  ('Aluguel NRSX - Imóvel 1',        'aluguel',        1550.00, 10, 'monthly', true,  false, true, 'NRSX Empreendimentos (~R$ 1.534-1.561)'),
  ('Aluguel NRSX - Imóvel 2',        'aluguel',        1722.00, 10, 'monthly', true,  false, true, 'NRSX Empreendimentos (~R$ 1.722-1.733)'),
  ('Condomínio Apartamento',         'aluguel',         770.00, 15, 'monthly', true,  false, true, 'Média R$ 744-804'),
  ('Unimed Joinville',               'saude',           958.00, 10, 'monthly', true,  false, true, 'Plano de saúde — variação R$ 936-982'),
  ('Personal Henrique',              'academia',       1500.00, 10, 'monthly', false, false, true, 'Varia R$ 900-1.800 conforme mês'),
  ('TIM - Plano Celular',            'telefonia',       100.00, 12, 'monthly', true,  false, true, 'Faixa R$ 91-141'),
  ('Claro - Plano',                  'telefonia',       120.00, 15, 'monthly', true,  false, true, 'Faixa R$ 117-147'),
  ('Supergasbras',                   'gas',              81.00, 15, 'monthly', false, false, true, 'Média R$ 65-89'),
  ('Sociedade Guararé',              'guarare',         592.00,  5, 'monthly', true,  false, true, 'Valor fixo R$ 592,00'),
  ('Paulo Henrique Coelho',          'outros',          598.00, 10, 'monthly', true,  false, true, 'Transferência intercorrente fixa ~R$ 598'),
  ('Tarifa Pacote BB',               'tarifas_bancarias',15.90, 12, 'monthly', true,  false, true, 'Tarifa mensal BB'),
  ('Tarifa Pacote Credifoz',         'tarifas_bancarias',16.90, 13, 'monthly', true,  false, true, 'Tarifa mensal Credifoz'),
  ('Cotas Credifoz',                 'tarifas_bancarias',40.00, 10, 'monthly', true,  false, true, 'Débito de cotas cooperativa'),
  ('Tarifa MSG BB',                  'tarifas_bancarias', 5.00, 25, 'monthly', true,  false, true, 'Tarifa mensagens BB'),
  ('PJBank - Boletos Consolidados',  'outros',         5026.00, 10, 'monthly', true,  false, true, 'Pagamento consolidado PJBank — revisar composição (possíveis boletos de terceiros/financiamentos)')
ON CONFLICT DO NOTHING;
