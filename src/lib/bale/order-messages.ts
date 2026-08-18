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
  customerName?: string | null;
  contactPhone: string;
  shippingAddress: string;
  totalAmount: number;
  confirmedAmount?: number | null;
  shippingAmount?: number | null;
  items: OrderMessageItem[];
  notes?: string | null;
  paymentRef?: string | null;
  trackingNumber?: string | null;
  createdAt?: string | null;
  paymentDeadlineAt?: string | null;
  /** مهلت واریز به دقیقه — برای متن پیام */
  paymentWindowMinutes?: number | null;
};

function shortId(id: string) {
  return id.slice(0, 8);
}

function amountOf(ctx: OrderMessageContext) {
  const sub = ctx.confirmedAmount ?? ctx.totalAmount;
  const ship = ctx.shippingAmount ?? 0;
  return sub + ship;
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
    ctx.customerName ? `مشتری: ${ctx.customerName}` : null,
    `تماس مشتری: ${ctx.contactPhone}`,
    "",
    "اقلام:",
    itemsBlock(ctx.items),
    "",
    `جمع کالا: ${formatPriceToman(ctx.totalAmount)}`,
    "",
    "آدرس:",
    ctx.shippingAddress,
    "",
    "لطفاً موجودی و قیمت را بررسی کنید و در پنل ادمین فاکتور را تأیید کنید.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function buildCustomerInvoiceMessage(
  ctx: OrderMessageContext,
  payment: { sheba: string; cardNumber: string; cardHolder: string }
): string {
  const lines = [
    "✅ فاکتور تأییدشده — رفاهستون",
    "",
    `سفارش: #${shortId(ctx.orderId)}`,
    ctx.customerName ? `مشتری: ${ctx.customerName}` : null,
    "",
    "اقلام:",
    itemsBlock(ctx.items),
    "",
    `جمع کالا: ${formatPriceToman(ctx.confirmedAmount ?? ctx.totalAmount)}`,
    `هزینه ارسال: ${formatPriceToman(ctx.shippingAmount ?? 0)}`,
    `مبلغ قابل پرداخت: ${formatPriceToman(amountOf(ctx))}`,
    "",
    "لطفاً مبلغ را به یکی از حساب‌های زیر واریز کنید:",
  ].filter((line) => line !== null) as string[];

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

  lines.push(
    "",
    "📸 بعد از واریز، عکس رسید را همین‌جا در گفتگوی بازوی بله (@refahestonbot) بفرستید.",
    "ادمین رسید را در بله می‌بیند و پرداخت را تأیید می‌کند.",
    "",
    `⏰ مهلت واریز و ارسال رسید: ${ctx.paymentWindowMinutes ?? 10} دقیقه از زمان صدور فاکتور (به‌وقت تهران).`
  );
  if (ctx.paymentDeadlineAt) {
    lines.push(`مهلت تا: ${formatJalaliDate(ctx.paymentDeadlineAt, true)}`);
  }
  lines.push(
    "پس از پایان مهلت، در صورت عدم تأیید پرداخت، سفارش لغو می‌شود."
  );

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

export function buildCustomerAdminNoteMessage(
  ctx: OrderMessageContext,
  noteBody: string
): string {
  return [
    "📩 پیام رفاهستون درباره سفارش",
    "",
    `سفارش #${shortId(ctx.orderId)}`,
    "",
    noteBody,
  ].join("\n");
}

export function buildCustomerTimeoutCancelledMessage(
  ctx: OrderMessageContext
): string {
  return [
    "❌ لغو خودکار سفارش — رفاهستون",
    "",
    `سفارش #${shortId(ctx.orderId)} به‌دلیل پایان مهلت واریز/تأیید پرداخت لغو شد.`,
    "در صورت تمایل می‌توانید مجدداً سفارش ثبت کنید.",
  ].join("\n");
}

export function buildCustomerStatusRevertedMessage(
  ctx: OrderMessageContext,
  statusLabel: string,
  reason?: string | null
): string {
  const lines = [
    "↩️ به‌روزرسانی وضعیت سفارش — رفاهستون",
    "",
    `سفارش #${shortId(ctx.orderId)}`,
    `وضعیت جدید: ${statusLabel}`,
  ];
  if (reason?.trim()) {
    lines.push("", reason.trim());
  } else {
    lines.push("", "ادمین فرایند را به این مرحله برگرداند؛ ادامه از همین‌جا پیگیری می‌شود.");
  }
  return lines.join("\n");
}
