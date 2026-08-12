-- Laptop category + structured laptop specs (from dobitkala)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cpu TEXT,
  ADD COLUMN IF NOT EXISTS gpu TEXT,
  ADD COLUMN IF NOT EXISTS display TEXT;

INSERT INTO categories (name, slug)
VALUES (N'لپ‌تاپ', 'laptop')
ON CONFLICT (slug) DO NOTHING;
