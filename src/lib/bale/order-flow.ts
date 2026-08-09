import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildAdminNewOrderMessage,
  buildCustomerCancelledMessage,
  buildCustomerDeliveredMessage,
  buildCustomerInvoiceMessage,
  buildCustomerPaymentConfirmedMessage,
  buildCustomerPreparingMessage,
  buildCustomerShippedMessage,
  paymentCopyText,
  type OrderMessageContext,
  type OrderMessageItem,
} from "@/lib/bale/order-messages";
import { paymentDetailsFromSettings, sendBaleTextMessage } from "@/lib/bale/safir";
import { getStoreSettingsAdmin } from "@/lib/store/settings";
import type { Order, OrderItem, OrderStatus } from "@/types/database";

export type OrderAction =
  | "approve_invoice"
  | "confirm_payment"
  | "mark_preparing"
  | "mark_shipped"
  | "mark_delivered"
  | "cancel";

function toItems(rows: OrderItem[]): OrderMessageItem[] {
  return rows.map((row) => ({
    title: row.product_title ?? "محصول",
    quantity: row.quantity,
    unitPrice: row.unit_price,
    color: row.color,
  }));
}

function toContext(
  order: Order,
  items: OrderItem[],
  overrides?: Partial<OrderMessageContext>
): OrderMessageContext {
  return {
    orderId: order.id,
    contactPhone: order.contact_phone,
    shippingAddress: order.shipping_address,
    totalAmount: order.total_amount,
    confirmedAmount: order.confirmed_amount,
    items: toItems(items),
    notes: order.notes,
    paymentRef: order.payment_ref,
    trackingNumber: order.tracking_number,
    createdAt: order.created_at,
    ...overrides,
  };
}

async function loadOrderBundle(orderId: string) {
  const supabase = createAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) throw new Error("سفارش یافت نشد");

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (itemsError) throw new Error(itemsError.message);

  return {
    order: order as Order,
    items: (items as OrderItem[]) ?? [],
  };
}

export async function notifyAdminNewOrder(orderId: string) {
  const { order, items } = await loadOrderBundle(orderId);
  const settings = await getStoreSettingsAdmin();
  const { adminPhone } = paymentDetailsFromSettings(settings);
  if (!adminPhone) {
    console.warn("[bale] bale_admin_phone is not set; skip admin notify");
    return { ok: true as const, skipped: true, reason: "no_admin_phone" };
  }

  const text = buildAdminNewOrderMessage(toContext(order, items));
  const result = await sendBaleTextMessage({
    phone: adminPhone,
    text,
    requestId: `admin-new-order-${orderId}`,
  });

  if (!result.ok) {
    console.error("[bale] admin notify failed", result);
  }
  return result;
}

