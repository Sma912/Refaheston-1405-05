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

function toFaDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export function formatJalaliDate(
  iso: string | Date,
  withTime = false
): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";

  const { jy, jm, jd } = jalaali.toJalaali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );

  const datePart = toFaDigits(
    `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`
  );

  if (!withTime) return datePart;

  const time = date.toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${datePart} ${time}`;
}

/** مثلاً: یکشنبه ۱۴۰۵/۰۵/۱۸ — ساعت ۱۴:۳۰ */
export function formatJalaliDateTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";

  const { jy, jm, jd } = jalaali.toJalaali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );

  const weekday = WEEKDAYS_FA[date.getDay()];
  const datePart = toFaDigits(
    `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`
  );
  const time = date.toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  });

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
