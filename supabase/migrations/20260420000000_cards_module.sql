-- ══════════════════════════════════════════════════════════════════
-- Sprint Cartões — Módulo /cards
-- BB (OFX parser determinístico) + XP (CSV parser) + PDF fallback (Gemini)
-- Granularidade transação-a-transação, categorização, integração com
-- Sobra Reinvestida (aporte_obra e dev conta como investimento).
-- ══════════════════════════════════════════════════════════════════

-- ── 1) Cartões cadastrados ──
CREATE TABLE IF NOT EXISTS cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,              -- "BB Ourocard Visa Infinite", "XP Visa Infinite"
  bank text NOT NULL,              -- "BB", "XP"
  brand text,                      -- "Visa", "Mastercard"
  last4 text,                      -- "6770"
  closing_day int,                 -- 25 (XP), 4 (BB)
  due_day int,                     -- 5
  credit_limit numeric(12,2),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seeds: BB + XP do William (ajusta last4 depois se precisar)
INSERT INTO cards (name, bank, brand, last4, closing_day, due_day, active) VALUES
  ('BB Ourocard Visa Infinite', 'BB', 'Visa', '6770', 4, 10, true),
  ('XP Visa Infinite',          'XP', 'Visa', NULL,   25, 5,  true)
ON CONFLICT DO NOTHING;

-- ── 2) Faturas (1 por cartão × mês) ──
CREATE TABLE IF NOT EXISTS card_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  reference_month text NOT NULL,   -- "2026-04" (mês de vencimento)
  closing_date date,
  due_date date,
  total_amount numeric(12,2),
  paid_amount numeric(12,2) DEFAULT 0,
  paid_at date,
  file_url text,                   -- Storage: bucket "card-invoices"
  file_format text,                -- 'ofx' | 'csv' | 'pdf'
  imported_at timestamptz DEFAULT now(),
  UNIQUE (card_id, reference_month)
);

-- ── 3) Categorias do módulo Cartões ──
-- Campo `counts_as_investment` na tabela `categories` (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'counts_as_investment'
  ) THEN
    ALTER TABLE categories ADD COLUMN counts_as_investment boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'vector'
  ) THEN
    ALTER TABLE categories ADD COLUMN vector text; -- 'WT7_Holding' | 'Prevensul' | 'T7' | 'Pessoal' | 'Casamento'
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'slug'
  ) THEN
    ALTER TABLE categories ADD COLUMN slug text UNIQUE;
  END IF;
END $$;

-- Seeds das 15 categorias (idempotente via slug)
INSERT INTO categories (slug, name, kind, counts_as_investment, vector) VALUES
  -- Investment = true
  ('aporte_obra',              'Aporte Obra (WT7 Holding)',          'expense', true,  'WT7_Holding'),
  ('dev_profissional_agora',   'Desenvolvimento Profissional — Agora', 'expense', true,  'Prevensul'),
  ('dev_pessoal_futuro',       'Desenvolvimento Pessoal/Profissional — Futuro', 'expense', true, 'Pessoal'),
  ('produtividade_ferramentas','Produtividade e Ferramentas',         'expense', true,  'Pessoal'),
  ('consorcios_aporte',        'Consórcios (aporte)',                 'expense', true,  'WT7_Holding'),
  -- Investment = false
  ('manutencao_kitnets',       'Manutenção Kitnets (operacional)',    'expense', false, 'WT7_Holding'),
  ('alimentacao_supermercado', 'Alimentação — Supermercado',          'expense', false, 'Pessoal'),
  ('alimentacao_restaurantes', 'Alimentação — Restaurantes/Bares',    'expense', false, 'Pessoal'),
  ('transporte_estacionamento','Transporte e Estacionamento',         'expense', false, 'Pessoal'),
  ('viagens',                  'Viagens',                             'expense', false, 'Pessoal'),
  ('saude_academia_farmacia',  'Saúde, Academia e Farmácia',          'expense', false, 'Pessoal'),
  ('varejo_pessoal',           'Varejo Pessoal',                      'expense', false, 'Pessoal'),
  ('casamento_2027',           'Casamento 2027',                      'expense', false, 'Casamento'),
  ('tarifas_iof_bancarias',    'Tarifas, IOF e Anuidades',            'expense', false, 'Pessoal'),
  ('a_investigar',             'A Investigar',                        'expense', false, NULL)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  counts_as_investment = EXCLUDED.counts_as_investment,
  vector = EXCLUDED.vector;

