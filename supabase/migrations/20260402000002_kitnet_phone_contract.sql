-- Add tenant phone and contract URL to kitnets
ALTER TABLE public.kitnets
  ADD COLUMN IF NOT EXISTS tenant_phone TEXT,
  ADD COLUMN IF NOT EXISTS contract_url TEXT;

-- Storage bucket for kitnet contracts (PDFs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload/read contracts
CREATE POLICY "Auth users can upload contracts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "Auth users can read contracts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracts');

CREATE POLICY "Auth users can delete contracts"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contracts');
