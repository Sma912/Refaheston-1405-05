import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_STORE_SETTINGS } from "@/lib/store/defaults";
import { getStoreSettings } from "@/lib/store/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ settings: DEMO_STORE_SETTINGS, demo: true });
    }
    const settings = await getStoreSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 500 }
    );
  }
}
