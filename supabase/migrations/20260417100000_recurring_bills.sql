-- ============================================================
-- recurring_bills + monthly_bill_instances
-- Sprint 1: Calendário Financeiro — despesas recorrentes
-- ============================================================

-- 1. Despesas recorrentes (template mensal)
CREATE TABLE IF NOT EXISTS public.recurring_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  name text NOT NULL,
  category text,                          -- categoria da despesa (mesmo enum de expenses)
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_day integer NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly','biweekly','weekly','yearly')),
  is_fixed boolean NOT NULL DEFAULT true,  -- fixo ou variável
  auto_promoted boolean NOT NULL DEFAULT false,  -- virou fixo por repetição automática
  active boolean NOT NULL DEFAULT true,
  notes text,
  linked_consortium_id uuid,               -- vínculo com consórcio (nullable)
  linked_residencial_code text,            -- vínculo com complexo kitnet (nullable)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Instâncias mensais (o que vence cada mês)
CREATE TABLE IF NOT EXISTS public.monthly_bill_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_bill_id uuid NOT NULL REFERENCES public.recurring_bills(id) ON DELETE CASCADE,
  reference_month text NOT NULL,            -- YYYY-MM
  expected_amount numeric(12,2) NOT NULL DEFAULT 0,
  actual_amount numeric(12,2),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','skipped')),
  matched_expense_id uuid,                 -- vínculo com expenses
  matched_transaction_id uuid,             -- vínculo com bank_transactions
  paid_at date,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (recurring_bill_id, reference_month)
);

-- 3. RLS
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_bill_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin full access recurring_bills"
  ON public.recurring_bills FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin full access monthly_bill_instances"
  ON public.monthly_bill_instances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_recurring_bills_active ON public.recurring_bills(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_bill_instances_month ON public.monthly_bill_instances(reference_month);
CREATE INDEX IF NOT EXISTS idx_bill_instances_status ON public.monthly_bill_instances(status) WHERE status = 'pending';
