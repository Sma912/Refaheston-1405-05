import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function toEnglishDigits(input: string): string {
  return String(input)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Local Iranian mobile: 09xxxxxxxxx */
function normalizePhone(input: string): string | null {
  const digits = toEnglishDigits(input).replace(/[^\d]/g, "");
  let national: string | null = null;
  if (digits.startsWith("0098") && digits.length === 14) national = digits.slice(4);
  else if (digits.startsWith("98") && digits.length === 12) national = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) national = digits.slice(1);
  else if (digits.length === 10 && digits.startsWith("9")) national = digits;
  else return null;
  if (!/^9\d{9}$/.test(national)) return null;
  return `0${national}`;
}

function phoneToBaleNumber(phone: string): string | null {
  const local = normalizePhone(phone);
  if (!local) return null;
  return `98${local.slice(1)}`;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    const normalized = normalizePhone(String(phone ?? ""));
    if (!normalized) {
      return new Response(
        JSON.stringify({ error: "شماره موبایل ایرانی نامعتبر است" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limit: max 3 OTPs per phone in 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", normalized)
      .gte("created_at", tenMinAgo);

    if ((count ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "تعداد درخواست‌ها بیش از حد مجاز است. کمی صبر کنید." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("otp_codes").insert({
      phone: normalized,
      code_hash: codeHash,
      expires_at: expiresAt,
      used: false,
    });

    if (insertError) {
      throw insertError;
    }

    const baleKey = Deno.env.get("BALE_API_ACCESS_KEY") ?? "";
    const botId = Deno.env.get("BALE_BOT_ID") ?? "";
    const baseUrl =
      Deno.env.get("BALE_OTP_BASE_URL") ?? "https://safir.bale.ai/api/v3";
    const allowDev = Deno.env.get("ALLOW_DEV_OTP") === "true";

    let sentViaBale = false;

    if (baleKey && botId) {
      const balePhone = phoneToBaleNumber(normalized);
      if (!balePhone) {
        return new Response(
          JSON.stringify({ error: "شماره موبایل ایرانی نامعتبر است" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          message_data: {
            otp_message: { otp: code },
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload?.error_data) {
        console.error("Bale OTP error", payload);
        return new Response(
          JSON.stringify({
            error: "ارسال کد از طریق بله ناموفق بود. لطفاً دوباره تلاش کنید.",
            details: payload?.error_data ?? null,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      sentViaBale = true;
    } else if (!allowDev) {
      return new Response(
        JSON.stringify({ error: "سرویس ارسال OTP پیکربندی نشده است" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: Record<string, unknown> = {
      success: true,
      message: sentViaBale
        ? "کد تأیید از طریق بله ارسال شد"
        : "حالت توسعه: کد در پاسخ برگردانده شد",
      phone: normalized,
      expires_in: 300,
    };

    if (!sentViaBale && allowDev) {
      body.dev_otp = code;
    }

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "خطای داخلی سرور" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
