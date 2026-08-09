import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildAdminNewOrderMessage,
  buildCustomerAdminNoteMessage,
  buildCustomerCancelledMessage,
  buildCustomerDeliveredMessage,
  buildCustomerInvoiceMessage,
  buildCustomerPaymentConfirmedMessage,
  buildCustomerPreparingMessage,
  buildCustomerShippedMessage,
  buildCustomerTimeoutCancelledMessage,
  paymentCopyText,
  type OrderMessageContext,
  type OrderMessageItem,
} from "@/lib/bale/order-messages";
import { paymentDetailsFromSettings, sendBaleTextMessage } from "@/lib/bale/safir";
import {
  ADMIN_CONFIRM_WINDOW_MS,
  PAYMENT_WINDOW_MS,
  getNoteTemplate,
} from "@/lib/orders/note-templates";
import { toMoney } from "@/lib/orders/totals";
import { getStoreSettingsAdmin } from "@/lib/store/settings";
import type { Order, OrderItem, OrderStatus } from "@/types/database";

export type OrderAction =
  | "approve_invoice"
  | "confirm_payment"
  | "mark_preparing"
  | "mark_shipped"
  | "mark_delivered"
  | "cancel"
  | "send_note";

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
    shippingAmount: order.shipping_amount,
    items: toItems(items),
    notes: order.notes,
    paymentRef: order.payment_ref,
    trackingNumber: order.tracking_number,
    createdAt: order.created_at,
    paymentDeadlineAt: order.payment_deadline_at,
    ...overrides,
  };
}

async function loadCustomerName(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return (data?.full_name as string | null | undefined) ?? null;
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

  const customerName = await loadCustomerName((order as Order).user_id);

  return {
    order: order as Order,
    items: (items as OrderItem[]) ?? [],
    customerName,
  };
}

