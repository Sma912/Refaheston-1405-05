import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import hamrahtelCatalog from "./hamrahtel-catalog.json";

const IMAGE_DIR = path.join(process.cwd(), "public", "product-images");
const INDEX_PATH = path.join(IMAGE_DIR, "index.json");
const FETCH_TIMEOUT_MS = 12000;
const HAMRAHTEL_API = "https://core-api.hamrahtel.com/graphql/";
const HAMRAHTEL_CHANNEL = "customer";
const STATIC_PLACEHOLDER = "/product-placeholder.svg";

/** Vercel/Lambda filesystem is ephemeral/read-only for public/. */
function isEphemeralFs() {
  return process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

const remoteUrlCache = new Map<string, string>();

export type ImageCacheEntry = {
  key: string;
  brand: string;
  model: string;
  color?: string | null;
  file: string;
  source: "hamrahtel" | "placeholder";
  sourceUrl?: string;
  createdAt: string;
};

type ImageIndex = Record<string, ImageCacheEntry>;

type CatalogEntry = {
  model: string;
  hamrahtelName: string;
  hamrahtelSlug: string;
  image: string;
  score: number;
};

const catalog = hamrahtelCatalog as CatalogEntry[];

const inflight = new Map<
  string,
  Promise<{ entry: ImageCacheEntry; publicUrl: string; cached: boolean }>
>();

export function productImageKey(brand: string, model: string) {
  const raw = `${brand}|${model}`.toLowerCase().trim();
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

async function ensureDir() {
  await fs.mkdir(IMAGE_DIR, { recursive: true });
}

async function readIndex(): Promise<ImageIndex> {
  try {
    return JSON.parse(await fs.readFile(INDEX_PATH, "utf8")) as ImageIndex;
  } catch {
    return {};
  }
}

async function writeIndex(index: ImageIndex) {
  await ensureDir();
  await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2), "utf8");
}

function isRaster(file: string) {
  return /\.(jpe?g|png|webp|gif)$/i.test(file);
}

async function findExistingFile(key: string): Promise<string | null> {
  for (const file of [`${key}.jpg`, `${key}.jpeg`, `${key}.png`, `${key}.webp`, `${key}.svg`]) {
    try {
      await fs.access(path.join(IMAGE_DIR, file));
      return file;
    } catch {
      // continue
    }
  }
  return null;
}

export async function getCachedProductImage(
  brand: string,
  model: string
): Promise<ImageCacheEntry | null> {
  const key = productImageKey(brand, model);
  const index = await readIndex();
  const entry = index[key];
  const onDisk = await findExistingFile(key);
  if (!onDisk) return null;

  if (entry) {
    if (entry.file !== onDisk && isRaster(onDisk) && !isRaster(entry.file)) {
      const upgraded = { ...entry, file: onDisk, source: "hamrahtel" as const };
      index[key] = upgraded;
      await writeIndex(index);
      return upgraded;
    }
    return { ...entry, file: onDisk };
  }

  return {
    key,
    brand,
    model,
    file: onDisk,
    source: isRaster(onDisk) ? "hamrahtel" : "placeholder",
    createdAt: new Date().toISOString(),
  };
}

async function saveImageBuffer(
  key: string,
  buffer: Buffer,
  ext: string,
  meta: Omit<ImageCacheEntry, "key" | "file" | "createdAt">
): Promise<ImageCacheEntry> {
  await ensureDir();
  const file = `${key}.${ext}`;
  await fs.writeFile(path.join(IMAGE_DIR, file), buffer);
  const entry: ImageCacheEntry = {
    key,
    file,
    createdAt: new Date().toISOString(),
    ...meta,
  };
  const index = await readIndex();
  const existing = index[key];
  if (existing && isRaster(existing.file) && !isRaster(file)) {
    return existing;
  }
  // Remove stale SVG when we get a real photo
  if (isRaster(file) && existing && !isRaster(existing.file)) {
    try {
      await fs.unlink(path.join(IMAGE_DIR, existing.file));
    } catch {
      // ignore
    }
  }
  index[key] = entry;
  await writeIndex(index);
  return entry;
}

function brandColors(brand: string): [string, string] {
  const map: Record<string, [string, string]> = {
    Samsung: ["#1428A0", "#000000"],
    Apple: ["#1d1d1f", "#86868b"],
    Xiaomi: ["#FF6900", "#1a1a1a"],
    Honor: ["#000000", "#E60012"],
    Nokia: ["#124191", "#1BA3E0"],
    Motorola: ["#E1140A", "#1a1a1a"],
    Tecno: ["#00A0E9", "#003366"],
    TCH: ["#1e3a8a", "#e11d48"],
    VOCAL: ["#7c3aed", "#1e3a8a"],
  };
  return map[brand] ?? ["#1e3a8a", "#e11d48"];
}

