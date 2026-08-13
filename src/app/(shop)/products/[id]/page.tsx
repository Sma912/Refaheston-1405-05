import { isDemoMode } from "@/lib/demo/config";
import { DEMO_PRODUCTS } from "@/lib/demo/data";
import { ProductDetailClient } from "@/components/product/product-detail-client";
import {
  getActiveProductById,
  getProductVariants,
} from "@/lib/products/fetch-product";
import type { Product } from "@/types/database";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

/** Soft-cache public product pages (prices/stock update via revalidation window). */
export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (isDemoMode()) {
    const p = DEMO_PRODUCTS.find((x) => x.id === id);
    if (!p) return { title: "محصول" };
    return { title: `${p.brand} ${p.model} ${p.color}` };
  }
  const product = await getActiveProductById(id);
  if (!product) return { title: "محصول" };
  return {
    title: `${product.brand} ${product.model} ${product.color}`,
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;

  let product: Product | null = null;
  let variants: Product[] = [];

  if (isDemoMode()) {
    product = DEMO_PRODUCTS.find((p) => p.id === id) ?? null;
    if (product) {
      variants = DEMO_PRODUCTS.filter(
        (p) =>
          p.brand === product!.brand &&
          p.model === product!.model &&
          p.storage === product!.storage &&
          p.ram === product!.ram &&
          p.origin === product!.origin
      );
    }
  } else {
    product = await getActiveProductById(id);
    if (product) {
      variants = await getProductVariants(product);
    }
  }

  return (
    <ProductDetailClient
      id={id}
      initialProduct={product}
      initialVariants={variants}
    />
  );
}
