import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildProductSyncPlan,
  planDeactivations,
  productVariantKey,
  type ProductListScope,
  type ProductSyncStats,
  type SyncProductRow,
} from "@/lib/products/sync";
import type { Product } from "@/types/database";
import { getStoreSettingsAdmin } from "@/lib/store/settings";
import {
  applyMarkupPercent,
  markupPercentForScope,
} from "@/lib/store/markup";

async function resolveCategoryIds(
  admin: ReturnType<typeof createAdminClient>
): Promise<Record<ProductListScope, string | null>> {
  const wanted: { scope: ProductListScope; name: string; slug: string }[] = [
    { scope: "mobile", name: "موبایل", slug: "mobile" },
    { scope: "iphone-noreg", name: "آیفون بدون رجیستری", slug: "iphone-noreg" },
    {
      scope: "android-noreg",
      name: "اندروید بدون رجیستری",
      slug: "android-noreg",
    },
    { scope: "tablet", name: "تبلت", slug: "tablet" },
    { scope: "ipad", name: "آیپد", slug: "ipad" },
    { scope: "xiaomi-pad", name: "تبلت شیائومی", slug: "xiaomi-pad" },
    { scope: "console", name: "کنسول بازی", slug: "console" },
    { scope: "laptop", name: "لپ‌تاپ", slug: "laptop" },
    { scope: "accessory", name: "لوازم جانبی", slug: "accessory" },
    { scope: "audio", name: "صوتی و اسپیکر", slug: "audio" },
  ];

  const { data } = await admin
    .from("categories")
    .select("id, slug")
    .in(
      "slug",
      wanted.map((w) => w.slug)
    );

  const map: Record<ProductListScope, string | null> = {
    mobile: null,
    "iphone-noreg": null,
    "android-noreg": null,
    tablet: null,
    ipad: null,
    "xiaomi-pad": null,
    console: null,
    laptop: null,
    accessory: null,
    audio: null,
  };

  for (const row of data ?? []) {
    const hit = wanted.find((w) => w.slug === row.slug);
    if (hit) map[hit.scope] = row.id;
  }

  for (const w of wanted) {
    if (map[w.scope]) continue;
    const { data: created } = await admin
      .from("categories")
      .upsert({ name: w.name, slug: w.slug }, { onConflict: "slug" })
      .select("id")
      .maybeSingle();
    map[w.scope] = created?.id ?? null;
  }

  return map;
}

function toUpsertPayload(
  row: SyncProductRow,
  categoryId: string | null,
  stampedAt: string
) {
  return {
    category_id: categoryId,
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
    updated_at: stampedAt,
  };
}

