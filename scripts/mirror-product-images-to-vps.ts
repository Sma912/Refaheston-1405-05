/**
 * Mirror product images onto the VPS media host and rewrite Supabase image_url.
 *
 * Uses MEDIA_UPLOAD_URL (HTTP PUT) — no rsync required.
 *
 * Env: MEDIA_BASE_URL, MEDIA_UPLOAD_URL, MEDIA_UPLOAD_SECRET, Supabase keys
 */
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { mediaBaseUrl, uploadMediaFile } from "../src/lib/media/vps";

const MEDIA_BASE = mediaBaseUrl();
const STAGING = path.join("/tmp", "refahston-media-sync");
const LIMIT = Number(process.env.MEDIA_MIRROR_LIMIT || "0");

type ProductRow = {
  id: string;
  image_url: string | null;
  origin: string | null;
  brand: string;
  model: string;
};

function extFromUrl(url: string): string {
  const m = url.toLowerCase().match(/\.(jpe?g|png|webp|gif)(?:\?|$)/);
  if (!m) return "jpg";
  return m[1] === "jpeg" ? "jpg" : m[1]!;
}

function alreadyOnMedia(url: string | null): boolean {
  return Boolean(url?.startsWith(MEDIA_BASE) || url?.includes("/refahston-media/"));
}

function targetRelPath(p: ProductRow, url: string, ext: string): string {
  const origin = p.origin || "";
  if (origin.startsWith("dobitkala:")) {
    return `laptops/${origin.slice("dobitkala:".length)}.${ext}`;
  }
  if (url.startsWith("/catalog/") || url.includes("/catalog/")) {
    return `catalog/${path.basename(url.split("?")[0]!)}`;
  }
  if (url.includes("/extras/")) {
    return `extras/${path.basename(url.split("?")[0]!)}`;
  }
  const key = createHash("sha1")
    .update(`${p.brand}|${p.model}|${url}`)
    .digest("hex")
    .slice(0, 16);
  return `products/${key}.${ext}`;
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  if (url.startsWith("/")) {
    const local = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    return fs.readFile(local);
  }
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RefahestonMediaMirror/1.0)",
      Accept: "image/*,*/*",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function loadAllProducts(
  admin: ReturnType<typeof createClient>
): Promise<ProductRow[]> {
  const out: ProductRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("products")
      .select("id,image_url,origin,brand,model")
      .eq("is_active", true)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const chunk = (data as ProductRow[]) ?? [];
    out.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing supabase env");
  if (!process.env.MEDIA_UPLOAD_SECRET) {
    throw new Error("MEDIA_UPLOAD_SECRET is required");
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  await fs.rm(STAGING, { recursive: true, force: true });
  await fs.mkdir(STAGING, { recursive: true });

  // curated catalog
  try {
    const catalogDir = path.join(process.cwd(), "public", "catalog");
    for (const name of await fs.readdir(catalogDir)) {
      const rel = `catalog/${name}`;
      const buf = await fs.readFile(path.join(catalogDir, name));
      await uploadMediaFile(rel, buf, "image/jpeg");
      console.log("catalog", rel);
    }
  } catch {
    /* optional */
  }

  const products = await loadAllProducts(admin);
  const withUrl = products.filter((p) => p.image_url && !alreadyOnMedia(p.image_url));
  const todo = LIMIT > 0 ? withUrl.slice(0, LIMIT) : withUrl;
  console.log({ products: products.length, needMirror: withUrl.length, doing: todo.length });

  let ok = 0;
  let fail = 0;
  const updates: { id: string; image_url: string }[] = [];

  for (const p of todo) {
    const src = p.image_url!;
    try {
      const ext = extFromUrl(src);
      const rel = targetRelPath(p, src, ext);
      const buf = await downloadToBuffer(src);
      const publicUrl = await uploadMediaFile(rel, buf);
      updates.push({ id: p.id, image_url: publicUrl });
      ok += 1;
      if (ok % 40 === 0) console.log(`mirrored ${ok}/${todo.length}`);
    } catch (e) {
      fail += 1;
      console.warn(`fail ${p.id}:`, e instanceof Error ? e.message : e);
    }
  }

  for (const p of products) {
    if (!p.image_url?.startsWith("/catalog/")) continue;
    if (updates.some((u) => u.id === p.id)) continue;
    updates.push({
      id: p.id,
      image_url: `${MEDIA_BASE}/catalog/${path.basename(p.image_url)}`,
    });
  }

  console.log(`updating db ${updates.length}`);
  for (let i = 0; i < updates.length; i += 40) {
    const chunk = updates.slice(i, i + 40);
    await Promise.all(
      chunk.map((u) =>
        admin.from("products").update({ image_url: u.image_url }).eq("id", u.id)
      )
    );
  }

  console.log(JSON.stringify({ ok, fail, updated: updates.length, mediaBase: MEDIA_BASE }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
