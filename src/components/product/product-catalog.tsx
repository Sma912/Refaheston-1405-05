"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/types/database";
import { ProductCard } from "@/components/product/product-card";
import { CategoryBrandNav } from "@/components/shop/category-brand-nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal } from "lucide-react";
import { isNonRegistryOrigin } from "@/lib/parser/bale-phone-parser";
import { DEMO_CAT_IPHONE_NOREG } from "@/lib/demo/data";

/** تشخیص تب «آیفون بدون رجیستری» در کاتالوگ فروشگاه */
export function isNoregCatalogProduct(product: {
  origin?: string | null;
  category_id?: string | null;
  description?: string | null;
}): boolean {
  if (isNonRegistryOrigin(product.origin)) return true;
  if (product.category_id === DEMO_CAT_IPHONE_NOREG) return true;
  const d = product.description?.trim() ?? "";
  if (d.includes("بدون کد ریجستری") || d.includes("بدون رجیستری")) return true;
  return false;
}

function inCategory(product: Product, category: string): boolean {
  const noreg = isNoregCatalogProduct(product);
  if (category === "iphone-noreg") return noreg;
  if (category === "mobile") return !noreg;
  return false;
}

export function ProductCatalog({ products }: { products: Product[] }) {
  const [category, setCategory] = useState("mobile");
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [storage, setStorage] = useState("");
  const [ram, setRam] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const categoryProducts = useMemo(
    () => products.filter((p) => inCategory(p, category)),
    [products, category]
  );

  const brands = useMemo(
    () =>
      [...new Set(categoryProducts.map((p) => p.brand))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [categoryProducts]
  );
  const brandCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of categoryProducts) map[p.brand] = (map[p.brand] ?? 0) + 1;
    return map;
  }, [categoryProducts]);

  const storages = useMemo(
    () =>
      [
        ...new Set(
          categoryProducts.map((p) => p.storage).filter(Boolean) as string[]
        ),
      ].sort((a, b) => parseInt(a) - parseInt(b)),
    [categoryProducts]
  );
  const rams = useMemo(
    () =>
      [
        ...new Set(
          categoryProducts.map((p) => p.ram).filter(Boolean) as string[]
        ),
      ].sort((a, b) => parseInt(a) - parseInt(b)),
    [categoryProducts]
  );

  const filtered = useMemo(() => {
    if (category !== "mobile" && category !== "iphone-noreg") return [];
    return categoryProducts.filter((p) => {
      const hay =
        `${p.brand} ${p.model} ${p.color} ${p.origin ?? ""}`.toLowerCase();
      if (q && !hay.includes(q.trim().toLowerCase())) return false;
      if (brand && p.brand !== brand) return false;
      if (storage && p.storage !== storage) return false;
      if (ram && p.ram !== ram) return false;
      if (minPrice && p.price < Number(minPrice)) return false;
      if (maxPrice && p.price > Number(maxPrice)) return false;
      return true;
    });
  }, [
    categoryProducts,
    category,
    q,
    brand,
    storage,
    ram,
    minPrice,
    maxPrice,
  ]);

  function reset() {
    setQ("");
    setBrand("");
    setStorage("");
    setRam("");
    setMinPrice("");
    setMaxPrice("");
  }

  return (
    <div className="space-y-6">
      <CategoryBrandNav
        brands={brands}
        brandCounts={brandCounts}
        selectedCategory={category}
        selectedBrand={brand}
        onCategoryChange={(id) => {
          setCategory(id);
          setBrand("");
          reset();
        }}
        onBrandChange={setBrand}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی برند، مدل یا رنگ..."
            className="pr-10"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters((v) => !v)}
          className="sm:w-auto"
        >
          <SlidersHorizontal className="h-4 w-4" />
          فیلترها
        </Button>
      </div>

      {showFilters && (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>حافظه</Label>
            <select
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={storage}
              onChange={(e) => setStorage(e.target.value)}
            >
              <option value="">همه</option>
              {storages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>رم</Label>
            <select
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={ram}
              onChange={(e) => setRam(e.target.value)}
            >
              <option value="">همه</option>
              {rams.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>حداقل قیمت</Label>
            <Input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="تومان"
            />
          </div>
          <div className="space-y-1.5">
            <Label>حداکثر قیمت</Label>
            <Input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="تومان"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="button" variant="secondary" onClick={reset}>
              پاک کردن فیلترها
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{filtered.length.toLocaleString("fa-IR")} محصول</span>
      </div>

      {category !== "mobile" && category !== "iphone-noreg" ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-slate-500">
          این دسته به‌زودی فعال می‌شود.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-slate-500">
          محصولی با این فیلترها پیدا نشد.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