async function appendOrderNote(params: {
  orderId: string;
  body: string;
  templateKey?: string | null;
  createdBy?: string | null;
  sentToCustomer: boolean;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("order_notes").insert({
    order_id: params.orderId,
    body: params.body,
    template_key: params.templateKey ?? null,
    created_by: params.createdBy ?? null,
    sent_to_customer: params.sentToCustomer,
  });
  if (error) console.error("order_notes insert", error);
}

export async function notifyAdminNewOrder(orderId: string) {
  const { order, items, customerName } = await loadOrderBundle(orderId);
  const settings = await getStoreSettingsAdmin();
  const { adminPhone } = paymentDetailsFromSettings(settings);
  if (!adminPhone) {
    console.warn("[bale] bale_admin_phone is not set; skip admin notify");
    return { ok: true as const, skipped: true, reason: "no_admin_phone" };
  }

  const text = buildAdminNewOrderMessage(
    toContext(order, items, { customerName })
  );
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
  templateKey?: string | null;
  confirmedAmount?: number | null;
  shippingAmount?: number | null;
  paymentRef?: string | null;
  trackingNumber?: string | null;
  notifyCustomer?: boolean;
  adminUserId?: string | null;
}) {
  const {
    orderId,
    action,
    notes,
    templateKey,
    confirmedAmount,
    shippingAmount,
    paymentRef,
    trackingNumber,
    notifyCustomer = true,
    adminUserId = null,
  } = params;

  const { order, items, customerName } = await loadOrderBundle(orderId);
  const supabase = createAdminClient();
  const nowDate = new Date();
  const now = nowDate.toISOString();

  const template = getNoteTemplate(templateKey);
  const noteBody =
    (notes?.trim() || template?.body || "").trim() || null;

  // send_note: فقط پیام + تاریخچه، بدون تغییر وضعیت
  if (action === "send_note") {
    if (!noteBody) throw new Error("متن پیام الزامی است");
    const ctx = toContext(order, items, { customerName, notes: noteBody });
    let baleResult: Awaited<ReturnType<typeof sendBaleTextMessage>> | null =
      null;
    if (notifyCustomer) {
      baleResult = await sendBaleTextMessage({
        phone: order.contact_phone,
        text: buildCustomerAdminNoteMessage(ctx, noteBody),
        requestId: `note-${orderId}-${Date.now()}`,
      });
    }
    await appendOrderNote({
      orderId,
      body: noteBody,
      templateKey: templateKey ?? null,
      createdBy: adminUserId,
      sentToCustomer: Boolean(notifyCustomer && baleResult?.ok !== false),
    });
    if (noteBody) {
      await supabase
        .from("orders")
        .update({ notes: noteBody })
        .eq("id", orderId);
    }
    return { order, bale: baleResult };
  }

  let nextStatus: OrderStatus = order.status;
  const patch: Record<string, unknown> = {};

  if (noteBody) {
    patch.notes = noteBody;
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
      const settings = await getStoreSettingsAdmin();
      const amount =
        confirmedAmount != null && confirmedAmount > 0
          ? Math.round(confirmedAmount)
          : toMoney(order.confirmed_amount, toMoney(order.total_amount, 0));
      const ship =
        shippingAmount != null && shippingAmount >= 0
          ? Math.round(shippingAmount)
          : order.shipping_amount != null
            ? toMoney(order.shipping_amount, 0)
            : toMoney(settings.shipping_cost, 0);
      nextStatus = "awaiting_payment";
      patch.status = nextStatus;
      patch.confirmed_amount = amount;
      patch.shipping_amount = ship;
      patch.invoice_sent_at = now;
      patch.payment_deadline_at = new Date(
        nowDate.getTime() + PAYMENT_WINDOW_MS
      ).toISOString();
      patch.admin_confirm_deadline_at = new Date(
        nowDate.getTime() + ADMIN_CONFIRM_WINDOW_MS
      ).toISOString();
      break;
    }
    case "confirm_payment": {
      if (order.status !== "awaiting_payment") {
        throw new Error("وضعیت سفارش برای تأیید پرداخت مناسب نیست");
      }
      const deadline = order.admin_confirm_deadline_at
        ? new Date(order.admin_confirm_deadline_at).getTime()
        : null;
      if (deadline != null && nowDate.getTime() > deadline) {
        throw new Error(
          "مهلت ۱۵ دقیقه‌ای تأیید پرداخت به پایان رسیده؛ سفارش باید لغو شود"
        );
      }
      const paymentDeadline = order.payment_deadline_at
        ? new Date(order.payment_deadline_at).getTime()
        : null;
      if (paymentDeadline != null && nowDate.getTime() > paymentDeadline) {
        // هنوز تا ۱۵ دقیقه فرصت هست، ولی مشتری از ۱۰ دقیقه گذشته — هشدار سخت نگیر، فقط اجازه بده اگر هنوز زیر ۱۵ دقیقه است
        // طبق درخواست: مشتری ۱۰ دقیقه برای رسید؛ اگر نرسیده و ادمین در ۱۵ دقیقه پیگیری زد تأیید شود.
        // پس اگر بعد از ۱۰ دقیقه هستیم ولی قبل از ۱۵ دقیقه، هنوز OK است.
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

  const historyBodies: string[] = [];

  if (notifyCustomer) {
    const ctx = toContext(updatedOrder, items, {
      customerName,
      notes: noteBody ?? updatedOrder.notes,
      confirmedAmount: updatedOrder.confirmed_amount,
      shippingAmount: updatedOrder.shipping_amount,
      paymentRef: updatedOrder.payment_ref,
      trackingNumber: updatedOrder.tracking_number,
      paymentDeadlineAt: updatedOrder.payment_deadline_at,
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
      historyBodies.push(
        `فاکتور صادر شد. مهلت واریز مشتری: ۱۰ دقیقه. مهلت تأیید ادمین: ۱۵ دقیقه.`
      );
      if (noteBody) historyBodies.push(noteBody);
    } else if (action === "confirm_payment") {
      baleResult = await sendBaleTextMessage({
        phone: updatedOrder.contact_phone,
        text: buildCustomerPaymentConfirmedMessage(ctx),
        requestId: `paid-${orderId}`,
      });
      historyBodies.push(
        `پرداخت تأیید شد${updatedOrder.payment_ref ? ` — پیگیری: ${updatedOrder.payment_ref}` : ""}`
      );
    } else if (action === "mark_preparing") {
      baleResult = await sendBaleTextMessage({
        phone: updatedOrder.contact_phone,
        text: buildCustomerPreparingMessage(ctx),
        requestId: `preparing-${orderId}`,
      });
      historyBodies.push("وضعیت: در حال آماده‌سازی");
    } else if (action === "mark_shipped") {
      baleResult = await sendBaleTextMessage({
        phone: updatedOrder.contact_phone,
        text: buildCustomerShippedMessage(ctx),
        copyText: updatedOrder.tracking_number ?? undefined,
        requestId: `shipped-${orderId}`,
      });
      historyBodies.push(
        `ارسال شد${updatedOrder.tracking_number ? ` — رهگیری: ${updatedOrder.tracking_number}` : ""}`
      );
    } else if (action === "mark_delivered") {
      baleResult = await sendBaleTextMessage({
        phone: updatedOrder.contact_phone,
        text: buildCustomerDeliveredMessage(ctx),
        requestId: `delivered-${orderId}`,
      });
      historyBodies.push("تحویل شد");
    } else if (action === "cancel") {
      baleResult = await sendBaleTextMessage({
        phone: updatedOrder.contact_phone,
        text: buildCustomerCancelledMessage(ctx, noteBody ?? updatedOrder.notes),
        requestId: `cancel-${orderId}`,
      });
      historyBodies.push(
        `سفارش لغو شد${noteBody ? ` — ${noteBody}` : ""}`
      );
    }
  } else if (noteBody) {
    historyBodies.push(noteBody);
  }

  for (const body of historyBodies) {
    await appendOrderNote({
      orderId,
      body,
      templateKey: templateKey ?? null,
      createdBy: adminUserId,
      sentToCustomer: Boolean(notifyCustomer && baleResult?.ok !== false),
    });
  }

  return {
    order: updatedOrder,
    bale: baleResult,
  };
}

/** لغو خودکار سفارش‌های awaiting_payment که از مهلت ۱۵ دقیقه‌ای گذشته‌اند */
export async function expireOverdueAwaitingOrders() {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: overdue, error } = await supabase
    .from("orders")
    .select("id, contact_phone")
    .eq("status", "awaiting_payment")
    .not("admin_confirm_deadline_at", "is", null)
    .lt("admin_confirm_deadline_at", now)
    .limit(50);

  if (error) {
    console.error("expire overdue query", error);
    return { cancelled: 0, error: error.message };
  }

  let cancelled = 0;
  for (const row of overdue ?? []) {
    const orderId = row.id as string;
    try {
      const { order, items, customerName } = await loadOrderBundle(orderId);
      if (order.status !== "awaiting_payment") continue;

      const reason =
        "لغو خودکار: مهلت ۱۰ دقیقه‌ای واریز/ارسال رسید یا مهلت ۱۵ دقیقه‌ای تأیید ادمین به پایان رسید.";

      const { data: updated, error: updErr } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          notes: reason,
        })
        .eq("id", orderId)
        .eq("status", "awaiting_payment")
        .select("*")
        .maybeSingle();

      if (updErr || !updated) continue;

      const ctx = toContext(updated as Order, items, {
        customerName,
        notes: reason,
      });
      await sendBaleTextMessage({
        phone: (updated as Order).contact_phone,
        text: buildCustomerTimeoutCancelledMessage(ctx),
        requestId: `timeout-cancel-${orderId}`,
      });
      await appendOrderNote({
        orderId,
        body: reason,
        templateKey: null,
        createdBy: null,
        sentToCustomer: true,
      });
      cancelled += 1;
    } catch (err) {
      console.error("expire order failed", orderId, err);
    }
  }

  return { cancelled };
}
