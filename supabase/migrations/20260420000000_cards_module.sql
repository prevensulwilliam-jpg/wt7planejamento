-- ══════════════════════════════════════════════════════════════════
-- Sprint Cartões — Módulo /cards
-- BB (OFX parser determinístico) + XP (CSV parser) + PDF fallback (Gemini)
-- Granularidade transação-a-transação, categorização, integração com
-- Sobra Reinvestida (aporte_obra e dev conta como investimento).
-- ATENÇÃO: tabela de categorias no WT7 chama `custom_categories`.
-- ══════════════════════════════════════════════════════════════════

-- ── 1) Cartões cadastrados ──
CREATE TABLE IF NOT EXISTS cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bank text NOT NULL,
  brand text,
  last4 text,
  closing_day int,
  due_day int,
  credit_limit numeric(12,2),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO cards (name, bank, brand, last4, closing_day, due_day, active) VALUES
  ('BB Ourocard Visa Infinite', 'BB', 'Visa', '6770', 4, 10, true),
  ('XP Visa Infinite',          'XP', 'Visa', NULL,   25, 5,  true)
ON CONFLICT DO NOTHING;

-- ── 2) Faturas ──
CREATE TABLE IF NOT EXISTS card_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  reference_month text NOT NULL,
  closing_date date,
  due_date date,
  total_amount numeric(12,2),
  paid_amount numeric(12,2) DEFAULT 0,
  paid_at date,
  file_url text,
  file_format text,
  imported_at timestamptz DEFAULT now(),
  UNIQUE (card_id, reference_month)
);

-- ── 3) Colunas extras em custom_categories ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custom_categories' AND column_name='counts_as_investment') THEN
    ALTER TABLE custom_categories ADD COLUMN counts_as_investment boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custom_categories' AND column_name='vector') THEN
    ALTER TABLE custom_categories ADD COLUMN vector text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custom_categories' AND column_name='slug') THEN
    ALTER TABLE custom_categories ADD COLUMN slug text UNIQUE;
  END IF;
END $$;

-- Seeds das 15 categorias do módulo Cartões (idempotente via slug)
INSERT INTO custom_categories (slug, name, type, counts_as_investment, vector, emoji, color) VALUES
  ('aporte_obra',              'Aporte Obra (WT7 Holding)',                       'despesa', true,  'WT7_Holding', '🏗️', '#F59E0B'),
  ('dev_profissional_agora',   'Desenvolvimento Profissional — Agora',            'despesa', true,  'Prevensul',   '📈', '#2DD4BF'),
  ('dev_pessoal_futuro',       'Desenvolvimento Pessoal/Profissional — Futuro',   'despesa', true,  'Pessoal',     '🎓', '#8B5CF6'),
  ('produtividade_ferramentas','Produtividade e Ferramentas',                     'despesa', true,  'Pessoal',     '🛠️', '#6366F1'),
  ('consorcios_aporte',        'Consórcios (aporte)',                             'despesa', true,  'WT7_Holding', '🔄', '#C9A84C'),
  ('manutencao_kitnets',       'Manutenção Kitnets (operacional)',                'despesa', false, 'WT7_Holding', '🔧', '#94A3B8'),
  ('alimentacao_supermercado', 'Alimentação — Supermercado',                      'despesa', false, 'Pessoal',     '🛒', '#F59E0B'),
  ('alimentacao_restaurantes', 'Alimentação — Restaurantes/Bares',                'despesa', false, 'Pessoal',     '🍽️', '#F43F5E'),
  ('transporte_estacionamento','Transporte e Estacionamento',                     'despesa', false, 'Pessoal',     '🚗', '#94A3B8'),
  ('viagens',                  'Viagens',                                         'despesa', false, 'Pessoal',     '✈️', '#3B82F6'),
  ('saude_academia_farmacia',  'Saúde, Academia e Farmácia',                      'despesa', false, 'Pessoal',     '🏋️', '#10B981'),
  ('varejo_pessoal',           'Varejo Pessoal',                                  'despesa', false, 'Pessoal',     '🛍️', '#EC4899'),
  ('casamento_2027',           'Casamento 2027',                                  'despesa', false, 'Casamento',   '💍', '#EC4899'),
  ('tarifas_iof_bancarias',    'Tarifas, IOF e Anuidades',                        'despesa', false, 'Pessoal',     '🧾', '#F43F5E'),
  ('a_investigar',             'A Investigar',                                    'despesa', false, NULL,          '❓', '#4A5568')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  counts_as_investment = EXCLUDED.counts_as_investment,
  vector = EXCLUDED.vector;

