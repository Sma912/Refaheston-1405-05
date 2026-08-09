export const PAYMENT_WINDOW_MS = 10 * 60 * 1000;
export const ADMIN_CONFIRM_WINDOW_MS = 15 * 60 * 1000;

export type NoteTemplateKey =
  | "out_of_stock"
  | "qty_less_than_requested"
  | "price_changed"
  | "resubmit_request"
  | "custom";

export type NoteTemplate = {
  key: NoteTemplateKey;
  label: string;
  body: string;
  /** پیشنهاد لغو سفارش پس از ارسال */
  suggestCancel?: boolean;
};

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    key: "out_of_stock",
    label: "موجودی تمام شده",
    body: "متأسفانه موجودی این کالا در حال حاضر به پایان رسیده است. لطفاً پس از اصلاح درخواست خود، مجدداً سفارش ثبت کنید.",
    suggestCancel: true,
  },
  {
    key: "qty_less_than_requested",
    label: "موجودی کمتر از درخواست",
    body: "موجودی فعلی کمتر از تعداد درخواستی شماست. لطفاً تعداد را اصلاح کرده و مجدداً سفارش خود را ارسال کنید.",
    suggestCancel: true,
  },
  {
    key: "price_changed",
    label: "تغییر قیمت",
    body: "قیمت این کالا نسبت به زمان ثبت سفارش تغییر کرده است. لطفاً با قیمت به‌روز مجدداً سفارش خود را ثبت کنید یا با پشتیبانی هماهنگ کنید.",
    suggestCancel: true,
  },
  {
    key: "resubmit_request",
    label: "درخواست اصلاح و ارسال مجدد",
    body: "لطفاً درخواست خود را اصلاح کرده و مجدداً سفارش را ارسال کنید تا بررسی موجودی و قیمت انجام شود.",
    suggestCancel: true,
  },
];

export function getNoteTemplate(key: string | null | undefined) {
  return NOTE_TEMPLATES.find((t) => t.key === key) ?? null;
}

export function addMinutesIso(from: Date | string, minutes: number) {
  const base = typeof from === "string" ? new Date(from) : from;
  return new Date(base.getTime() + minutes * 60 * 1000).toISOString();
}

export function msRemaining(deadlineIso: string | null | undefined, now = Date.now()) {
  if (!deadlineIso) return null;
  return new Date(deadlineIso).getTime() - now;
}

export function formatCountdown(ms: number | null) {
  if (ms == null) return "—";
  if (ms <= 0) return "۰۰:۰۰";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
