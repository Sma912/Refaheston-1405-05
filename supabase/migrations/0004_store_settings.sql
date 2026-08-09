-- Store-wide public settings (single row)

CREATE TABLE IF NOT EXISTS store_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  contact_phone TEXT,
  order_tracking_phone TEXT,
  payment_sheba TEXT,
  payment_card_number TEXT,
  payment_card_holder TEXT,
  bale_admin_phone TEXT,
  bale_products_channel_url TEXT,
  enamad_code TEXT,
  enamad_url TEXT,
  ecommerce_license_number TEXT,
  ecommerce_license_url TEXT,
  store_address TEXT,
  footer_tagline TEXT,
  about_content TEXT,
  terms_content TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

INSERT INTO store_settings (
  id,
  footer_tagline,
  about_content,
  terms_content
)
VALUES (
  1,
  'فروشگاه اینترنتی رفاهستون — تخصصی موبایل و لوازم الکترونیکی. پرداخت پس از تأیید موجودی از طریق اپلیکیشن بله انجام می‌شود.',
  E'رفاهستون از سال‌ها فعالیت در بازار موبایل و لوازم الکترونیکی شکل گرفت؛ ابتدا به‌صورت فروش حضوری و سپس با حضور فعال در پیام‌رسان بله، جایی که لیست روز محصولات و قیمت‌ها برای مشتریان منتشر می‌شود.\n\nهدف ما ساده است: دسترسی شفاف به قیمت روز، تأیید موجودی پیش از پرداخت، و پیگیری سفارش تا لحظه تحویل. به همین دلیل فرایند خرید در سایت با بررسی دستی موجودی و قیمت آغاز می‌شود و مراحل پرداخت و اطلاع‌رسانی از طریق بله ادامه پیدا می‌کند.\n\nامروز رفاهستون ترکیبی از فروشگاه اینترنتی و کانال تخصصی محصولات است تا خریدار هم از راحتی سفارش آنلاین بهره ببرد و هم از سرعت و شفافیت ارتباط در بله.',
  E'شرایط اختصاصی خرید از فروشگاه اینترنتی رفاهستون\n\n۱. ثبت سفارش در سایت به‌منزله درخواست بررسی موجودی و قیمت است و تا پیش از تأیید ادمین، الزام قطعی به تحویل کالا ایجاد نمی‌کند.\n\n۲. پس از تأیید موجودی و قیمت، فاکتور و اطلاعات پرداخت (شبا / کارت) از طریق بله برای مشتری ارسال می‌شود. پرداخت فقط به حساب‌های اعلام‌شده در همان پیام معتبر است.\n\n۳. مشتری موظف است پس از واریز، رسید پرداخت را در بله ارسال کند. تأیید نهایی خرید پس از بررسی رسید و ثبت شماره پیگیری توسط ادمین انجام می‌شود.\n\n۴. زمان آماده‌سازی و ارسال بسته به موجودی و نوع کالا اعلام می‌شود. کد رهگیری ارسال پس از ارسال کالا از طریق بله و در بخش سفارش‌های سایت قابل مشاهده است.\n\n۵. در صورت لغو سفارش پیش از تأیید پرداخت، تعهد مالی برای طرفین ایجاد نمی‌شود. پس از تأیید پرداخت، هرگونه تغییر یا مرجوعی طبق قوانین جاری و توافق با پشتیبانی بررسی می‌شود.\n\n۶. مسئولیت صحت شماره تماس، آدرس ارسال و اطلاعات حساب کاربری بر عهده مشتری است.\n\n۷. رفاهستون حق به‌روزرسانی این شرایط را دارد؛ نسخهٔ منتشرشده در سایت ملاک عمل است.'
)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS store_settings_updated_at ON store_settings;
CREATE TRIGGER store_settings_updated_at
  BEFORE UPDATE ON store_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_settings_public_read" ON store_settings;
CREATE POLICY "store_settings_public_read" ON store_settings
  FOR SELECT TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "store_settings_admin_update" ON store_settings;
CREATE POLICY "store_settings_admin_update" ON store_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "store_settings_admin_insert" ON store_settings;
CREATE POLICY "store_settings_admin_insert" ON store_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
