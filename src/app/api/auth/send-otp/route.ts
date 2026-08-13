import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils/phone";
import { sendBaleOtpMessage } from "@/lib/bale/safir";
import { createHash, randomInt } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

    const allowDev = process.env.ALLOW_DEV_OTP === "true";
    const result = await sendBaleOtpMessage({
      phone: normalized,
      otp: code,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error || "ارسال کد از طریق بله ناموفق بود. لطفاً دوباره تلاش کنید.",
          details: result.details ?? null,
        },
        { status: 502 }
      );
    }

    const sentViaBale = !result.skipped;
    if (!sentViaBale && !allowDev) {
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
