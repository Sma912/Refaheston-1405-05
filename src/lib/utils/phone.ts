/** Convert Persian/Arabic-Indic digits to English digits. */
export function toEnglishDigits(input: string): string {
  return String(input)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Local Iranian mobile stored as 09xxxxxxxxx (exactly 11 digits). */
export const PHONE_LOCAL_LENGTH = 11;

/**
 * Normalize any common Iranian mobile form to local `09xxxxxxxxx`.
 * Accepts English/Persian digits and forms: 09… / 9… / 98… / 0098…
 */
export function normalizePhone(input: string): string | null {
  const digits = toEnglishDigits(input).replace(/[^\d]/g, "");
  let national: string | null = null;

  if (digits.startsWith("0098") && digits.length === 14) {
    national = digits.slice(4);
  } else if (digits.startsWith("98") && digits.length === 12) {
    national = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 11) {
    national = digits.slice(1);
  } else if (digits.length === 10 && digits.startsWith("9")) {
    national = digits;
  } else {
    return null;
  }

  if (!/^9\d{9}$/.test(national)) return null;
  return `0${national}`;
}

/** Bale Safir expects country code without plus: 989xxxxxxxxx */
export function phoneToBaleNumber(phone: string): string | null {
  const local = normalizePhone(phone);
  if (!local) return null;
  return `98${local.slice(1)}`;
}

export function formatPhoneDisplay(phone: string): string {
  return normalizePhone(phone) ?? phone;
}

/** Live input: Persian→English digits, fixed max length, auto-normalize full pastes. */
export function sanitizePhoneInput(input: string): string {
  const digits = toEnglishDigits(input).replace(/[^\d]/g, "");
  const normalized = normalizePhone(digits);
  if (normalized) return normalized;
  return digits.slice(0, PHONE_LOCAL_LENGTH);
}

export function sanitizeOtpInput(input: string): string {
  return toEnglishDigits(input).replace(/[^\d]/g, "").slice(0, 6);
}

export function phoneToAuthEmail(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error("شماره موبایل نامعتبر است");
  return `${normalized}@phone.refahestoon.local`;
}
