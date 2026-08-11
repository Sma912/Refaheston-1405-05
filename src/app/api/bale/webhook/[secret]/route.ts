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

    // روی Vercel تأخیر after()+sleep قابل‌اعتماد نیست؛ فوری همگام می‌کنیم.
    // اگر چند پیام پشت‌سرهم بیاید، هر کدام بافر را جمع و دوباره sync می‌کند.
    const flushes: Array<{ chatId: string; result: unknown }> = [];
    for (const chatId of chatIds) {
      try {
        const result = await flushChannelProductSync(chatId, { force: true });
        flushes.push({ chatId, result });
        if (!("skipped" in result) || !result.skipped) {
          console.info("[bale:channel-sync]", { chatId, result });
        }
      } catch (err) {
        console.error("[bale:channel-sync] flush failed", chatId, err);
        flushes.push({
          chatId,
          result: {
            skipped: true,
            reason: err instanceof Error ? err.message : "flush_error",
          },
        });
      }
    }

    return NextResponse.json({ ok: true, accepted, chatIds, flushes });
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
