"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { AddToCartPanel } from "@/components/product/add-to-cart-panel";
import { ProductImage } from "@/components/product/product-image";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_PRODUCTS } from "@/lib/demo/data";
import { useDemoStore } from "@/lib/demo/store";
import { isDobitLaptopOrigin } from "@/lib/dobitkala/parse-laptop";
import { productTitle } from "@/lib/parser/bale-phone-parser";
import type { Product } from "@/types/database";

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium leading-6">{value}</dd>
    </div>
  );
}

export function ProductDetailClient({
  id,
  initialProduct,
  initialVariants,
}: {
  id: string;
  initialProduct: Product | null;
  initialVariants: Product[];
}) {
  const demo = isDemoMode();
  const storeProducts = useDemoStore((s) => s.products);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const product = useMemo(() => {
    if (demo && hydrated) {
      return storeProducts.find((p) => p.id === id) ?? null;
    }
    if (demo) {
      return DEMO_PRODUCTS.find((p) => p.id === id) ?? initialProduct;
    }
    return initialProduct;
  }, [demo, hydrated, storeProducts, id, initialProduct]);

  const variants = useMemo(() => {
    if (!product) return [];
    const source =
      demo && hydrated ? storeProducts : demo ? DEMO_PRODUCTS : initialVariants;
    const list = source.filter(
      (p) =>
        p.brand === product.brand &&
        p.model === product.model &&
        p.storage === product.storage &&
        p.ram === product.ram &&
        p.origin === product.origin
    );
    return list.length ? list : [product];
  }, [product, demo, hydrated, storeProducts, initialVariants]);

  if (!product) {
    notFound();
  }

  const laptop =
    isDobitLaptopOrigin(product.origin) ||
    Boolean(product.cpu || product.gpu || product.display);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <ProductImage
        productId={product.id}
        brand={product.brand}
        model={product.model}
        color={product.color}
        alt={productTitle(product)}
        fallbackUrl={product.image_url}
        className="aspect-square rounded-3xl border border-slate-200"
        imageClassName="p-8"
      />

      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-[var(--brand-blue)]">
            {product.brand}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
            {product.model}
          </h1>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {product.cpu && <Spec label="پردازنده" value={product.cpu} />}
            {product.gpu && <Spec label="گرافیک" value={product.gpu} />}
            {product.ram && <Spec label="رم" value={product.ram} />}
            {product.storage && (
              <Spec
                label={laptop ? "حافظه ذخیره‌سازی" : "حافظه"}
                value={product.storage}
              />
            )}
            {product.display && (
              <Spec label="صفحه نمایش" value={product.display} />
            )}
            {product.origin && !isDobitLaptopOrigin(product.origin) && (
              <Spec label="مبدأ" value={product.origin} />
            )}
            <Spec
              label="موجودی"
              value={product.stock > 0 ? `${product.stock} عدد` : "پس از تأیید"}
            />
          </dl>
        </div>

        <AddToCartPanel product={product} variants={variants} />

        {product.description && (
          <p className="text-sm leading-7 text-slate-600">
            {product.description}
          </p>
        )}
      </div>
    </div>
  );
}
