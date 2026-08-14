-- مهلت‌های قابل تنظیم سفارش (دقیقه)
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS payment_window_minutes INTEGER NOT NULL DEFAULT 10
    CHECK (payment_window_minutes >= 1 AND payment_window_minutes <= 180);

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS admin_confirm_window_minutes INTEGER NOT NULL DEFAULT 15
    CHECK (admin_confirm_window_minutes >= 1 AND admin_confirm_window_minutes <= 180);

COMMENT ON COLUMN store_settings.payment_window_minutes IS 'مهلت مشتری برای واریز و ارسال رسید (دقیقه)';
COMMENT ON COLUMN store_settings.admin_confirm_window_minutes IS 'مهلت ادمین برای تأیید پرداخت پس از صدور فاکتور (دقیقه)';
