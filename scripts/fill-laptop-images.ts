/**
 * Fill missing laptop images from Dobitkala → VPS /media.
 * Usage: npx tsx scripts/fill-laptop-images.ts [limit=200] [concurrency=5]
 */
import {
  fetchAllDobitLaptops,
  fetchDobitProductImage,
  mapPool,
} from "../src/lib/dobitkala/client";
import { mirrorRemoteImageToMedia } from "../src/lib/media/vps";
import { createAdminClient } from "../src/lib/supabase/admin";

async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const wait = 1500 * (i + 1);
      console.log(`retry ${i + 1}/${tries} in ${wait}ms`, e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

async function main() {
  const limit = Number(process.argv[2] || "200");
  const concurrency = Number(process.argv[3] || "5");
  const admin = createAdminClient();

  const { data: cat, error: catErr } = await admin
    .from("categories")
    .select("id")
    .eq("slug", "laptop")
    .single();
  if (catErr || !cat) throw new Error(catErr?.message || "laptop category missing");

  console.log("fetching dobitkala list…");
  const items = await withRetry(() => fetchAllDobitLaptops());
  const byId = new Map(items.map((i) => [i.id, i]));
  console.log("dobit items", items.length);

  const products: {
    id: string;
    origin: string | null;
    image_url: string | null;
  }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("products")
      .select("id, origin, image_url")
      .eq("is_active", true)
      .eq("category_id", cat.id)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    products.push(...((data as typeof products) ?? []));
    if ((data ?? []).length < 1000) break;
  }

  const need = products.filter((p) => {
    if (!p.origin?.startsWith("dobitkala:")) return false;
    const u = p.image_url?.trim() || "";
    if (!u) return true;
    if (u.startsWith("/media/")) return false;
    return true;
  });

  // one fetch per Dobit product (colors share origin)
  const seen = new Set<string>();
  const unique = need.filter((p) => {
    const o = p.origin!;
    if (seen.has(o)) return false;
    seen.add(o);
    return true;
  });
  const batch = unique.slice(0, limit);
  console.log({
    needRows: need.length,
    needOrigins: unique.length,
    batch: batch.length,
    concurrency,
  });

  let ok = 0;
  let fail = 0;

  await mapPool(batch, concurrency, async (p) => {
    const dobitId = p.origin!.replace(/^dobitkala:/, "");
    const item = byId.get(dobitId);
    try {
      let source =
        p.image_url && p.image_url.includes("dobitkala.com")
          ? p.image_url
          : null;
      if (!source && item?.slug) {
        source = await withRetry(() => fetchDobitProductImage(item.slug), 3);
      }
      if (!source) {
        fail += 1;
        console.log("fail:no-source", dobitId);
        return;
      }

      const ext =
        source.toLowerCase().match(/\.(jpe?g|png|webp|gif)(?:\?|$)/)?.[1] ||
        "jpg";
      const normalizedExt = ext === "jpeg" ? "jpg" : ext;
      const mirrored = await mirrorRemoteImageToMedia(
        source,
        `laptops/${dobitId}.${normalizedExt}`
      );
      const finalUrl = mirrored || source;
      const { error } = await admin
        .from("products")
        .update({ image_url: finalUrl })
        .eq("origin", p.origin!);
      if (error) throw new Error(error.message);
      ok += 1;
      if (ok % 20 === 0 || ok === batch.length) {
        console.log("progress", { ok, fail });
      }
    } catch (e) {
      fail += 1;
      console.log(
        "fail",
        dobitId,
        e instanceof Error ? e.message.slice(0, 140) : "err"
      );
    }
  });

  console.log(JSON.stringify({ ok, fail, left: need.length - ok }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
