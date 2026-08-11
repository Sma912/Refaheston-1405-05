/**
 * Bale Bot API (Gateway) — جدا از Safir OTP
 * Base: https://tapi.bale.ai/bot{token}/{method}
 */

const DEFAULT_BASE = "https://tapi.bale.ai";

export function getBaleBotToken(): string {
  return (process.env.BALE_BOT_TOKEN ?? "").trim();
}

export function getBaleWebhookSecret(): string {
  return (
    process.env.BALE_WEBHOOK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

export function baleBotApiBase(): string {
  const base = (process.env.BALE_BOT_API_BASE ?? DEFAULT_BASE).replace(
    /\/$/,
    ""
  );
  const token = getBaleBotToken();
  if (!token) throw new Error("BALE_BOT_TOKEN تنظیم نشده است");
  return `${base}/bot${token}`;
}

export type BaleApiResult<T> =
  | { ok: true; result: T }
  | { ok: false; error: string; description?: string };

export async function callBaleBotApi<T>(
  method: string,
  body?: Record<string, unknown>
): Promise<BaleApiResult<T>> {
  try {
    const url = `${baleBotApiBase()}/${method}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      result?: T;
      description?: string;
      error_code?: number;
    };
    if (!payload.ok) {
      return {
        ok: false,
        error: payload.description || `Bale API error ${payload.error_code ?? response.status}`,
        description: payload.description,
      };
    }
    return { ok: true, result: payload.result as T };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "خطا در تماس با API بله",
    };
  }
}

export async function setBaleWebhook(url: string) {
  return callBaleBotApi<boolean>("setWebhook", { url });
}

export async function getBaleWebhookInfo() {
  return callBaleBotApi<{
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
  }>("getWebhookInfo");
}

export async function getBaleMe() {
  return callBaleBotApi<{
    id: number;
    is_bot: boolean;
    first_name?: string;
    username?: string;
  }>("getMe");
}

/** تشخیص متن لیست قیمت محصولات کانال */
export function looksLikeProductList(text: string): boolean {
  const t = text.trim();
  if (t.length < 40) return false;
  return t.includes("📱") && t.includes("💰") && /تومان/.test(t);
}

/** تکه ادامه‌دار لیست (بدون هدر کامل) */
export function looksLikeProductContinuation(text: string): boolean {
  const t = text.trim();
  if (t.length < 20) return false;
  if (looksLikeProductList(t)) return false;
  return t.includes("💰") && /تومان/.test(t);
}