-- ── 4) Transações individuais (granularidade máxima) ──
CREATE TABLE IF NOT EXISTS card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES card_invoices(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES cards(id),
  transaction_date date NOT NULL,
  description text NOT NULL,
  merchant_normalized text,             -- "MAFRA_MATERIAIS" (pra pattern matching)
  amount numeric(12,2) NOT NULL,        -- sempre positivo (despesa)
  cardholder text,                      -- "WILLIAM TAVARES" | "CAMILA FUENFSTUECK"
  installment_current int DEFAULT 1,
  installment_total int DEFAULT 1,
  currency text DEFAULT 'BRL',          -- 'BRL' | 'USD'
  fx_rate numeric(10,4),
  fitid text,                           -- OFX FITID pra dedupe BB; null no CSV
  category_id uuid REFERENCES categories(id),
  counts_as_investment boolean DEFAULT false, -- cache do categories.counts_as_investment
  vector text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Dedupe: FITID quando existe (BB), composto pra CSV (XP)
CREATE UNIQUE INDEX IF NOT EXISTS card_tx_fitid_unique
  ON card_transactions (card_id, fitid)
  WHERE fitid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS card_tx_composite_unique
  ON card_transactions (card_id, transaction_date, description, amount, cardholder, installment_current)
  WHERE fitid IS NULL;

CREATE INDEX IF NOT EXISTS card_tx_invoice_idx ON card_transactions (invoice_id);
CREATE INDEX IF NOT EXISTS card_tx_category_idx ON card_transactions (category_id);
CREATE INDEX IF NOT EXISTS card_tx_merchant_idx ON card_transactions (merchant_normalized);

-- ── 5) Milhas / pontos ──
CREATE TABLE IF NOT EXISTS card_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  reference_month text NOT NULL,
  points_earned int DEFAULT 0,
  points_balance int,
  program text,                         -- "LATAM Pass", "Rewards XP"
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (card_id, reference_month)
);

-- ── 6) Pattern learning (merchant → categoria) ──
CREATE TABLE IF NOT EXISTS card_merchant_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_pattern text NOT NULL UNIQUE, -- "MAFRA" → match qualquer descrição com MAFRA
  category_id uuid NOT NULL REFERENCES categories(id),
  confidence int DEFAULT 1,              -- +1 cada vez que William confirma
  last_used_at timestamptz DEFAULT now()
);

