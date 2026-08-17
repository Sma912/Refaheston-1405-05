import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { syncToseehFromTelegram } from "@/lib/toseeh/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** کرون / تریگر امن برای همگام توسعه همراه از تلگرام */
export async function GET(req: NextRequest) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncToseehFromTelegram({
      postToBale: true,
      channel: "toseehhamrah",
      limit: 50,
    });
    return NextResponse.json({ ok: result.ok, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
