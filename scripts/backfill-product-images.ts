/**
 * Backfill product.image_url using Digikala (preferred) / Torob / Hamrahtel.
 * Usage: npx tsx scripts/backfill-product-images.ts [--limit=30] [--dry]
 */
import { createClient } from "@supabase/supabase-js";
import { resolveReferenceProductImage } from "../src/lib/product-images/digikala";
import { mirrorRemoteImageToMedia } from "../src/lib/media/vps";
import { createHash } from "crypto";

const LIMIT = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "80"
);
const DRY = process.argv.includes("--dry");

function key(brand: string, model: string) {
  return createHash("sha1")
    .update(`${brand}|${model}`.toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keyEnv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !keyEnv) throw new Error("Supabase env missing");
  const sb = createClient(url, keyEnv);

  const { data: cats } = await sb.from("categories").select("id,slug");
  const mobileId = (cats || []).find((c) => c.slug === "mobile")?.id;
  if (!mobileId) throw new Error("mobile category missing");

  const { data: products, error } = await sb
    .from("products")
    .select("id,brand,model,image_url")
    .eq("category_id", mobileId)
    .eq("is_active", true)
    .order("brand")
    .limit(LIMIT);
  if (error) throw error;

  const byModel = new Map<string, typeof products>();
  for (const p of products || []) {
    const k = `${p.brand}|${p.model}`.toLowerCase();
    const list = byModel.get(k) || [];
    list.push(p);
    byModel.set(k, list);
  }

  let ok = 0;
  let fail = 0;
  const canMirror = Boolean(process.env.MEDIA_UPLOAD_SECRET?.trim());

  for (const [, rows] of byModel) {
    const sample = rows[0];
    if (sample.image_url && !sample.image_url.endsWith(".svg")) {
      ok++;
      continue;
    }
    const ref = await resolveReferenceProductImage(sample.brand, sample.model);
    if (!ref) {
      console.log("MISS", sample.brand, sample.model);
      fail++;
      continue;
    }
    let finalUrl = ref.url;
    if (canMirror && !DRY) {
      const rel = `catalog/${key(sample.brand, sample.model)}.jpg`;
      const mirrored = await mirrorRemoteImageToMedia(ref.url, rel);
      if (mirrored) finalUrl = mirrored;
    }
    console.log(DRY ? "DRY" : "SET", sample.brand, sample.model, "←", ref.source, finalUrl.slice(0, 80));
    if (!DRY) {
      const ids = rows.map((r) => r.id);
      const { error: upErr } = await sb
        .from("products")
        .update({ image_url: finalUrl })
        .in("id", ids);
      if (upErr) {
        console.error(upErr);
        fail++;
      } else ok++;
    } else ok++;
  }

  console.log(JSON.stringify({ ok, fail, models: byModel.size, dry: DRY, mirrored: canMirror }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
