import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { isDemoMode } from "@/lib/demo/config";
import {
  ensureBaleWebhookConfigured,
  flushAllPendingChannelSyncs,
} from "@/lib/bale/channel-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * شبکه ایمنی: هر بافر گیرکرده را همگام می‌کند و وب‌هوک بله را چک/تعمیر می‌کند.
 * روی Hobby حداکثر روزانه قابل زمان‌بندی است؛ در Pro می‌تواند مکرر باشد.
 */
export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isDemoMode()) {
    return NextResponse.json({ ok: true, demo: true, skipped: true });
  }

  try {
    const webhook = await ensureBaleWebhookConfigured();
    const flushed = await flushAllPendingChannelSyncs({ force: true });
    return NextResponse.json({
      ok: true,
      webhook,
      flushed,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron:bale-channel-sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
