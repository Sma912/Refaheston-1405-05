import type { Order, OrderItem } from "@/types/database";
import type { StoreSettings } from "@/lib/store/defaults";

export function orderSubtotal(order: Pick<Order, "total_amount" | "confirmed_amount">) {
  return order.confirmed_amount ?? order.total_amount;
}

export function orderShipping(order: Pick<Order, "shipping_amount">) {
  return order.shipping_amount ?? 0;
}

export function orderPayable(
  order: Pick<Order, "total_amount" | "confirmed_amount" | "shipping_amount">
) {
  return orderSubtotal(order) + orderShipping(order);
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
  >;
};
