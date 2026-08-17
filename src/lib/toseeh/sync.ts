import { syncProductsFromMarketProducts } from "@/lib/products/sync-server";
import type { ProductListScope } from "@/lib/products/sync";
import { getStoreSettingsAdmin } from "@/lib/store/settings";
import { markupPercentForScope } from "@/lib/store/markup";
import { fetchToseehTelegramMessages } from "@/lib/toseeh/telegram-fetch";
import {
  detectToseehListKind,
  toseehKindTitle,
  toseehKindToSiteScope,
  type ToseehListKind,
} from "@/lib/toseeh/list-kinds";
import { parseMarketList } from "@/lib/toseeh/market-parser";
import { bumpToseehChannelPrices } from "@/lib/toseeh/price-bump";
import { callBaleBotApi } from "@/lib/bale/bot-api";

function splitMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (line.length > maxLen) {
      if (current.trim()) chunks.push(current);
      current = "";
      for (let i = 0; i < line.length; i += maxLen) {
        chunks.push(line.slice(i, i + maxLen));
      }
      continue;
    }
    if ((current + "\n" + line).length > maxLen) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? current + "\n" + line : line;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

function resolveBaleChatId(settingsChatUrl?: string): string {
  const fromEnv =
    process.env.BALE_PRODUCTS_POST_CHAT_ID?.trim() ||
    process.env.BALE_PRODUCTS_CHANNEL_ID?.split(",")[0]?.trim() ||
    "";
  if (fromEnv && !fromEnv.includes("http")) return fromEnv;

  const url = settingsChatUrl || "";
  const m = url.match(/@([\w\d_]+)/) || url.match(/bale\.ai\/@?([\w\d_]+)/i);
  if (m?.[1]) return `@${m[1]}`;
  return "@refahston05";
}

async function sendToBaleChannel(chatId: string, text: string): Promise<number> {
  const chunks = splitMessage(text);
  for (const chunk of chunks) {
    const res = await callBaleBotApi("sendMessage", {
      chat_id: chatId,
      text: chunk,
    });
    if (!res.ok) {
      throw new Error(`ارسال بله ناموفق: ${res.error}`);
    }
    if (chunks.length > 1) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return chunks.length;
}

export type ToseehSyncResult = {
  ok: boolean;
  channel: string;
  fetchedAt: string;
  scanned: number;
  processed: Array<{
    kind: ToseehListKind;
    scope: ProductListScope;
    products: number;
    baleChunks: number;
    siteUpserted: number;
  }>;
  skipped: Array<{ kind: ToseehListKind; reason: string; preview: string }>;
  errors: string[];
};

/**
 * خواندن کانال تلگرام توسعه همراه → سایت (با درصد تنظیمات) + کانال بله
 */
export async function syncToseehFromTelegram(options?: {
  channel?: string;
  postToBale?: boolean;
  limit?: number;
}): Promise<ToseehSyncResult> {
  const postToBale = options?.postToBale !== false;
  const settings = await getStoreSettingsAdmin();
  const fetched = await fetchToseehTelegramMessages({
    channel: options?.channel,
    limit: options?.limit ?? 50,
  });

  const result: ToseehSyncResult = {
    ok: true,
    channel: fetched.channel,
    fetchedAt: fetched.fetchedAt,
    scanned: fetched.messages.length,
    processed: [],
    skipped: [],
    errors: [],
  };

  // برای هر kind فقط جدیدترین پیام (اولین در لیست reverse = جدیدتر)
  const bestByKind = new Map<ToseehListKind, string>();
  for (const msg of fetched.messages) {
    const kind = detectToseehListKind(msg);
    if (kind === "skip") {
      result.skipped.push({
        kind,
        reason: "غیرلیست",
        preview: msg.slice(0, 80),
      });
      continue;
    }
    if (kind === "skip-registered") {
      result.skipped.push({
        kind,
        reason: "گوشی رجیستری‌شده — رد شد",
        preview: msg.slice(0, 80),
      });
      continue;
    }
    if (!bestByKind.has(kind)) bestByKind.set(kind, msg);
  }

  const baleChatId = resolveBaleChatId(settings.bale_products_channel_url);

  for (const [kind, body] of bestByKind) {
    const scope = toseehKindToSiteScope(kind);
    if (!scope) continue;

    try {
      const products = parseMarketList(body);
      if (!products.length) {
        result.skipped.push({
          kind,
          reason: "محصولی استخراج نشد",
          preview: body.slice(0, 80),
        });
        continue;
      }

      const percent = markupPercentForScope(settings, scope as ProductListScope);
      const title = toseehKindTitle(kind);

      const siteStats = await syncProductsFromMarketProducts({
        products,
        scope: scope as ProductListScope,
        applyMarkup: true,
        sourceLabel: `toseeh:${kind}`,
      });

      // برای بله: همان فرمت کانال با قیمت × درصد
      const retailText =
        `🏪 رفاهستون | ${title}\n` + bumpToseehChannelPrices(body, percent);

      let baleChunks = 0;
      if (postToBale) {
        try {
          baleChunks = await sendToBaleChannel(baleChatId, retailText);
        } catch (baleErr) {
          const m = baleErr instanceof Error ? baleErr.message : String(baleErr);
          result.errors.push(`${kind} (بله): ${m}`);
          result.ok = false;
        }
      }

      result.processed.push({
        kind,
        scope: scope as ProductListScope,
        products: products.length,
        baleChunks,
        siteUpserted: siteStats.upserted,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`${kind}: ${msg}`);
      result.ok = false;
    }
  }

  if (result.processed.length === 0 && result.errors.length === 0) {
    result.ok = false;
    result.errors.push("هیچ لیست قابل‌پردازشی در پیام‌های اخیر پیدا نشد");
  }

  return result;
}