export async function syncProductsFromChannelText(input: {
  rawText: string;
  importedBy?: string | null;
  forceScope?: ProductListScope | "auto";
  /** اگر false باشد فقط upsert؛ کالاهای غایب غیرفعال نمی‌شوند */
  deactivateMissing?: boolean;
  /**
   * اگر true باشد قیمت ورودی wholesale فرض می‌شود و درصد تنظیمات سایت اعمال می‌شود.
   * برای همگام از کانال بله (که قبلاً سود خورده) false بگذارید.
   */
  applyMarkup?: boolean;
}): Promise<ProductSyncStats> {
  const deactivateMissing = input.deactivateMissing !== false;
  const plan = buildProductSyncPlan(input.rawText, input.forceScope);
  if (plan.rows.length === 0) {
    return {
      parsed: 0,
      upserted: 0,
      inserted: 0,
      updated: 0,
      deactivated: 0,
      scopes: [],
      errors: plan.parsed.errors.length
        ? plan.parsed.errors
        : ["هیچ محصولی از متن استخراج نشد"],
      stampedAt: plan.stampedAt,
    };
  }

  if (input.applyMarkup) {
    const settings = await getStoreSettingsAdmin();
    for (const row of plan.rows) {
      const pct = markupPercentForScope(settings, row.scope);
      row.price = applyMarkupPercent(row.price, pct);
    }
  }

  const admin = createAdminClient();
  const categoryIds = await resolveCategoryIds(admin);
  const categoryIdToScope: Partial<Record<string, ProductListScope>> = {};
  for (const [scope, id] of Object.entries(categoryIds) as [
    ProductListScope,
    string | null,
  ][]) {
    if (id) categoryIdToScope[id] = scope;
  }

  const { data: existingRows, error: existingError } = await admin
    .from("products")
    .select("*");

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existing = (existingRows as Product[]) ?? [];
  const existingByKey = new Map(
    existing.map((p) => [productVariantKey(p), p] as const)
  );

  let inserted = 0;
  let updated = 0;

  const byKey = new Map<string, ReturnType<typeof toUpsertPayload>>();
  for (const row of plan.rows) {
    byKey.set(
      row.key,
      toUpsertPayload(row, categoryIds[row.scope], plan.stampedAt)
    );
  }
  const upserts = [...byKey.values()];
  for (const key of byKey.keys()) {
    if (existingByKey.has(key)) updated += 1;
    else inserted += 1;
  }

  const chunkSize = 50;
  for (let i = 0; i < upserts.length; i += chunkSize) {
    const chunk = upserts.slice(i, i + chunkSize);
    const { error } = await admin.from("products").upsert(chunk, {
      onConflict: "brand,model,storage,ram,color,origin",
    });
    if (error) throw new Error(error.message);
  }

  let deactivated = 0;
  if (deactivateMissing) {
    const { data: afterRows, error: afterError } = await admin
      .from("products")
      .select("*");
    if (afterError) throw new Error(afterError.message);

    const after = (afterRows as Product[]) ?? [];
    const deactivateIds = planDeactivations(after, plan, categoryIdToScope);

    if (deactivateIds.length > 0) {
      const { error } = await admin
        .from("products")
        .update({ is_active: false, updated_at: plan.stampedAt })
        .in("id", deactivateIds);
      if (error) throw new Error(error.message);
      deactivated = deactivateIds.length;
    }
  }

  await admin.from("product_imports").insert({
    raw_text: input.rawText,
    parsed_count: plan.rows.length,
    imported_by: input.importedBy ?? null,
  });

  return {
    parsed: plan.rows.length,
    upserted: plan.rows.length,
    inserted,
    updated,
    deactivated,
    scopes: plan.scopes,
    errors: plan.parsed.errors,
    stampedAt: plan.stampedAt,
  };
}