-- ── 4) Transações individuais ──
CREATE TABLE IF NOT EXISTS card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES card_invoices(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES cards(id),
  transaction_date date NOT NULL,
  description text NOT NULL,
  merchant_normalized text,
  amount numeric(12,2) NOT NULL,
  cardholder text,
  installment_current int DEFAULT 1,
  installment_total int DEFAULT 1,
  currency text DEFAULT 'BRL',
  fx_rate numeric(10,4),
  fitid text,
  category_id uuid REFERENCES custom_categories(id),
  counts_as_investment boolean DEFAULT false,
  vector text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS card_tx_fitid_unique
  ON card_transactions (card_id, fitid) WHERE fitid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS card_tx_composite_unique
  ON card_transactions (card_id, transaction_date, description, amount, cardholder, installment_current) WHERE fitid IS NULL;
CREATE INDEX IF NOT EXISTS card_tx_invoice_idx ON card_transactions (invoice_id);
CREATE INDEX IF NOT EXISTS card_tx_category_idx ON card_transactions (category_id);
CREATE INDEX IF NOT EXISTS card_tx_merchant_idx ON card_transactions (merchant_normalized);

-- ── 5) Milhas ──
CREATE TABLE IF NOT EXISTS card_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  reference_month text NOT NULL,
  points_earned int DEFAULT 0,
  points_balance int,
  program text,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (card_id, reference_month)
);

-- ── 6) Pattern learning ──
CREATE TABLE IF NOT EXISTS card_merchant_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_pattern text NOT NULL UNIQUE,
  category_id uuid NOT NULL REFERENCES custom_categories(id),
  confidence int DEFAULT 1,
  last_used_at timestamptz DEFAULT now()
);

