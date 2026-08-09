import { NextRequest, NextResponse } from "next/server";
import {
  resolveProductImage,
  warmHamrahtelImages,
  warmPlaceholderImages,
} from "@/lib/product-images/cache";
import { DEMO_PRODUCTS } from "@/lib/demo/data";
import { isDemoMode } from "@/lib/demo/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand")?.trim();
  const model = searchParams.get("model")?.trim();
  const color = searchParams.get("color")?.trim() || null;
  const asJson = searchParams.get("redirect") === "0";
  const warm = searchParams.get("warm") === "1";
  const photos = searchParams.get("photos") === "1";
  const force = searchParams.get("force") === "1";

  if (warm && isDemoMode()) {
    const unique = DEMO_PRODUCTS.map((p) => ({ brand: p.brand, model: p.model }));
    if (photos) {
      const result = await warmHamrahtelImages(unique, { force });
      return NextResponse.json({ ok: true, source: "hamrahtel", ...result });
    }
    await warmPlaceholderImages(unique);
    return NextResponse.json({ ok: true, count: unique.length });
  }

  if (!brand || !model) {
    return NextResponse.json(
      { error: "brand و model الزامی است" },
      { status: 400 }
    );
  }

  try {
    const result = await resolveProductImage({ brand, model, color });

    if (asJson) {
      return NextResponse.json({
        url: result.publicUrl,
        cached: result.cached,
        source: result.entry.source,
      });
    }

    const res = NextResponse.redirect(new URL(result.publicUrl, req.url), 307);
    res.headers.set(
      "Cache-Control",
      result.cached
        ? "public, max-age=31536000, immutable"
        : "public, max-age=60"
    );
    res.headers.set("X-Image-Cached", result.cached ? "1" : "0");
    res.headers.set("X-Image-Source", result.entry.source);
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطا در دریافت تصویر" }, { status: 500 });
  }
}
