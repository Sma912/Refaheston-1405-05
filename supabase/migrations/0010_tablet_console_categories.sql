-- Tablet + game console categories
INSERT INTO categories (name, slug)
VALUES
  ('تبلت', 'tablet'),
  ('کنسول بازی', 'console')
ON CONFLICT (slug) DO NOTHING;
