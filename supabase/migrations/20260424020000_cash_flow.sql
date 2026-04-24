-- ═══════════════════════════════════════════════════════════════════
-- Migration: cash_flow_items — plano de caixa mensal 24 meses
--
-- Contexto: Sprint 5D auditoria 24/04/2026. William precisa monitorar
-- mensalmente se a projeção de caixa está batendo com a realidade.
-- Meses críticos (jun/26 → dez/26) com caixa abaixo do piso R$ 100k.
--
-- Cada linha = 1 item de fluxo de caixa por mês (receita, custo de vida,
-- saída extra, ou transfer). Status muda de 'projected' para 'realized'
-- conforme realiza. realized_amount guarda o valor real pra comparar com
-- o projetado.
--
-- Data: 2026-04-24
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cash_flow_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month text NOT NULL,  -- YYYY-MM
  label text NOT NULL,
  category text NOT NULL,         -- slug: receita_total, custo_vida, villa_sonali, etc
  flow_type text NOT NULL,        -- income | expense_extra | cost_of_living | transfer_in
  amount numeric(12,2) NOT NULL,  -- sempre positivo; sinal vem de flow_type
  notes text,
  status text NOT NULL DEFAULT 'projected',
  realized_amount numeric(12,2),  -- preenchido quando status='realized'
  realized_at date,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT cash_flow_items_flow_type_check
    CHECK (flow_type IN ('income', 'expense_extra', 'cost_of_living', 'transfer_in')),
  CONSTRAINT cash_flow_items_status_check
    CHECK (status IN ('projected', 'confirmed', 'realized', 'cancelled'))
);

COMMENT ON TABLE public.cash_flow_items IS
  'Plano de caixa mensal. 1 linha por item × mês. Status ''projected'' até William
   marcar como realized (quando o pagamento/recebimento efetivo ocorre).';

COMMENT ON COLUMN public.cash_flow_items.flow_type IS
  'income: entrada operacional (Prev, aluguéis, TDI, comissões)
   expense_extra: saída extra (obras, casamento, viagens, terrenos)
   cost_of_living: custo de vida fixo mensal
   transfer_in: reembolso/transferência entrando (Walmir, Jairo)';

COMMENT ON COLUMN public.cash_flow_items.category IS
  'Slug estruturado. Ex: receita_prev, villa_sonali, jw7_itaipava_obra,
   rwt04_terreno, casamento_extras, viagem_china_japao.';

CREATE INDEX IF NOT EXISTS idx_cash_flow_items_month
  ON public.cash_flow_items (reference_month, flow_type);
CREATE INDEX IF NOT EXISTS idx_cash_flow_items_status
  ON public.cash_flow_items (status, reference_month);

-- RLS — admin only
ALTER TABLE public.cash_flow_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin full cash_flow_items" ON public.cash_flow_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ═══════════════════════════════════════════════════════════════════
-- SEED: 21 meses (abr/2026 → dez/2027)
-- ═══════════════════════════════════════════════════════════════════

-- ───── Receitas mensais projetadas ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'Receita total projetada', 'receita_total', 'income', v, n, 10
FROM (VALUES
  ('2026-04', 65912, 'Prev R$ 45,9k + Aluguéis R$ 20k'),
  ('2026-05', 65912, 'Prev + Aluguéis (TDI ainda não começou)'),
  ('2026-06', 65912, 'Prev + Aluguéis'),
  ('2026-07', 75912, 'Prev + Aluguéis + TDI 10k inicial'),
  ('2026-08', 77000, 'TDI crescendo 10%/mês (aprox)'),
  ('2026-09', 78500, 'TDI crescendo'),
  ('2026-10', 80500, 'TDI crescendo'),
  ('2026-11', 82500, 'TDI crescendo'),
  ('2026-12', 85000, 'TDI ~14k | Obras RWT05 + JW7 Sonho entregando'),
  ('2027-01', 97000, '+ Aluguéis novos R$ 10k (RWT05 + JW7 Sonho)'),
  ('2027-02', 98500, ''),
  ('2027-03', 100000, ''),
  ('2027-04', 101500, ''),
  ('2027-05', 103000, ''),
  ('2027-06', 104500, ''),
  ('2027-07', 106000, ''),
  ('2027-08', 107500, ''),
  ('2027-09', 109000, ''),
  ('2027-10', 110500, ''),
  ('2027-11', 112000, ''),
  ('2027-12', 113500, 'TDI consolidado ~25k')
) AS t(m, v, n);

-- ───── Custo de vida mensal (21 meses × R$ 42.000) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'Custo de vida mensal', 'custo_vida', 'cost_of_living', 42000,
       'Base abril/2026. 74% em cartões (ver /cards)', 90
