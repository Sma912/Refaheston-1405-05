import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, phoneToBaleNumber } from "@/lib/utils/phone";
import { createHash, randomInt } from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const normalized = normalizePhone(String(body.phone ?? ""));
    if (!normalized) {
      return NextResponse.json(
        { error: "شماره موبایل ایرانی نامعتبر است" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", normalized)
      .gte("created_at", tenMinAgo);

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: "تعداد درخواست‌ها بیش از حد مجاز است. کمی صبر کنید." },
        { status: 429 }
      );
    }

    const code = String(randomInt(100000, 999999));
    const codeHash = createHash("sha256").update(code).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("otp_codes").insert({
      phone: normalized,
      code_hash: codeHash,
      expires_at: expiresAt,
      used: false,
    });

    if (insertError) {
      console.error(insertError);
      return NextResponse.json({ error: "ذخیره کد ناموفق بود" }, { status: 500 });
    }

    const baleKey = process.env.BALE_API_ACCESS_KEY ?? "";
    const botId = process.env.BALE_BOT_ID ?? "";
    const baseUrl =
      process.env.BALE_OTP_BASE_URL ?? "https://safir.bale.ai/api/v3";
    const allowDev = process.env.ALLOW_DEV_OTP === "true";

    let sentViaBale = false;

    if (baleKey && botId) {
      const balePhone = phoneToBaleNumber(normalized);
      if (!balePhone) {
        return NextResponse.json(
          { error: "شماره موبایل ایرانی نامعتبر است" },
          { status: 400 }
        );
      }
      const response = await fetch(`${baseUrl}/send_message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-access-key": baleKey,
        },
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          bot_id: Number(botId),
          phone_number: balePhone,
          message_data: { otp_message: { otp: code } },
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload?.error_data) {
        console.error("Bale OTP error", payload);
        return NextResponse.json(
          {
            error: "ارسال کد از طریق بله ناموفق بود. لطفاً دوباره تلاش کنید.",
            details: payload?.error_data ?? null,
          },
          { status: 502 }
        );
      }
      sentViaBale = true;
    } else if (!allowDev) {
      return NextResponse.json(
        { error: "سرویس ارسال OTP پیکربندی نشده است" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: sentViaBale
        ? "کد تأیید از طریق بله ارسال شد"
        : "حالت توسعه: کد در پاسخ برگردانده شد",
      phone: normalized,
      expires_in: 300,
      ...(sentViaBale || !allowDev ? {} : { dev_otp: code }),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
