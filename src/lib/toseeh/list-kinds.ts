/** تشخیص نوع لیست کانال توسعه همراه + رد گوشی‌های رجیستری‌شده */

export type ToseehListKind =
  | "iphone-noreg"
  | "android-noreg"
  | "ipad"
  | "xiaomi-pad"
  | "tablet" // سامسونگ تب و مشابه
  | "playstation"
  | "accessory" // ایرپاد، واچ، قلم، آداپتور
  | "audio" // JBL / Harman
  | "laptop"
  | "skip-registered"
  | "skip";

export function detectToseehListKind(body: string): ToseehListKind {
  if (!body || !String(body).trim()) return "skip";
  const t = body.toLowerCase();
  const raw = body;

  // پیام‌های صبح بخیر / تبلیغ
  if (
    /صبح بخیر|روز بخیر|لیست[‌\s]*های امروز|فرصت‌های خوب|کانال رسمی/.test(raw) &&
    !/🔥|💸|📲|💻|🎧|⌚️|🔊/.test(raw)
  ) {
    return "skip";
  }

  if (
    /playstation/.test(t) ||
    /\bps5\b/.test(t) ||
    /\bps4\b/.test(t) ||
    /dual\s*sen[sc]e/.test(t)
  ) {
    return "playstation";
  }

  if (/\bipad\b/.test(t) || /\s*_?ipad/.test(t)) return "ipad";

  if (/macbook|mackbook/.test(t) || /💻/.test(raw)) return "laptop";

  if (
    /xiaomi\s*pad/.test(t) ||
    /redmi\s*pad/.test(t) ||
    /tab\s*xiaomi/.test(t)
  ) {
    return "xiaomi-pad";
  }

  if (/tab\s*samsung|\btab\s*s\d|\btab\s*a\d|galaxy\s*tab/.test(t)) {
    return "tablet";
  }

  if (
    /accessories\s*list\s*apple|airpods|apple\s*watch|⌚️|🎧|🖊️|adaptor\s*apple/.test(
      t
    ) ||
    /watch\s*s\d|watch\s*se|watch\s*ultra|pen\s*pro|pen\s*3/.test(t)
  ) {
    return "accessory";
  }

  if (
    /\bjbl\b|harman|kardon|party\s*box|boom\s*box|soundstick|aura\s*studio|onyx|go\s*play|🔊/.test(
      t
    )
  ) {
    return "audio";
  }

  const hasNoRegister =
    /no\s*register/.test(t) ||
    /بدون\s*ریجستر/.test(t) ||
    /بدون\s*رجیستر/.test(t);
  const hasNotRegion = /\bnot\s*(zaa|ch|ll|za\/a)\b/i.test(raw);
  const hasIphone =
    /iphone/.test(t) ||
    /آیفون/.test(t) ||
    /📲\s*1[3-9]/.test(raw) ||
    /17\s*pro|17\s*-?\s*normal|16\s*pro/.test(t);

  if (hasIphone && (hasNoRegister || hasNotRegion)) return "iphone-noreg";

  // سامسونگ/اندروید بدون رجیستر
  if (
    hasNoRegister &&
    (/s2[4-9]|s26|galaxy|📲\s*s\d/i.test(raw) || /ultra|a\d{2}\b/.test(t))
  ) {
    return "android-noreg";
  }

  // لیست کامل سامسونگ رجیستری (بدون No register) → رد
  if (
    (/_samsung_|\*samsung\*/i.test(raw) ||
      (/samsung/.test(t) && /1405\//.test(raw))) &&
    !hasNoRegister &&
    !hasNotRegion
  ) {
    return "skip-registered";
  }

  // گوشی‌های سری A/S بدون ذکر noreg در لیست رجیستری
  if (
    /📲\s*(s2[4-9]|a\d{2}|a07|a17|a26|a36|a37|a56)/i.test(raw) &&
    !hasNoRegister &&
    !hasNotRegion &&
    !/tab\b/i.test(raw)
  ) {
    // اگر فقط مدل noreg تکی با Not ZAA نبود
    if (!hasIphone) return "skip-registered";
  }

  return "skip";
}

export function toseehKindTitle(kind: ToseehListKind): string {
  switch (kind) {
    case "iphone-noreg":
      return "📵 آیفون بدون ریجستر";
    case "android-noreg":
      return "📵 اندروید بدون ریجستر";
    case "ipad":
      return "آیپد اپل";
    case "xiaomi-pad":
      return "تبلت شیائومی";
    case "tablet":
      return "تبلت سامسونگ";
    case "playstation":
      return "کنسول بازی";
    case "accessory":
      return "لوازم جانبی اپل";
    case "audio":
      return "اسپیکر و صوتی";
    case "laptop":
      return "لپ‌تاپ";
    default:
      return "لیست قیمت";
  }
}

/** نگاشت به scope سایت */
export type SiteScope =
  | "mobile"
  | "iphone-noreg"
  | "tablet"
  | "ipad"
  | "xiaomi-pad"
  | "console"
  | "laptop"
  | "accessory"
  | "audio";

export function toseehKindToSiteScope(kind: ToseehListKind): SiteScope | null {
  switch (kind) {
    case "iphone-noreg":
      return "iphone-noreg";
    case "android-noreg":
      return "mobile";
    case "ipad":
      return "ipad";
    case "xiaomi-pad":
      return "xiaomi-pad";
    case "tablet":
      return "tablet";
    case "playstation":
      return "console";
    case "accessory":
      return "accessory";
    case "audio":
      return "audio";
    case "laptop":
      return "laptop";
    default:
      return null;
  }
}
