import type { DobitLaptopRow } from "@/lib/dobitkala/client";

const NOISE_WORDS = new Set(
  [
    "laptop",
    "ultrabook",
    "notebook",
    "gaming",
    "لپ",
    "تاپ",
    "اینچی",
    "گیمینگ",
    "مدل",
  ].map((s) => s.toLowerCase())
);

function normalizeToken(t: string): string {
  return t.replace(/[()[\],]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenLooksLikeSpec(token: string, row: DobitLaptopRow): boolean {
  const t = token.toLowerCase();
  if (!t || NOISE_WORDS.has(t)) return true;
  if (/^(inch|inches|اینچ|اینجی|اینج)$/i.test(t)) return true;
  if (/^\d+(\.\d+)?(gb|tb|mb|hz|inch|inches|in|"|”|اینچ)?$/i.test(t)) {
    // عدد خالی مثل ۱۵ مدل Katana 15 را نگه دار؛ فقط اگر دقیقاً اندازه صفحه باشد حذف کن
    if (/^\d{1,2}$/.test(t)) {
      const size = (row.display || "").match(/(\d+(?:\.\d+)?)/)?.[1];
      return size === t;
    }
    if (/^\d+(\.\d+)?$/.test(t)) {
      const size = (row.display || "").match(/(\d+(?:\.\d+)?)/)?.[1];
      return size === t;
    }
    return true;
  }
  if (/^\d+x\d+$/i.test(t)) return true;
  if (/^(ddr\d*|ssd|hdd|nvme|ips|oled|va|tn|fhd|uhd|qhd|wqxga|wuxga|hd|full)$/i.test(t))
    return true;
  if (/^(rtx|gtx|rx|arc)\d/i.test(t)) return true;
  if (/^(i[3579]|ryzen|corei[3579]|coreultra|ultra\d?)$/i.test(t)) return true;
  if (/^\d{4,5}(hx|h|u|p|hs|g\d)?$/i.test(t)) return true; // 14900HX etc.

  // رقم تکی باقی‌مانده از «Ultra 7» / «i7»
  if (/^\d$/.test(t) && row.cpu) {
    if (new RegExp(`(?:ultra|core|ryzen|\\bi)\\s*${t}\\b`, "i").test(row.cpu)) {
      return true;
    }
  }

  const fieldText = [row.cpu, row.ram, row.storage, row.gpu]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (fieldText) {
    const fieldTokens = fieldText.split(/[^a-z0-9.+]+/i).filter(Boolean);
    if (fieldTokens.includes(t)) return true;
    if (
      t.length >= 5 &&
      /[a-z]/i.test(t) &&
      /\d/.test(t) &&
      fieldText.includes(t)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * نام مدل تمیز: مشخصات (CPU/RAM/SSD/GPU/صفحه) از عنوان انگلیسی حذف می‌شود.
 * مثال:
 *  MSI Raider GE78 HX 14VIG i9 14900HX 64GB 2TB SSD RTX4090 ...
 *  → Raider GE78 HX 14VIG
 */
export function cleanLaptopModelName(row: DobitLaptopRow): string {
  let title = row.titleEn || row.titleFa;
  // اگر عنوان فارسی «مدل X» دارد، بخش بعد از مدل را ترجیح بده
  const faModel = row.titleFa.match(/مدل\s+(.+)$/i)?.[1]?.trim();
  if (faModel && faModel.length > 3) {
    // اگر انگلیسی موجود است همان را پایه بگیر؛ وگرنه فارسی
    if (!row.titleEn) title = faModel;
  }

  const brand = row.brandEn.toLowerCase();
  let tokens = normalizeToken(title)
    .split(/\s+/)
    .filter(Boolean);

  // حذف برند از ابتدای عنوان
  if (tokens[0]?.toLowerCase() === brand) {
    tokens = tokens.slice(1);
  }
  // برند چندکلمه‌ای مثل "ASUS ROG" را دست نزن؛ فقط توکن اول برند رسمی

  tokens = tokens.filter((tok) => !tokenLooksLikeSpec(tok, row));

  const cleaned = tokens.join(" ").replace(/\s+/g, " ").trim();
  if (cleaned.length >= 3) return cleaned;

  // fallback: بعد از «مدل» در فارسی
  if (faModel && faModel.length >= 3) {
    return faModel
      .replace(/\b\d+\s*GB\b/gi, "")
      .replace(/\b\d+\s*TB\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return row.titleEn || row.titleFa || row.slug;
}

export const LAPTOP_MARKUP_PERCENT = 2.5;

export function laptopFinalPrice(sellPrice: number): number {
  return Math.round(sellPrice * (1 + LAPTOP_MARKUP_PERCENT / 100));
}

export function laptopOrigin(dobitId: string): string {
  return `dobitkala:${dobitId}`;
}

export function isDobitLaptopOrigin(origin: string | null | undefined): boolean {
  return Boolean(origin?.startsWith("dobitkala:"));
}
