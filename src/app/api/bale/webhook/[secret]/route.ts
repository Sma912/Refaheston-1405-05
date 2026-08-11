import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/config";
import { getBaleWebhookSecret } from "@/lib/bale/bot-api";
import {
  flushChannelProductSync,
  handleBaleProductUpdate,
  type BaleUpdate,
} from "@/lib/bale/channel-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ secret: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { secret } = await context.params;
    const expected = getBaleWebhookSecret();
    if (!expected || secret !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (isDemoMode()) {
      return NextResponse.json({ ok: true, demo: true, skipped: true });
    }

    const update = (await req.json()) as BaleUpdate;
    const { accepted, chatIds } = await handleBaleProductUpdate(update);

    for (const chatId of chatIds) {
      after(async () => {
        await new Promise((r) => setTimeout(r, 26_000));
        try {
          const result = await flushChannelProductSync(chatId);
          if (!result.skipped) {
            console.info("[bale:channel-sync]", {
              chatId,
              parsed: result.stats.parsed,
              upserted: result.stats.upserted,
              deactivated: result.stats.deactivated,
              messageCount: result.messageCount,
            });
          }
        } catch (err) {
          console.error("[bale:channel-sync] flush failed", chatId, err);
        }
      });
    }

    return NextResponse.json({ ok: true, accepted, chatIds });
  } catch (err) {
    console.error("[bale:webhook]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "webhook error" },
      { status: 500 }
    );
  }
}

/** Bale گاهی برای بررسی وب‌هوک GET می‌زند */
export async function GET(_req: NextRequest, context: RouteContext) {
  const { secret } = await context.params;
  const expected = getBaleWebhookSecret();
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, service: "bale-channel-webhook" });
}
