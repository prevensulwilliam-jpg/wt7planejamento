-- Bank transactions imported from OFX/CSV/Pluggy
CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES bank_accounts(id),
  external_id text UNIQUE,
  date date NOT NULL,
  description text,
  amount numeric NOT NULL,
  type text CHECK (type IN ('credit','debit')),
  category_suggestion text,
  category_confirmed text,
  status text CHECK (status IN ('pending','matched','ignored')) DEFAULT 'pending',
  matched_revenue_id uuid REFERENCES revenues(id),
  matched_expense_id uuid REFERENCES expenses(id),
  source text CHECK (source IN ('ofx','csv','pluggy','manual')),
  raw_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pluggy_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text,
  item_id text UNIQUE,
  account_id text,
  status text DEFAULT 'active',
  last_sync timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pluggy_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage bank_transactions" ON bank_transactions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can manage pluggy_connections" ON pluggy_connections
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));