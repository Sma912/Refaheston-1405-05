import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/config";
import {
  flushChannelProductSync,
  handleBaleProductUpdate,
  enqueueChannelProductText,
  type BaleUpdate,
} from "@/lib/bale/channel-sync";
import { getBaleWebhookSecret, looksLikeProductList } from "@/lib/bale/bot-api";
import { after } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * همگام‌سازی مستقیم متن لیست (اگر ربات بتواند به سایت POST بزند)
 * Header: Authorization: Bearer <BALE_WEBHOOK_SECRET>
 * Body: { text: "...", chatId?: "manual" } یا Update کامل بله
 */
export async function POST(req: NextRequest) {
  try {
    const expected = getBaleWebhookSecret();
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const headerSecret = req.headers.get("x-bale-sync-secret")?.trim() ?? "";
    if (!expected || (bearer !== expected && headerSecret !== expected)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (isDemoMode()) {
      return NextResponse.json({ ok: true, demo: true, skipped: true });
    }

    const body = (await req.json()) as BaleUpdate & {
      text?: string;
      chatId?: string;
      flushNow?: boolean;
    };

    if (typeof body.text === "string" && body.text.trim()) {
      if (!looksLikeProductList(body.text)) {
        return NextResponse.json(
          { error: "متن شبیه لیست محصول نیست (📱 و 💰 و تومان لازم است)" },
          { status: 400 }
        );
      }
      const chatId = body.chatId?.trim() || "manual";
      await enqueueChannelProductText({
        chatId,
        messageId: null,
        text: body.text,
      });

      if (body.flushNow) {
        const result = await flushChannelProductSync(chatId);
        return NextResponse.json({ ok: true, result });
      }

      after(async () => {
        await new Promise((r) => setTimeout(r, 26_000));
        try {
          await flushChannelProductSync(chatId);
        } catch (err) {
          console.error("[bale:push-sync]", err);
        }
      });

      return NextResponse.json({ ok: true, accepted: 1, chatId, deferred: true });
    }

    const { accepted, chatIds } = await handleBaleProductUpdate(body);
    for (const chatId of chatIds) {
      after(async () => {
        await new Promise((r) => setTimeout(r, 26_000));
        try {
          await flushChannelProductSync(chatId);
        } catch (err) {
          console.error("[bale:push-sync]", err);
        }
      });
    }
    return NextResponse.json({ ok: true, accepted, chatIds });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 500 }
    );
  }
}
