import type { Order, OrderItem } from "@/types/database";
import type { StoreSettings } from "@/lib/store/defaults";

/** مقدار پولی از DB گاهی string/bigint می‌آید */
export function toMoney(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "bigint") return Number(value);
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

export function orderSubtotal(
  order: Pick<Order, "total_amount" | "confirmed_amount">
) {
  const confirmed = toMoney(order.confirmed_amount, NaN);
  if (Number.isFinite(confirmed) && order.confirmed_amount != null) {
    return confirmed;
  }
  return toMoney(order.total_amount, 0);
}

/**
 * هزینه ارسال سفارش؛ اگر روی سفارش ثبت نشده باشد از پیش‌فرض تنظیمات استفاده می‌شود.
 */
export function orderShipping(
  order: Pick<Order, "shipping_amount">,
  fallbackShippingCost = 0
) {
  if (order.shipping_amount != null && order.shipping_amount !== ("" as unknown)) {
    return toMoney(order.shipping_amount, fallbackShippingCost);
  }
  return toMoney(fallbackShippingCost, 0);
}

export function orderPayable(
  order: Pick<Order, "total_amount" | "confirmed_amount" | "shipping_amount">,
  fallbackShippingCost = 0
) {
  return orderSubtotal(order) + orderShipping(order, fallbackShippingCost);
}

export type InvoiceCustomer = {
  fullName: string | null;
  phone: string;
};

export type InvoiceViewModel = {
  order: Order;
  items: OrderItem[];
  customer: InvoiceCustomer;
  settings: Pick<
    StoreSettings,
    | "payment_sheba"
    | "payment_card_number"
    | "payment_card_holder"
    | "contact_phone"
    | "store_address"
    | "shipping_cost"
  >;
};
