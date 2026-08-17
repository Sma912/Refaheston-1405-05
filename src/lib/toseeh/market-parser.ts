/**
 * پارسر فرمت بازار توسعه همراه (واتساپ/تلگرام)
 * خروجی: قیمت wholesale بدون سود
 */

export type MarketProduct = {
  brand: string;
  model: string;
  color: string;
  price: number;
};

function normalizePrice(raw: string): number {
  const price = String(raw || "")
    .replace(/[^\d.,\/]/g, "")
    .replace(/,/g, "");
  if (!price) return 0;
  if (price.includes("/")) {
    return parseInt(price.replace(/[^\d]/g, ""), 10) || 0;
  }
  // 71.000 → 71000
  if (/^\d+\.\d{3}$/.test(price)) {
    return parseInt(price.replace(/\./g, ""), 10) || 0;
  }
  return parseInt(price.replace(/[^\d]/g, ""), 10) || 0;
}

function stripDecoEmoji(line: string): string {
  return String(line || "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanColorName(raw: string): string {
  return stripDecoEmoji(raw)
    .replace(/[.\-–—:_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanModelName(raw: string): string {
  return stripDecoEmoji(raw)
    .replace(/wifi/gi, "WiFi")
    .replace(/\s+/g, " ")
    .trim();
}

function detectBrand(text: string): string {
  const t = text.toLowerCase();
  if (
    t.includes("iphone") ||
    t.includes("ipad") ||
    t.includes("airpods") ||
    t.includes("watch") ||
    t.includes("macbook") ||
    t.includes("pen")
  ) {
    return "Apple";
  }
  if (t.includes("galaxy") || /\btab\s*s|\btab\s*a|samsung/.test(t) || /\bs2[4-9]\b|\bs26\b|\ba\d{2}\b/.test(t)) {
    return "Samsung";
  }
  if (t.includes("xiaomi") || t.includes("redmi") || t.includes("poco")) {
    return "Xiaomi";
  }
  if (
    t.includes("playstation") ||
    t.includes("ps5") ||
    t.includes("ps4") ||
    t.includes("dual sense") ||
    t.includes("dualsense") ||
    t.includes("dual sence")
  ) {
    return "Sony";
  }
  if (t.includes("jbl") || t.includes("harman") || t.includes("kardon")) {
    return t.includes("harman") || t.includes("kardon") ? "Harman/Kardon" : "JBL";
  }
  return "";
}

function normalizeAppleModel(m: string): string {
  let out = m;
  if (/^1[3-9]\b/.test(out) && !/iphone/i.test(out)) {
    out = "iPhone " + out;
  }
  return out;
}

export function parseMarketList(raw: string): MarketProduct[] {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((l) =>
      l
        .trim()
        .replace(/^\*+/, "")
        .replace(/\*+$/, "")
        .replace(/^_+/, "")
        .replace(/_+$/, "")
        .trim()
    )
    .filter(Boolean);

  const products: MarketProduct[] = [];
  let currentModel = "";
  let currentBrand = "";

  for (const line of lines) {
    const clean = stripDecoEmoji(line);
    const lower = line.toLowerCase();

    const compact = clean.replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
    const isSectionHeader =
      /^(toseeh\b.*|playstation|tab\s*xiaomi(\s*pad)?|samsung|jbl|harman.*)$/i.test(
        compact
      ) ||
      (/^ipad$/i.test(compact) && !/\d/.test(clean)) ||
      /accessories\s*list/i.test(compact) ||
      /^macbook$/i.test(compact);

    if (isSectionHeader) {
      if (/play|ps5|ps4|sony/.test(lower)) currentBrand = "Sony";
      else if (/ipad|apple|macbook|airpods|watch/.test(lower) || //.test(line))
        currentBrand = "Apple";
      else if (/xiaomi|redmi|pad/.test(lower)) currentBrand = "Xiaomi";
      else if (/samsung|tab\s*s/.test(lower)) currentBrand = "Samsung";
      else if (/jbl/.test(lower)) currentBrand = "JBL";
      else if (/harman|kardon/.test(lower)) currentBrand = "Harman/Kardon";
      continue;
    }

    // CALL قیمت → رد
    if (/call|تماس/i.test(line) && !/\d{3,}/.test(line.replace(/1405.*/, ""))) {
      // اگر فقط CALL است رد کن ولی مدل را نگه دار
      if (!/\d{4,}/.test(line)) continue;
    }

    if (/^[📲📱🎮💻🎧⌚️🔊🖊️🔌🔋]/u.test(line.trimStart()) || /^🖥/u.test(line)) {
      const modelLine = cleanModelName(
        line.replace(/^[\s📲📱🎮💻🎧⌚️🔊🖊️🔌🔋]+/u, "").trim()
      );
      if (/^(09|\+98|\d{11})/.test(modelLine)) continue;
      if (/no\s*register|بدون\s*ریجستر|بدون\s*رجیستر/i.test(modelLine) && !/\d/.test(modelLine)) {
        currentBrand = detectBrand(modelLine) || currentBrand || "Apple";
        continue;
      }
      currentModel = normalizeAppleModel(modelLine);
      currentBrand =
        detectBrand(currentModel) ||
        (/not\s*(zaa|ch)/i.test(currentModel) ? "Apple" : currentBrand);
      continue;
    }

    if (
      lower.includes("iphone") ||
      lower.includes("galaxy") ||
      lower.includes("xiaomi") ||
      lower.includes("redmi") ||
      lower.includes("ipad") ||
      lower.includes("macbook") ||
      lower.includes("watch") ||
      lower.includes("airpods") ||
      lower.includes("ps5") ||
      lower.includes("ps4") ||
      lower.includes("playstation") ||
      /dual\s*sen[sc]e/.test(lower) ||
      /party\s*box|boom\s*box|soundstick|aura|onyx/.test(lower)
    ) {
      if (/no\s*register|بدون\s*ریجستر|بدون\s*رجیستر/i.test(lower) && !/\d{2,}/.test(clean)) {
        currentBrand = "Apple";
        continue;
      }
      if (
        /^(playstation|ipad|macbook)$/i.test(
          clean.replace(/[^a-z0-9\s]/gi, "").trim()
        ) &&
        !/\d/.test(clean)
      ) {
        currentBrand = detectBrand(clean) || currentBrand;
        continue;
      }
      currentModel = normalizeAppleModel(cleanModelName(clean));
      currentBrand = detectBrand(line) || currentBrand;
      continue;
    }

    if (line.includes("→") || line.includes("->") || /👉/u.test(line)) {
      const parts = line.split(/→|->|👉[\u{1F3FB}-\u{1F3FF}]?/u);
      const colorPart = cleanColorName(stripDecoEmoji(parts[0] || ""));
      const pricePart = parts.slice(1).join(" ").trim();
      if (!pricePart || !currentModel) continue;
      if (/call|تماس|📞/i.test(pricePart) && !/\d{4,}/.test(pricePart)) continue;
      const price = normalizePrice(pricePart.replace(/,/g, ""));
      if (price < 1000) continue;
      products.push({
        brand: currentBrand || detectBrand(currentModel) || "سایر",
        model: currentModel,
        color: colorPart || "—",
        price,
      });
      continue;
    }

    if (line.includes("🔥") || line.includes("💸") || /👉/u.test(line)) {
      if (!currentModel) continue;
      if (/call|تماس|📞/i.test(line) && !/\d{4,}/.test(line)) continue;
      const nums = String(line).match(/([\d.,\/]+)/g);
      if (!nums) continue;
      const price = normalizePrice(nums[nums.length - 1]);
      if (price < 1000) continue;
      let colorRaw = cleanColorName(
        stripDecoEmoji(line)
          .split(/👉|🔥|💸|\d/u)[0]
          .replace(/\./g, "")
          .replace(/[,،]/g, "")
          .trim()
      );
      if (!colorRaw && /بدون\s*گارانتی/i.test(line)) colorRaw = "بدون گارانتی";
      if (!colorRaw) colorRaw = "—";
      products.push({
        brand: currentBrand || detectBrand(currentModel) || "سایر",
        model: currentModel,
        color: colorRaw,
        price,
      });
      continue;
    }
  }

  return products;
}

export function formatMarketProductsForBale(
  products: MarketProduct[],
  opts: { title: string; percent: number; storeName: string; phones?: string; address?: string }
): string {
  if (!products.length) return "";
  const pct = Number(opts.percent) || 0;
  const withFinal = products.map((p) => ({
    ...p,
    finalPrice: Math.round(p.price * (1 + pct / 100)),
  }));

  let text = "";
  if (opts.title) text += `${opts.title}\n`;
  text += `📅 ${new Date().toLocaleDateString("fa-IR")}\n\n`;

  const groups = new Map<string, typeof withFinal>();
  for (const p of withFinal) {
    const key = p.brand || "سایر";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  for (const [brand, items] of groups) {
    text += `══ ${brand} ══\n\n`;
    let lastModel = "";
    for (const p of items) {
      if (p.model !== lastModel) {
        if (lastModel) text += "\n";
        text += `📱 ${p.model}\n`;
        lastModel = p.model;
      }
      const color = (p.color || "").replace(/[\d,\\.\/]+/g, "").trim();
      text += color ? `  ${color}: ` : "  ";
      text += `💰 ${p.finalPrice.toLocaleString("en-US")} تومان\n`;
    }
    text += `\n${"─".repeat(20)}\n\n`;
  }

  text += `\n🏪 ${opts.storeName}\n`;
  if (opts.phones) text += `📞 ${opts.phones}\n`;
  if (opts.address) text += `📍 ${opts.address}\n`;
  return text;
}
