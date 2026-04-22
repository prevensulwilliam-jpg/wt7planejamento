-- Plano estratégico 2026-2028: cada linha é um evento financeiro previsto (desembolso ou recebimento).
-- Usado pela página /plan pra deriva meta mensal de receita (bottom-up, não "chute").
-- Entradas iniciais seedadas no fim do arquivo (obras + viagens + casamento).

CREATE TABLE IF NOT EXISTS public.plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,                    -- YYYY-MM (mês do evento; se diluído, mês do desembolso)
  kind text NOT NULL,                     -- obra | viagem | casamento | custo_fixo | receita_travada | receita_projetada | imposto | outro
  category text,                          -- ex: jw7_sonho, rwt05, china_japao, eua, casamento
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  is_revenue boolean NOT NULL DEFAULT false,
  notes text,
  locked boolean NOT NULL DEFAULT false,  -- true = valor contratado/confirmado; false = estimativa
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

-- ═══════════════════════════════════════════════════════════════════
-- SEEDS iniciais (entrevista William 21/04/2026)
-- Valores agrupados no mês-âncora do evento. William dilui conforme fluxo.
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO public.plan_items (month, kind, category, description, amount, locked, notes) VALUES
  -- OBRAS
  ('2027-12','obra','jw7_sonho_f1','JW7 Praia do Sonho — Fase 1 (cota W, pagar ao Jairo)', 85000.00, true,  'Cota total R$150k sobre obra de R$300k; já gastos R$52k (metade cada). Diluir ao longo de 2026.'),
  ('2028-06','obra','jw7_sonho_f2','JW7 Praia do Sonho — Fase 2 (cota W)',                  150000.00, false, 'Início jan/2028, entrega meio de 2028. Total R$300k 50/50.'),
  ('2026-12','obra','rwt05_f1',     'RWT05 & Corrêa — Fase 1 (cota W c/ mobília)',            62500.00, false, 'Total R$130k (50/50 com Walmir). Mão de obra já contratada R$40k. Já gastos ~R$2,5k cota.'),
  ('2027-12','obra','rwt05_f2',     'RWT05 & Corrêa — Fase 2 (cota W)',                        50000.00, false, 'Início set/2027. Total R$100k 50/50.'),
  ('2027-12','obra','jw7_itaipava', 'JW7 Itaipava — cota W (50%)',                            175000.00, false, 'Início 2027, entrega fim 2027. Total R$350k 50/50.'),
  ('2027-12','obra','rwt04',        'RWT04 — construção solo (caixa próprio)',                350000.00, false, 'Início 2027, entrega fim 2027. 100% William. ALERTA: pesado, requer T7 estourar pra caber.'),

  -- VIAGENS
  ('2026-06','viagem','eua',        'EUA (19/jun → 04/jul 2026, 2 semanas)',                   20000.00, false, 'Já tem USD 2.500 guardados; gasto adicional estimado R$15-20k.'),
  ('2027-03','viagem','china_japao','China + Japão com Camila',                                50000.00, false, 'Viagem âncora antes do casamento.'),

  -- CASAMENTO (placeholder — puxar do módulo wedding quando consolidar)
  ('2027-12','casamento','casamento','Casamento 11/12/2027 Villa Sonali BC (placeholder)',      80000.00, false, 'AJUSTAR: valor exato virá do módulo /wedding. Placeholder conservador.')
ON CONFLICT DO NOTHING;
