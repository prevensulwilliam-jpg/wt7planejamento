
CREATE TABLE IF NOT EXISTS public.custom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text DEFAULT '📦',
  type text CHECK (type IN ('despesa', 'receita', 'ambos')) DEFAULT 'despesa',
  color text DEFAULT '#94A3B8',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_categories" ON public.custom_categories
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.custom_categories (name, emoji, type, color) VALUES
('Cartão de Crédito', '💳', 'despesa', '#F43F5E'),
('Energia Elétrica', '⚡', 'despesa', '#F59E0B'),
('Internet', '🌐', 'despesa', '#3B82F6'),
('Telefonia', '📱', 'despesa', '#8B5CF6'),
('Lazer', '🎉', 'despesa', '#EC4899'),
('Alimentação', '🍽️', 'despesa', '#F59E0B'),
('Suplementação', '💊', 'despesa', '#8B5CF6'),
('Saúde', '🏥', 'despesa', '#10B981'),
('Maçonaria', '🔷', 'despesa', '#2DD4BF'),
('Guarani', '⚽', 'despesa', '#10B981'),
('Consórcio', '🔄', 'despesa', '#C9A84C'),
('Terapia', '🧠', 'despesa', '#8B5CF6'),
('Obras', '🏗️', 'despesa', '#F59E0B'),
('Terrenos', '🌍', 'despesa', '#10B981'),
('Água', '💧', 'despesa', '#3B82F6'),
('Gasolina', '⛽', 'despesa', '#F43F5E'),
('Farmácia', '💊', 'despesa', '#10B981'),
('Academia', '🏋️', 'despesa', '#2DD4BF'),
('Impostos/Taxas', '🧾', 'despesa', '#F43F5E'),
('Casamento', '💍', 'despesa', '#EC4899'),
('Assinaturas', '📲', 'despesa', '#6366F1'),
('Veículo', '🚗', 'despesa', '#94A3B8'),
('Outros', '📦', 'despesa', '#4A5568'),
('Aluguel/Kitnets', '🏘️', 'receita', '#C9A84C'),
('Salário', '💼', 'receita', '#10B981'),
('Comissão Prevensul', '📊', 'receita', '#2DD4BF'),
('Energia Solar', '☀️', 'receita', '#F59E0B'),
('Laudos Técnicos', '📋', 'receita', '#3B82F6'),
('T7 Sales', '🚀', 'receita', '#8B5CF6'),
('Dividendos/Rendimentos', '📈', 'receita', '#10B981'),
('Outros (Receita)', '💰', 'receita', '#C9A84C');
