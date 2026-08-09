-- Bale bot link for Resalat loan guide promo

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS bale_loan_bot_url TEXT;

COMMENT ON COLUMN store_settings.bale_loan_bot_url IS 'لینک ربات بله راهنمای وام بانک رسالت';
