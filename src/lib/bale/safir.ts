import { phoneToBaleNumber } from "@/lib/utils/phone";

export type SafirSendResult =
  | { ok: true; messageId: string | null; skipped?: boolean; reason?: string }
  | { ok: false; error: string; details?: unknown };

type SafirMessageData =
  | { otp_message: { otp: string } }
  | { message: { text: string; copy_text?: string } };

function safirConfig() {
  const apiKey = process.env.BALE_API_ACCESS_KEY ?? "";
  const botId = process.env.BALE_BOT_ID ?? "";
  const baseUrl =
    process.env.BALE_OTP_BASE_URL ?? "https://safir.bale.ai/api/v3";
  const proxyUrl = (
    process.env.BALE_SAFIR_PROXY_URL ||
    process.env.MEDIA_UPLOAD_URL?.replace(/\/upload\/?$/, "/safir/send_message") ||
    ""
  ).trim();
  const proxySecret = process.env.MEDIA_UPLOAD_SECRET?.trim() ?? "";
  return { apiKey, botId, baseUrl, proxyUrl, proxySecret };
}

export function isBaleMessagingConfigured(): boolean {
  const { apiKey, botId } = safirConfig();
  return Boolean(apiKey && botId);
}

async function postSafirSendMessage(body: unknown): Promise<{
  ok: boolean;
  status: number;
  payload: { message_id?: string; error_data?: unknown; error?: string };
}> {
  const { apiKey, baseUrl, proxyUrl, proxySecret } = safirConfig();
  const useProxy = Boolean(proxyUrl && proxySecret);
  const url = useProxy ? proxyUrl : `${baseUrl}/send_message`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "api-access-key": apiKey,
  };
  if (useProxy) {
    headers.Authorization = `Bearer ${proxySecret}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(28000),
  });

  let payload: { message_id?: string; error_data?: unknown; error?: string } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    payload = { error: "invalid_json" };
  }

  return {
    ok: response.ok && !payload?.error_data,
    status: response.status,
    payload,
  };
}

export async function sendBaleSafirPayload(options: {
  phone: string;
  messageData: SafirMessageData;
  requestId?: string;
}): Promise<SafirSendResult> {
  const { apiKey, botId } = safirConfig();
  const allowDev = process.env.ALLOW_DEV_OTP === "true";
  const balePhone = phoneToBaleNumber(options.phone);

  if (!balePhone) {
    return { ok: false, error: "شماره موبایل نامعتبر است" };
  }

  if (!apiKey || !botId) {
    if (allowDev) {
      console.info("[bale:dev] skip send", {
        phone: balePhone,
        messageData: options.messageData,
      });
      return {
        ok: true,
        messageId: null,
        skipped: true,
        reason: "dev_skip",
      };
    }
    return { ok: false, error: "سرویس پیام بله پیکربندی نشده است" };
  }

  try {
    const { ok, payload } = await postSafirSendMessage({
      request_id: options.requestId ?? crypto.randomUUID(),
      bot_id: Number(botId),
      phone_number: balePhone,
      message_data: options.messageData,
    });

    if (!ok) {
      console.error("Bale Safir send error", payload);
      return {
        ok: false,
        error: "ارسال پیام بله ناموفق بود",
        details: payload?.error_data ?? payload,
      };
    }

    return { ok: true, messageId: payload.message_id ?? null };
  } catch (err) {
    console.error("Bale Safir network error", err);
    return {
      ok: false,
      error:
        err instanceof Error && /timeout|fetch failed/i.test(err.message)
          ? "ارتباط با سرویس بله برقرار نشد. کمی بعد دوباره تلاش کنید."
          : err instanceof Error
            ? err.message
            : "خطای شبکه بله",
    };
  }
}

/**
 * ارسال پیام متنی از طریق سفیر بله به شماره موبایل.
 * اگر کلیدها تنظیم نشده باشند و ALLOW_DEV_OTP=true باشد، فقط لاگ می‌کند.
 */
export async function sendBaleTextMessage(options: {
  phone: string;
  text: string;
  /** متن دکمه رونوشت روی پیام (مثلاً شبا) */
  copyText?: string;
  requestId?: string;
}): Promise<SafirSendResult> {
  const message: { text: string; copy_text?: string } = { text: options.text };
  if (options.copyText) {
    message.copy_text = options.copyText;
  }
  return sendBaleSafirPayload({
    phone: options.phone,
    requestId: options.requestId,
    messageData: { message },
  });
}

export async function sendBaleOtpMessage(options: {
  phone: string;
  otp: string;
  requestId?: string;
}): Promise<SafirSendResult> {
  return sendBaleSafirPayload({
    phone: options.phone,
    requestId: options.requestId,
    messageData: { otp_message: { otp: options.otp } },
  });
}

export function getAdminBalePhone(): string | null {
  const raw = process.env.BALE_ADMIN_PHONE?.trim() ?? "";
  if (!raw) return null;
  return raw;
}

export function getPaymentDetails() {
  return {
    sheba: (process.env.PAYMENT_SHEBA ?? "").trim(),
    cardNumber: (process.env.PAYMENT_CARD_NUMBER ?? "").trim(),
    cardHolder: (process.env.PAYMENT_CARD_HOLDER ?? "").trim(),
  };
}

export function paymentDetailsFromSettings(settings: {
  payment_sheba: string;
  payment_card_number: string;
  payment_card_holder: string;
  bale_admin_phone: string;
}) {
  return {
    sheba: settings.payment_sheba.trim(),
    cardNumber: settings.payment_card_number.trim(),
    cardHolder: settings.payment_card_holder.trim(),
    adminPhone: settings.bale_admin_phone.trim(),
  };
}
