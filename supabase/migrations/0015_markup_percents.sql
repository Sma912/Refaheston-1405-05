-- درصد سود قابل تنظیم برای هر گروه محصول (قیمت نهایی = wholesale × (1 + percent/100))

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS markup_percent_mobile numeric(6,3) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS markup_percent_iphone_noreg numeric(6,3) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS markup_percent_tablet numeric(6,3) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS markup_percent_ipad numeric(6,3) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS markup_percent_xiaomi_pad numeric(6,3) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS markup_percent_console numeric(6,3) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS markup_percent_laptop numeric(6,3) NOT NULL DEFAULT 2.5;

COMMENT ON COLUMN store_settings.markup_percent_mobile IS 'سود درصد موبایل (همراه‌تل و مشابه)';
COMMENT ON COLUMN store_settings.markup_percent_iphone_noreg IS 'سود درصد آیفون بدون رجیستری';
COMMENT ON COLUMN store_settings.markup_percent_tablet IS 'سود درصد تبلت عمومی';
COMMENT ON COLUMN store_settings.markup_percent_ipad IS 'سود درصد آیپد';
COMMENT ON COLUMN store_settings.markup_percent_xiaomi_pad IS 'سود درصد تبلت شیائومی';
COMMENT ON COLUMN store_settings.markup_percent_console IS 'سود درصد کنسول بازی';
COMMENT ON COLUMN store_settings.markup_percent_laptop IS 'سود درصد لپ‌تاپ';

UPDATE store_settings
SET
  markup_percent_mobile = COALESCE(markup_percent_mobile, 2.7),
  markup_percent_iphone_noreg = COALESCE(markup_percent_iphone_noreg, 2.7),
  markup_percent_tablet = COALESCE(markup_percent_tablet, 2.7),
  markup_percent_ipad = COALESCE(markup_percent_ipad, 2.7),
  markup_percent_xiaomi_pad = COALESCE(markup_percent_xiaomi_pad, 2.7),
  markup_percent_console = COALESCE(markup_percent_console, 2.7),
  markup_percent_laptop = COALESCE(markup_percent_laptop, 2.5)
WHERE id = 1;
