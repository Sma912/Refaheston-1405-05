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
  "بعد از تأیید موجودی و قیمت، مراحل پرداخت از طریق اپلیکیشن بله برای شما فعال و نهایی می‌شود. لطفاً صبور باشید.";

export const ALL_ORDER_STATUSES = Object.keys(
  ORDER_STATUS_LABELS
) as OrderStatus[];
