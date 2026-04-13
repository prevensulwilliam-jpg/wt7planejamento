-- locked_months: estado atual do cadeado por mês
CREATE TABLE IF NOT EXISTS public.locked_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month text NOT NULL UNIQUE,
  locked_by uuid REFERENCES auth.users(id),
  locked_at timestamptz DEFAULT now(),
  is_locked boolean NOT NULL DEFAULT true
);
ALTER TABLE public.locked_months ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access locked_months"
  ON public.locked_months FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- month_lock_log: histórico imutável de lock/unlock
CREATE TABLE IF NOT EXISTS public.month_lock_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month text NOT NULL,
  action text NOT NULL CHECK (action IN ('lock', 'unlock')),
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz DEFAULT now()
);
ALTER TABLE public.month_lock_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access month_lock_log"
  ON public.month_lock_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- kitnet_alerts: saldo pendente entre meses
CREATE TABLE IF NOT EXISTS public.kitnet_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kitnet_id uuid NOT NULL REFERENCES public.kitnets(id) ON DELETE CASCADE,
  source_entry_id uuid REFERENCES public.kitnet_entries(id) ON DELETE SET NULL,
  alert_month text NOT NULL,
  source_month text NOT NULL,
  pending_amount numeric(12,2) NOT NULL,
  alert_type text NOT NULL DEFAULT 'pending_balance',
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.kitnet_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access kitnet_alerts"
  ON public.kitnet_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
