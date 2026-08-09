-- Order ↔ Bale review/payment/shipping fields

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS confirmed_amount BIGINT CHECK (confirmed_amount IS NULL OR confirmed_amount >= 0),
  ADD COLUMN IF NOT EXISTS payment_ref TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.confirmed_amount IS 'مبلغ نهایی تأییدشده برای فاکتور (در صورت تفاوت با total_amount)';
COMMENT ON COLUMN orders.payment_ref IS 'شماره پیگیری پرداخت بانکی پس از دریافت رسید';
COMMENT ON COLUMN orders.tracking_number IS 'کد رهگیری ارسال کالا';