/** همگام مستقیم از لیست بازار توسعه همراه — بدون عبور از پارسر بله */
export async function syncProductsFromMarketProducts(input: {
  products: Array<{ brand: string; model: string; color: string; price: number }>;
  scope: ProductListScope;
  applyMarkup?: boolean;
  sourceLabel?: string;
  /** پیش‌فرض true: کالاهای همان دسته که در لیست امروز نیستند غیرفعال می‌شوند */
  deactivateMissing?: boolean;
}): Promise<ProductSyncStats> {
  const stampedAt = new Date().toISOString();
  const deactivateMissing = input.deactivateMissing !== false;
  if (!input.products.length) {
    return {
      parsed: 0,
      upserted: 0,
      inserted: 0,
      updated: 0,
      deactivated: 0,
      scopes: [],
      errors: ["محصولی نیست"],
      stampedAt,
    };
  }

  const settings = await getStoreSettingsAdmin();
  const pct = input.applyMarkup
    ? markupPercentForScope(settings, input.scope)
    : 0;

  const needsThousand =
    input.scope === "tablet" ||
    input.scope === "ipad" ||
    input.scope === "xiaomi-pad" ||
    input.scope === "console" ||
    input.scope === "accessory" ||
    input.scope === "audio" ||
    input.scope === "laptop" ||
    input.scope === "iphone-noreg" ||
    input.scope === "android-noreg";

  function sanitizeModel(raw: string): string {
    return String(raw || "")
      .replace(/^\*+_?|_?\*+$/g, "")
      .replace(/^_+|_+$/g, "")
      .replace(/[⌚️]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function belongsInScope(brand: string, model: string, scope: ProductListScope): boolean {
    const m = `${brand} ${model}`.toLowerCase();
    if (scope === "iphone-noreg") {
      return /iphone|آیفون|\b1[3-9]\b/.test(m) && !/watch|airpods|ipad|macbook/.test(m);
    }
    if (scope === "android-noreg") {
      return !/iphone|آیفون|watch|airpods|ipad/.test(m);
    }
    if (scope === "accessory") {
      return /watch|airpods|pen|pencil|adaptor|adapter|cable/.test(m);
    }
    return true;
  }

  const rows: SyncProductRow[] = [];
  for (const p of input.products) {
    let model = sanitizeModel(p.model);
    if (!model) continue;
    if (!belongsInScope(p.brand, model, input.scope)) continue;

    let ram: string | null = null;
    let storage: string | null = null;
    const mem = model.match(/\((\d+)\s*\/\s*(\d+)\s*GB\)/i);
    if (mem) {
      ram = `${mem[1]}GB`;
      storage = `${mem[2]}GB`;
      model = model.replace(mem[0], "").replace(/\s+/g, " ").trim();
    } else {
      const onlyStorage = model.match(/\((\d+)\s*GB\)/i);
      if (onlyStorage) {
        storage = `${onlyStorage[1]}GB`;
        model = model.replace(onlyStorage[0], "").replace(/\s+/g, " ").trim();
      }
    }

    let price = p.price;
    if (needsThousand && price > 0 && price < 10_000_000) price *= 1000;
    price = applyMarkupPercent(price, pct);

    const origin =
      input.scope === "iphone-noreg"
        ? /not\s*ch/i.test(p.model)
          ? "Not CH"
          : "Not ZAA"
        : input.scope === "android-noreg"
          ? "No register"
          : null;

    const key = productVariantKey({
      brand: p.brand,
      model,
      storage,
      ram,
      color: p.color || "—",
      origin,
    });

    rows.push({
      brand: p.brand || "سایر",
      model,
      storage,
      ram,
      color: sanitizeModel(p.color) || "—",
      price,
      origin,
      description:
        input.scope === "iphone-noreg"
          ? "آیفون بدون کد ریجستری"
          : input.scope === "android-noreg"
            ? "اندروید بدون رجیستری (توسعه همراه)"
            : null,
      is_active: true,
      raw_import_text: input.sourceLabel || null,
      scope: input.scope,
      key,
    });
  }

  if (!rows.length) {
    return {
      parsed: 0,
      upserted: 0,
      inserted: 0,
      updated: 0,
      deactivated: 0,
      scopes: [],
      errors: ["پس از فیلتر، محصولی نماند"],
      stampedAt,
    };
  }

  const admin = createAdminClient();
  const categoryIds = await resolveCategoryIds(admin);
  const categoryId = categoryIds[input.scope] ?? "";
  const existingByKey = new Map<string, true>();
  const { data: existingRows } = await admin
    .from("products")
    .select("id,brand,model,storage,ram,color,origin,is_active")
    .eq("category_id", categoryId);
  for (const e of existingRows ?? []) {
    existingByKey.set(productVariantKey(e as Product), true);
  }

  let inserted = 0;
  let updated = 0;
  const byKey = new Map<string, ReturnType<typeof toUpsertPayload>>();
  for (const row of rows) {
    byKey.set(row.key, toUpsertPayload(row, categoryId, stampedAt));
  }
  for (const key of byKey.keys()) {
    if (existingByKey.has(key)) updated += 1;
    else inserted += 1;
  }

  const upserts = [...byKey.values()];
  for (let i = 0; i < upserts.length; i += 50) {
    const chunk = upserts.slice(i, i + 50);
    const { error } = await admin.from("products").upsert(chunk, {
      onConflict: "brand,model,storage,ram,color,origin",
    });
    if (error) throw new Error(error.message);
  }

  let deactivated = 0;
  if (deactivateMissing && categoryId) {
    const keepKeys = new Set(byKey.keys());
    const deactivateIds = (existingRows ?? [])
      .filter((e) => {
        const key = productVariantKey(e as Product);
        return (e as { is_active?: boolean }).is_active !== false && !keepKeys.has(key);
      })
      .map((e) => (e as { id: string }).id)
      .filter(Boolean);
    if (deactivateIds.length > 0) {
      for (let i = 0; i < deactivateIds.length; i += 100) {
        const chunk = deactivateIds.slice(i, i + 100);
        const { error } = await admin
          .from("products")
          .update({ is_active: false, updated_at: stampedAt })
          .in("id", chunk);
        if (error) throw new Error(error.message);
      }
      deactivated = deactivateIds.length;
    }
  }

  await admin.from("product_imports").insert({
    raw_text: input.sourceLabel || `market:${input.scope}`,
    parsed_count: rows.length,
    imported_by: null,
  });

  return {
    parsed: rows.length,
    upserted: rows.length,
    inserted,
    updated,
    deactivated,
    scopes: [input.scope],
    errors: [],
    stampedAt,
  };
}
