-- Shipping cost on store settings + snapshot on orders

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS shipping_cost BIGINT NOT NULL DEFAULT 0
    CHECK (shipping_cost >= 0);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_amount BIGINT
    CHECK (shipping_amount IS NULL OR shipping_amount >= 0);

COMMENT ON COLUMN store_settings.shipping_cost IS 'هزینه ارسال پیش‌فرض (تومان) برای فاکتور';
COMMENT ON COLUMN orders.shipping_amount IS 'هزینه ارسال ثبت‌شده روی فاکتور در زمان تأیید';