INSERT INTO card_merchant_patterns (merchant_pattern, category_id) VALUES
  ('MAFRA',               (SELECT id FROM custom_categories WHERE slug='aporte_obra')),
  ('EDUARDOTEVAH',        (SELECT id FROM custom_categories WHERE slug='dev_profissional_agora')),
  ('G4EDU',               (SELECT id FROM custom_categories WHERE slug='dev_profissional_agora')),
  ('G40TREINAME',         (SELECT id FROM custom_categories WHERE slug='dev_profissional_agora')),
  ('VENDE-C',             (SELECT id FROM custom_categories WHERE slug='dev_profissional_agora')),
  ('HUBLA',               (SELECT id FROM custom_categories WHERE slug='dev_pessoal_futuro')),
  ('MILAGREDIG',          (SELECT id FROM custom_categories WHERE slug='dev_pessoal_futuro')),
  ('ADAPTAORG',           (SELECT id FROM custom_categories WHERE slug='dev_pessoal_futuro')),
  ('LOVABLE',             (SELECT id FROM custom_categories WHERE slug='produtividade_ferramentas')),
  ('ANTHROPIC',           (SELECT id FROM custom_categories WHERE slug='produtividade_ferramentas')),
  ('APPLECOMBILL',        (SELECT id FROM custom_categories WHERE slug='produtividade_ferramentas')),
  ('APPLE.COM',           (SELECT id FROM custom_categories WHERE slug='produtividade_ferramentas')),
  ('SUPERMERCADOS DE ANGELI', (SELECT id FROM custom_categories WHERE slug='alimentacao_supermercado')),
  ('BISTEK',              (SELECT id FROM custom_categories WHERE slug='alimentacao_supermercado')),
  ('TA NA MAO',           (SELECT id FROM custom_categories WHERE slug='alimentacao_supermercado')),
  ('EMPORIO DA BRAVA',    (SELECT id FROM custom_categories WHERE slug='alimentacao_supermercado')),
  ('PADARIAGUANAB',       (SELECT id FROM custom_categories WHERE slug='alimentacao_supermercado')),
  ('GRAO SABOR',          (SELECT id FROM custom_categories WHERE slug='alimentacao_supermercado')),
  ('DONA BRAVA',          (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('TRIBUS BAR',          (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('JUISTREET',           (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('AKATORI',             (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('MERENGUE CAFE',       (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('ERMANOS BURGUER',     (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('CASA DA SOPA',        (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('BALBURDIA',           (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('LA GULA',             (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('MASBAHCHURRASCO',     (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('MeuQueridoBarzin',    (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('MINI KALZONE',        (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('PARADA DO JAPONEZ',   (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('JARDIM GASTROBAR',    (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('AleChoperia',         (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('JAH PRAIA BRAVA',     (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('Ceu Floripa',         (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('FLORIPAO',            (SELECT id FROM custom_categories WHERE slug='alimentacao_restaurantes')),
  ('V PARKING',           (SELECT id FROM custom_categories WHERE slug='transporte_estacionamento')),
  ('CAXAMBU ESTACIONAMENTO', (SELECT id FROM custom_categories WHERE slug='transporte_estacionamento')),
  ('UBERRIDES',           (SELECT id FROM custom_categories WHERE slug='transporte_estacionamento')),
  ('UBER TRIP',           (SELECT id FROM custom_categories WHERE slug='transporte_estacionamento')),
  ('TaxiPablo',           (SELECT id FROM custom_categories WHERE slug='transporte_estacionamento')),
  ('WEBMOTORS',           (SELECT id FROM custom_categories WHERE slug='transporte_estacionamento')),
  ('AIRBNB',              (SELECT id FROM custom_categories WHERE slug='viagens')),
  ('BOOKINGCOM',          (SELECT id FROM custom_categories WHERE slug='viagens')),
  ('LATAM',               (SELECT id FROM custom_categories WHERE slug='viagens')),
  ('COSTB',               (SELECT id FROM custom_categories WHERE slug='viagens')),
  ('EUCATUR',             (SELECT id FROM custom_categories WHERE slug='viagens')),
  ('MARINGA SAO',         (SELECT id FROM custom_categories WHERE slug='viagens')),
  ('RODOSNACK',           (SELECT id FROM custom_categories WHERE slug='viagens')),
  ('NSB TUR',             (SELECT id FROM custom_categories WHERE slug='viagens')),
  ('EQI RACKET',          (SELECT id FROM custom_categories WHERE slug='saude_academia_farmacia')),
  ('MAPFIT',              (SELECT id FROM custom_categories WHERE slug='saude_academia_farmacia')),
  ('FORMULA ATIVA',       (SELECT id FROM custom_categories WHERE slug='saude_academia_farmacia')),
  ('HAVAN',               (SELECT id FROM custom_categories WHERE slug='varejo_pessoal')),
  ('MAGALU',              (SELECT id FROM custom_categories WHERE slug='varejo_pessoal')),
  ('ENJOEI',              (SELECT id FROM custom_categories WHERE slug='varejo_pessoal')),
  ('ON OFFSE',            (SELECT id FROM custom_categories WHERE slug='varejo_pessoal')),
  ('IRONBERG',            (SELECT id FROM custom_categories WHERE slug='varejo_pessoal')),
  ('IOF - COMPRA NO EXTERIOR', (SELECT id FROM custom_categories WHERE slug='tarifas_iof_bancarias')),
  ('ANUIDADE',            (SELECT id FROM custom_categories WHERE slug='tarifas_iof_bancarias')),
  ('ASAAS*Redrive',       (SELECT id FROM custom_categories WHERE slug='a_investigar')),
  ('ASAAS*ERIC LU',       (SELECT id FROM custom_categories WHERE slug='a_investigar')),
  ('CAT  AG',             (SELECT id FROM custom_categories WHERE slug='a_investigar')),
  ('WKE INDUSTRIA',       (SELECT id FROM custom_categories WHERE slug='a_investigar')),
  ('VITALTREINAMENT',     (SELECT id FROM custom_categories WHERE slug='a_investigar'))
ON CONFLICT (merchant_pattern) DO NOTHING;

-- ── 7) RLS ──
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_merchant_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all cards" ON cards;
CREATE POLICY "admin all cards" ON cards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin all card_invoices" ON card_invoices;
CREATE POLICY "admin all card_invoices" ON card_invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin all card_transactions" ON card_transactions;
CREATE POLICY "admin all card_transactions" ON card_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin all card_rewards" ON card_rewards;
CREATE POLICY "admin all card_rewards" ON card_rewards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin all card_merchant_patterns" ON card_merchant_patterns;
CREATE POLICY "admin all card_merchant_patterns" ON card_merchant_patterns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── 8) Storage bucket ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-invoices', 'card-invoices', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin reads card-invoices" ON storage.objects;
CREATE POLICY "admin reads card-invoices" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'card-invoices' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin writes card-invoices" ON storage.objects;
CREATE POLICY "admin writes card-invoices" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'card-invoices' AND public.has_role(auth.uid(), 'admin'::public.app_role));
