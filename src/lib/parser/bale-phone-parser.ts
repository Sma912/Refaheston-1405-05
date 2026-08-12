import type { ParsedProduct } from "@/types/database";
import { parsePriceString } from "@/lib/utils/price";

/** Brand section like: 🔷══ Samsung ══🔷 */
const BRAND_SECTION_RE = /═+\s*(.+?)\s*═+/u;

const PRICE_RE = /:\s*💰\s*([\d,]+)\s*تومان/gu;

const COLOR_PRICE_LINE_RE =
  /^([\u0600-\u06FFA-Za-z0-9][\u0600-\u06FFA-Za-z0-9\s\-_/]*?)\s*:\s*💰\s*([\d,]+)\s*تومان\s*$/u;

/** Non-registry / non-active region markers (checked before ZA/A, CH/A). */
const NON_REGISTRY_ORIGINS = ["Not ZAA", "Not CH", "NOT ZAA", "NOT CH"];

const KNOWN_ORIGINS = [
  ...NON_REGISTRY_ORIGINS,
  "Vietnam",
  "India",
  "China",
  "UAE",
  "ZA/A",
  "CH/A",
  "LL/A",
  "VN/A",
];

/** Origins that belong in the separate «آیفون بدون رجیستری» catalog. */
export function isNonRegistryOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  const n = origin.trim().toLowerCase().replace(/\s+/g, " ");
  if (n === "not zaa" || n === "not za/a" || n === "not za a") return true;
  if (n === "not ch" || n === "not ch/a") return true;
  if (/^not\s*za\s*\/?\s*a$/.test(n)) return true;
  if (/^not\s*ch\s*\/?\s*a?$/.test(n)) return true;
  if (n.includes("non active") || n.includes("non-active")) return true;
  if (n.includes("بدون رجیستر") || n.includes("بدون کد")) return true;
  // Avoid matching unrelated phrases like "not china"
  if (/\bnot\s+zaa?\b/.test(n) || /\bnot\s+za\/a\b/.test(n)) return true;
  if (/\bnot\s+ch\b/.test(n) || /\bnot\s+ch\/a\b/.test(n)) return true;
  return false;
}

export function normalizeNonRegistryOrigin(origin: string): string {
  const n = origin.trim().toLowerCase().replace(/\s+/g, " ");
  if (/not\s*za\s*\/?\s*a/.test(n) || /not\s*zaa/.test(n)) return "Not ZAA";
  if (/not\s*ch\s*\/?\s*a?/.test(n) || /not\s*ch\b/.test(n)) return "Not CH";
  if (n.includes("non active") || n.includes("non-active")) return "Not ZAA";
  if (n.includes("بدون رجیستر") || n.includes("بدون کد")) return "Not ZAA";
  return origin.trim();
}

function normalizeBrand(brand: string): string {
  const cleaned = brand.trim().replace(/\s+/g, " ");
  const map: Record<string, string> = {
    sony: "Sony",
    samsung: "Samsung",
    xiaomi: "Xiaomi",
    apple: "Apple",
    honor: "Honor",
    huawei: "Huawei",
    nokia: "Nokia",
    realme: "Realme",
    motorola: "Motorola",
    tecno: "Tecno",
    tch: "TCH",
    vocal: "VOCAL",
  };
  return map[cleaned.toLowerCase()] ?? cleaned;
}

/** Prefer model-based brand when clear; otherwise section brand. */
function resolveBrand(modelText: string, sectionBrand: string | null): string {
  const lower = modelText.toLowerCase();
  if (lower.includes("galaxy") || lower.startsWith("samsung")) return "Samsung";
  if (
    lower.includes("poco") ||
    lower.includes("redmi") ||
    lower.startsWith("xiaomi")
  ) {
    return "Xiaomi";
  }
  if (
    lower.includes("iphone") ||
    lower.includes("ipad") ||
    lower.startsWith("apple") ||
    /^\d+\s*(pro(\s*max)?|-?\s*normal)\b/i.test(modelText.trim())
  ) {
    return "Apple";
  }
  if (
    lower.includes("ps5") ||
    lower.includes("ps4") ||
    lower.includes("playstation") ||
    /dual\s*sen[sc]e/.test(lower) ||
    lower.includes("sony")
  ) {
    return "Sony";
  }
  if (lower.includes("honor")) return "Honor";
  if (lower.includes("huawei")) return "Huawei";
  if (lower.includes("nokia")) return "Nokia";
  if (lower.includes("motorola")) return "Motorola";
  if (lower.includes("tecno")) return "Tecno";
  if (lower.startsWith("tch")) return "TCH";
  if (lower.startsWith("vocal")) return "VOCAL";
  if (lower.includes("realme")) return "Realme";
  if (sectionBrand) return normalizeBrand(sectionBrand);
  return "Unknown";
}