function placeholderSvg(brand: string, model: string): Buffer {
  const [c1, c2] = brandColors(brand);
  const title = brand.slice(0, 18);
  const subtitle = model.slice(0, 30);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <linearGradient id="phone" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <rect x="210" y="90" width="380" height="520" rx="48" fill="url(#phone)"/>
  <rect x="248" y="140" width="304" height="400" rx="28" fill="#020617" opacity="0.28"/>
  <circle cx="400" cy="560" r="14" fill="#ffffff" opacity="0.9"/>
  <text x="400" y="670" text-anchor="middle" font-family="Tahoma,Arial,sans-serif" font-size="40" font-weight="700" fill="${c1}">${escapeXml(title)}</text>
  <text x="400" y="720" text-anchor="middle" font-family="Tahoma,Arial,sans-serif" font-size="22" fill="#64748b">${escapeXml(subtitle)}</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeTokens(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function matchScore(query: string, candidate: string) {
  const A = new Set(normalizeTokens(query));
  const B = new Set(normalizeTokens(candidate));
  if (!A.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = new Set([...A, ...B]).size;
  const recall = inter / A.size;
  const jaccard = inter / union;
  return recall * 0.7 + jaccard * 0.3;
}

function searchQuery(brand: string, model: string) {
  return `${brand} ${model}`
    .replace(/\b(RAM|GB|TB|5G|4G|FA|ZA\/A|CH\/A|Vietnam|India|مونتاژ|ایران|بیمه)\b/gi, " ")
    .replace(/\d+\s*GB/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function downloadImage(
  url: string
): Promise<{ buffer: Buffer; ext: string } | null> {
  const imgRes = await fetchWithTimeout(url.replace(/^http:/, "https:"), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "image/*,*/*",
      Referer: "https://hamrahtel.com/",
    },
    redirect: "follow",
  });
  if (!imgRes.ok) return null;
  const contentType = imgRes.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  if (buffer.length < 1500) return null;
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  return { buffer, ext };
}

function isAccessoryName(name: string) {
  return /باندل|قاب|کاور|گلس|شارژر|محافظ|پک|کابل|بند|آداپتور/i.test(name);
}

/** Promo overlays: gift / reward / festival banners on Hamrahtel thumbnails. */
export function isPromoImageUrl(url: string): boolean {
  try {
    const decoded = decodeURIComponent(url).toLowerCase();
    return /promotion|پاداش|جشنواره|gift|\/400t[_-]|\/200t[_-]|\/300t[_-]|honor-promotion/i.test(
      decoded
    );
  } catch {
    return /promotion|gift|honor-promotion/i.test(url.toLowerCase());
  }
}

/** Prefer clean product file over Saleor promo thumbnail paths. */
function toDownloadableImageUrl(url: string): string {
  const https = url.replace(/^http:/, "https:");
  const thumb = https.match(
    /\/thumbnails\/products\/(.+)_thumbnail_\d+\.(jpe?g|png|webp)/i
  );
  if (thumb) {
    const base = thumb[1];
    const ext = thumb[2];
    // Original product asset via Hamrahtel image CDN (usually without promo overlay)
    return `https://images.hamrahtel.com/1024x/webp/hmt-saleor-production/products/${base}.${ext}`;
  }
  return https;
}

function collectCandidateUrls(node: {
  thumbnail?: { url?: string } | null;
  media?: { url?: string; type?: string }[] | null;
}): string[] {
  const urls: string[] = [];
  const push = (raw?: string | null) => {
    if (!raw) return;
    const primary = toDownloadableImageUrl(raw);
    urls.push(primary);
    // Also keep 4096 thumbnail as fallback when CDN original 404s
    const https = raw.replace(/^http:/, "https:");
    if (/_thumbnail_\d+\./i.test(https)) {
      urls.push(https.replace(/_thumbnail_\d+\./i, "_thumbnail_4096."));
      urls.push(https);
    }
  };
  push(node.thumbnail?.url);
  for (const m of node.media ?? []) {
    if ((m.type ?? "IMAGE") === "IMAGE") push(m.url);
  }
  // de-dupe preserve order
  return [...new Set(urls)];
}

async function downloadFirstCleanImage(
  urls: string[]
): Promise<{ url: string; buffer: Buffer; ext: string } | null> {
  const preference = (url: string) => {
    if (isPromoImageUrl(url)) return -1000;
    try {
      const u = decodeURIComponent(url);
      if (/Guides/i.test(u)) return 100;
      if (/\/(?:products\/)?\d+_[a-f0-9]+/i.test(u)) return 20;
      return 50;
    } catch {
      return 0;
    }
  };
  const clean = urls.filter((u) => !isPromoImageUrl(u));
  const ordered = (clean.length ? clean : urls)
    .slice()
    .sort((a, b) => preference(b) - preference(a));

  for (const url of ordered) {
    const downloaded = await downloadImage(url);
    if (downloaded) return { url, ...downloaded };
  }
  return null;
}

/** Avoid matching iPhone 17 Pro → Pro Max, or iPhone 17 → Pro. */
function modelNameCompatible(queryModel: string, candidateName: string) {
  if (isAccessoryName(candidateName)) return false;
  const q = queryModel.toLowerCase();
  const c = candidateName.toLowerCase();
  if (/\biphone\b/i.test(q)) {
    if (!/\biphone\b/i.test(c)) return false;
    const qProMax = /pro\s*max/i.test(q);
    const cProMax = /pro\s*max/i.test(c);
    const qPro = /\bpro\b/i.test(q) && !qProMax;
    const cPro = /\bpro\b/i.test(c) && !cProMax;
    if (qProMax !== cProMax) return false;
    if (qPro !== cPro) return false;
  }
  return true;
}

function findCatalogImage(model: string): CatalogEntry | null {
  let best: CatalogEntry | null = null;
  let bestScore = 0;
  for (const entry of catalog) {
    if (
      !modelNameCompatible(model, entry.hamrahtelName) &&
      !modelNameCompatible(model, entry.model)
    ) {
      if (entry.model.toLowerCase() !== model.toLowerCase()) continue;
    }
    const score =
      entry.model.toLowerCase() === model.toLowerCase()
        ? 1
        : Math.max(
            matchScore(model, entry.model),
            matchScore(model, entry.hamrahtelName)
          );
    if (!modelNameCompatible(model, entry.hamrahtelName) && score < 1) continue;
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  if (!best || bestScore < 0.75) return null;
  return best;
}

async function selectHamrahtelImageLive(
  brand: string,
  model: string
): Promise<{ url: string; buffer: Buffer; ext: string } | null> {
  const query = `
    query($search: String!) {
      publicProducts(first: 8, channel: "${HAMRAHTEL_CHANNEL}", search: $search) {
        edges {
          node {
            name
            thumbnail(size: 1024) { url }
            media { url type }
          }
        }
      }
    }
  `;
  const searches = [model, searchQuery(brand, model)].filter(Boolean);
  for (const search of searches) {
    try {
      const res = await fetchWithTimeout(HAMRAHTEL_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables: { search } }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        data?: {
          publicProducts?: {
            edges?: {
              node: {
                name: string;
                thumbnail?: { url?: string } | null;
                media?: { url?: string; type?: string }[] | null;
              };
            }[];
          };
        };
      };
      const edges = data.data?.publicProducts?.edges ?? [];
      type Candidate = {
        name: string;
        score: number;
        urls: string[];
      };
      let best: Candidate | null = null;
      for (const edge of edges) {
        if (!modelNameCompatible(model, edge.node.name)) continue;
        // Skip combo/bundle listings that aren't the phone itself
        if (
          /\+/.test(edge.node.name) &&
          !/بیمه|insurance/i.test(edge.node.name)
        ) {
          continue;
        }
        let score = matchScore(model, edge.node.name);
        if (/بیمه|insurance/i.test(edge.node.name)) score += 0.05;
        const urls = collectCandidateUrls(edge.node);
        if (!urls.length) continue;
        if (!best || score > best.score) {
          best = { name: edge.node.name, score, urls };
        }
      }
      if (best && best.score >= 0.7) {
        const downloaded = await downloadFirstCleanImage(best.urls);
        if (downloaded) return downloaded;
      }
    } catch {
      // try next search / catalog
    }
  }
  return null;
}

async function selectHamrahtelImage(
  brand: string,
  model: string
): Promise<{ url: string; buffer: Buffer; ext: string } | null> {
  const fromCatalog = findCatalogImage(model);
  if (fromCatalog?.image && !isPromoImageUrl(fromCatalog.image)) {
    const candidates = collectCandidateUrls({
      thumbnail: { url: fromCatalog.image },
      media: [{ url: fromCatalog.image, type: "IMAGE" }],
    });
    const downloaded = await downloadFirstCleanImage(candidates);
    if (downloaded) return downloaded;
  }
  // Catalog promo thumbs (Honor +بیمه etc.) → pick clean gallery image live
  return selectHamrahtelImageLive(brand, model);
}

async function ensurePlaceholder(brand: string, model: string, color?: string | null) {
  const key = productImageKey(brand, model);
  return saveImageBuffer(key, placeholderSvg(brand, model), "svg", {
    brand,
    model,
    color: color ?? null,
    source: "placeholder",
  });
}

async function tryUpgradeToPhoto(
  brand: string,
  model: string,
  color?: string | null
) {
  try {
    const selected = await selectHamrahtelImage(brand, model);
    if (!selected) return;
    const key = productImageKey(brand, model);
    await saveImageBuffer(key, selected.buffer, selected.ext, {
      brand,
      model,
      color: color ?? null,
      source: "hamrahtel",
      sourceUrl: selected.url,
    });
  } catch {
    // ignore — keep placeholder
  }
}

async function resolveOnce(input: {
  brand: string;
  model: string;
  color?: string | null;
}): Promise<{ entry: ImageCacheEntry; publicUrl: string; cached: boolean }> {
  const { brand, model, color } = input;
  const key = productImageKey(brand, model);

  // Serverless: never write under public/; return Hamrahtel CDN URL directly.
  if (isEphemeralFs()) {
    const cachedRemote = remoteUrlCache.get(key);
    if (cachedRemote) {
      return {
        entry: {
          key,
          brand,
          model,
          color: color ?? null,
          file: "",
          source: "hamrahtel",
          sourceUrl: cachedRemote,
          createdAt: new Date().toISOString(),
        },
        publicUrl: cachedRemote,
        cached: true,
      };
    }

    try {
      const selected = await selectHamrahtelImage(brand, model);
      if (selected?.url) {
        remoteUrlCache.set(key, selected.url);
        return {
          entry: {
            key,
            brand,
            model,
            color: color ?? null,
            file: "",
            source: "hamrahtel",
            sourceUrl: selected.url,
            createdAt: new Date().toISOString(),
          },
          publicUrl: selected.url,
          cached: false,
        };
      }
    } catch (err) {
      console.error("serverless image resolve failed", err);
    }

    return {
      entry: {
        key,
        brand,
        model,
        color: color ?? null,
        file: "product-placeholder.svg",
        source: "placeholder",
        createdAt: new Date().toISOString(),
      },
      publicUrl: STATIC_PLACEHOLDER,
      cached: false,
    };
  }

  const cached = await getCachedProductImage(brand, model);
  if (cached) {
    const needsPhoto =
      !isRaster(cached.file) ||
      cached.source !== "hamrahtel" ||
      Boolean(cached.sourceUrl && isPromoImageUrl(cached.sourceUrl));
    if (needsPhoto) {
      void tryUpgradeToPhoto(brand, model, color);
    }
    return {
      entry: cached,
      publicUrl: `/product-images/${cached.file}`,
      cached: true,
    };
  }

  // Instant local placeholder so UI never waits on network
  const placeholder = await ensurePlaceholder(brand, model, color);
  void tryUpgradeToPhoto(brand, model, color);

  return {
    entry: placeholder,
    publicUrl: `/product-images/${placeholder.file}`,
    cached: false,
  };
}

export async function resolveProductImage(input: {
  brand: string;
  model: string;
  color?: string | null;
}): Promise<{ entry: ImageCacheEntry; publicUrl: string; cached: boolean }> {
  const key = productImageKey(input.brand, input.model);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = resolveOnce(input).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/** Pre-create local placeholders for many products (no network). */
export async function warmPlaceholderImages(
  items: { brand: string; model: string }[]
) {
  const unique = new Map<string, { brand: string; model: string }>();
  for (const item of items) {
    unique.set(productImageKey(item.brand, item.model), item);
  }
  for (const item of unique.values()) {
    const cached = await getCachedProductImage(item.brand, item.model);
    if (!cached) await ensurePlaceholder(item.brand, item.model);
  }
}

/** Download Hamrahtel photos for all items and cache locally. */
export async function warmHamrahtelImages(
  items: { brand: string; model: string }[],
  options?: { force?: boolean }
) {
  const unique = new Map<string, { brand: string; model: string }>();
  for (const item of items) {
    unique.set(productImageKey(item.brand, item.model), item);
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of unique.values()) {
    const cached = await getCachedProductImage(item.brand, item.model);
    const cachedIsPromo = Boolean(
      cached?.sourceUrl && isPromoImageUrl(cached.sourceUrl)
    );
    if (
      !options?.force &&
      !cachedIsPromo &&
      cached &&
      isRaster(cached.file) &&
      cached.source === "hamrahtel"
    ) {
      skipped++;
      continue;
    }
    try {
      const selected = await selectHamrahtelImage(item.brand, item.model);
      if (!selected) {
        if (!cached) await ensurePlaceholder(item.brand, item.model);
        failed++;
        continue;
      }
      const key = productImageKey(item.brand, item.model);
      await saveImageBuffer(key, selected.buffer, selected.ext, {
        brand: item.brand,
        model: item.model,
        source: "hamrahtel",
        sourceUrl: selected.url,
      });
      downloaded++;
    } catch {
      failed++;
    }
  }

  return { total: unique.size, downloaded, skipped, failed };
}
