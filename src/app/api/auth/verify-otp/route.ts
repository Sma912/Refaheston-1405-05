import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, phoneToAuthEmail, sanitizeOtpInput } from "@/lib/utils/phone";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const normalized = normalizePhone(String(body.phone ?? ""));
    const otp = sanitizeOtpInput(String(body.code ?? ""));
    const fullName = body.full_name ? String(body.full_name) : null;

    if (!normalized || otp.length !== 6) {
      return NextResponse.json(
        { error: "شماره یا کد تأیید نامعتبر است" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const codeHash = createHash("sha256").update(otp).digest("hex");

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
      return NextResponse.json(
        { error: "کد تأیید اشتباه یا منقضی شده است" },
        { status: 401 }
      );
    }

    await supabase.from("otp_codes").update({ used: true }).eq("id", otpRow.id);

    const email = phoneToAuthEmail(normalized);

    // Ensure user exists (ignore "already registered")
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        phone: normalized,
        full_name: fullName,
      },
    });

    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          data: {
            phone: normalized,
            full_name: fullName,
          },
        },
      });

    if (linkError || !linkData?.properties?.hashed_token || !linkData.user) {
      console.error(linkError);
      return NextResponse.json(
        { error: "ایجاد نشست ناموفق بود" },
        { status: 500 }
      );
    }

    const user = linkData.user;

    if (fullName) {
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          phone: normalized,
          full_name: fullName,
        },
      });
    }

    await supabase.from("profiles").upsert(
      {
        id: user.id,
        phone: normalized,
        full_name: fullName ?? user.user_metadata?.full_name ?? null,
      },
      { onConflict: "id" }
    );

    return NextResponse.json({
      success: true,
      token_hash: linkData.properties.hashed_token,
      email,
      user_id: user.id,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