/** Map channel shorthand like "17 PRO MAX" / "17-Normal" → "iPhone 17 Pro Max". */
export function normalizeIphoneModel(model: string): string {
  let m = model.replace(/\s+/g, " ").trim();
  m = m.replace(/^iPhone\s+/i, "iPhone ");
  if (/^iPhone\b/i.test(m)) {
    return m
      .replace(/\bPRO\b/gi, "Pro")
      .replace(/\bMAX\b/gi, "Max")
      .replace(/\s+/g, " ")
      .trim();
  }
  m = m.replace(/^(\d+)\s*PRO\s*MAX\b/i, "iPhone $1 Pro Max");
  m = m.replace(/^(\d+)\s*PRO\b/i, "iPhone $1 Pro");
  m = m.replace(/^(\d+)\s*-?\s*Normal\b/i, "iPhone $1");
  return m.replace(/\s+/g, " ").trim();
}

function extractOrigin(text: string): { origin: string | null; rest: string } {
  let rest = text;

  // Not ZAA / Not ZA/A / Not CH / Not CH/A (before generic ZA/A, CH/A)
  const notMatch = rest.match(/\bNot\s+(ZA\s*\/?\s*A|ZAA|CH\s*\/?\s*A|CH)\b/i);
  if (notMatch) {
    const origin = normalizeNonRegistryOrigin(notMatch[0]);
    rest = rest.replace(notMatch[0], " ").replace(/\s+/g, " ").trim();
    return { origin, rest };
  }

  const nonActive = rest.match(/\bnon[-\s]?active\b/i);
  if (nonActive) {
    rest = rest.replace(nonActive[0], " ").replace(/\s+/g, " ").trim();
    return { origin: "Not ZAA", rest };
  }

  const faNoreg = rest.match(/بدون\s*(کد\s*)?رجیستر[یي]?/u);
  if (faNoreg) {
    rest = rest.replace(faNoreg[0], " ").replace(/\s+/g, " ").trim();
    return { origin: "Not ZAA", rest };
  }

  for (const origin of KNOWN_ORIGINS) {
    if (NON_REGISTRY_ORIGINS.includes(origin)) continue;
    const re = new RegExp(`\\b${origin.replace("/", "\\/")}\\b`, "i");
    if (re.test(rest)) {
      rest = rest.replace(re, " ").replace(/\s+/g, " ").trim();
      return { origin, rest };
    }
  }
  return { origin: null, rest };
}

