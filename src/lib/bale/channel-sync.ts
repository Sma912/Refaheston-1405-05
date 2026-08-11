import { createAdminClient } from "@/lib/supabase/admin";
import { looksLikeProductList } from "@/lib/bale/bot-api";
import { syncProductsFromChannelText } from "@/lib/products/sync-server";
import type { ProductSyncStats } from "@/lib/products/sync";

const DEBOUNCE_MS = 25_000;
const BUFFER_WINDOW_MS = 5 * 60_000;

export type BaleChatMessage = {
  message_id?: number;
  text?: string;
  caption?: string;
  chat?: { id?: number | string; type?: string; title?: string; username?: string };
};

export type BaleUpdate = {
  update_id?: number;
  message?: BaleChatMessage;
  channel_post?: BaleChatMessage;
  edited_channel_post?: BaleChatMessage;
  edited_message?: BaleChatMessage;
};

function allowedChannelIds(): Set<string> | null {
  const raw = process.env.BALE_PRODUCTS_CHANNEL_ID?.trim() ?? "";
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function extractSyncablePosts(update: BaleUpdate): Array<{
  chatId: string;
  messageId: number | null;
  text: string;
}> {
  const candidates = [
    update.channel_post,
    update.edited_channel_post,
    update.message,
    update.edited_message,
  ].filter(Boolean) as BaleChatMessage[];

  const allow = allowedChannelIds();
  const out: Array<{ chatId: string; messageId: number | null; text: string }> =
    [];

  for (const msg of candidates) {
    const text = (msg.text ?? msg.caption ?? "").trim();
    if (!looksLikeProductList(text)) continue;
    if (msg.chat?.id == null) continue;
    const chatId = String(msg.chat.id);
    if (allow && !allow.has(chatId) && !allow.has(`@${msg.chat.username ?? ""}`)) {
      continue;
    }
    out.push({
      chatId,
      messageId: msg.message_id ?? null,
      text,
    });
  }
  return out;
}

export async function enqueueChannelProductText(input: {
  chatId: string;
  messageId?: number | null;
  text: string;
}): Promise<{ scheduled: true; debounceUntil: string }> {
  const admin = createAdminClient();
  const debounceUntil = new Date(Date.now() + DEBOUNCE_MS).toISOString();

  const { error: insertError } = await admin
    .from("bale_channel_message_buffer")
    .insert({
      chat_id: input.chatId,
      message_id: input.messageId ?? null,
      body: input.text,
    });
  if (insertError) {
    if (
      insertError.message.includes("bale_channel_message_buffer") ||
      insertError.code === "42P01" ||
      insertError.message.includes("does not exist")
    ) {
      throw new Error(
        "جداول همگام‌سازی کانال ساخته نشده‌اند — migration 0008 را در Supabase اجرا کنید"
      );
    }
    throw new Error(insertError.message);
  }

  const { error: stateError } = await admin.from("bale_channel_sync_state").upsert(
    {
      chat_id: input.chatId,
      debounce_until: debounceUntil,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chat_id" }
  );
  if (stateError) throw new Error(stateError.message);

  return { scheduled: true, debounceUntil };
}

/**
 * همه پیام‌های اخیر چت را جمع می‌کند و به products همگام می‌کند.
 * force=true برای رد کردن debounce (webhook فوری / flush دستی).
 */
export async function flushChannelProductSync(
  chatId: string,
  options?: { force?: boolean }
): Promise<
  | { skipped: true; reason: string }
  | { skipped: false; stats: ProductSyncStats; messageCount: number }
> {
  const force = options?.force === true;
  const admin = createAdminClient();
  const { data: state, error: stateError } = await admin
    .from("bale_channel_sync_state")
    .select("debounce_until")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (stateError) throw new Error(stateError.message);
  if (!state?.debounce_until && !force) {
    return { skipped: true, reason: "no_state" };
  }

  if (!force) {
    const until = new Date(state!.debounce_until).getTime();
    if (Number.isFinite(until) && until > Date.now() + 500) {
      return { skipped: true, reason: "debounce_pending" };
    }
  }

  const sinceIso = new Date(Date.now() - BUFFER_WINDOW_MS).toISOString();
  const { data: rows, error: bufError } = await admin
    .from("bale_channel_message_buffer")
    .select("id, body, created_at")
    .eq("chat_id", chatId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });

  if (bufError) throw new Error(bufError.message);
  if (!rows?.length) {
    return { skipped: true, reason: "empty_buffer" };
  }

  // حذف تکراری متن یکسان
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const body = String(row.body ?? "").trim();
    if (!body || seen.has(body)) continue;
    seen.add(body);
    parts.push(body);
  }

  const rawText = parts.join("\n\n");
  const stats = await syncProductsFromChannelText({
    rawText,
    importedBy: null,
    forceScope: "auto",
    deactivateMissing: true,
  });

  const ids = rows.map((r) => r.id);
  await admin.from("bale_channel_message_buffer").delete().in("id", ids);

  await admin.from("bale_channel_sync_state").upsert(
    {
      chat_id: chatId,
      debounce_until: new Date(0).toISOString(),
      last_synced_at: new Date().toISOString(),
      last_stats: stats,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chat_id" }
  );

  // پاکسازی بافرهای قدیمی
  await admin
    .from("bale_channel_message_buffer")
    .delete()
    .lt("created_at", sinceIso);

  return { skipped: false, stats, messageCount: parts.length };
}

export async function handleBaleProductUpdate(update: BaleUpdate): Promise<{
  accepted: number;
  chatIds: string[];
}> {
  const posts = extractSyncablePosts(update);
  const chatIds: string[] = [];
  for (const post of posts) {
    await enqueueChannelProductText(post);
    chatIds.push(post.chatId);
  }
  return { accepted: posts.length, chatIds: [...new Set(chatIds)] };
}
