import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/config";
import {
  flushChannelProductSync,
  handleBaleProductUpdate,
  enqueueChannelProductText,
  type BaleUpdate,
} from "@/lib/bale/channel-sync";
import { getBaleWebhookSecret, looksLikeProductList } from "@/lib/bale/bot-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * همگام‌سازی مستقیم متن لیست (اگر ربات بتواند به سایت POST بزند)
 * Header: Authorization: Bearer <BALE_WEBHOOK_SECRET>
 * Body: { text: "...", chatId?: "manual", flushNow?: true } یا Update کامل بله
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

      const result = await flushChannelProductSync(chatId, { force: true });
      return NextResponse.json({ ok: true, result });
    }

    // flush-only: { chatId, flushNow: true } without new text
    if (body.flushNow && body.chatId?.trim()) {
      const result = await flushChannelProductSync(body.chatId.trim(), {
        force: true,
      });
      return NextResponse.json({ ok: true, result });
    }

    const { accepted, chatIds } = await handleBaleProductUpdate(body);
    const flushes = [];
    for (const chatId of chatIds) {
      const result = await flushChannelProductSync(chatId, { force: true });
      flushes.push({ chatId, result });
    }
    return NextResponse.json({ ok: true, accepted, chatIds, flushes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 500 }
    );
  }
}
