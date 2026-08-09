"use client";

import { StoreProductCatalog } from "@/components/product/store-product-catalog";
import type { Product } from "@/types/database";

/** Home catalog — images resolve on demand from local disk cache. */
export function HomeCatalogWithImages({
  initialProducts,
}: {
  initialProducts: Product[];
}) {
  return <StoreProductCatalog initialProducts={initialProducts} />;
}
