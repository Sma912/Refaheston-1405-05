import {
  isNonRegistryOrigin,
  parseBalePhoneText,
  type ParseResult,
} from "@/lib/parser/bale-phone-parser";
import type { ParsedProduct, Product } from "@/types/database";

export type ProductListScope =
  | "mobile"
  | "iphone-noreg"
  | "tablet"
  | "ipad"
  | "xiaomi-pad"
  | "console"
  | "laptop";

export const CATEGORY_SLUGS: Record<ProductListScope, string> = {
  mobile: "mobile",
  "iphone-noreg": "iphone-noreg",
  tablet: "tablet",
  ipad: "ipad",
  "xiaomi-pad": "xiaomi-pad",
  console: "console",
  laptop: "laptop",
};

export const DEMO_CATEGORY_IDS: Record<ProductListScope, string> = {
  mobile: "demo-cat-mobile",
  "iphone-noreg": "demo-cat-iphone-noreg",
  tablet: "demo-cat-tablet",
  ipad: "demo-cat-ipad",
  "xiaomi-pad": "demo-cat-xiaomi-pad",
  console: "demo-cat-console",
  laptop: "demo-cat-laptop",
};

export const SCOPE_LABELS: Record<ProductListScope, string> = {
  mobile: "موبایل",
  "iphone-noreg": "آیفون بدون رجیستری",
  tablet: "تبلت",
  ipad: "آیپد",
  "xiaomi-pad": "تبلت شیائومی",
  console: "کنسول بازی",
  laptop: "لپ‌تاپ",
};

export type SyncProductRow = {
  brand: string;
  model: string;
  storage: string | null;
  ram: string | null;
  color: string;
  price: number;
  origin: string | null;
  description: string | null;
  is_active: true;
  raw_import_text: string | null;
  scope: ProductListScope;
  key: string;
};

export type ProductSyncPlan = {
  parsed: ParseResult;
  stampedAt: string;
  scopes: ProductListScope[];
  rows: SyncProductRow[];
  keysByScope: Record<ProductListScope, Set<string>>;
};

export type ProductSyncStats = {
  parsed: number;
  upserted: number;
  inserted: number;
  updated: number;
  deactivated: number;
  scopes: ProductListScope[];
  errors: string[];
  stampedAt: string;
};

export function productVariantKey(p: {
  brand: string;
  model: string;
  storage?: string | null;
  ram?: string | null;
  color: string;
  origin?: string | null;
}): string {
  return [
    p.brand,
    p.model,
    p.storage ?? "",
    p.ram ?? "",
    p.color,
    p.origin ?? "",
  ]
    .join("|")
    .toLowerCase();
}

function modelHay(p: { brand?: string | null; model?: string | null }) {
  return `${p.brand ?? ""} ${p.model ?? ""}`.toLowerCase();
}

export function isIpadProduct(p: {
  brand?: string | null;
  model?: string | null;
  category_id?: string | null;
}): boolean {
  if (
    p.category_id === DEMO_CATEGORY_IDS.ipad ||
    p.category_id === DEMO_CATEGORY_IDS.tablet
  ) {
    const m = modelHay(p);
    if (/xiaomi\s*pad|redmi\s*pad/.test(m)) return false;
    if (p.category_id === DEMO_CATEGORY_IDS.ipad) return true;
  }
  return /\bipad\b/.test(modelHay(p));
}

export function isXiaomiPadProduct(p: {
  brand?: string | null;
  model?: string | null;
  category_id?: string | null;
}): boolean {
  if (p.category_id === DEMO_CATEGORY_IDS["xiaomi-pad"]) return true;
  const m = modelHay(p);
  return /xiaomi\s*pad/.test(m) || /redmi\s*pad/.test(m);
}

export function isTabletProduct(p: {
  brand?: string | null;
  model?: string | null;
  category_id?: string | null;
}): boolean {
  return isIpadProduct(p) || isXiaomiPadProduct(p);
}

export function isConsoleProduct(p: {
  brand?: string | null;
  model?: string | null;
  category_id?: string | null;
}): boolean {
  if (p.category_id === DEMO_CATEGORY_IDS.console) return true;
  const m = modelHay(p);
  return (
    /\bps5\b/.test(m) ||
    /\bps4\b/.test(m) ||
    /playstation/.test(m) ||
    /dual\s*sen[sc]e/.test(m) ||
    /\bxbox\b/.test(m) ||
    /nintendo|switch/.test(m)
  );
}

export function isLaptopProduct(p: {
  brand?: string | null;
  model?: string | null;
  category_id?: string | null;
  origin?: string | null;
}): boolean {
  if (p.category_id === DEMO_CATEGORY_IDS.laptop) return true;
  if (p.origin?.startsWith("dobitkala:")) return true;
  return false;
}

export function scopeForParsedProduct(p: ParsedProduct): ProductListScope {
  if (isNonRegistryOrigin(p.origin)) return "iphone-noreg";
  if (isConsoleProduct(p)) return "console";
  if (isIpadProduct(p)) return "ipad";
  if (isXiaomiPadProduct(p)) return "xiaomi-pad";
  return "mobile";
}