export async function runOrderAction(params: {
  orderId: string;
  action: OrderAction;
  notes?: string | null;
  confirmedAmount?: number | null;
  paymentRef?: string | null;
  trackingNumber?: string | null;
  notifyCustomer?: boolean;
}) {
  const {
    orderId,
    action,
    notes,
    confirmedAmount,
    paymentRef,
    trackingNumber,
    notifyCustomer = true,
  } = params;

  const { order, items } = await loadOrderBundle(orderId);
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  let nextStatus: OrderStatus = order.status;
  const patch: Record<string, unknown> = {};

  if (typeof notes === "string") {
    patch.notes = notes.trim() || null;
  }

  switch (action) {
    case "approve_invoice": {
      if (
        order.status !== "pending_confirmation" &&
        order.status !== "awaiting_payment"
      ) {
        throw new Error(
          "فقط سفارش‌های در انتظار تأیید یا پرداخت قابل صدور فاکتور هستند"
        );
      }
      const amount =
        confirmedAmount != null && confirmedAmount > 0
          ? Math.round(confirmedAmount)
          : order.confirmed_amount ?? order.total_amount;
      nextStatus = "awaiting_payment";
      patch.status = nextStatus;
      patch.confirmed_amount = amount;
      patch.invoice_sent_at = now;
      break;
    }
    case "confirm_payment": {
      if (
        order.status !== "awaiting_payment" &&
        order.status !== "pending_confirmation"
      ) {
        throw new Error("وضعیت سفارش برای تأیید پرداخت مناسب نیست");
      }
      const ref = (paymentRef ?? order.payment_ref ?? "").trim();
      if (!ref) {
        throw new Error("شماره پیگیری پرداخت الزامی است");
      }
      nextStatus = "paid";
      patch.status = nextStatus;
      patch.payment_ref = ref;
      patch.payment_confirmed_at = now;
      break;
    }
    case "mark_preparing": {
      if (order.status !== "paid" && order.status !== "preparing") {
        throw new Error("ابتدا باید پرداخت تأیید شده باشد");
      }
      nextStatus = "preparing";
      patch.status = nextStatus;
      break;
    }
    case "mark_shipped": {
      if (
        order.status !== "paid" &&
        order.status !== "preparing" &&
        order.status !== "shipped"
      ) {
        throw new Error("وضعیت سفارش برای ثبت ارسال مناسب نیست");
      }
      const track = (trackingNumber ?? order.tracking_number ?? "").trim();
      if (!track) {
        throw new Error("کد رهگیری ارسال الزامی است");
      }
      nextStatus = "shipped";
      patch.status = nextStatus;
      patch.tracking_number = track;
      patch.shipped_at = now;
      break;
    }
    case "mark_delivered": {
      if (order.status !== "shipped" && order.status !== "delivered") {
        throw new Error("فقط سفارش ارسال‌شده قابل تحویل است");
      }
      nextStatus = "delivered";
      patch.status = nextStatus;
      break;
    }
    case "cancel": {
      if (order.status === "delivered") {
        throw new Error("سفارش تحویل‌شده قابل لغو نیست");
      }
      nextStatus = "cancelled";
      patch.status = nextStatus;
      break;
    }
    default:
      throw new Error("عملیات نامعتبر است");
  }

  const { data: updated, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .select("*")
    .single();

  if (error || !updated) {
    throw new Error(error?.message ?? "به‌روزرسانی سفارش ناموفق بود");
  }

  const updatedOrder = updated as Order;
  let baleResult: Awaited<ReturnType<typeof sendBaleTextMessage>> | null =
    null;

  if (notifyCustomer) {
    const ctx = toContext(updatedOrder, items, {
      notes: (patch.notes as string | null | undefined) ?? updatedOrder.notes,
      confirmedAmount: updatedOrder.confirmed_amount,
      paymentRef: updatedOrder.payment_ref,
      trackingNumber: updatedOrder.tracking_number,
    });

    if (action === "approve_invoice") {
      const settings = await getStoreSettingsAdmin();
      const payment = paymentDetailsFromSettings(settings);
      const text = buildCustomerInvoiceMessage(ctx, payment);
      baleResult = await sendBaleTextMessage({
        phone: updatedOrder.contact_phone,
        text,
        copyText: paymentCopyText(payment),
        requestId: `invoice-${orderId}-${updatedOrder.invoice_sent_at ?? now}`,
      });
    } else if (action === "confirm_payment") {
      baleResult = await sendBaleTextMessage({
        phone: updatedOrder.contact_phone,
        text: buildCustomerPaymentConfirmedMessage(ctx),
        requestId: `paid-${orderId}`,
      });
    } else if (action === "mark_preparing") {
      baleResult = await sendBaleTextMessage({
        phone: updatedOrder.contact_phone,
        text: buildCustomerPreparingMessage(ctx),
        requestId: `preparing-${orderId}`,
      });
    } else if (action === "mark_shipped") {
      baleResult = await sendBaleTextMessage({
        phone: updatedOrder.contact_phone,
        text: buildCustomerShippedMessage(ctx),
        copyText: updatedOrder.tracking_number ?? undefined,
        requestId: `shipped-${orderId}`,
      });
    } else if (action === "mark_delivered") {
      baleResult = await sendBaleTextMessage({
        phone: updatedOrder.contact_phone,
        text: buildCustomerDeliveredMessage(ctx),
        requestId: `delivered-${orderId}`,
      });
    } else if (action === "cancel") {
      baleResult = await sendBaleTextMessage({
        phone: updatedOrder.contact_phone,
        text: buildCustomerCancelledMessage(
          ctx,
          (patch.notes as string | null | undefined) ?? updatedOrder.notes
        ),
        requestId: `cancel-${orderId}`,
      });
    }
  }

  return {
    order: updatedOrder,
    bale: baleResult,
  };
}
