-- Categorias de despesas por edificação (RWT02 / RWT03)
-- Para o Dashboard CEO usar dados reais ao invés de hardcoded

INSERT INTO public.custom_categories (name, emoji, type, color, active) VALUES
  -- CELESC (energia)
  ('CELESC Apt',         '⚡', 'despesa', '#F59E0B', true),
  ('CELESC RWT02',       '⚡', 'despesa', '#F59E0B', true),
  ('CELESC RWT03',       '⚡', 'despesa', '#F59E0B', true),
  -- SEMASA (água)
  ('SEMASA RWT02',       '💧', 'despesa', '#3B82F6', true),
  ('SEMASA RWT03',       '💧', 'despesa', '#3B82F6', true),
  -- IPTU
  ('IPTU RWT02',         '🧾', 'despesa', '#F43F5E', true),
  ('IPTU RWT03',         '🧾', 'despesa', '#F43F5E', true),
  -- Ambiental
  ('Ambiental RWT02',    '🌿', 'despesa', '#10B981', true),
  ('Ambiental RWT03',    '🌿', 'despesa', '#10B981', true),
  -- Internet
  ('Internet RWT02',     '🌐', 'despesa', '#3B82F6', true),
  ('Internet RWT03',     '🌐', 'despesa', '#3B82F6', true),
  -- Manutenção
  ('Manutenção RWT02',   '🔧', 'despesa', '#F97316', true),
  ('Manutenção RWT03',   '🔧', 'despesa', '#F97316', true)
ON CONFLICT DO NOTHING;
