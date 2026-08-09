"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
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
  { id: "laptop", label: "لپ‌تاپ", enabled: false },
  { id: "console", label: "کنسول بازی", enabled: false },
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

  return (
    <div className="space-y-3">
      {/* Category tabs — future categories appear here */}
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

      {/* Brand accordion — for mobile & non-registry iPhone lists */}
      {(selectedCategory === "mobile" ||
        selectedCategory === "iphone-noreg") && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right"
          >
            <div>
              <p className="text-xs text-slate-500">انتخاب برند</p>
              <p className="text-sm font-semibold text-slate-900">
                {selectedBrandLabel}
                {selectedBrand
                  ? ` (${(brandCounts[selectedBrand] ?? 0).toLocaleString("fa-IR")})`
                  : ` (${brands.reduce((n, b) => n + (brandCounts[b] ?? 0), 0).toLocaleString("fa-IR")})`}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-slate-500 transition-transform",
                open && "rotate-180"
              )}
            />
          </button>

          {open && (
            <div className="border-t border-slate-100 px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onBrandChange("")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm transition",
                    !selectedBrand
                      ? "bg-[var(--brand-red)] text-white"
                      : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                  )}
                >
                  همه برندها
                </button>
                {brands.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => onBrandChange(b)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm transition",
                      selectedBrand === b
                        ? "bg-[var(--brand-blue)] text-white"
                        : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {b}
                    <span className="mr-1 opacity-70">
                      {(brandCounts[b] ?? 0).toLocaleString("fa-IR")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
