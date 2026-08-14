import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { isDemoMode } from "@/lib/demo/config";
import { syncDobitkalaLaptops } from "@/lib/products/laptop-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** همگام‌سازی لیست + بخشی از عکس‌ها */
export const maxDuration = 300;

/**
 * روزانه ~۱۱:۰۰ تهران: لیست لپ‌تاپ دوبیت‌کالا با ۲.۵٪ مارکاپ.
 * عکس‌های جدید به‌تدریج از صفحات محصول دوبیت پر می‌شوند.
 */
export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isDemoMode()) {
    return NextResponse.json({ ok: true, demo: true, skipped: true });
  }

  const url = new URL(req.url);
  const maxNewImages = Number(url.searchParams.get("maxNewImages") || "150");
  const fullImages = url.searchParams.get("fullImages") === "1";

  try {
    const stats = await syncDobitkalaLaptops({
      maxNewImages: fullImages ? 5000 : Math.max(0, maxNewImages),
      imageConcurrency: 8,
      deactivateMissing: true,
    });
    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    console.error("[cron:dobitkala-laptops]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
