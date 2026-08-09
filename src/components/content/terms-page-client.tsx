"use client";

import { usePublicStoreSettings } from "@/lib/store/use-public-settings";
import type { StoreSettings } from "@/lib/store/defaults";

export function TermsPageClient({
  initialSettings,
}: {
  initialSettings?: StoreSettings;
}) {
  const settings = usePublicStoreSettings(initialSettings);
  const lines = settings.terms_content
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""));

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-[var(--brand-blue)]">رفاهستون</p>
        <h1 className="text-3xl font-extrabold">شرایط اختصاصی</h1>
        <p className="text-sm text-slate-500">
          قوانین خرید، پرداخت از طریق بله، و پیگیری سفارش
        </p>
      </header>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm leading-8 text-slate-700 md:p-8 md:text-base">
        {lines.map((line, i) =>
          line === "" ? (
            <div key={i} className="h-3" />
          ) : (
            <p key={i} className="whitespace-pre-wrap">
              {line}
            </p>
          )
        )}
      </div>
    </article>
  );
}
