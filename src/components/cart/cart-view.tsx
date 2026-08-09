"use client";

import Link from "next/link";
import { useCartStore } from "@/lib/cart/store";
import { formatPriceToman } from "@/lib/utils/price";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2 } from "lucide-react";

export function CartView() {
  const { items, updateQuantity, removeItem, totalAmount } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <p className="mb-4 text-slate-500">سبد خرید شما خالی است.</p>
        <Button asChild>
          <Link href="/">مشاهده محصولات</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.productId}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-semibold text-slate-900">
                {item.brand} {item.model}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {[item.storage, item.ram, item.color, item.origin]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-2 text-sm font-bold text-[var(--brand-red)]">
                {formatPriceToman(item.price)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center rounded-lg border border-slate-200">
                <button
                  type="button"
                  className="p-2"
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-sm">{item.quantity}</span>
                <button
                  type="button"
                  className="p-2"
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                onClick={() => removeItem(item.productId)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">خلاصه سبد</h2>
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">جمع کل</span>
          <span className="text-lg font-bold text-[var(--brand-red)]">
            {formatPriceToman(totalAmount())}
          </span>
        </div>
        <Button asChild className="w-full" size="lg">
          <Link href="/checkout">ادامه و ثبت سفارش</Link>
        </Button>
      </aside>
    </div>
  );
}
