import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAllDobitLaptops,
  fetchDobitProductImage,
  mapPool,
  type DobitLaptopRow,
} from "@/lib/dobitkala/client";
import {
  cleanLaptopModelName,
  laptopFinalPrice,
  laptopOrigin,
} from "@/lib/dobitkala/parse-laptop";
import type { Product } from "@/types/database";

export type LaptopSyncStats = {
  fetched: number;
  upserted: number;
  inserted: number;
  updated: number;
  deactivated: number;
  imagesFetched: number;
  imagesFailed: number;
  stampedAt: string;
  errors: string[];
};

async function ensureLaptopCategory(
  admin: ReturnType<typeof createAdminClient>
): Promise<string> {
  const { data: existing } = await admin
    .from("categories")
    .select("id")
    .eq("slug", "laptop")
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await admin
    .from("categories")
    .upsert({ name: "لپ‌تاپ", slug: "laptop" }, { onConflict: "slug" })
    .select("id")
    .maybeSingle();
  if (error || !created?.id) {
    throw new Error(error?.message || "ایجاد دسته لپ‌تاپ ناموفق بود");
  }
  return created.id;
}

type Prepared = {
  brand: string;
  model: string;
  storage: string | null;
  ram: string | null;
  color: string;
  price: number;
  origin: string;
  description: string | null;
  image_url: string | null;
  cpu: string | null;
  gpu: string | null;
  display: string | null;
  raw_import_text: string;
  slug: string;
};

function prepareRow(
  item: DobitLaptopRow,
  imageUrl: string | null
): Prepared {
  return {
    brand: item.brandEn,
    model: cleanLaptopModelName(item),
    storage: item.storage,
    ram: item.ram,
    color: item.color || "—",
    price: laptopFinalPrice(item.sellPrice),
    origin: laptopOrigin(item.id),
    description: item.guarantee,
    image_url: imageUrl,
    cpu: item.cpu,
    gpu: item.gpu,
    display: item.display,
    raw_import_text: `${item.titleEn} | ${item.slug} | ${item.sellPrice}`,
    slug: item.slug,
  };
}

export async function syncDobitkalaLaptops(opts?: {
  maxNewImages?: number;
  imageConcurrency?: number;
  deactivateMissing?: boolean;
}): Promise<LaptopSyncStats> {
  const maxNewImages = opts?.maxNewImages ?? 120;
  const imageConcurrency = opts?.imageConcurrency ?? 8;
  const deactivateMissing = opts?.deactivateMissing !== false;
  const stampedAt = new Date().toISOString();
  const errors: string[] = [];

  const items = await fetchAllDobitLaptops();
  const admin = createAdminClient();
  const categoryId = await ensureLaptopCategory(admin);

  const { data: existingRows, error: existingError } = await admin
    .from("products")
    .select("*")
    .eq("category_id", categoryId);
  if (existingError) throw new Error(existingError.message);

  const existing = (existingRows as Product[]) ?? [];
  const byOrigin = new Map<string, Product[]>();
  for (const p of existing) {
    if (!p.origin?.startsWith("dobitkala:")) continue;
    const list = byOrigin.get(p.origin) ?? [];
    list.push(p);
    byOrigin.set(p.origin, list);
  }

  const prepared = items.map((item) => {
    const origin = laptopOrigin(item.id);
    const prev = byOrigin.get(origin)?.[0];
    return prepareRow(item, prev?.image_url ?? null);
  });

  const needImage = prepared.filter((r) => !r.image_url);
  const toFetch = needImage.slice(0, maxNewImages);
  let imagesFetched = 0;
  let imagesFailed = 0;

  const fetched = await mapPool(toFetch, imageConcurrency, async (row) => {
    try {
      const url = await fetchDobitProductImage(row.slug);
      if (url) {
        imagesFetched += 1;
        return { origin: row.origin, url };
      }
      imagesFailed += 1;
      return { origin: row.origin, url: null as string | null };
    } catch (e) {
      imagesFailed += 1;
      errors.push(
        `image ${row.slug}: ${e instanceof Error ? e.message : "fail"}`
      );
      return { origin: row.origin, url: null as string | null };
    }
  });

  const imageByOrigin = new Map(
    fetched.filter((f) => f.url).map((f) => [f.origin, f.url!] as const)
  );

  let inserted = 0;
  let updated = 0;

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; payload: Record<string, unknown> }[] = [];
  const dupeIds: string[] = [];

  for (const row of prepared) {
    const image_url = imageByOrigin.get(row.origin) ?? row.image_url;
    const payload = {
      category_id: categoryId,
      brand: row.brand,
      model: row.model,
      storage: row.storage,
      ram: row.ram,
      color: row.color,
      price: row.price,
      origin: row.origin,
      description: row.description,
      image_url,
      cpu: row.cpu,
      gpu: row.gpu,
      display: row.display,
      is_active: true,
      raw_import_text: row.raw_import_text,
      updated_at: stampedAt,
    };

    const matches = byOrigin.get(row.origin) ?? [];
    if (matches.length === 0) {
      toInsert.push(payload);
      inserted += 1;
      continue;
    }

    const [primary, ...dupes] = matches;
    toUpdate.push({ id: primary.id, payload });
    updated += 1;
    for (const d of dupes) dupeIds.push(d.id);
  }

  const chunkSize = 40;

  // اول تکراری‌های origin را بردار تا آپدیت مدل به unique برخورد نکند
  if (dupeIds.length) {
    const { error } = await admin
      .from("products")
      .update({ is_active: false, updated_at: stampedAt })
      .in("id", dupeIds);
    if (error) throw new Error(error.message);
    // حذف فیزیکی تکراری‌ها برای آزاد شدن قید یکتا
    const { error: delErr } = await admin
      .from("products")
      .delete()
      .in("id", dupeIds);
    if (delErr) throw new Error(delErr.message);
  }

  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    const { error } = await admin.from("products").upsert(chunk, {
      onConflict: "brand,model,storage,ram,color,origin",
    });
    if (error) throw new Error(error.message);
  }

  for (let i = 0; i < toUpdate.length; i += chunkSize) {
    const chunk = toUpdate.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(({ id, payload }) =>
        admin.from("products").update(payload).eq("id", id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
  }

  let deactivated = 0;
  if (deactivateMissing) {
    const keep = new Set(prepared.map((r) => r.origin));
    const dropIds = existing
      .filter((p) => p.is_active && p.origin && !keep.has(p.origin))
      .map((p) => p.id);
    if (dropIds.length) {
      const { error } = await admin
        .from("products")
        .update({ is_active: false, updated_at: stampedAt })
        .in("id", dropIds);
      if (error) throw new Error(error.message);
      deactivated = dropIds.length;
    }
  }

  await admin.from("product_imports").insert({
    raw_text: `dobitkala-laptop:${items.length}`,
    parsed_count: items.length,
    imported_by: null,
  });

  return {
    fetched: items.length,
    upserted: prepared.length,
    inserted,
    updated,
    deactivated,
    imagesFetched,
    imagesFailed,
    stampedAt,
    errors,
  };
}
