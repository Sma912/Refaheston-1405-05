/**
 * افزایش قیمت داخل متن خام کانال توسعه همراه — فرمت پیام حفظ می‌شود
 */
export function bumpToseehChannelPrices(raw: string, percent: number): string {
  const pct = Number(percent) || 0;
  if (!pct) return raw;

  // قیمت‌های نزدیک فلش/آتش/پول؛ CALL را دست نزن
  return raw.replace(
    /((?:👉🏿|→|->|🔥|💸)[^0-9CALL📞]*)(\d{1,3}(?:,\d{3})+|\d{4,7})/gi,
    (full, prefix: string, num: string) => {
      if (/call|تماس|📞/i.test(full)) return full;
      const n = parseInt(String(num).replace(/,/g, ""), 10);
      if (!Number.isFinite(n) || n < 1000) return full;
      const bumped = Math.round(n * (1 + pct / 100));
      return `${prefix}${bumped.toLocaleString("en-US")}`;
    }
  );
}

/**
 * حذف برند کانال منبع (توسعه همراه اعتماد) تا در بله فقط رفاهستون دیده شود.
 */
export function stripToseehSourceBranding(raw: string): string {
  const brandLine =
    /^\s*[*_~`]*\s*(?:TOSEEH\s+HAMRAH(?:\s+ETEMAD)?|توسعه\s*همراه(?:\s*اعتماد)?)\s*[*_~`]*\s*$/iu;

  return String(raw || "")
    .split(/\r?\n/)
    .filter((line) => !brandLine.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimStart();
}
