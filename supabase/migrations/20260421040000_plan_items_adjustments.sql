-- Ajustes no plano após entrevista 21/04/2026 (bloco 2):
--   1. Casamento: valor real R$170k total, R$150.378 a desembolsar (R$19.622 já pagos)
--   2. IR anual placeholder (2026/27/28)
--   3. Custo de vida agregado anual com inflação 4,5% a.a.
--   4. Venda Rampage projetada em jun/2028

-- ═══ 1. Casamento — corrige placeholder pra valor real (a desembolsar até dez/27) ═══
UPDATE public.plan_items
   SET amount = 150378.00,
       description = 'Casamento 11/12/2027 — a desembolsar (Villa R$78.488 + extras R$71.890)',
       notes = 'Orçamento total R$170k; já pagos R$19.622 (fora do plano, já em expenses). Detalhe completo em /wedding.'
 WHERE kind = 'casamento' AND category = 'casamento';

-- ═══ 2. IR anual — placeholders ═══
INSERT INTO public.plan_items (month, kind, category, description, amount, locked, notes) VALUES
  ('2026-04','imposto','ir_anual','IR Pessoa Física 2026 (placeholder)', 25000.00, false, 'Estimativa conservadora. Validar com DIRPF real.'),
  ('2027-04','imposto','ir_anual','IR Pessoa Física 2027 (placeholder)', 30000.00, false, 'Estimativa com crescimento receita (Prevensul + aluguéis novos).'),
  ('2028-04','imposto','ir_anual','IR Pessoa Física 2028 (placeholder)', 35000.00, false, 'Estimativa considerando T7/TDI maduro.')
ON CONFLICT DO NOTHING;

-- ═══ 3. Custo de vida com inflação IPCA 4,5% a.a. (média 2024-2025) ═══
-- Base abr/2026: R$ 43.816/mês
-- 2026 (9 meses, abr-dez, sem inflação no ano corrente): R$ 43.816 × 9 = R$ 394.344
-- 2027 (12 meses × R$ 45.787 = R$ 43.816 × 1,045): R$ 549.444
-- 2028 (12 meses × R$ 47.848 = R$ 43.816 × 1,092): R$ 574.176
INSERT INTO public.plan_items (month, kind, category, description, amount, locked, notes) VALUES
  ('2026-12','custo_fixo','custo_vida','Custo de vida 2026 — abr-dez (9 × R$ 43.816)', 394344.00, false, 'Base abr/2026. Sem inflação no ano corrente.'),
  ('2027-12','custo_fixo','custo_vida','Custo de vida 2027 (12 × R$ 45.787, IPCA 4,5%)', 549444.00, false, 'Inflação IPCA média 2024-2025 = 4,5% a.a.'),
  ('2028-12','custo_fixo','custo_vida','Custo de vida 2028 (12 × R$ 47.848, IPCA 9,2% acum)', 574176.00, false, 'Inflação composta 2 anos a 4,5% a.a.')
ON CONFLICT DO NOTHING;

-- ═══ 4. Venda da Rampage — receita projetada metade de 2028 ═══
INSERT INTO public.plan_items (month, kind, category, description, amount, is_revenue, locked, notes) VALUES
  ('2028-06','receita_projetada','venda_rampage','Venda Rampage (sem compra carro novo até metade 2028)',
   134800.00, true, false,
   'Valor líquido estimado (memoria/metas.md). Sem data exata — William pretende vender até metade de 2028, sem reposição.')
ON CONFLICT DO NOTHING;
