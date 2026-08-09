import { formatJalaliDate } from "@/lib/utils/date";
import { formatPriceToman } from "@/lib/utils/price";

export type OrderMessageItem = {
  title: string;
  quantity: number;
  unitPrice: number;
  color?: string | null;
};

export type OrderMessageContext = {
  orderId: string;
  contactPhone: string;
  shippingAddress: string;
  totalAmount: number;
  confirmedAmount?: number | null;
  items: OrderMessageItem[];
  notes?: string | null;
  paymentRef?: string | null;
  trackingNumber?: string | null;
  createdAt?: string | null;
};

function shortId(id: string) {
  return id.slice(0, 8);
}

function amountOf(ctx: OrderMessageContext) {
  return ctx.confirmedAmount ?? ctx.totalAmount;
}

function itemsBlock(items: OrderMessageItem[]) {
  if (items.length === 0) return "—";
  return items
    .map((item, i) => {
      const color = item.color ? ` (${item.color})` : "";
      return `${i + 1}) ${item.title}${color} × ${item.quantity} — ${formatPriceToman(item.unitPrice * item.quantity)}`;
    })
    .join("\n");
}

export function buildAdminNewOrderMessage(ctx: OrderMessageContext): string {
  const date = ctx.createdAt
    ? formatJalaliDate(ctx.createdAt, true)
    : "—";
  return [
    "🛒 سفارش جدید — رفاهستون",
    "",
    `شناسه: #${shortId(ctx.orderId)}`,
    `تاریخ: ${date}`,
    `تماس مشتری: ${ctx.contactPhone}`,
    "",
    "اقلام:",
    itemsBlock(ctx.items),
    "",
    `جمع: ${formatPriceToman(ctx.totalAmount)}`,
    "",
    "آدرس:",
    ctx.shippingAddress,
    "",
    "لطفاً موجودی و قیمت را بررسی کنید و در پنل ادمین فاکتور را تأیید کنید.",
  ].join("\n");
}

export function buildCustomerInvoiceMessage(
  ctx: OrderMessageContext,
  payment: { sheba: string; cardNumber: string; cardHolder: string }
): string {
  const lines = [
    "✅ فاکتور تأییدشده — رفاهستون",
    "",
    `سفارش: #${shortId(ctx.orderId)}`,
    "",
    "اقلام:",
    itemsBlock(ctx.items),
    "",
    `مبلغ قابل پرداخت: ${formatPriceToman(amountOf(ctx))}`,
    "",
    "لطفاً مبلغ را به یکی از حساب‌های زیر واریز کنید و رسید را در همین گفتگو ارسال کنید:",
  ];

  if (payment.cardNumber) {
    lines.push("", `💳 کارت: ${payment.cardNumber}`);
    if (payment.cardHolder) lines.push(`به نام: ${payment.cardHolder}`);
  }
  if (payment.sheba) {
    lines.push("", `🏦 شبا: ${payment.sheba}`);
    if (payment.cardHolder && !payment.cardNumber) {
      lines.push(`به نام: ${payment.cardHolder}`);
    }
  }
  if (!payment.cardNumber && !payment.sheba) {
    lines.push("", "اطلاعات پرداخت به‌زودی اعلام می‌شود.");
  }

  if (ctx.notes) {
    lines.push("", `توضیح: ${ctx.notes}`);
  }

  return lines.join("\n");
}

/** برای دکمه رونوشت سفیر — اولویت با شبا */
export function paymentCopyText(payment: {
  sheba: string;
  cardNumber: string;
}): string | undefined {
  if (payment.sheba) return payment.sheba.replace(/\s/g, "");
  if (payment.cardNumber) return payment.cardNumber.replace(/\s/g, "");
  return undefined;
}

export function buildCustomerPaymentConfirmedMessage(
  ctx: OrderMessageContext
): string {
  const lines = [
    "🎉 تأیید خرید — رفاهستون",
    "",
    `سفارش #${shortId(ctx.orderId)} پرداخت شما تأیید شد.`,
    `مبلغ: ${formatPriceToman(amountOf(ctx))}`,
  ];
  if (ctx.paymentRef) {
    lines.push(`شماره پیگیری: ${ctx.paymentRef}`);
  }
  lines.push(
    "",
    "سفارش شما وارد مرحله آماده‌سازی و خرید کالا می‌شود. به‌محض ارسال، کد رهگیری را برایتان می‌فرستیم."
  );
  return lines.join("\n");
}

export function buildCustomerPreparingMessage(ctx: OrderMessageContext): string {
  return [
    "📦 آماده‌سازی سفارش — رفاهستون",
    "",
    `سفارش #${shortId(ctx.orderId)} در حال آماده‌سازی و خرید کالا است.`,
    "به‌زودی وضعیت ارسال را اطلاع می‌دهیم.",
  ].join("\n");
}

export function buildCustomerShippedMessage(ctx: OrderMessageContext): string {
  const lines = [
    "🚚 ارسال شد — رفاهستون",
    "",
    `سفارش #${shortId(ctx.orderId)} ارسال شد.`,
  ];
  if (ctx.trackingNumber) {
    lines.push(`کد رهگیری: ${ctx.trackingNumber}`);
  }
  lines.push("", "پس از تحویل، از خریدتان لذت ببرید.");
  return lines.join("\n");
}

export function buildCustomerDeliveredMessage(ctx: OrderMessageContext): string {
  return [
    "✅ تحویل شد — رفاهستون",
    "",
    `سفارش #${shortId(ctx.orderId)} تحویل داده شد.`,
    "از اعتماد شما سپاسگزاریم.",
  ].join("\n");
}

export function buildCustomerCancelledMessage(
  ctx: OrderMessageContext,
  reason?: string | null
): string {
  const lines = [
    "❌ لغو سفارش — رفاهستون",
    "",
    `سفارش #${shortId(ctx.orderId)} لغو شد.`,
  ];
  if (reason) lines.push(`دلیل: ${reason}`);
  return lines.join("\n");
}
