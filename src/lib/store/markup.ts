import type { ProductListScope } from "@/lib/products/sync";
import type { StoreSettings } from "@/lib/store/defaults";

/** درصد سود برای هر scope از تنظیمات فروشگاه */
export function markupPercentForScope(
  settings: Pick<
    StoreSettings,
    | "markup_percent_mobile"
    | "markup_percent_iphone_noreg"
    | "markup_percent_tablet"
    | "markup_percent_ipad"
    | "markup_percent_xiaomi_pad"
    | "markup_percent_console"
    | "markup_percent_laptop"
  >,
  scope: ProductListScope
): number {
  switch (scope) {
    case "iphone-noreg":
      return settings.markup_percent_iphone_noreg;
    case "tablet":
      return settings.markup_percent_tablet;
    case "ipad":
      return settings.markup_percent_ipad;
    case "xiaomi-pad":
      return settings.markup_percent_xiaomi_pad;
    case "console":
      return settings.markup_percent_console;
    case "laptop":
      return settings.markup_percent_laptop;
    case "mobile":
    default:
      return settings.markup_percent_mobile;
  }
}

/** قیمت نهایی با درصد سود (مثلاً ۲.۷٪ → ×۱.۰۲۷) */
export function applyMarkupPercent(price: number, percent: number): number {
  if (!Number.isFinite(price) || price <= 0) return price;
  const p = Number.isFinite(percent) ? percent : 0;
  return Math.round(price * (1 + p / 100));
}
