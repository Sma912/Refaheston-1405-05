"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/types/database";
import { useCartStore } from "@/lib/cart/store";
import { Button } from "@/components/ui/button";
import { formatPriceToman } from "@/lib/utils/price";
import { formatJalaliDateTime } from "@/lib/utils/date";
import { productTitle } from "@/lib/parser/bale-phone-parser";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

export function AddToCartPanel({
  product,
  variants,
}: {
  product: Product;
  variants: Product[];
}) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [selectedId, setSelectedId] = useState(product.id);
  const [qty, setQty] = useState(1);

  const selected = variants.find((v) => v.id === selectedId) ?? product;
  const colors = variants;

  function handleAdd() {
    addItem(
      {
        productId: selected.id,
        brand: selected.brand,
        model: selected.model,
        storage: selected.storage,
        ram: selected.ram,
        color: selected.color,
        origin: selected.origin,
        price: selected.price,
        image_url: selected.image_url,
      },
      qty
    );
    toast.success("به سبد اضافه شد");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-slate-600">رنگ</p>
        <div className="flex flex-wrap gap-2">
          {colors.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedId(v.id)}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                selectedId === v.id
                  ? "border-[var(--brand-blue)] bg-blue-50 text-[var(--brand-blue)]"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {v.color}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-2xl font-bold text-[var(--brand-red)]">
          {formatPriceToman(selected.price)}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {productTitle(selected)}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          آخرین به‌روزرسانی قیمت:{" "}
          <span className="font-medium text-slate-700">
            {formatJalaliDateTime(selected.updated_at)}
          </span>
        </p>
      </div>

      <div className="flex items-center gap-3">
        <p className="text-sm text-slate-600">تعداد</p>
        <div className="inline-flex items-center rounded-lg border border-slate-200">
          <button
            type="button"
            className="p-2 hover:bg-slate-50"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium">{qty}</span>
          <button
            type="button"
            className="p-2 hover:bg-slate-50"
            onClick={() => setQty((q) => q + 1)}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={handleAdd} className="flex-1" size="lg">
          <ShoppingCart className="h-4 w-4" />
          افزودن به سبد
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            handleAdd();
            router.push("/cart");
          }}
        >
          خرید سریع
        </Button>
      </div>
    </div>
  );
}