FROM unnest(ARRAY[
  '2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12',
  '2027-01','2027-02','2027-03','2027-04','2027-05','2027-06','2027-07','2027-08','2027-09','2027-10','2027-11','2027-12'
]) AS m;

-- ───── Villa Sonali (10 parcelas jan-out/27) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'Villa Sonali — parcela ' || idx || '/10', 'villa_sonali', 'expense_extra', 7848.80,
       'Pacote completo local + pré-wedding + open bar + churrasco', 20
FROM (VALUES
  ('2027-01', 1), ('2027-02', 2), ('2027-03', 3), ('2027-04', 4), ('2027-05', 5),
  ('2027-06', 6), ('2027-07', 7), ('2027-08', 8), ('2027-09', 9), ('2027-10', 10)
) AS t(m, idx);

-- ───── JW7 Itaipava obra — MO (8 parcelas fev-set/27) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'JW7 Itaipava MO cota 50% — parcela ' || idx || '/8', 'jw7_itaipava_mo', 'expense_extra', 6250,
       'Empreiteiro R$ 100k total em 8×. Cota William = R$ 6.250/mês', 30
FROM (VALUES
  ('2027-02', 1), ('2027-03', 2), ('2027-04', 3), ('2027-05', 4),
  ('2027-06', 5), ('2027-07', 6), ('2027-08', 7), ('2027-09', 8)
) AS t(m, idx);

-- ───── JW7 Itaipava obra — Material (10 parcelas fev-nov/27) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'JW7 Itaipava Material cota 50% — parcela ' || idx || '/10', 'jw7_itaipava_material', 'expense_extra', 12500,
       'R$ 125k cota em 10× R$ 12.500', 31
FROM (VALUES
  ('2027-02', 1), ('2027-03', 2), ('2027-04', 3), ('2027-05', 4), ('2027-06', 5),
  ('2027-07', 6), ('2027-08', 7), ('2027-09', 8), ('2027-10', 9), ('2027-11', 10)
) AS t(m, idx);

-- ───── JW7 Itaipava — Móveis (3 parcelas out-dez/27) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'JW7 Itaipava Móveis cota 50% — parcela ' || idx || '/3', 'jw7_itaipava_moveis', 'expense_extra', 16667,
       'R$ 50k cota (R$ 10k/kitnet × 10 × 50%) em 3× R$ 16.667', 32
FROM (VALUES
  ('2027-10', 1), ('2027-11', 2), ('2027-12', 3)
) AS t(m, idx);

-- ───── Viagem China/Japão (6 parcelas out/26-mar/27) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'Viagem China/Japão — parcela ' || idx || '/6', 'viagem_china_japao', 'expense_extra', 8333.33,
       'Canton Fair + Japão abril/2027, 15-20 dias com Camila. R$ 50k em 6×', 40
FROM (VALUES
  ('2026-10', 1), ('2026-11', 2), ('2026-12', 3),
  ('2027-01', 4), ('2027-02', 5), ('2027-03', 6)
) AS t(m, idx);

-- ───── RWT05 obra fase 1 (3 parcelas mai-jul/26, cota William) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'RWT05 obra fase 1 cota William — parcela ' || idx || '/3', 'rwt05_obra_fase1', 'expense_extra', 11333,
       'Fase 1 entrega jul/26. Cota R$ 70k - gasto R$ 36k = R$ 34k em 3× R$ 11.333', 50
FROM (VALUES
  ('2026-05', 1), ('2026-06', 2), ('2026-07', 3)
) AS t(m, idx);

-- ───── RWT05 obra fase 2 (5 parcelas ago-dez/26) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'RWT05 obra fase 2 cota William — parcela ' || idx || '/5', 'rwt05_obra_fase2', 'expense_extra', 10000,
       'Fase 2 entrega dez/26. Cota R$ 50k em 5× R$ 10.000', 51
FROM (VALUES
  ('2026-08', 1), ('2026-09', 2), ('2026-10', 3), ('2026-11', 4), ('2026-12', 5)
) AS t(m, idx);

-- ───── JW7 Sonho obra (8 parcelas mai-dez/26, cota William) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'JW7 Sonho obra cota William — parcela ' || idx || '/8', 'jw7_sonho_obra', 'expense_extra', 18750,
       'Cota 50% restante R$ 150k em 8× R$ 18.750 (mai-dez/26)', 52
FROM (VALUES
  ('2026-05', 1), ('2026-06', 2), ('2026-07', 3), ('2026-08', 4),
  ('2026-09', 5), ('2026-10', 6), ('2026-11', 7), ('2026-12', 8)
) AS t(m, idx);

-- ───── RWT05 terreno cheque bruto (4 parcelas restantes abr-jul/26) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'RWT05 terreno cheque bruto — parcela ' || idx || '/5', 'rwt05_terreno_cheque', 'expense_extra', 10000,
       'Cheque único. Walmir reembolsa R$ 5k depois (ver transfer_in)', 60
