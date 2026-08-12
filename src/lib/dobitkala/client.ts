/** Dobitkala laptop price-list client (DataTables JSON + product page images). */

export type DobitLaptopRow = {
  id: string;
  slug: string;
  ref: string | null;
  brandFa: string;
  brandEn: string;
  titleEn: string;
  titleFa: string;
  cpu: string | null;
  ram: string | null;
  storage: string | null;
  gpu: string | null;
  display: string | null;
  resolution: string | null;
  color: string;
  guarantee: string | null;
  sellPrice: number;
};

const LIST_URL = "https://dobitkala.com/price-list/laptop";
const DT_URL = "https://dobitkala.com/ajax/dt";
const COLUMNS = [
  "more",
  "brand_name",
  "enname",
  "cpu",
  "ram",
  "hdd",
  "gpu",
  "resolution",
  "display",
  "color",
  "guarantee",
  "end_price",
] as const;

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeCookieValue(cookieHeader: string, name: string): string | null {
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

async function openSession(): Promise<{
  cookie: string;
  csrf: string;
  xsrf: string;
}> {
  const res = await fetch(LIST_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RefahestonBot/1.0; +https://refaheston.ir)",
      Accept: "text/html",
    },
    cache: "no-store",
  });
  const html = await res.text();
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [res.headers.get("set-cookie") || ""];
  const cookie = setCookies
    .flatMap((line) => (line ? [line.split(";")[0]!.trim()] : []))
    .filter(Boolean)
    .join("; ");
  const csrf =
    html.match(/name="csrf-token"\s+content="([^"]+)"/)?.[1]?.trim() ?? "";
  const xsrf = decodeCookieValue(cookie, "XSRF-TOKEN") ?? csrf;
  if (!csrf) {
    throw new Error("dobitkala: CSRF token not found");
  }
  return { cookie, csrf, xsrf };
}

function buildDtBody(start: number, length: number): string {
  const parts: string[] = [
    `draw=1`,
    `start=${start}`,
    `length=${length}`,
    `model=pricelist`,
    `itemname=enname`,
    `pid=laptop`,
    `search[value]=`,
    `search[regex]=false`,
    `order[0][column]=1`,
    `order[0][dir]=desc`,
  ];
  COLUMNS.forEach((c, i) => {
    const searchable = c === "more" ? "false" : "true";
    const orderable = c === "more" ? "false" : "true";
    parts.push(
      `columns[${i}][data]=${c}`,
      `columns[${i}][name]=${c}`,
      `columns[${i}][searchable]=${searchable}`,
      `columns[${i}][orderable]=${orderable}`,
      `columns[${i}][search][value]=`,
      `columns[${i}][search][regex]=false`
    );
  });
  return parts.join("&");
}

function cleanField(value: unknown): string | null {
  const t = String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t === "-" || t === "—" || t === "–" || t === ".") return null;
  return t;
}

function brandEnFromRow(row: Record<string, unknown>, titleEn: string): string {
  const brandHtml = String(row.brand_name ?? "");
  const alt = brandHtml.match(/alt="([^"]+)"/i)?.[1]?.trim();
  if (alt) return alt.toUpperCase();
  const first = titleEn.split(/\s+/)[0]?.trim();
  return (first || "UNKNOWN").toUpperCase();
}

function mapRow(row: Record<string, unknown>): DobitLaptopRow | null {
  const id = String(row.id ?? "").trim();
  const slug = String(row.slug ?? "").trim();
  if (!id || !slug) return null;

  const enHtml = String(row.enname ?? "");
  const titleEn =
    enHtml.match(/product-title[^>]*>([^<]+)</i)?.[1]?.trim() ||
    stripTags(enHtml);
  const titleFa = String(row.faname ?? "").trim() || titleEn;
  const sell = Number(row.sell_price);
  if (!Number.isFinite(sell) || sell <= 0) return null;

  const displayRaw = cleanField(row.display);
  const resolution = cleanField(row.resolution);
  let displaySize = displayRaw;
  if (displaySize) {
    displaySize = displaySize.replace(/["'“”]/g, "").trim();
    if (displaySize && !/اینچ|inch/i.test(displaySize)) {
      displaySize = `${displaySize}"`;
    }
  }
  const display =
    [displaySize || null, resolution].filter(Boolean).join(" / ") || null;

  return {
    id,
    slug,
    ref: row.ref ? String(row.ref) : null,
    brandFa:
      cleanField(row.brand_faname) || brandEnFromRow(row, titleEn),
    brandEn: brandEnFromRow(row, titleEn),
    titleEn,
    titleFa,
    cpu: cleanField(row.cpu),
    ram: cleanField(row.ram),
    storage: cleanField(row.hdd),
    gpu: cleanField(row.gpu),
    display,
    resolution,
    color: cleanField(row.color) || "—",
    guarantee: cleanField(row.guarantee),
    sellPrice: Math.round(sell),
  };
}

export async function fetchAllDobitLaptops(): Promise<DobitLaptopRow[]> {
  const session = await openSession();
  const pageSize = 100;
  const out: DobitLaptopRow[] = [];
  let total = Infinity;

  for (let start = 0; start < total; start += pageSize) {
    const res = await fetch(DT_URL, {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RefahestonBot/1.0; +https://refaheston.ir)",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: LIST_URL,
        "X-CSRF-TOKEN": session.csrf,
        "X-XSRF-TOKEN": session.xsrf,
        Cookie: session.cookie,
      },
      body: buildDtBody(start, pageSize),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`dobitkala dt HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      recordsTotal?: number;
      data?: Record<string, unknown>[];
      message?: string;
    };
    if (!Array.isArray(json.data)) {
      throw new Error(json.message || "dobitkala dt: unexpected payload");
    }
    total = Number(json.recordsTotal ?? json.data.length);
    for (const row of json.data) {
      const mapped = mapRow(row);
      if (mapped) out.push(mapped);
    }
    if (json.data.length === 0) break;
  }

  return out;
}

export async function fetchDobitProductImage(
  slug: string
): Promise<string | null> {
  const res = await fetch(`https://dobitkala.com/product/${slug}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RefahestonBot/1.0; +https://refaheston.ir)",
      Accept: "text/html",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const html = await res.text();
  const og = html.match(
    /property=["']og:image["']\s+content=["']([^"']+)["']/i
  );
  return og?.[1]?.trim() || null;
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => run()));
  return results;
}
