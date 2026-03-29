CREATE TABLE bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_type text,
  balance numeric DEFAULT 0,
  last_updated date,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage bank_accounts" ON bank_accounts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));