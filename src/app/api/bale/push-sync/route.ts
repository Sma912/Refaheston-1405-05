import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/config";
import {
  flushChannelProductSync,
  handleBaleProductUpdate,
  enqueueChannelProductText,
  type BaleUpdate,
} from "@/lib/bale/channel-sync";
import { getBaleWebhookSecret, looksLikeProductList } from "@/lib/bale/bot-api";
import { syncProductsFromChannelText } from "@/lib/products/sync-server";
import type { ProductListScope } from "@/lib/products/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SCOPES = new Set<ProductListScope>([
  "mobile",
  "iphone-noreg",
  "tablet",
  "ipad",
  "xiaomi-pad",
  "console",
]);

/**
 * همگام‌سازی مستقیم متن لیست
 * Authorization: Bearer <BALE_WEBHOOK_SECRET>
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
      forceScope?: ProductListScope | "auto";
      source?: string;
    };

    if (typeof body.text === "string" && body.text.trim()) {
      if (!looksLikeProductList(body.text)) {
        return NextResponse.json(
          { error: "متن شبیه لیست محصول نیست (📱 و 💰 و تومان لازم است)" },
          { status: 400 }
        );
      }

      const forceScope =
        body.forceScope &&
        body.forceScope !== "auto" &&
        SCOPES.has(body.forceScope)
          ? body.forceScope
          : "auto";

      // مسیر مستقیم ربات مک/سرور: بدون بافر کانال
      if (body.flushNow !== false) {
        const result = await syncProductsFromChannelText({
          rawText: body.text,
          importedBy: null,
          forceScope,
          deactivateMissing: true,
        });
        return NextResponse.json({
          ok: true,
          result,
          source: body.source ?? null,
        });
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

    if (body.flushNow) {
      const chatId = body.chatId?.trim();
      if (chatId) {
        const result = await flushChannelProductSync(chatId, { force: true });
        return NextResponse.json({ ok: true, result });
      }
    }

    const { accepted, chatIds } = await handleBaleProductUpdate(body);
    const flushes = [];
    for (const chatId of chatIds) {
      flushes.push({
        chatId,
        result: await flushChannelProductSync(chatId, { force: true }),
      });
    }
    return NextResponse.json({ ok: true, accepted, chatIds, flushes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 500 }
    );
  }
}
