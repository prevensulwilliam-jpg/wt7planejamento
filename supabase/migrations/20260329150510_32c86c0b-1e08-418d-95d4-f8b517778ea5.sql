ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS category_intent text,
ADD COLUMN IF NOT EXISTS category_confidence text,
ADD COLUMN IF NOT EXISTS category_label text;