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

function sanitizeOtpInput(input: string): string {
  return toEnglishDigits(input).replace(/[^\d]/g, "").slice(0, 6);
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function phoneToEmail(phone: string) {
  return `${phone}@phone.refahestoon.local`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, code, full_name } = await req.json();
    const normalized = normalizePhone(String(phone ?? ""));
    const otp = sanitizeOtpInput(String(code ?? ""));

    if (!normalized || otp.length !== 6) {
      return new Response(
        JSON.stringify({ error: "شماره یا کد تأیید نامعتبر است" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const codeHash = await sha256(otp);
    const { data: otpRow, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", normalized)
      .eq("code_hash", codeHash)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRow) {
      return new Response(
        JSON.stringify({ error: "کد تأیید اشتباه یا منقضی شده است" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpRow.id);

    const email = phoneToEmail(normalized);

    const { data: listed } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    let user = listed?.users?.find(
      (u) =>
        u.email === email ||
        u.user_metadata?.phone === normalized ||
        u.phone === normalized
    );

    if (!user) {
      const { data: created, error: createError } =
        await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            phone: normalized,
            full_name: full_name ?? null,
          },
        });

      if (createError || !created.user) {
        console.error(createError);
        return new Response(
          JSON.stringify({ error: "ایجاد کاربر ناموفق بود" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      user = created.user;
    } else if (full_name) {
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          phone: normalized,
          full_name,
        },
      });
    }

    await supabase.from("profiles").upsert(
      {
        id: user.id,
        phone: normalized,
        full_name: full_name ?? user.user_metadata?.full_name ?? null,
      },
      { onConflict: "id" }
    );

    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error(linkError);
      return new Response(
        JSON.stringify({ error: "ایجاد نشست ناموفق بود" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        token_hash: linkData.properties.hashed_token,
        email,
        user_id: user.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "خطای داخلی سرور" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
