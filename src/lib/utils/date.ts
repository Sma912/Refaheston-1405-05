import * as jalaali from "jalaali-js";

const WEEKDAYS_FA = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];

const TEHRAN_TZ = "Asia/Tehran";

function toFaDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/** اجزای تاریخ/ساعت به‌وقت تهران — مستقل از timezone سرور (مثلاً Vercel UTC) */
function tehranParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TEHRAN_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  // weekday: Sun Mon ... — map via a Date constructed from Tehran Y-M-D
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  // UTC noon on that civil date → stable weekday
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();

  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;

  return {
    year,
    month,
    day,
    hour,
    minute: Number(get("minute")),
    weekdayIndex,
  };
}

export function formatJalaliDate(
  iso: string | Date,
  withTime = false
): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";

  const t = tehranParts(date);
  const { jy, jm, jd } = jalaali.toJalaali(t.year, t.month, t.day);

  const datePart = toFaDigits(
    `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`
  );

  if (!withTime) return datePart;

  const time = toFaDigits(
    `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`
  );

  return `${datePart} — ساعت ${time}`;
}

/** مثلاً: یکشنبه ۱۴۰۵/۰۵/۱۸ — ساعت ۱۴:۳۰ */
export function formatJalaliDateTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";

  const t = tehranParts(date);
  const { jy, jm, jd } = jalaali.toJalaali(t.year, t.month, t.day);
  const weekday = WEEKDAYS_FA[t.weekdayIndex] ?? "";

  const datePart = toFaDigits(
    `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`
  );
  const time = toFaDigits(
    `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`
  );

  return `${weekday} ${datePart} — ساعت ${time}`;
}

/** Convert Jalali Y/M/D (+ optional time) to ISO for seed/import timestamps. */
export function jalaliToIso(
  jy: number,
  jm: number,
  jd: number,
  hour = 12,
  minute = 0
): string {
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd, hour, minute, 0).toISOString();
}

function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Parse channel header like 📅 ۱۴۰۵/۵/۱۸ → ISO. */
export function parseChannelDateToIso(
  text: string,
  hour = 14,
  minute = 30
): string | null {
  const normalized = toEnglishDigits(text);
  const m = normalized.match(
    /📅\s*(\d{3,4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})/
  );
  if (!m) return null;
  return jalaliToIso(Number(m[1]), Number(m[2]), Number(m[3]), hour, minute);
}
