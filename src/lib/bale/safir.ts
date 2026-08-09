import { phoneToBaleNumber } from "@/lib/utils/phone";

export type SafirSendResult =
  | { ok: true; messageId: string | null; skipped?: boolean; reason?: string }
  | { ok: false; error: string; details?: unknown };

type SendTextOptions = {
  phone: string;
  text: string;
  /** متن دکمه رونوشت زیر پیام (مثلاً شبا) */
  copyText?: string;
  requestId?: string;
};

function safirConfig() {
  const apiKey = process.env.BALE_API_ACCESS_KEY ?? "";
  const botId = process.env.BALE_BOT_ID ?? "";
  const baseUrl =
    process.env.BALE_OTP_BASE_URL ?? "https://safir.bale.ai/api/v3";
  return { apiKey, botId, baseUrl };
}

export function isBaleMessagingConfigured(): boolean {
  const { apiKey, botId } = safirConfig();
  return Boolean(apiKey && botId);
}

/**
 * ارسال پیام متنی از طریق سفیر بله به شماره موبایل.
 * اگر کلیدها تنظیم نشده باشند و ALLOW_DEV_OTP=true باشد، فقط لاگ می‌کند.
 */
export async function sendBaleTextMessage(
  options: SendTextOptions
): Promise<SafirSendResult> {
  const { apiKey, botId, baseUrl } = safirConfig();
  const allowDev = process.env.ALLOW_DEV_OTP === "true";
  const balePhone = phoneToBaleNumber(options.phone);

  if (!balePhone) {
    return { ok: false, error: "شماره موبایل نامعتبر است" };
  }

  if (!apiKey || !botId) {
    if (allowDev) {
      console.info("[bale:dev] skip send", {
        phone: balePhone,
        text: options.text.slice(0, 200),
        copyText: options.copyText,
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

  const message: Record<string, unknown> = { text: options.text };
  if (options.copyText) {
    message.copy_text = options.copyText;
  }

  try {
    const response = await fetch(`${baseUrl}/send_message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-access-key": apiKey,
      },
      body: JSON.stringify({
        request_id: options.requestId ?? crypto.randomUUID(),
        bot_id: Number(botId),
        phone_number: balePhone,
        message_data: { message },
      }),
    });

    const payload = (await response.json()) as {
      message_id?: string;
      error_data?: unknown;
    };

    if (!response.ok || payload?.error_data) {
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
      error: err instanceof Error ? err.message : "خطای شبکه بله",
    };
  }
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
