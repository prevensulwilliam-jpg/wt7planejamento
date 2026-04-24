-- ═══════════════════════════════════════════════════════════════════
-- Migration: módulo casamento — consolidação em wedding_vendors
--
-- Contexto: auditoria financeira 24/04/2026 identificou:
--   1. wedding_budget tem itens duplicados com wedding_vendors
--   2. Itens Villa (Pré, Churrasco, Espaço Noiva) só estão em wedding_budget
--   3. Fotografia/Vídeo em wedding_vendors com estimated_value=0
--   4. Faltam: Vestido noiva, Terno noivo, Alianças, Cabelo/Maquia
--   5. Falta lua de mel Itália jul/2028 (R$ 50k)
--
-- Solução: wedding_vendors vira fonte única. wedding_budget mantida
-- por histórico mas marcada como deprecated (não usar mais no código).
--
-- Data: 2026-04-24
-- ═══════════════════════════════════════════════════════════════════

-- 1) Itens Villa Sonali que só existiam em wedding_budget → migrar pra wedding_vendors
INSERT INTO public.wedding_vendors (service, vendor_name, status, estimated_value, contracted_value, notes)
VALUES
  ('Pré Wedding jantar 20 pessoas', 'Villa Sonali', 'incluido_pacote', 2400, 2400, 'Incluso no pacote Villa Sonali'),
  ('Churrasco Pós Wedding',         'Villa Sonali', 'incluido_pacote', 2520, 2520, 'Incluso no pacote Villa Sonali'),
  ('Espaço da Noiva',               'Villa Sonali', 'incluido_pacote', 0,    0,    'Cortesia Villa Sonali');

-- 2) Fotografia/Vídeo — precificar em R$ 10.000
UPDATE public.wedding_vendors
SET estimated_value = 10000
WHERE service ILIKE 'Fotografia/V%deo%' AND estimated_value = 0;

-- 3) Itens a contratar ainda não cadastrados (estimativas William 24/04)
INSERT INTO public.wedding_vendors (service, vendor_name, status, estimated_value, notes)
VALUES
  ('Vestido da Noiva',       NULL, 'a_contratar', 5000,  'Camila escolhe'),
  ('Terno do Noivo',         NULL, 'a_contratar', 2500,  NULL),
  ('Alianças',               NULL, 'a_contratar', 10000, 'Par'),
  ('Cabelo e Maquiagem',     NULL, 'a_contratar', 5000,  'Dia do casamento');

-- 4) Lua de mel Itália — jul/2028 (pós-casamento, mas rastreado aqui)
INSERT INTO public.wedding_vendors (service, vendor_name, status, estimated_value, notes)
VALUES
  ('Lua de mel — Itália', NULL, 'a_contratar', 50000,
   'Julho/2028. Evento pós-casamento (dez/2027), separado mas gerenciado aqui por conveniência.');

-- 5) Deprecar wedding_budget (mantém dados por histórico, parar de usar no código)
COMMENT ON TABLE public.wedding_budget IS
  'DEPRECATED em 24/04/2026. wedding_vendors vira fonte única de itens do casamento.
   Tabela mantida por histórico. Não adicionar UI nova que escreva aqui.';

-- ── Audit ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count int;
  v_estimated numeric;
  v_contracted numeric;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(estimated_value),0), COALESCE(SUM(contracted_value),0)
  INTO v_count, v_estimated, v_contracted
  FROM public.wedding_vendors;

  RAISE NOTICE 'wedding_vendors pós-migration: % registros, estimated R$ %, contracted R$ %',
    v_count, v_estimated, v_contracted;
END $$;
