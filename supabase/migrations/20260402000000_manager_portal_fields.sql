-- Add manager portal fields to kitnets
ALTER TABLE kitnets ADD COLUMN IF NOT EXISTS tenant_phone text;
ALTER TABLE kitnets ADD COLUMN IF NOT EXISTS contract_url text;

-- Storage bucket for contracts (run once)
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: only authenticated users with kitnet_manager or admin role
CREATE POLICY "Manager can upload contracts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND (
      (SELECT has_role(auth.uid(), 'kitnet_manager'))
      OR (SELECT has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Manager can read contracts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (
      (SELECT has_role(auth.uid(), 'kitnet_manager'))
      OR (SELECT has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Manager can update contracts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (
      (SELECT has_role(auth.uid(), 'kitnet_manager'))
      OR (SELECT has_role(auth.uid(), 'admin'))
    )
  );
