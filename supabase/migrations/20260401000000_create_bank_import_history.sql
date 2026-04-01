
-- Create bank_import_history table
CREATE TABLE public.bank_import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  file_type TEXT,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  total_transactions INTEGER,
  new_transactions INTEGER,
  duplicate_transactions INTEGER,
  auto_categorized INTEGER,
  pending_review INTEGER,
  total_credits NUMERIC,
  total_debits NUMERIC,
  period_start DATE,
  period_end DATE,
  reference_month TEXT,
  imported_at TIMESTAMPTZ DEFAULT now(),
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB
);

ALTER TABLE public.bank_import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bank_import_history"
  ON public.bank_import_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert bank_import_history"
  ON public.bank_import_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete bank_import_history"
  ON public.bank_import_history FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Create bank-statements storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-statements', 'bank-statements', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for bank-statements bucket
CREATE POLICY "Authenticated users can upload bank statements"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bank-statements' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read bank statements"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bank-statements' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete bank statements"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'bank-statements' AND auth.uid() IS NOT NULL);
