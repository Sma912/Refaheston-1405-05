-- دسته‌های جدید + درصد سود لوازم جانبی و صوتی

INSERT INTO categories (name, slug)
VALUES
  ('لوازم جانبی', 'accessory'),
  ('صوتی و اسپیکر', 'audio')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS markup_percent_accessory numeric(6,3) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS markup_percent_audio numeric(6,3) NOT NULL DEFAULT 2.7;

-- اگر migration 0015 هنوز اجرا نشده، ستون‌های اصلی را هم اضافه کن
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS markup_percent_mobile numeric(6,3) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS markup_percent_iphone_noreg numeric(6,3) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS markup_percent_tablet numeric(6,3) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS markup_percent_ipad numeric(6,3) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS markup_percent_xiaomi_pad numeric(6,3) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS markup_percent_console numeric(6,3) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS markup_percent_laptop numeric(6,3) NOT NULL DEFAULT 2.5;
