"use client";

import { usePublicStoreSettings } from "@/lib/store/use-public-settings";
import type { StoreSettings } from "@/lib/store/defaults";

function ContentBlocks({ text }: { text: string }) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4 text-sm leading-8 text-slate-700 md:text-base">
      {blocks.map((block, i) => (
        <p key={i} className="whitespace-pre-line">
          {block}
        </p>
      ))}
    </div>
  );
}

export function AboutPageClient({
  initialSettings,
}: {
  initialSettings?: StoreSettings;
}) {
  const settings = usePublicStoreSettings(initialSettings);

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-[var(--brand-blue)]">رفاهستون</p>
        <h1 className="text-3xl font-extrabold">درباره ما</h1>
        <p className="text-sm text-slate-500">
          داستان فروشگاه و مسیر فعالیت ما در بازار موبایل
        </p>
      </header>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <ContentBlocks text={settings.about_content} />
      </div>
      {(settings.contact_phone ||
        settings.order_tracking_phone ||
        settings.bale_products_channel_url) && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm">
          <h2 className="mb-3 font-semibold">ارتباط با ما</h2>
          <ul className="space-y-2 text-slate-600">
            {settings.contact_phone ? (
              <li>
                تماس:{" "}
                <span dir="ltr" className="font-medium text-slate-800">
                  {settings.contact_phone}
                </span>
              </li>
            ) : null}
            {settings.order_tracking_phone ? (
              <li>
                پیگیری سفارش:{" "}
                <span dir="ltr" className="font-medium text-slate-800">
                  {settings.order_tracking_phone}
                </span>
              </li>
            ) : null}
            {settings.bale_products_channel_url ? (
              <li>
                کانال بله:{" "}
                <a
                  href={settings.bale_products_channel_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--brand-blue)] underline"
                >
                  مشاهده لیست محصولات
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      )}
    </article>
  );
}
