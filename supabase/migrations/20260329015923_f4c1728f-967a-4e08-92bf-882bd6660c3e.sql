
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'kitnet_manager', 'financial', 'partner');

-- User roles table (separate from profiles per security best practices)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- user_roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  partner_projects TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Residenciais
CREATE TABLE public.residenciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT,
  address TEXT,
  city TEXT,
  total_units INTEGER
);
ALTER TABLE public.residenciais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read residenciais" ON public.residenciais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage residenciais" ON public.residenciais FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Kitnets
CREATE TABLE public.kitnets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residencial_code TEXT,
  unit_number INTEGER,
  code TEXT UNIQUE,
  tenant_name TEXT,
  rent_value NUMERIC,
  status TEXT CHECK (status IN ('occupied','vacant','maintenance')),
  deposit_bank TEXT,
  deposit_agency TEXT,
  deposit_account TEXT
);
ALTER TABLE public.kitnets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can read kitnets" ON public.kitnets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/manager can manage kitnets" ON public.kitnets FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitnet_manager')
);

-- Kitnet entries
CREATE TABLE public.kitnet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kitnet_id UUID REFERENCES public.kitnets(id),
  reference_month TEXT,
  period_start DATE,
  period_end DATE,
  rent_gross NUMERIC,
  iptu_taxa NUMERIC,
  celesc NUMERIC,
  semasa NUMERIC,
  adm_fee NUMERIC,
  total_liquid NUMERIC,
  broker_name TEXT,
  broker_creci TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.kitnet_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can read kitnet_entries" ON public.kitnet_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/manager can manage entries" ON public.kitnet_entries FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitnet_manager')
);

-- CELESC invoices
CREATE TABLE public.celesc_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residencial_code TEXT,
  reference_month TEXT,
  due_date DATE,
  kwh_total NUMERIC,
  invoice_total NUMERIC,
  cosip NUMERIC,
  pis_cofins_pct NUMERIC,
  icms_pct NUMERIC,
  solar_kwh_offset NUMERIC,
  amount_paid NUMERIC,
  tariff_per_kwh NUMERIC,
  pdf_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.celesc_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can read celesc" ON public.celesc_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/manager can manage celesc" ON public.celesc_invoices FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitnet_manager')
);

-- Energy readings
CREATE TABLE public.energy_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kitnet_id UUID REFERENCES public.kitnets(id),
  celesc_invoice_id UUID REFERENCES public.celesc_invoices(id),
  reference_month TEXT,
  reading_previous NUMERIC,
  reading_current NUMERIC,
  consumption_kwh NUMERIC,
  tariff_per_kwh NUMERIC,
  amount_to_charge NUMERIC,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.energy_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can read readings" ON public.energy_readings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/manager can manage readings" ON public.energy_readings FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitnet_manager')
);

-- Prevensul billing
CREATE TABLE public.prevensul_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT,
  contract_total NUMERIC,
  balance_remaining NUMERIC,
  contract_nf TEXT,
  installment_current INTEGER,
  installment_total INTEGER,
  closing_date DATE,
  amount_paid NUMERIC,
  commission_rate NUMERIC DEFAULT 0.03,
  commission_value NUMERIC GENERATED ALWAYS AS (amount_paid * 0.03) STORED,
  status TEXT,
  reference_month TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.prevensul_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can read billing" ON public.prevensul_billing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financial can manage billing" ON public.prevensul_billing FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financial')
);

-- Import history
CREATE TABLE public.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT,
  reference_month TEXT,
  records_imported INTEGER,
  total_paid NUMERIC,
  total_commission NUMERIC,
  imported_by UUID REFERENCES auth.users(id),
  imported_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can read imports" ON public.import_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financial can manage imports" ON public.import_history FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financial')
);

-- Revenues
CREATE TABLE public.revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT CHECK (source IN ('kitnets','salario','comissao_prevensul','t7','laudos','solar_energia','casamento_energia','outros')),
  description TEXT,
  amount NUMERIC,
  type TEXT CHECK (type IN ('fixed','variable','eventual')),
  reference_month TEXT,
  received_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.revenues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage revenues" ON public.revenues FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT CHECK (category IN ('alimentacao','suplementos','academia','saude','lazer','viagens','impostos','empresas_t7','kitnets_manutencao','assinaturas','veiculo','casamento','outros')),
  description TEXT,
  amount NUMERIC,
  type TEXT CHECK (type IN ('fixed','variable')),
  reference_month TEXT,
  paid_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage expenses" ON public.expenses FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Real estate properties
