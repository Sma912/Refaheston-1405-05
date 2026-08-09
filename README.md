# فروشگاه اینترنتی رفاهستون

فروشگاه فارسی/RTL برای فروش گوشی موبایل با Next.js 15، Supabase و احراز هویت OTP از طریق پیام‌رسان بله (Safir).

## استک

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + کامپوننت‌های UI شبیه shadcn
- Supabase (PostgreSQL + Auth + Edge Functions)
- Vercel برای دیپلوی
- jalaali-js برای تاریخ شمسی
- lucide-react

## پیش‌نیازها

- Node.js 20+
- حساب [Supabase](https://supabase.com)
- حساب [Vercel](https://vercel.com)
- (اختیاری برای OTP واقعی) دسترسی سفیر بله و Bot ID

## راه‌اندازی سریع محلی

```bash
git clone <REPO_URL>
cd Refaheston-1405-05
cp .env.example .env.local
npm install
npm run dev
```

سایت روی `http://localhost:3000` اجرا می‌شود.

## ۱) ساخت پروژه در Supabase

1. در داشبورد Supabase یک پروژه جدید بسازید.
2. از **Settings → API** مقادیر زیر را بردارید و در `.env.local` / Vercel بگذارید:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (فقط سمت سرور — هرگز در کلاینت)
3. در **Authentication → Providers** ایمیل را فعال نگه دارید (برای سشن magic link داخلی استفاده می‌شود؛ کاربر ایمیل واقعی نمی‌بیند).

## ۲) اجرای Migration (همیشه از Git)

منبع حقیقت schema فقط پوشهٔ [`supabase/migrations/`](supabase/migrations/) است.
راهنمای کامل انتقال به پروژهٔ جدید: [`supabase/README.md`](supabase/README.md)

در Supabase → **SQL Editor** به ترتیب اجرا کنید، یا:

```bash
./scripts/apply-supabase-sql.sh
# خروجی را در SQL Editor پیست کنید
```

این اسکریپت جداول، enumها، RLS، trigger پروفایل و دسته‌ها را می‌سازد.

> قانون: تغییر ساختار فقط با فایل migration جدید + commit روی GitHub — نه فقط از داشبورد.

### ادمین کردن یک کاربر

بعد از اولین ورود با شماره موبایل:

```sql
UPDATE profiles
SET role = 'admin'
WHERE phone = '09123456789';
```

## ۳) متغیرهای محیطی

فایل نمونه: [`.env.example`](.env.example)

| متغیر | توضیح |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | آدرس پروژه Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (API OTP و ادمین) |
| `NEXT_PUBLIC_SITE_URL` | آدرس سایت (لوکال یا دامنه Vercel) |
| `BALE_API_ACCESS_KEY` | کلید API سفیر بله |
| `BALE_BOT_ID` | شناسه عددی بازو |
| `BALE_OTP_BASE_URL` | پیش‌فرض `https://safir.bale.ai/api/v3` |
| `BALE_ADMIN_PHONE` | شماره ادمین برای اعلان سفارش جدید در بله |
| `PAYMENT_SHEBA` | شماره شبا (ارسال در فاکتور) |
| `PAYMENT_CARD_NUMBER` | شماره کارت |
| `PAYMENT_CARD_HOLDER` | نام صاحب حساب/کارت |
| `ALLOW_DEV_OTP` | اگر `true` و کلید بله خالی باشد، OTP در پاسخ API برمی‌گردد |

## ۴) احراز هویت OTP بله

جریان:

1. کاربر شماره موبایل ایرانی وارد می‌کند.
2. `POST /api/auth/send-otp` کد ۶ رقمی می‌سازد، هش را در `otp_codes` ذخیره می‌کند و از Safir با `otp_message` ارسال می‌کند.
3. `POST /api/auth/verify-otp` کد را تأیید، کاربر Auth می‌سازد/پیدا می‌کند و `token_hash` برمی‌گرداند.
4. کلاینت با `supabase.auth.verifyOtp` وارد می‌شود.

### Edge Functions (اختیاری / پیشنهادی برای Production)

کد آماده در:

- [`supabase/functions/send-otp`](supabase/functions/send-otp)
- [`supabase/functions/verify-otp`](supabase/functions/verify-otp)

دیپلوی:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set BALE_API_ACCESS_KEY=... BALE_BOT_ID=... BALE_OTP_BASE_URL=https://safir.bale.ai/api/v3 ALLOW_DEV_OTP=false
npx supabase functions deploy send-otp
npx supabase functions deploy verify-otp
```

مستندات بله: [Safir](https://docs.bale.ai/safir) و [Gateway](https://docs.bale.ai/gateway)

> در این فاز، مسیر اصلی فرانت همان API Routeهای Next است تا کلیدها روی Vercel امن بمانند. Edge Functions برای استقرار روی Supabase آماده‌اند.

## ۵) ورود / همگام‌سازی کالا

در `/admin/products/import` متن کانال بله را بچسبانید:

- پارس خودکار فرمت موبایل و آیفون بدون رجیستری (`Not ZAA` / `Not CH`)
- **Upsert** روی کلید یکتا: brand + model + storage + ram + color + origin
- کالاهای حذف‌شده از **همان دسته** → `is_active = false` (حذف سخت نمی‌شود)
- همگام‌سازی لیست موبایل، دستهٔ آیفون بدون رجیستری را دست نمی‌زند و برعکس
- API واقعی: `POST /api/admin/sync-products` با `{ rawText, forceScope? }`
- بعداً ربات کانال بله می‌تواند همان API را صدا بزند

## ۶) اتصال GitHub + Vercel

1. ریپو را به GitHub push کنید:

```bash
git remote add origin git@github.com:ORG/refahestoon.git
git add .
git commit -m "feat: initial Refahestoon store"
git push -u origin main
```

2. در Vercel → **Add New Project** → ریپوی GitHub را انتخاب کنید.
3. Framework: Next.js — Root: `/`
4. Environment Variables را از `.env.example` وارد کنید (بدون `ALLOW_DEV_OTP=true` در production مگر برای تست).
5. Deploy کنید. از این به بعد هر push به `main` به‌صورت خودکار دیپلوی می‌شود.

## ساختار پوشه‌ها

```
src/app/(shop)/     صفحات فروشگاه
src/app/admin/      پنل ادمین
src/app/api/auth/   OTP (ارسال/تأیید)
src/lib/parser/     پارسر کانال بله
src/lib/supabase/   کلاینت‌های Supabase
supabase/migrations مهاجرت دیتابیس
supabase/functions  Edge Functions OTP
public/logo.png     لوگوی رفاهستون
```

## جریان سفارش (سایت ↔ بله)

1. مشتری سفارش را در سایت ثبت می‌کند → وضعیت `pending_confirmation`
2. جزئیات سفارش به شماره `BALE_ADMIN_PHONE` در بله ارسال می‌شود
3. ادمین در `/admin/orders` موجودی/قیمت را بررسی و **تأیید و ارسال فاکتور در بله** می‌زند → `awaiting_payment` + فاکتور و شبا/کارت برای مشتری
4. مشتری رسید را در بله می‌فرستد؛ ادمین **شماره پیگیری پرداخت** را ثبت و تأیید می‌کند → `paid` + پیام تأیید خرید در بله
5. با آماده‌سازی / ارسال کالا، وضعیت در سایت عوض می‌شود و گزارش (با کد رهگیری) برای مشتری در بله می‌رود

Migration مرتبط: `supabase/migrations/0003_order_bale_flow.sql`

## تنظیمات فروشگاه (ادمین)

در `/admin/settings` این موارد قابل ویرایش و روی سایت نمایش داده می‌شوند:

- شماره تماس، شماره پیگیری سفارش، شماره ادمین بله
- شبا / کارت / نام صاحب حساب
- لینک کانال بله محصولات
- مجوز فروشگاه اینترنتی و اینماد
- متن فوتر، محتوای «درباره ما» و «شرایط اختصاصی»

صفحات عمومی: `/about` و `/terms` — همچنین لینک‌ها و اطلاعات در فوتر.

Migration: `supabase/migrations/0004_store_settings.sql`

## اسکریپت‌ها

```bash
npm run dev      # توسعه
npm run build    # بیلد پروداکشن
npm run start    # اجرای بیلد
npm run lint     # eslint
```

## نکات امنیتی

- `SUPABASE_SERVICE_ROLE_KEY` و `BALE_API_ACCESS_KEY` فقط سمت سرور
- RLS فعال است: کاربر فقط سفارش خودش را می‌بیند
- مسیر `/admin` فقط برای `profiles.role = 'admin'`
- OTP هش‌شده ذخیره می‌شود و ۵ دقیقه اعتبار دارد