export function scopeForProduct(
  p: Product,
  categoryIdToScope?: Partial<Record<string, ProductListScope>>
): ProductListScope {
  if (p.category_id && categoryIdToScope?.[p.category_id]) {
    return categoryIdToScope[p.category_id]!;
  }
  if (
    p.category_id === DEMO_CATEGORY_IDS["iphone-noreg"] ||
    isNonRegistryOrigin(p.origin) ||
    p.description?.includes("بدون کد ریجستری") ||
    p.description?.includes("بدون رجیستری")
  ) {
    return "iphone-noreg";
  }
  if (p.category_id === DEMO_CATEGORY_IDS.ipad || isIpadProduct(p)) {
    return "ipad";
  }
  if (
    p.category_id === DEMO_CATEGORY_IDS["xiaomi-pad"] ||
    isXiaomiPadProduct(p)
  ) {
    return "xiaomi-pad";
  }
  if (p.category_id === DEMO_CATEGORY_IDS.tablet && isTabletProduct(p)) {
    return isIpadProduct(p) ? "ipad" : "xiaomi-pad";
  }
  if (p.category_id === DEMO_CATEGORY_IDS.console || isConsoleProduct(p)) {
    return "console";
  }
  if (p.category_id === DEMO_CATEGORY_IDS.laptop || isLaptopProduct(p)) {
    return "laptop";
  }
  return "mobile";
}

/** Pure planner: which existing ids to deactivate within touched scopes. */
export function planDeactivations(
  existing: Product[],
  plan: ProductSyncPlan,
  categoryIdToScope?: Partial<Record<string, ProductListScope>>
): string[] {
  const touched = new Set(plan.scopes);
  const deactivate: string[] = [];

  for (const p of existing) {
    if (!p.is_active) continue;
    const scope = scopeForProduct(p, categoryIdToScope);
    if (!touched.has(scope)) continue;
    const key = productVariantKey(p);
    if (!plan.keysByScope[scope].has(key)) {
      deactivate.push(p.id);
    }
  }

  return deactivate;
}

function emptyKeysByScope(): Record<ProductListScope, Set<string>> {
  return {
    mobile: new Set(),
    "iphone-noreg": new Set(),
    tablet: new Set(),
    ipad: new Set(),
    "xiaomi-pad": new Set(),
    console: new Set(),
    laptop: new Set(),
  };
}

export function buildProductSyncPlan(
  rawText: string,
  forceScope?: ProductListScope | "auto"
): ProductSyncPlan {
  const parsed = parseBalePhoneText(rawText);
  const stampedAt = new Date().toISOString();

  const rows: SyncProductRow[] = [];
  const keysByScope = emptyKeysByScope();

  for (const p of parsed.products) {
    const detected = scopeForParsedProduct(p);
    const scope =
      forceScope && forceScope !== "auto" ? forceScope : detected;
    let origin = p.origin;
    if (scope === "iphone-noreg" && !isNonRegistryOrigin(origin)) {
      origin = origin?.trim() ? origin : "Not ZAA";
    }
    let price = p.price;
    // لیست‌های بازار توسعه برای تبلت/کنسول معمولاً به هزار تومان‌اند
    if (
      (scope === "tablet" ||
        scope === "ipad" ||
        scope === "xiaomi-pad" ||
        scope === "console") &&
      price > 0 &&
      price < 10_000_000
    ) {
      price *= 1000;
    }
    const key = productVariantKey({ ...p, origin });
    rows.push({
      brand: p.brand,
      model: p.model,
      storage: p.storage,
      ram: p.ram,
      color: p.color,
      price,
      origin,
      description:
        scope === "iphone-noreg" ? "آیفون بدون کد ریجستری" : null,
      is_active: true,
      raw_import_text: p.raw_line,
      scope,
      key,
    });
    keysByScope[scope].add(key);
  }

  const scopes = (Object.keys(keysByScope) as ProductListScope[]).filter(
    (s) => keysByScope[s].size > 0
  );

  return { parsed, stampedAt, scopes, rows, keysByScope };
}

export function applySyncToProductList(
  existing: Product[],
  plan: ProductSyncPlan
): { products: Product[]; stats: ProductSyncStats } {
  const map = new Map(
    existing.map((p) => [productVariantKey(p), p] as const)
  );

  let inserted = 0;
  let updated = 0;

  for (const row of plan.rows) {
    const prev = map.get(row.key);
    if (prev) {
      updated += 1;
      map.set(row.key, {
        ...prev,
        brand: row.brand,
        model: row.model,
        storage: row.storage,
        ram: row.ram,
        color: row.color,
        price: row.price,
        origin: row.origin,
        description: row.description,
        is_active: true,
        raw_import_text: row.raw_import_text,
        category_id: DEMO_CATEGORY_IDS[row.scope],
        updated_at: plan.stampedAt,
        image_url: prev.image_url,
      });
    } else {
      inserted += 1;
      map.set(row.key, {
        id: `demo-sync-${Date.now()}-${inserted}-${Math.random().toString(36).slice(2, 7)}`,
        category_id: DEMO_CATEGORY_IDS[row.scope],
        brand: row.brand,
        model: row.model,
        storage: row.storage,
        ram: row.ram,
        color: row.color,
        price: row.price,
        stock: 0,
        origin: row.origin,
        description: row.description,
        image_url: null,
        is_active: true,
        raw_import_text: row.raw_import_text,
        created_at: plan.stampedAt,
        updated_at: plan.stampedAt,
      });
    }
  }

  const deactivateIds = new Set(planDeactivations([...map.values()], plan));
  let deactivated = 0;
  const products = [...map.values()].map((p) => {
    if (!deactivateIds.has(p.id)) return p;
    deactivated += 1;
    return {
      ...p,
      is_active: false,
      updated_at: plan.stampedAt,
    };
  });

  return {
    products,
    stats: {
      parsed: plan.rows.length,
      upserted: plan.rows.length,
      inserted,
      updated,
      deactivated,
      scopes: plan.scopes,
      errors: plan.parsed.errors,
      stampedAt: plan.stampedAt,
    },
  };
}
