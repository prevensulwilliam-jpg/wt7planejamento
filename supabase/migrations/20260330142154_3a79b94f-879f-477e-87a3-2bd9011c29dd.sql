
-- Tabela de fornecedores do casamento
CREATE TABLE IF NOT EXISTS public.wedding_vendors (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  vendor_name text,
  status text check (status in ('incluido_pacote','contratado','a_contratar','noivos_trazem')) default 'a_contratar',
  estimated_value numeric default 0,
  contracted_value numeric,
  contract_file_url text,
  contract_file_name text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela de pagamentos por fornecedor
CREATE TABLE IF NOT EXISTS public.wedding_vendor_payments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.wedding_vendors(id) on delete cascade,
  description text not null,
  amount numeric not null,
  due_date date,
  paid_at date,
  status text check (status in ('pending','paid','overdue')) default 'pending',
  payment_method text,
  receipt_url text,
  receipt_file_name text,
  notes text,
  created_at timestamptz default now()
);

ALTER TABLE public.wedding_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_vendor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_wedding_vendors" ON public.wedding_vendors FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_vendor_payments" ON public.wedding_vendor_payments FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket para contratos e comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('wedding-docs', 'wedding-docs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_wedding_docs" ON storage.objects
FOR ALL USING (bucket_id = 'wedding-docs');

-- Seed com os fornecedores já conhecidos
INSERT INTO public.wedding_vendors (service, vendor_name, status, estimated_value, contracted_value) VALUES
('Buffet/Jantar', 'Villa Sonali', 'incluido_pacote', 0, 0),
('DJ (Luka)', 'Villa Sonali', 'incluido_pacote', 0, 0),
('Cerimonialista (Chris Martini)', 'Villa Sonali', 'incluido_pacote', 0, 0),
('Bar alcoólico', 'Villa Sonali', 'incluido_pacote', 11970, 11970),
('Decoração cerimônia', null, 'a_contratar', 12000, null),
('Tenda cobertura deck', null, 'a_contratar', 5000, null),
('Estrutura espelhada piscina', null, 'a_contratar', 4500, null),
('Gerador', null, 'a_contratar', 1000, null),
('Lembrancinhas', null, 'a_contratar', 1000, null),
('Bolo', null, 'a_contratar', 2500, null),
('Bolo fake', null, 'a_contratar', 150, null),
('Docinhos', null, 'a_contratar', 5000, null),
('Espumantes', null, 'noivos_trazem', 3000, null),
('Whisky', null, 'noivos_trazem', 2000, null),
('Iluminação', null, 'a_contratar', 3000, null),
('Celebrante', null, 'a_contratar', 1000, null),
('Banda/Música jantar', null, 'a_contratar', 2000, null),
('Fotografia/Vídeo', null, 'a_contratar', 0, null);