-- Seeds dos padrões recorrentes identificados nas 3 faturas
INSERT INTO card_merchant_patterns (merchant_pattern, category_id) VALUES
  ('MAFRA',               (SELECT id FROM categories WHERE slug='aporte_obra')),
  ('EDUARDOTEVAH',        (SELECT id FROM categories WHERE slug='dev_profissional_agora')),
  ('G4EDU',               (SELECT id FROM categories WHERE slug='dev_profissional_agora')),
  ('G40TREINAME',         (SELECT id FROM categories WHERE slug='dev_profissional_agora')),
  ('VENDE-C',             (SELECT id FROM categories WHERE slug='dev_profissional_agora')),
  ('HUBLA',               (SELECT id FROM categories WHERE slug='dev_pessoal_futuro')),
  ('MILAGREDIG',          (SELECT id FROM categories WHERE slug='dev_pessoal_futuro')),
  ('ADAPTAORG',           (SELECT id FROM categories WHERE slug='dev_pessoal_futuro')),
  ('LOVABLE',             (SELECT id FROM categories WHERE slug='produtividade_ferramentas')),
  ('ANTHROPIC',           (SELECT id FROM categories WHERE slug='produtividade_ferramentas')),
  ('APPLECOMBILL',        (SELECT id FROM categories WHERE slug='produtividade_ferramentas')),
  ('APPLE.COM',           (SELECT id FROM categories WHERE slug='produtividade_ferramentas')),
  ('SUPERMERCADOS DE ANGELI', (SELECT id FROM categories WHERE slug='alimentacao_supermercado')),
  ('BISTEK',              (SELECT id FROM categories WHERE slug='alimentacao_supermercado')),
  ('TA NA MAO',           (SELECT id FROM categories WHERE slug='alimentacao_supermercado')),
  ('EMPORIO DA BRAVA',    (SELECT id FROM categories WHERE slug='alimentacao_supermercado')),
  ('PADARIAGUANAB',       (SELECT id FROM categories WHERE slug='alimentacao_supermercado')),
  ('GRAO SABOR',          (SELECT id FROM categories WHERE slug='alimentacao_supermercado')),
  ('DONA BRAVA',          (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('TRIBUS BAR',          (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('JUISTREET',           (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('AKATORI',             (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('MERENGUE CAFE',       (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('ERMANOS BURGUER',     (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('CASA DA SOPA',        (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('BALBURDIA',           (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('LA GULA',             (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('MASBAHCHURRASCO',     (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('MeuQueridoBarzin',    (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('MINI KALZONE',        (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('PARADA DO JAPONEZ',   (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('JARDIM GASTROBAR',    (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('AleChoperia',         (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('JAH PRAIA BRAVA',     (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('Ceu Floripa',         (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('FLORIPAO',            (SELECT id FROM categories WHERE slug='alimentacao_restaurantes')),
  ('V PARKING',           (SELECT id FROM categories WHERE slug='transporte_estacionamento')),
  ('CAXAMBU ESTACIONAMENTO', (SELECT id FROM categories WHERE slug='transporte_estacionamento')),
  ('UBERRIDES',           (SELECT id FROM categories WHERE slug='transporte_estacionamento')),
  ('UBER TRIP',           (SELECT id FROM categories WHERE slug='transporte_estacionamento')),
  ('TaxiPablo',           (SELECT id FROM categories WHERE slug='transporte_estacionamento')),
  ('WEBMOTORS',           (SELECT id FROM categories WHERE slug='transporte_estacionamento')),
  ('AIRBNB',              (SELECT id FROM categories WHERE slug='viagens')),
  ('BOOKINGCOM',          (SELECT id FROM categories WHERE slug='viagens')),
  ('LATAM',               (SELECT id FROM categories WHERE slug='viagens')),
  ('COSTB',               (SELECT id FROM categories WHERE slug='viagens')),
  ('EUCATUR',             (SELECT id FROM categories WHERE slug='viagens')),
  ('MARINGA SAO',         (SELECT id FROM categories WHERE slug='viagens')),
  ('RODOSNACK',           (SELECT id FROM categories WHERE slug='viagens')),
  ('NSB TUR',             (SELECT id FROM categories WHERE slug='viagens')),
  ('EQI RACKET',          (SELECT id FROM categories WHERE slug='saude_academia_farmacia')),
  ('MAPFIT',              (SELECT id FROM categories WHERE slug='saude_academia_farmacia')),
  ('FORMULA ATIVA',       (SELECT id FROM categories WHERE slug='saude_academia_farmacia')),
  ('HAVAN',               (SELECT id FROM categories WHERE slug='varejo_pessoal')),
  ('MAGALU',              (SELECT id FROM categories WHERE slug='varejo_pessoal')),
  ('ENJOEI',              (SELECT id FROM categories WHERE slug='varejo_pessoal')),
  ('ON OFFSE',            (SELECT id FROM categories WHERE slug='varejo_pessoal')),
  ('IRONBERG',            (SELECT id FROM categories WHERE slug='varejo_pessoal')),
  ('IOF - COMPRA NO EXTERIOR', (SELECT id FROM categories WHERE slug='tarifas_iof_bancarias')),
  ('ANUIDADE',            (SELECT id FROM categories WHERE slug='tarifas_iof_bancarias')),
  ('ASAAS*Redrive',       (SELECT id FROM categories WHERE slug='a_investigar')),
  ('ASAAS*ERIC LU',       (SELECT id FROM categories WHERE slug='a_investigar')),
  ('CAT  AG',             (SELECT id FROM categories WHERE slug='a_investigar')),
  ('WKE INDUSTRIA',       (SELECT id FROM categories WHERE slug='a_investigar')),
  ('VITALTREINAMENT',     (SELECT id FROM categories WHERE slug='a_investigar'))
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

-- ── 8) Storage bucket pras faturas originais (OFX/CSV/PDF) ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-invoices', 'card-invoices', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin reads card-invoices" ON storage.objects;
CREATE POLICY "admin reads card-invoices" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'card-invoices' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin writes card-invoices" ON storage.objects;
CREATE POLICY "admin writes card-invoices" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'card-invoices' AND public.has_role(auth.uid(), 'admin'::public.app_role));
