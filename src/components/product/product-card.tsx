import Link from "next/link";
import type { Product } from "@/types/database";
import { formatPriceToman } from "@/lib/utils/price";
import {
  isNonRegistryOrigin,
  productTitle,
} from "@/lib/parser/bale-phone-parser";
import { ProductImage } from "@/components/product/product-image";

export function ProductCard({ product }: { product: Product }) {
  const noreg = isNonRegistryOrigin(product.origin);

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition duration-300 hover:-translate-y-0.5 hover:border-[var(--brand-blue)]/30 hover:shadow-lg hover:shadow-slate-200/60"
    >
      <div className="relative">
        <ProductImage
          productId={product.id}
          brand={product.brand}
          model={product.model}
          color={product.color}
          alt={productTitle(product)}
          fallbackUrl={product.image_url}
          className="aspect-[4/3]"
          imageClassName="group-hover:scale-[1.03]"
        />
        {noreg && (
          <span className="absolute left-2 top-2 rounded-md bg-amber-500/95 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">
            بدون رجیستری
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="text-xs font-medium text-[var(--brand-blue)]">
          {product.brand}
          {product.origin ? (
            <span className="mr-1 text-slate-400">· {product.origin}</span>
          ) : null}
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-6 text-slate-900">
          {product.model}
          {product.storage ? ` ${product.storage}` : ""}
          {product.ram ? ` / ${product.ram}` : ""}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
            {product.color}
          </span>
          <span className="text-sm font-bold text-[var(--brand-red)]">
            {formatPriceToman(product.price)}
          </span>
        </div>
      </div>
    </Link>
  );
}
