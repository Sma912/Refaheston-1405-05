import { createAdminClient } from "@/lib/supabase/admin";
import {
  looksLikeProductContinuation,
  looksLikeProductList,
} from "@/lib/bale/bot-api";
import { syncProductsFromChannelText } from "@/lib/products/sync-server";
import type { ProductSyncStats } from "@/lib/products/sync";

/** صبر کوتاه تا تکه‌های پشت‌سرهم لیست در بافر جمع شوند */
export const SETTLE_MS = 8_000;
const BUFFER_WINDOW_MS = 10 * 60_000;
/** کمتر از این تعداد پارس‌شده، غیرفعال‌سازی کالاهای غایب انجام نمی‌شود */
const MIN_PARSED_FOR_DEACTIVATE = 15;

export type BaleChatMessage = {
  message_id?: number;
  text?: string;
  caption?: string;
  chat?: {
    id?: number | string;
    type?: string;
    title?: string;
    username?: string;
  };
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

function isAllowedChat(
  chatId: string,
  username?: string | null
): boolean {
  const allow = allowedChannelIds();
  if (!allow) return true;
  if (allow.has(chatId)) return true;
  if (username && allow.has(`@${username}`)) return true;
  if (username && allow.has(username)) return true;
  return false;
}

export function extractSyncablePosts(update: BaleUpdate): Array<{
  chatId: string;
  messageId: number | null;
  text: string;
  soft: boolean;
}> {
  const candidates = [
    update.channel_post,
    update.edited_channel_post,
    update.message,
    update.edited_message,
  ].filter(Boolean) as BaleChatMessage[];

  const out: Array<{
    chatId: string;
    messageId: number | null;
    text: string;
    soft: boolean;
  }> = [];

  for (const msg of candidates) {
    const text = (msg.text ?? msg.caption ?? "").trim();
    if (!text || msg.chat?.id == null) continue;
    const chatId = String(msg.chat.id);
    if (!isAllowedChat(chatId, msg.chat.username)) continue;

    const full = looksLikeProductList(text);
    const soft = !full && looksLikeProductContinuation(text);
    if (!full && !soft) continue;

    out.push({
      chatId,
      messageId: msg.message_id ?? null,
      text,
      soft,
    });
  }
  return out;
}

export async function enqueueChannelProductText(input: {
  chatId: string;
  messageId?: number | null;
  text: string;
}): Promise<{ scheduled: true; settleUntil: string }> {
  const admin = createAdminClient();
  const settleUntil = new Date(Date.now() + SETTLE_MS).toISOString();
  const nowIso = new Date().toISOString();

  const { error: insertError } = await admin
    .from("bale_channel_message_buffer")
    .insert({
      chat_id: input.chatId,
      message_id: input.messageId ?? null,
      body: input.text,
      created_at: nowIso,
    });

  if (insertError) {
    const dup =
      insertError.code === "23505" ||
      insertError.message.toLowerCase().includes("duplicate");
    if (!dup) {
      if (
        insertError.message.includes("bale_channel_message_buffer") ||
        insertError.code === "42P01" ||
        insertError.message.includes("does not exist")
      ) {
        throw new Error(
          "جداول همگام‌سازی کانال ساخته نشده‌اند — migration 0008/0009 را در Supabase اجرا کنید"
        );
      }
      throw new Error(insertError.message);
    }
  }

  const { data: existing } = await admin
    .from("bale_channel_sync_state")
    .select("pending_since")
    .eq("chat_id", input.chatId)
    .maybeSingle();

  const { error: stateError } = await admin.from("bale_channel_sync_state").upsert(
    {
      chat_id: input.chatId,
      debounce_until: settleUntil,
      pending_since: existing?.pending_since ?? nowIso,
      updated_at: nowIso,
      last_error: null,
    },
    { onConflict: "chat_id" }
  );
  if (stateError) throw new Error(stateError.message);

  return { scheduled: true, settleUntil };
}

function shouldDeactivateMissing(rawText: string, parsed: number): boolean {
  if (parsed < MIN_PARSED_FOR_DEACTIVATE) return false;
  const brandSections = (rawText.match(/═{2,}/g) ?? []).length;
  const phoneMarks = (rawText.match(/📱/g) ?? []).length;
  // فقط وقتی لیست به‌نظر کامل می‌آید کالاهای غایب را غیرفعال کن
  return brandSections >= 2 || phoneMarks >= 25;
}

/**
 * جمع پیام‌های اخیر و همگام‌سازی به products.
 * force=true: بدون انتظار settle
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
  const syncStartedAt = new Date().toISOString();
  const lock = crypto.randomUUID();

  const { data: state, error: stateError } = await admin
    .from("bale_channel_sync_state")
    .select("debounce_until, sync_lock")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (stateError) throw new Error(stateError.message);

  if (!force) {
    if (!state?.debounce_until) {
      return { skipped: true, reason: "no_state" };
    }
    const until = new Date(state.debounce_until).getTime();
    if (Number.isFinite(until) && until > Date.now() + 400) {
      return { skipped: true, reason: "settle_pending" };
    }
  }

  // قفل خوش‌بینانه تا دو flush همزمان همدیگر را خراب نکنند
  const { error: lockError } = await admin
    .from("bale_channel_sync_state")
    .upsert(
      {
        chat_id: chatId,
        sync_lock: lock,
        debounce_until: state?.debounce_until ?? new Date(0).toISOString(),
        updated_at: syncStartedAt,
      },
      { onConflict: "chat_id" }
    );
  if (lockError) throw new Error(lockError.message);

  const sinceIso = new Date(Date.now() - BUFFER_WINDOW_MS).toISOString();
  const { data: rows, error: bufError } = await admin
    .from("bale_channel_message_buffer")
    .select("id, body, created_at")
    .eq("chat_id", chatId)
    .gte("created_at", sinceIso)
    .lte("created_at", syncStartedAt)
    .order("created_at", { ascending: true });

  if (bufError) throw new Error(bufError.message);
  if (!rows?.length) {
    return { skipped: true, reason: "empty_buffer" };
  }

  const parts: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const body = String(row.body ?? "").trim();
    if (!body || seen.has(body)) continue;
    seen.add(body);
    parts.push(body);
  }

  if (parts.length === 0) {
    return { skipped: true, reason: "empty_parts" };
  }

  const rawText = parts.join("\n\n");
  if (!looksLikeProductList(rawText)) {
    await admin
      .from("bale_channel_sync_state")
      .update({
        last_error: "متن بافر هنوز شبیه لیست کامل محصول نیست",
        updated_at: new Date().toISOString(),
      })
      .eq("chat_id", chatId)
      .eq("sync_lock", lock);
    return { skipped: true, reason: "incomplete_list" };
  }

  let stats: ProductSyncStats;
  try {
    const { buildProductSyncPlan } = await import("@/lib/products/sync");
    const plan = buildProductSyncPlan(rawText, "auto");
    const deactivateMissing = shouldDeactivateMissing(
      rawText,
      plan.rows.length
    );

    stats = await syncProductsFromChannelText({
      rawText,
      importedBy: null,
      forceScope: "auto",
      deactivateMissing,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_failed";
    await admin
      .from("bale_channel_sync_state")
      .update({
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("chat_id", chatId)
      .eq("sync_lock", lock);
    throw err;
  }

  // فقط اگر هنوز قفل مال ماست، بافر را پاک کن
  const { data: lockCheck } = await admin
    .from("bale_channel_sync_state")
    .select("sync_lock")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (lockCheck?.sync_lock !== lock) {
    return { skipped: true, reason: "lock_lost" };
  }

  const ids = rows.map((r) => r.id);
  await admin.from("bale_channel_message_buffer").delete().in("id", ids);

  await admin.from("bale_channel_sync_state").upsert(
    {
      chat_id: chatId,
      debounce_until: new Date(0).toISOString(),
      last_synced_at: new Date().toISOString(),
      last_stats: stats,
      last_error: null,
      pending_since: null,
      sync_lock: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chat_id" }
  );

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
    if (post.soft) {
      // تکه ادامه‌دار فقط اگر همین چت اخیراً بافر داشته باشد
      const admin = createAdminClient();
      const sinceIso = new Date(Date.now() - BUFFER_WINDOW_MS).toISOString();
      const { count } = await admin
        .from("bale_channel_message_buffer")
        .select("id", { count: "exact", head: true })
        .eq("chat_id", post.chatId)
        .gte("created_at", sinceIso);
      if (!count) continue;
    }
    await enqueueChannelProductText(post);
    chatIds.push(post.chatId);
  }

  return { accepted: posts.length, chatIds: [...new Set(chatIds)] };
}

/** برای cron: همه چت‌های دارای بافر را flush کن */
export async function flushAllPendingChannelSyncs(options?: {
  force?: boolean;
}): Promise<{
  chats: Array<{ chatId: string; result: unknown }>;
}> {
  const admin = createAdminClient();
  const sinceIso = new Date(Date.now() - BUFFER_WINDOW_MS).toISOString();
  const { data: rows, error } = await admin
    .from("bale_channel_message_buffer")
    .select("chat_id")
    .gte("created_at", sinceIso);

  if (error) throw new Error(error.message);

  const chatIds = [...new Set((rows ?? []).map((r) => String(r.chat_id)))];
  const chats: Array<{ chatId: string; result: unknown }> = [];
  for (const chatId of chatIds) {
    try {
      const result = await flushChannelProductSync(chatId, {
        force: options?.force === true,
      });
      chats.push({ chatId, result });
    } catch (err) {
      chats.push({
        chatId,
        result: {
          skipped: true,
          reason: err instanceof Error ? err.message : "error",
        },
      });
    }
  }
  return { chats };
}

/** اطمینان از درست بودن URL وب‌هوک */
export async function ensureBaleWebhookConfigured(): Promise<{
  ok: boolean;
  url?: string;
  fixed?: boolean;
  error?: string;
}> {
  const { getBaleWebhookInfo, getBaleWebhookSecret, setBaleWebhook } =
    await import("@/lib/bale/bot-api");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const secret = getBaleWebhookSecret();
  if (!site || !secret) {
    return { ok: false, error: "SITE_URL یا WEBHOOK_SECRET نیست" };
  }
  const expected = `${site}/api/bale/webhook/${secret}`;
  try {
    const info = await getBaleWebhookInfo();
    if (!info.ok) return { ok: false, error: info.error };
    if (info.result.url === expected) {
      return { ok: true, url: expected };
    }
    const set = await setBaleWebhook(expected);
    if (!set.ok) return { ok: false, error: set.error, url: expected };
    return { ok: true, url: expected, fixed: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "webhook_check_failed",
    };
  }
}
