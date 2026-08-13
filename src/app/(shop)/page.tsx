import { isDemoMode } from "@/lib/demo/config";
import { DEMO_PRODUCTS } from "@/lib/demo/data";
import { createClient } from "@/lib/supabase/server";
import { fetchAllActiveProducts } from "@/lib/products/fetch-active";
import { HomeCatalogWithImages } from "@/components/product/home-catalog-with-images";
import { ResalatLoanPromoBanner } from "@/components/home/resalat-loan-promo-banner";
import type { Product } from "@/types/database";
import Link from "next/link";

export default async function HomePage() {
  let products: Product[] = [];

  if (isDemoMode()) {
    products = DEMO_PRODUCTS;
  } else {
    try {
      const supabase = await createClient();
      products = await fetchAllActiveProducts(supabase);
    } catch {
      products = [];
    }
  }

  return (
    <div className="space-y-8">
      {isDemoMode() && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          حالت بررسی فعال است — {DEMO_PRODUCTS.length.toLocaleString("fa-IR")} محصول نمونه
          از کانال بارگذاری شده. پنل ادمین:{" "}
          <Link href="/admin" className="font-bold underline">
            /admin
          </Link>
        </div>
      )}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-l from-[var(--brand-blue)] via-[#2347a8] to-[var(--brand-red)] px-6 py-10 text-white shadow-lg shadow-blue-900/10 md:px-10 md:py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_45%)]" />
        <div className="relative max-w-xl space-y-3">
          <p className="animate-fade-up text-sm font-medium text-white/80">
            فروشگاه اینترنتی رفاهستون
          </p>
          <h1 className="animate-fade-up text-3xl font-extrabold leading-tight md:text-4xl">
            رفاهستون
          </h1>
          <p className="animate-fade-up-delay text-sm leading-7 text-white/90 md:text-base">
            خرید گوشی موبایل با قیمت روز. پس از ثبت سفارش، موجودی تأیید و پرداخت از طریق بله
            فعال می‌شود.
          </p>
        </div>
      </section>

      <ResalatLoanPromoBanner />

      <HomeCatalogWithImages initialProducts={products} />
    </div>
  );
}
