/**
 * خواندن پیام‌های اخیر کانال عمومی تلگرام توسعه همراه
 * https://t.me/s/toseehhamrah
 */

const DEFAULT_CHANNEL = "toseehhamrah";

function decodeHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .trim();
}

export async function fetchToseehTelegramMessages(options?: {
  channel?: string;
  limit?: number;
}): Promise<{ channel: string; messages: string[]; fetchedAt: string }> {
  const channel = (options?.channel || DEFAULT_CHANNEL).replace(/^@/, "");
  const limit = options?.limit ?? 40;
  const url = `https://t.me/s/${channel}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RefahstonBot/1.0; +https://refahston.ir)",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`خواندن تلگرام ناموفق بود (HTTP ${res.status})`);
  }

  const html = await res.text();
  const blocks =
    html.match(
      /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g
    ) || [];

  const messages: string[] = [];
  for (const block of blocks) {
    const inner = block.replace(/^[^>]*>/, "").replace(/<\/div>$/, "");
    const text = decodeHtml(inner);
    if (text.length >= 20) messages.push(text);
  }

  // جدیدترین‌ها آخر HTML هستند؛ از آخر برش بزن
  const sliced = messages.slice(-limit).reverse();

  return {
    channel,
    messages: sliced,
    fetchedAt: new Date().toISOString(),
  };
}
