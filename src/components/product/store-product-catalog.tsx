"use client";

import { Suspense, useEffect, useState } from "react";
import { ProductCatalog } from "@/components/product/product-catalog";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_PRODUCTS } from "@/lib/demo/data";
import { useDemoStore } from "@/lib/demo/store";
import type { Product } from "@/types/database";

function CatalogInner({ products }: { products: Product[] }) {
  return <ProductCatalog products={products} />;
}

export function StoreProductCatalog({
  initialProducts,
}: {
  initialProducts: Product[];
}) {
  const demo = isDemoMode();
  const storeProducts = useDemoStore((s) => s.products);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const products = (demo
    ? hydrated
      ? storeProducts
      : DEMO_PRODUCTS
    : initialProducts
  ).filter((p) => p.is_active);

  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-slate-400">
          در حال بارگذاری کاتالوگ...
        </div>
      }
    >
      <CatalogInner products={products} />
    </Suspense>
  );
}
