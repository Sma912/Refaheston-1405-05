import {
  isNonRegistryOrigin,
  parseBalePhoneText,
  type ParseResult,
} from "@/lib/parser/bale-phone-parser";
import type { ParsedProduct, Product } from "@/types/database";

export type ProductListScope = "mobile" | "iphone-noreg";

export const CATEGORY_SLUGS: Record<ProductListScope, string> = {
  mobile: "mobile",
  "iphone-noreg": "iphone-noreg",
};

export const DEMO_CATEGORY_IDS: Record<ProductListScope, string> = {
  mobile: "demo-cat-mobile",
  "iphone-noreg": "demo-cat-iphone-noreg",
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

export function scopeForParsedProduct(p: ParsedProduct): ProductListScope {
  return isNonRegistryOrigin(p.origin) ? "iphone-noreg" : "mobile";
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

export function buildProductSyncPlan(
  rawText: string,
  forceScope?: ProductListScope | "auto"
): ProductSyncPlan {
  const parsed = parseBalePhoneText(rawText);
  // Always stamp with sync time so product pages show when the site last updated prices.
  // Channel 📅 date is only used for seed/demo initial data, not sync operations.
  const stampedAt = new Date().toISOString();

  const rows: SyncProductRow[] = [];
  const keysByScope: Record<ProductListScope, Set<string>> = {
    mobile: new Set(),
    "iphone-noreg": new Set(),
  };

  for (const p of parsed.products) {
    const detected = scopeForParsedProduct(p);
    const scope =
      forceScope && forceScope !== "auto" ? forceScope : detected;
    let origin = p.origin;
    if (scope === "iphone-noreg" && !isNonRegistryOrigin(origin)) {
      // forceScope یا دسته بدون‌کد: مبدأ را برای کاتالوگ/قیمت مشخص نگه دار
      origin = origin?.trim() ? origin : "Not ZAA";
    }
    const key = productVariantKey({ ...p, origin });
    rows.push({
      brand: p.brand,
      model: p.model,
      storage: p.storage,
      ram: p.ram,
      color: p.color,
      price: p.price,
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
        // Always refresh stamp on sync (even if price unchanged)
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
