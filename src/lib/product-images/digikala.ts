/**
 * Resolve product images with Digikala as the preferred reference.
 * Digikala's public API is often blocked outside Iran; Torob is used as fallback
 * (many listings mirror Digikala product photos).
 */

const FETCH_TIMEOUT_MS = 6000;
const DIGIKALA_SEARCH = "https://api.digikala.com/v1/search/";
const TOROB_SEARCH = "https://api.torob.com/v4/base-product/search/";

function normalizeTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 1);
}

function scoreName(query: string, candidate: string): number {
  const A = new Set(normalizeTokens(query));
  const B = new Set(normalizeTokens(candidate));
  if (!A.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / A.size;
}

function buildSearchQuery(brand: string, model: string): string {
  const cleaned = `${brand} ${model}`
    .replace(/\b(RAM|GB|TB|5G|4G|FA|ZA\/A|CH\/A|Vietnam|India|مونتاژ|ایران|بیمه|Not\s*ZAA|Not\s*CH)\b/gi, " ")
    .replace(/\(\s*\d+\s*\/\s*\d+\s*GB\s*\)/gi, " ")
    .replace(/\(\s*\d+\s*GB\s*\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

function persianPhoneQuery(brand: string, model: string): string {
  const q = buildSearchQuery(brand, model);
  const b = brand.toLowerCase();
  if (b.includes("apple") || /iphone|ipad/i.test(q)) {
    return `گوشی اپل ${q.replace(/apple/gi, "").trim()}`;
  }
  if (b.includes("samsung") || /galaxy/i.test(q)) {
    return `گوشی سامسونگ ${q.replace(/samsung|galaxy/gi, " ").replace(/\s+/g, " ").trim()}`;
  }
  if (b.includes("xiaomi") || /redmi|poco/i.test(q)) {
    return `گوشی شیائومی ${q}`;
  }
  if (b.includes("honor")) return `گوشی آنر ${q}`;
  if (b.includes("nokia")) return `گوشی نوکیا ${q}`;
  return `گوشی ${q}`;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        ...(init?.headers || {}),
      },
    });
    if (res.status >= 300 && res.status < 400) return null;
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pickDigikalaImage(product: Record<string, unknown>): string | null {
  const images = (product.images || {}) as Record<string, unknown>;
  const main = images.main;
  if (typeof main === "string" && main.startsWith("http")) return main;
  if (main && typeof main === "object") {
    const url = (main as { url?: string }).url;
    if (url?.startsWith("http")) return url;
  }
  const list = images.list;
  if (Array.isArray(list) && list.length) {
    const first = list[0];
    if (typeof first === "string" && first.startsWith("http")) return first;
    if (first && typeof first === "object") {
      const url = (first as { url?: string }).url;
      if (url?.startsWith("http")) return url;
    }
  }
  return null;
}

async function searchDigikala(brand: string, model: string): Promise<string | null> {
  const queries = [
    persianPhoneQuery(brand, model),
    buildSearchQuery(brand, model),
  ];
  for (const q of queries) {
    const url = `${DIGIKALA_SEARCH}?q=${encodeURIComponent(q)}&page=1`;
    const data = (await fetchJson(url, {
      headers: {
        Origin: "https://www.digikala.com",
        Referer: "https://www.digikala.com/",
      },
    })) as {
      data?: { products?: Record<string, unknown>[] };
      status?: number;
    } | null;
    const products = data?.data?.products ?? [];
    if (!products.length) continue;

    const needle = buildSearchQuery(brand, model);
    let best: { score: number; url: string } | null = null;
    for (const p of products.slice(0, 12)) {
      const title = String(p.title_fa || p.title_en || "");
      if (/قاب|کاور|گلس|شارژر|کابل|محافظ|لوازم/i.test(title)) continue;
      const score = scoreName(needle, title);
      if (score < 0.45) continue;
      const img = pickDigikalaImage(p);
      if (!img || !/dkstatics/i.test(img)) continue;
      if (!best || score > best.score) best = { score, url: img };
    }
    if (best) return best.url.replace(/^http:/, "https:");
  }
  return null;
}

async function searchTorob(brand: string, model: string): Promise<string | null> {
  const queries = [
    persianPhoneQuery(brand, model),
    buildSearchQuery(brand, model),
  ];
  const needle = buildSearchQuery(brand, model);
  const mustTokens = normalizeTokens(needle).filter(
    (t) => !["گوشی", "موبایل", "apple", "samsung", "xiaomi", "honor", "nokia"].includes(t)
  );

  for (const q of queries) {
    const url = `${TOROB_SEARCH}?query=${encodeURIComponent(q)}&page=0`;
    const data = (await fetchJson(url)) as {
      results?: { name1?: string; name2?: string; image_url?: string }[];
    } | null;
    const results = data?.results ?? [];
    if (!results.length) continue;

    let best: { score: number; url: string } | null = null;
    for (const r of results.slice(0, 20)) {
      const name = `${r.name1 || ""} ${r.name2 || ""}`;
      if (/قاب|کاور|گلس|شارژر|کابل|محافظ|لوازم|آداپتور/i.test(name)) continue;
      if (!r.image_url?.startsWith("http")) continue;
      // Prefer phone-like titles when query looks like a phone
      if (/iphone|galaxy|redmi|poco|honor|nokia|a\d{2}|s2\d/i.test(needle)) {
        if (!/گوشی|iphone|galaxy|redmi|poco|honor|nokia/i.test(name)) continue;
      }
      const score = scoreName(needle, name);
      // Require at least one distinctive model token when available
      if (mustTokens.length) {
        const hit = mustTokens.some((t) => name.toLowerCase().includes(t));
        if (!hit) continue;
      }
      if (score < 0.4) continue;
      if (!best || score > best.score) best = { score, url: r.image_url };
    }
    if (best) return best.url.replace(/^http:/, "https:");
  }
  return null;
}

/** Digikala first; Torob only as last-resort catalog mirror. */
export async function resolveDigikalaProductImage(
  brand: string,
  model: string
): Promise<string | null> {
  return searchDigikala(brand, model);
}

export async function resolveTorobProductImage(
  brand: string,
  model: string
): Promise<string | null> {
  return searchTorob(brand, model);
}

/** Digikala first, then Torob (Digikala-mirrored catalog images). */
export async function resolveReferenceProductImage(
  brand: string,
  model: string
): Promise<{ url: string; source: "digikala" | "torob" } | null> {
  const digi = await searchDigikala(brand, model);
  if (digi) return { url: digi, source: "digikala" };
  const torob = await searchTorob(brand, model);
  if (torob) return { url: torob, source: "torob" };
  return null;
}
