/** تشخیص نوع لیست کانال توسعه همراه + رد گوشی‌های رجیستری‌شده */

export type ToseehListKind =
  | "iphone-noreg"
  | "android-noreg"
  | "ipad"
  | "xiaomi-pad"
  | "tablet"
  | "playstation"
  | "accessory"
  | "audio"
  | "laptop"
  | "skip-registered"
  | "skip";

export function detectToseehListKind(body: string): ToseehListKind {
  if (!body || !String(body).trim()) return "skip";
  const t = body.toLowerCase();
  const raw = body;

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
    /17\s*pro|17\s*-?\s*normal|16\s*pro|16\s*-?\s*normal/.test(t);
  const hasAndroidPhone =
    /s2[4-9]|s26|galaxy|📲\s*s\d|📲\s*a\d/i.test(raw) ||
    /\ba(07|17|26|36|37|56)\b/.test(t);

  // رجیستری / شرکتی → هرگز وارد کاتالوگ همراه‌تل یا noreg نشود
  const isRegisteredList =
    (/شرکتی/.test(raw) ||
      (/register/.test(t) && !hasNoRegister) ||
      (/_samsung_|\*samsung\*/i.test(raw) && !hasNoRegister)) &&
    !hasNoRegister;

  if (isRegisteredList) return "skip-registered";

  // آیفون بدون رجیستر / Not ZAA|CH
  if (hasIphone && (hasNoRegister || hasNotRegion)) return "iphone-noreg";

  // اندروید بدون رجیستر (جدا از موبایل همراه‌تل)
  if (hasAndroidPhone && hasNoRegister) return "android-noreg";

  // لیست سامسونگ/اندروید بدون No register
  if (hasAndroidPhone && !hasNoRegister && !hasNotRegion && !/tab\b/i.test(raw)) {
    return "skip-registered";
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

export type SiteScope =
  | "mobile"
  | "iphone-noreg"
  | "android-noreg"
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
      return "android-noreg";
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
