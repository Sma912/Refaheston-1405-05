import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_PRODUCTS } from "@/lib/demo/data";
import { ProductDetailClient } from "@/components/product/product-detail-client";
import type { Product } from "@/types/database";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (isDemoMode()) {
    const p = DEMO_PRODUCTS.find((x) => x.id === id);
    if (!p) return { title: "محصول" };
    return { title: `${p.brand} ${p.model} ${p.color}` };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("brand, model, color")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { title: "محصول" };
  return { title: `${data.brand} ${data.model} ${data.color}` };
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
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();
    product = (data as Product) ?? null;
    if (product) {
      const { data: v } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("brand", product.brand)
        .eq("model", product.model)
        .eq("storage", product.storage)
        .eq("ram", product.ram)
        .eq("origin", product.origin);
      variants = (v as Product[]) ?? [product];
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
