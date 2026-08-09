"use client";

import { useEffect, useState } from "react";
import { ProductCatalog } from "@/components/product/product-catalog";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_PRODUCTS } from "@/lib/demo/data";
import { useDemoStore } from "@/lib/demo/store";
import type { Product } from "@/types/database";

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

  return <ProductCatalog products={products} />;
}
