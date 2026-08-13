"use client";

import Image from "next/image";
import Link from "next/link";
import { usePublicStoreSettings } from "@/lib/store/use-public-settings";
import type { StoreSettings } from "@/lib/store/defaults";

function TrustBadges({ settings }: { settings: StoreSettings }) {
  const hasEnamad = Boolean(settings.enamad_url || settings.enamad_code);
  const hasLicense = Boolean(
    settings.ecommerce_license_url || settings.ecommerce_license_number
  );
  if (!hasEnamad && !hasLicense) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {hasEnamad && (
        <a
          href={
            settings.enamad_url ||
            `https://trustseal.enamad.ir/?id=${encodeURIComponent(settings.enamad_code)}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-16 min-w-16 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:border-[var(--brand-blue)]"
          title="نماد اعتماد الکترونیکی"
        >
          اینماد
          {settings.enamad_code ? (
            <span className="mr-1 font-mono text-[10px] text-slate-400" dir="ltr">
              {settings.enamad_code}
            </span>
          ) : null}
        </a>
      )}
      {hasLicense && (
        <a
          href={settings.ecommerce_license_url || "#"}
          target={settings.ecommerce_license_url ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="inline-flex min-h-16 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:border-[var(--brand-blue)]"
          title="مجوز فروشگاه اینترنتی"
        >
          مجوز فروشگاه اینترنتی
          {settings.ecommerce_license_number ? (
            <span className="mr-1 font-mono text-[10px] text-slate-400" dir="ltr">
              {settings.ecommerce_license_number}
            </span>
          ) : null}
        </a>
      )}
    </div>
  );
}

export function SiteFooter({
  initialSettings,
}: {
  initialSettings?: StoreSettings;
}) {
  const settings = usePublicStoreSettings(initialSettings);

  return (
    <footer className="mt-auto border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="space-y-3 text-center md:text-right">
          <Image
            src="/logo.png"
            alt="رفاهستون"
            width={180}
            height={37}
            className="mx-auto h-9 w-auto md:mx-0"
          />
          <p className="text-sm leading-relaxed text-slate-600">
            {settings.footer_tagline}
          </p>
          <TrustBadges settings={settings} />
        </div>

        <div className="space-y-2 text-center text-sm md:text-right">
          <h3 className="font-semibold text-slate-800">لینک‌ها</h3>
          <div className="flex flex-col gap-1.5 text-slate-500">
            <Link href="/" className="hover:text-[var(--brand-blue)]">
              محصولات
            </Link>
            <Link href="/about" className="hover:text-[var(--brand-blue)]">
              درباره ما
            </Link>
            <Link href="/terms" className="hover:text-[var(--brand-blue)]">
              شرایط اختصاصی
            </Link>
            <Link href="/orders" className="hover:text-[var(--brand-blue)]">
              سفارش‌ها
            </Link>
            {settings.bale_products_channel_url ? (
              <a
                href={settings.bale_products_channel_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--brand-blue)]"
              >
                کانال بله محصولات
              </a>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 text-center text-sm md:text-right">
          <h3 className="font-semibold text-slate-800">ارتباط</h3>
          <dl className="space-y-1.5 text-slate-600">
            {settings.contact_phone ? (
              <div>
                <dt className="text-xs text-slate-400">تماس</dt>
                <dd dir="ltr">{settings.contact_phone}</dd>
              </div>
            ) : null}
            {settings.order_tracking_phone ? (
              <div>
                <dt className="text-xs text-slate-400">پیگیری سفارش</dt>
                <dd dir="ltr">{settings.order_tracking_phone}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs text-slate-400">پرداخت</dt>
              <dd className="text-xs leading-6 text-slate-500">
                اطلاعات واریز فقط پس از تأیید سفارش، از طریق پیام بله اعلام می‌شود.
              </dd>
            </div>
            {settings.store_address ? (
              <div>
                <dt className="text-xs text-slate-400">آدرس</dt>
                <dd>{settings.store_address}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
      <p className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} رفاهستون. تمامی حقوق محفوظ است.
      </p>
    </footer>
  );
}
