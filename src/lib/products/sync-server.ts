import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildProductSyncPlan,
  CATEGORY_SLUGS,
  planDeactivations,
  productVariantKey,
  type ProductListScope,
  type ProductSyncStats,
  type SyncProductRow,
} from "@/lib/products/sync";
import type { Product } from "@/types/database";

async function resolveCategoryIds(
  admin: ReturnType<typeof createAdminClient>
): Promise<Record<ProductListScope, string | null>> {
  const { data } = await admin
    .from("categories")
    .select("id, slug")
    .in("slug", Object.values(CATEGORY_SLUGS));

  const map: Record<ProductListScope, string | null> = {
    mobile: null,
    "iphone-noreg": null,
  };

  for (const row of data ?? []) {
    if (row.slug === "mobile") map.mobile = row.id;
    if (row.slug === "iphone-noreg") map["iphone-noreg"] = row.id;
  }

  if (!map["iphone-noreg"]) {
    const { data: created } = await admin
      .from("categories")
      .upsert(
        { name: "آیفون بدون رجیستری", slug: "iphone-noreg" },
        { onConflict: "slug" }
      )
      .select("id")
      .maybeSingle();
    map["iphone-noreg"] = created?.id ?? null;
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
}): Promise<ProductSyncStats> {
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

  const upserts = plan.rows.map((row) => {
    if (existingByKey.has(row.key)) updated += 1;
    else inserted += 1;
    return toUpsertPayload(row, categoryIds[row.scope], plan.stampedAt);
  });

  const chunkSize = 50;
  for (let i = 0; i < upserts.length; i += chunkSize) {
    const chunk = upserts.slice(i, i + chunkSize);
    const { error } = await admin.from("products").upsert(chunk, {
      onConflict: "brand,model,storage,ram,color,origin",
    });
    if (error) throw new Error(error.message);
  }

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
    deactivated: deactivateIds.length,
    scopes: plan.scopes,
    errors: plan.parsed.errors,
    stampedAt: plan.stampedAt,
  };
}