FROM (VALUES
  ('2026-04', 2), ('2026-05', 3), ('2026-06', 4), ('2026-07', 5)
) AS t(m, idx);

-- ───── RWT04 terreno NRSX (21 meses, 100% William) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'RWT04 terreno NRSX — parcela mensal', 'rwt04_terreno', 'expense_extra', 1459.96,
       'Lote 13 Quadra B Parque do Sol. 288 parcelas iniciadas mai/2025. 100% cota William', 70
FROM unnest(ARRAY[
  '2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12',
  '2027-01','2027-02','2027-03','2027-04','2027-05','2027-06','2027-07','2027-08','2027-09','2027-10','2027-11','2027-12'
]) AS m;

-- ───── JW7 Itaipava terreno NRSX bruto (21 meses, cota 50% Jairo) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'JW7 Itaipava terreno NRSX bruto', 'jw7_itaipava_terreno', 'expense_extra', 1704.18,
       'Lote 02 Quadra E Parque do Sol. William paga bruto, Jairo reembolsa R$ 861,44 (ver transfer_in)', 71
FROM unnest(ARRAY[
  '2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12',
  '2027-01','2027-02','2027-03','2027-04','2027-05','2027-06','2027-07','2027-08','2027-09','2027-10','2027-11','2027-12'
]) AS m;

-- ───── Reembolso Walmir RWT05 (4 parcelas transfer_in) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'Reembolso Walmir cheque RWT05 — parcela ' || idx || '/4', 'reembolso_walmir', 'transfer_in', 5000,
       'Metade do cheque de R$ 10k reembolsada por Walmir. Entra como transfer, não receita', 80
FROM (VALUES
  ('2026-04', 1), ('2026-05', 2), ('2026-06', 3), ('2026-07', 4)
) AS t(m, idx);

-- ───── Reembolso Jairo JW7 Itaipava (21 meses transfer_in) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'Reembolso Jairo NRSX JW7 Itaipava', 'reembolso_jairo_nrsx', 'transfer_in', 861.44,
       'Metade da parcela NRSX reembolsada pelo Jairo. Transfer, não receita', 81
FROM unnest(ARRAY[
  '2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12',
  '2027-01','2027-02','2027-03','2027-04','2027-05','2027-06','2027-07','2027-08','2027-09','2027-10','2027-11','2027-12'
]) AS m;

-- ───── Casamento extras (12 parcelas jan-dez/27, distribuído linear R$ 69.650) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'Casamento extras (vendors a contratar) — mensal', 'casamento_extras', 'expense_extra', 5804.17,
       'R$ 69.650 distribuído 12× (foto/vídeo, decoração, vestido, alianças, bolo, banda, etc)', 22
FROM unnest(ARRAY[
  '2027-01','2027-02','2027-03','2027-04','2027-05','2027-06','2027-07','2027-08','2027-09','2027-10','2027-11','2027-12'
]) AS m;

-- ───── Casamento buffer imprevistos (7 parcelas jan-jul/27) ─────
INSERT INTO public.cash_flow_items (reference_month, label, category, flow_type, amount, notes, display_order)
SELECT m, 'Casamento buffer imprevistos', 'casamento_buffer', 'expense_extra', 4285.71,
       'R$ 30k buffer para imprevistos, distribuído 7×', 23
FROM unnest(ARRAY[
  '2027-01','2027-02','2027-03','2027-04','2027-05','2027-06','2027-07'
]) AS m;

-- ═══════════════════════════════════════════════════════════════════
-- Audit final
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_total int; v_in numeric; v_out numeric; v_vida numeric; v_transfer numeric;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.cash_flow_items;
  SELECT COALESCE(SUM(amount), 0) INTO v_in FROM public.cash_flow_items WHERE flow_type = 'income';
  SELECT COALESCE(SUM(amount), 0) INTO v_out FROM public.cash_flow_items WHERE flow_type = 'expense_extra';
  SELECT COALESCE(SUM(amount), 0) INTO v_vida FROM public.cash_flow_items WHERE flow_type = 'cost_of_living';
  SELECT COALESCE(SUM(amount), 0) INTO v_transfer FROM public.cash_flow_items WHERE flow_type = 'transfer_in';

  RAISE NOTICE 'cash_flow_items seed: % itens | receitas R$ % | saídas extras R$ % | custo vida R$ % | transfers R$ %',
    v_total, v_in, v_out, v_vida, v_transfer;
  RAISE NOTICE 'Saídas totais (extras + vida): R$ %', v_out + v_vida;
  RAISE NOTICE 'Saldo projetado 21m: R$ %', v_in + v_transfer - v_out - v_vida;
END $$;
