import { getPublicStoreSettings } from "@/lib/store/settings";

/**
 * بنر تبلیغاتی راهنمای وام بانک رسالت — لینک به ربات بله
 */
export async function ResalatLoanPromoBanner() {
  const settings = await getPublicStoreSettings();
  const href =
    settings.bale_loan_bot_url.trim() ||
    process.env.NEXT_PUBLIC_BALE_LOAN_BOT_URL?.trim() ||
    "";

  const content = (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.16),transparent_42%)]" />
      <div className="pointer-events-none absolute -left-10 top-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="animate-fade-up text-sm font-medium text-white/85">
            ویژه مشتریان رفاهستون
          </p>
          <h2 className="animate-fade-up text-2xl font-extrabold leading-tight md:text-3xl">
            وام بانک رسالت با راهنمای کامل در بله
          </h2>
          <p className="animate-fade-up-delay text-sm leading-7 text-white/90 md:text-base">
            شرایط دریافت، مدارک لازم و مراحل ثبت‌نام وام قرض‌الحسنه بانک رسالت را
            قدم‌به‌قدم در ربات بله ببینید و سریع‌تر برای خرید اقساطی اقدام کنید.
          </p>
          <ul className="animate-fade-up-delay mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80 md:text-sm">
            <li>• راهنمای تصویری و متنی</li>
            <li>• پاسخ به سوالات پرتکرار</li>
            <li>• مسیر ساده تا افتتاح و دریافت</li>
          </ul>
        </div>
        <div className="animate-fade-up shrink-0">
          <span className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-[var(--brand-blue)] shadow-md transition group-hover:scale-[1.02] group-hover:shadow-lg">
            ورود به ربات راهنمای وام
          </span>
        </div>
      </div>
    </>
  );

  const className =
    "group relative block overflow-hidden rounded-3xl border border-emerald-400/30 bg-gradient-to-l from-emerald-700 via-teal-700 to-[var(--brand-blue)] px-6 py-8 text-white shadow-lg shadow-emerald-900/15 transition hover:brightness-[1.03] md:px-10 md:py-10";

  if (!href) {
    return (
      <section className={className} aria-label="تبلیغ وام بانک رسالت">
        {content}
        <p className="relative mt-4 text-xs text-white/70">
          لینک ربات هنوز تنظیم نشده — در پنل ادمین → تنظیمات فروشگاه وارد کنید.
        </p>
      </section>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label="ورود به ربات بله راهنمای وام بانک رسالت"
    >
      {content}
    </a>
  );
}
