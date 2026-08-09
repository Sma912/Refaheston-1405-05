import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center">
        <Image
          src="/logo.png"
          alt="رفاهستون"
          width={180}
          height={37}
          className="h-9 w-auto"
        />
        <p className="max-w-md text-sm leading-relaxed text-slate-600">
          فروشگاه اینترنتی رفاهستون — تخصصی موبایل و لوازم الکترونیکی. پرداخت پس از تأیید
          موجودی از طریق اپلیکیشن بله انجام می‌شود.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
          <Link href="/" className="hover:text-[var(--brand-blue)]">
            محصولات
          </Link>
          <Link href="/orders" className="hover:text-[var(--brand-blue)]">
            سفارش‌ها
          </Link>
          <Link href="/login" className="hover:text-[var(--brand-blue)]">
            ورود
          </Link>
        </div>
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} رفاهستون. تمامی حقوق محفوظ است.
        </p>
      </div>
    </footer>
  );
}
