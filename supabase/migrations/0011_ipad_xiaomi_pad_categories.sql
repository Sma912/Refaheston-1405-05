-- Separate categories for iPad and Xiaomi/Redmi pads
INSERT INTO categories (name, slug)
VALUES
  ('آیپد', 'ipad'),
  ('تبلت شیائومی', 'xiaomi-pad'),
  ('تبلت', 'tablet'),
  ('کنسول بازی', 'console')
ON CONFLICT (slug) DO NOTHING;
