CREATE TABLE IF NOT EXISTS classification_patterns (
  id uuid primary key default gen_random_uuid(),
  description_pattern text not null,
  category text not null,
  intent text not null,
  label text not null,
  count integer default 1,
  auto_apply boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  UNIQUE(description_pattern, category, intent)
);

ALTER TABLE classification_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_patterns" ON classification_patterns
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));