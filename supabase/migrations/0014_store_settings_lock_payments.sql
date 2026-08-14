-- قفل اطلاعات بانکی / ادمین در store_settings
-- anon و کاربر عادی دیگر SELECT کامل ندارند؛ فقط ادمین یا service role

DROP POLICY IF EXISTS "store_settings_public_read" ON store_settings;

DROP POLICY IF EXISTS "store_settings_admin_read" ON store_settings;
CREATE POLICY "store_settings_admin_read" ON store_settings
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ویوی عمومی بدون شبا/کارت/شماره ادمین بله (برای دسترسی مستقیم اختیاری)
CREATE OR REPLACE VIEW public.store_settings_public
WITH (security_invoker = false)
AS
SELECT
  id,
  contact_phone,
  order_tracking_phone,
  bale_products_channel_url,
  bale_loan_bot_url,
  enamad_code,
  enamad_url,
  ecommerce_license_number,
  ecommerce_license_url,
  store_address,
  shipping_cost,
  payment_window_minutes,
  admin_confirm_window_minutes,
  footer_tagline,
  about_content,
  terms_content,
  updated_at
FROM store_settings
WHERE id = 1;

REVOKE ALL ON public.store_settings_public FROM PUBLIC;
GRANT SELECT ON public.store_settings_public TO anon, authenticated;

COMMENT ON VIEW public.store_settings_public IS
  'تنظیمات عمومی فروشگاه بدون اطلاعات بانکی و شماره ادمین بله';