function cleanColorLabel(raw: string): string {
  return raw
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, "")
    .replace(/�/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Format: 🎨 White  then 💰 292,740 تومان */
function parseArtColorPriceLines(
  lines: string[]
): { color: string; price: number }[] {
  const pairs: { color: string; price: number }[] = [];
  let pendingColor: string | null = null;

  for (const line of lines) {
    const colorMatch = line.match(/^🎨\s*(.+)$/u);
    if (colorMatch) {
      pendingColor = cleanColorLabel(colorMatch[1]);
      continue;
    }

    const priceMatch = line.match(/^💰\s*([\d,]+)\s*تومان/u);
    if (priceMatch) {
      const price = parsePriceString(priceMatch[1]);
      const color = pendingColor || "نامشخص";
      if (price > 0) pairs.push({ color, price });
      pendingColor = null;
      continue;
    }

    const combo = line.match(/^🎨\s*(.+?)\s*💰\s*([\d,]+)\s*تومان/u);
    if (combo) {
      const price = parsePriceString(combo[2]);
      if (price > 0) {
        pairs.push({ color: cleanColorLabel(combo[1]), price });
      }
      pendingColor = null;
    }
  }

  return pairs;
}

function extractStorageRam(text: string): {
  storage: string | null;
  ram: string | null;
  rest: string;
} {
  let rest = text;
  let storage: string | null = null;
  let ram: string | null = null;

  const ramMatch =
    rest.match(/RAM\s*(\d+)\s*GB/i) || rest.match(/RAM\s*(\d+)/i);
  if (ramMatch) {
    ram = `${ramMatch[1]}GB`;
    rest = rest.replace(ramMatch[0], " ");
  }

  const tbMatch = rest.match(/(\d+)\s*TB/i);
  if (tbMatch) {
    storage = `${tbMatch[1]}TB`;
    rest = rest.replace(tbMatch[0], " ");
  } else {
    const gbMatch = rest.match(/(\d+)\s*GB/i);
    if (gbMatch) {
      storage = `${gbMatch[1]}GB`;
      rest = rest.replace(gbMatch[0], " ");
    }
  }

  if (!ram) {
    const leftoverGb = rest.match(/(\d+)\s*GB/i);
    if (leftoverGb) {
      ram = `${leftoverGb[1]}GB`;
      rest = rest.replace(leftoverGb[0], " ");
    }
  }

  rest = rest
    .replace(/تحت لیسانس نوکیا/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { storage, ram, rest };
}

function splitModelAndColor(text: string): { model: string; color: string } {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return { model: "", color: "" };

  const persian = cleaned.match(
    /^(.*?)(?:\s+)([\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)*)$/u
  );
  if (persian && persian[1].trim()) {
    return { model: persian[1].trim(), color: persian[2].trim() };
  }

  const eng = cleaned.match(
    /^(.*?)(?:\s+)([A-Za-z][A-Za-z]*(?:\s+[A-Za-z][A-Za-z]*){0,2})$/
  );
  if (eng && eng[1].trim() && !/\d/.test(eng[2])) {
    return { model: eng[1].trim(), color: eng[2].trim() };
  }

  return { model: cleaned, color: "نامشخص" };
}

function extractColorPricePairsFromText(text: string): {
  header: string;
  pairs: { color: string; price: number }[];
} {
  const priceMatches = [...text.matchAll(PRICE_RE)];
  if (priceMatches.length === 0) {
    return { header: text.trim(), pairs: [] };
  }

  const pairs: { color: string; price: number }[] = [];
  let header = "";

  for (let p = 0; p < priceMatches.length; p++) {
    const match = priceMatches[p];
    const price = parsePriceString(match[1]);
    const regionStart =
      p === 0 ? 0 : priceMatches[p - 1].index! + priceMatches[p - 1][0].length;
    const region = text.slice(regionStart, match.index!).trim();

    if (p === 0) {
      const { model, color } = splitModelAndColor(region);
      header = model;
      if (color && price > 0) pairs.push({ color, price });
    } else if (region && price > 0) {
      pairs.push({ color: region, price });
    }
  }

  return { header, pairs };
}

function isIgnorableLine(line: string): boolean {
  if (!line) return true;
  if (/^[─\-_=━]{3,}$/u.test(line)) return true;
  if (/^📅/.test(line)) return true;
  if (/^🏪/.test(line)) return true;
  if (/^📞/.test(line)) return true;
  return false;
}

function parseContinuationPrices(
  line: string
): { color: string; price: number }[] {
  const single = line.match(COLOR_PRICE_LINE_RE);
  if (single) {
    const price = parsePriceString(single[2]);
    if (price > 0) return [{ color: single[1].trim(), price }];
  }

  // Multiple colors on one continuation line
  const { header, pairs } = extractColorPricePairsFromText(line);
  if (pairs.length === 0) return [];
  // If header looks like a model (has digits/GB), don't treat as continuation
  if (header && /(\d+\s*GB|RAM|Galaxy|iPhone|Poco|Redmi)/i.test(header)) {
    return [];
  }
  return pairs;
}

export interface ParseResult {
  products: ParsedProduct[];
  errors: string[];
  brands: string[];
}

export function parseBalePhoneText(rawText: string): ParseResult {
  const products: ParsedProduct[] = [];
  const errors: string[] = [];
  const brands = new Set<string>();
  let currentBrand: string | null = null;

  const lines = rawText.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    i += 1;

    if (isIgnorableLine(line)) continue;

    if (BRAND_SECTION_RE.test(line) && line.includes("═")) {
      const sectionMatch = line.match(BRAND_SECTION_RE);
      if (sectionMatch) {
        currentBrand = normalizeBrand(sectionMatch[1]);
        brands.add(currentBrand);
        continue;
      }
    }

    if (!line.includes("📱")) {
      if (line.includes("💰")) {
        errors.push(`خط ${i}: رنگ بدون مدل نادیده گرفته شد`);
      }
      continue;
    }

    const phoneIdx = line.indexOf("📱");
    const afterEmoji = line.slice(phoneIdx + 2).trim();

    const blockLines: string[] = [afterEmoji];
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next) {
        i += 1;
        // blank line inside a block: keep scanning (format uses blank between colors sometimes)
        // but stop if next non-empty is a new phone/section
        let j = i;
        while (j < lines.length && !lines[j].trim()) j += 1;
        if (j >= lines.length) break;
        const peek = lines[j].trim();
        if (
          peek.includes("📱") ||
          (peek.includes("═") && BRAND_SECTION_RE.test(peek)) ||
          isIgnorableLine(peek)
        ) {
          break;
        }
        continue;
      }
      if (isIgnorableLine(next)) break;
      if (next.includes("📱")) break;
      if (next.includes("═") && BRAND_SECTION_RE.test(next)) break;

      blockLines.push(next);
      i += 1;
    }

    const firstLine = blockLines[0];
    const firstLineHasPrice = PRICE_RE.test(firstLine);
    // reset lastIndex after test
    PRICE_RE.lastIndex = 0;

    let header = "";
    const pairs: { color: string; price: number }[] = [];

    const hasArtColor = blockLines.some((l) => l.includes("🎨"));

    if (hasArtColor) {
      header = firstLine;
      pairs.push(...parseArtColorPriceLines(blockLines.slice(1)));
      if (pairs.length === 0) {
        pairs.push(...parseArtColorPriceLines(blockLines));
      }
    } else if (firstLineHasPrice) {
      const parsed = extractColorPricePairsFromText(firstLine);
      header = parsed.header;
      pairs.push(...parsed.pairs);
      for (const cont of blockLines.slice(1)) {
        pairs.push(...parseContinuationPrices(cont));
      }
    } else {
      header = firstLine;
      for (const cont of blockLines.slice(1)) {
        const contPairs = parseContinuationPrices(cont);
        if (contPairs.length) {
          pairs.push(...contPairs);
        } else if (cont.includes("💰")) {
          errors.push(`مدل «${header}»: رنگ/قیمت نامعتبر — ${cont}`);
        }
      }
    }

    if (!header) {
      errors.push(`خط نزدیک ${i}: مدل شناسایی نشد`);
      continue;
    }
    if (pairs.length === 0) {
      errors.push(`مدل «${header}»: هیچ قیمتی پیدا نشد`);
      continue;
    }

    const { origin, rest: afterOrigin } = extractOrigin(header);
    const { storage, ram, rest: modelRaw } = extractStorageRam(afterOrigin);
    let model = modelRaw;
    if (!model) {
      errors.push(`مدل خالی بعد از پارس مشخصات: «${header}»`);
      continue;
    }

    const brand = resolveBrand(model, currentBrand);
    if (brand === "Apple" && !/\bipad\b/i.test(model)) {
      model = normalizeIphoneModel(model);
    }
    brands.add(brand);

    const rawBlock = ["📱 " + afterEmoji, ...blockLines.slice(1)].join("\n");
    const finalOrigin =
      origin && isNonRegistryOrigin(origin)
        ? normalizeNonRegistryOrigin(origin)
        : origin;

    for (const pair of pairs) {
      let price = pair.price;
      if (
        isNonRegistryOrigin(finalOrigin) &&
        price > 0 &&
        price < 10_000_000
      ) {
        price *= 1000;
      }
      products.push({
        brand,
        model,
        storage,
        ram,
        color: pair.color,
        price,
        origin: finalOrigin,
        raw_line: rawBlock,
      });
    }
  }

  return {
    products,
    errors,
    brands: [...brands],
  };
}

export function productTitle(p: {
  brand: string;
  model: string;
  storage?: string | null;
  ram?: string | null;
  color?: string | null;
  origin?: string | null;
}): string {
  return [p.brand, p.model, p.storage, p.ram && `RAM ${p.ram}`, p.origin, p.color]
    .filter(Boolean)
    .join(" ");
}
