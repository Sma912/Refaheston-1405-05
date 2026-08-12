"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type ShopCategory = {
  id: string;
  label: string;
  enabled: boolean;
};

export const SHOP_CATEGORIES: ShopCategory[] = [
  { id: "mobile", label: "موبایل", enabled: true },
  {
    id: "iphone-noreg",
    label: "آیفون بدون رجیستری",
    enabled: true,
  },
  { id: "ipad", label: "آیپد", enabled: true },
  { id: "xiaomi-pad", label: "تبلت شیائومی", enabled: true },
  { id: "console", label: "کنسول بازی", enabled: true },
  { id: "laptop", label: "لپ‌تاپ", enabled: true },
  { id: "accessory", label: "لوازم جانبی", enabled: false },
];

type Props = {
  brands: string[];
  brandCounts: Record<string, number>;
  selectedCategory: string;
  selectedBrand: string;
  onCategoryChange: (categoryId: string) => void;
  onBrandChange: (brand: string) => void;
};

export function CategoryBrandNav({
  brands,
  brandCounts,
  selectedCategory,
  selectedBrand,
  onCategoryChange,
  onBrandChange,
}: Props) {
  const [open, setOpen] = useState(true);

  const selectedBrandLabel = useMemo(() => {
    if (!selectedBrand) return "همه برندها";
    return selectedBrand;
  }, [selectedBrand]);

  const showBrands = [
    "mobile",
    "iphone-noreg",
    "ipad",
    "xiaomi-pad",
    "console",
    "laptop",
    "tablet",
  ].includes(selectedCategory);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SHOP_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              disabled={!cat.enabled}
              onClick={() => cat.enabled && onCategoryChange(cat.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
                active &&
                  cat.enabled &&
                  "bg-[var(--brand-blue)] text-white shadow-sm",
                !active &&
                  cat.enabled &&
                  "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-[var(--brand-blue)]/40",
                !cat.enabled &&
                  "cursor-not-allowed bg-slate-100 text-slate-400 ring-1 ring-slate-100"
              )}
              title={!cat.enabled ? "به‌زودی" : cat.label}
            >
              {cat.label}
              {!cat.enabled && (
                <span className="mr-1 text-[10px] opacity-80">به‌زودی</span>
              )}
            </button>
          );
        })}
      </div>

      {showBrands && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700"
          >
            برند: {selectedBrandLabel}
            <ChevronDown
              className={cn("h-4 w-4 transition", open && "rotate-180")}
            />
          </button>
          {open && (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => onBrandChange("")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium ring-1",
                  !selectedBrand
                    ? "bg-[var(--brand-blue)] text-white ring-[var(--brand-blue)]"
                    : "bg-white text-slate-600 ring-slate-200"
                )}
              >
                همه ({brands.reduce((n, b) => n + (brandCounts[b] ?? 0), 0)})
              </button>
              {brands.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => onBrandChange(b)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium ring-1",
                    selectedBrand === b
                      ? "bg-[var(--brand-blue)] text-white ring-[var(--brand-blue)]"
                      : "bg-white text-slate-600 ring-slate-200"
                  )}
                >
                  {b} ({brandCounts[b] ?? 0})
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
