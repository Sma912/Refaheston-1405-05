import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/config";
import { getBaleWebhookSecret } from "@/lib/bale/bot-api";
import {
  SETTLE_MS,
  flushChannelProductSync,
  handleBaleProductUpdate,
  type BaleUpdate,
} from "@/lib/bale/channel-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ secret: string }> };

async function settledFlush(chatId: string) {
  await new Promise((r) => setTimeout(r, SETTLE_MS + 500));
  const result = await flushChannelProductSync(chatId, { force: true });
  console.info("[bale:channel-sync]", { chatId, result });
  return result;
}

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
        try {
          await settledFlush(chatId);
        } catch (err) {
          console.error("[bale:channel-sync] flush failed", chatId, err);
          try {
            await new Promise((r) => setTimeout(r, 3000));
            await flushChannelProductSync(chatId, { force: true });
          } catch (err2) {
            console.error("[bale:channel-sync] retry failed", chatId, err2);
          }
        }
      });
    }

    return NextResponse.json({
      ok: true,
      accepted,
      chatIds,
      settleMs: SETTLE_MS,
    });
  } catch (err) {
    console.error("[bale:webhook]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "webhook error" },
      { status: 500 }
    );
  }
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { secret } = await context.params;
  const expected = getBaleWebhookSecret();
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, service: "bale-channel-webhook" });
}
