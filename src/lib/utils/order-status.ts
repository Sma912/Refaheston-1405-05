import type { OrderStatus } from "@/types/database";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_confirmation: "در انتظار تأیید موجودی و قیمت",
  awaiting_payment: "در انتظار پرداخت از طریق بله",
  paid: "پرداخت شده",
  preparing: "در حال آماده‌سازی",
  shipped: "ارسال شده",
  delivered: "تحویل شده",
  cancelled: "لغو شده",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending_confirmation: "bg-amber-100 text-amber-800 border-amber-200",
  awaiting_payment: "bg-orange-100 text-orange-800 border-orange-200",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
  preparing: "bg-sky-100 text-sky-800 border-sky-200",
  shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
};

export const ORDER_SUCCESS_MESSAGE =
  "سفارش شما ثبت شد و برای بررسی موجودی و قیمت به ادمین ارسال شد. پس از تأیید، فاکتور و اطلاعات پرداخت از طریق بله برایتان می‌آید.";

export const ALL_ORDER_STATUSES = Object.keys(
  ORDER_STATUS_LABELS
) as OrderStatus[];

/** ترتیب خطی فرایند (به‌جز لغو) */
export const ORDER_PIPELINE: OrderStatus[] = [
  "pending_confirmation",
  "awaiting_payment",
  "paid",
  "preparing",
  "shipped",
  "delivered",
];

export function orderPipelineIndex(status: OrderStatus): number {
  return ORDER_PIPELINE.indexOf(status);
}

/**
 * فیلدهایی که با برگشت به یک مرحله باید پاک/بازنشانی شوند
 * تا ادمین بتواند دوباره از همان نقطه ادامه دهد.
 */
export function patchForRevertToStatus(target: OrderStatus): Record<string, unknown> {
  const patch: Record<string, unknown> = { status: target };
  const idx = orderPipelineIndex(target);

  // قبل از پرداخت تأییدشده
  if (idx < orderPipelineIndex("paid") || target === "cancelled") {
    patch.payment_ref = null;
    patch.payment_confirmed_at = null;
  }
  // قبل از ارسال
  if (idx < orderPipelineIndex("shipped") || target === "cancelled") {
    patch.tracking_number = null;
    patch.shipped_at = null;
  }
  // برگشت به قبل از صدور فاکتور
  if (idx <= orderPipelineIndex("pending_confirmation") || target === "cancelled") {
    patch.invoice_sent_at = null;
    patch.payment_deadline_at = null;
    patch.admin_confirm_deadline_at = null;
  }
  // برگشت به awaiting_payment: مهلت‌ها را خالی کن تا با صدور مجدد فاکتور تازه شوند
  if (target === "awaiting_payment") {
    patch.payment_deadline_at = null;
    patch.admin_confirm_deadline_at = null;
  }

  return patch;
}
