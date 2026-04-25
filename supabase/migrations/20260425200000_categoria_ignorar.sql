-- ══════════════════════════════════════════════════════════════════
-- Categoria "🚫 Ignorar" — pra tx que não devem entrar no cálculo
--
-- Casos:
--  - PGTO CASH AG (pagamento de fatura aparecendo positivo no OFX BB)
--  - Estornos de cancelamento (compra parcelada que foi cancelada)
--  - Lançamentos contábeis que não são compras reais
--
-- Quando uma tx tem category.slug = 'ignorar':
--  - useSobraReinvestida exclui do custeio_cartao e investimento_cartao
--  - useCockpitBreakdown exclui dos buckets
--  - Aparece no /cartoes mas não soma no cálculo
-- ══════════════════════════════════════════════════════════════════

INSERT INTO custom_categories (slug, name, type, counts_as_investment, vector, emoji, color)
VALUES (
  'ignorar',
  '🚫 Ignorar transação',
  'despesa',
  false,
  NULL,
  '🚫',
  '#64748B'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  color = EXCLUDED.color,
  counts_as_investment = false;