CREATE TABLE public.real_estate_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name TEXT,
  address TEXT,
  city TEXT,
  type TEXT CHECK (type IN ('terreno','obra','pronto','patrimonial')),
  status TEXT CHECK (status IN ('aguardando_entrega','em_obra','pronto_vazio','gerando_renda','patrimonial')),
  total_units_planned INTEGER,
  total_units_built INTEGER,
  total_units_rented INTEGER,
  estimated_completion DATE,
  estimated_rent_per_unit NUMERIC,
  property_value NUMERIC,
  iptu_annual NUMERIC,
  ownership_pct NUMERIC DEFAULT 100,
  partner_name TEXT,
  partner_pct NUMERIC,
  notes TEXT
);
ALTER TABLE public.real_estate_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can read properties" ON public.real_estate_properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage properties" ON public.real_estate_properties FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Construction expenses
CREATE TABLE public.construction_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.real_estate_properties(id),
  property_code TEXT,
  expense_date DATE,
  description TEXT,
  category TEXT CHECK (category IN ('terreno','terraplenagem','materiais','mao_de_obra','instalacoes','acabamento','taxas_cartorio','outros')),
  total_amount NUMERIC,
  william_amount NUMERIC,
  partner_amount NUMERIC,
  paid_by TEXT CHECK (paid_by IN ('william','partner','ambos')),
  payment_type TEXT CHECK (payment_type IN ('avista','parcelado')),
  installments_total INTEGER,
  installments_paid INTEGER,
  next_due_date DATE,
  receipt_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.construction_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can read construction_expenses" ON public.construction_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/partner can manage construction" ON public.construction_expenses FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'partner')
);

-- Assets
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT CHECK (type IN ('imovel','terreno','veiculo','aplicacao','consorcio','outros')),
  estimated_value NUMERIC,
  acquisition_date DATE,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage assets" ON public.assets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Investments
CREATE TABLE public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT CHECK (type IN ('cdb','tesouro','fii','acoes','poupanca','outros')),
  bank TEXT,
  initial_amount NUMERIC,
  current_amount NUMERIC,
  rate_percent NUMERIC,
  maturity_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage investments" ON public.investments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Consortiums
CREATE TABLE public.consortiums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  total_value NUMERIC,
  monthly_payment NUMERIC,
  installments_total INTEGER,
  installments_paid INTEGER,
  status TEXT CHECK (status IN ('active','contemplated','finished')),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.consortiums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage consortiums" ON public.consortiums FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Wedding budget
CREATE TABLE public.wedding_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT,
  item TEXT,
  supplier TEXT,
  status TEXT CHECK (status IN ('contratado','parcialmente_pago','a_contratar','cortesia','cancelado')),
  estimated_value NUMERIC,
  contracted_value NUMERIC,
  amount_paid NUMERIC,
  amount_remaining NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.wedding_budget ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage wedding_budget" ON public.wedding_budget FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Wedding installments
CREATE TABLE public.wedding_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT,
  supplier TEXT,
  due_date DATE,
  amount NUMERIC,
  paid_at DATE,
  status TEXT CHECK (status IN ('pago','pendente','vencido')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.wedding_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage wedding_installments" ON public.wedding_installments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Goals
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT CHECK (type IN ('renda','patrimonio','imoveis','reserva','projeto','saude','outros')),
  target_value NUMERIC,
  current_value NUMERIC,
  deadline DATE,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage goals" ON public.goals FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Taxes
CREATE TABLE public.taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT,
  amount NUMERIC,
  due_date DATE,
  paid_at DATE,
  status TEXT CHECK (status IN ('pending','paid','overdue')),
  reference_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage taxes" ON public.taxes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Debts
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  creditor TEXT,
  total_amount NUMERIC,
  remaining_amount NUMERIC,
  monthly_payment NUMERIC,
  due_date DATE,
  status TEXT CHECK (status IN ('active','paid','renegotiating')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage debts" ON public.debts FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Wisely messages
CREATE TABLE public.wisely_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user','assistant')),
  content TEXT,
  module TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.wisely_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own messages" ON public.wisely_messages FOR ALL USING (auth.uid() = user_id);

-- Audit log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT,
  table_name TEXT,
  record_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can read audit_log" ON public.audit_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth can insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
CREATE POLICY "Auth can upload documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Auth can read own documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
