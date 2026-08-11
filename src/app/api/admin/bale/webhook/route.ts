import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/config";
import { createClient } from "@/lib/supabase/server";
import {
  getBaleBotToken,
  getBaleMe,
  getBaleWebhookInfo,
  getBaleWebhookSecret,
  setBaleWebhook,
} from "@/lib/bale/bot-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "وارد شوید" }, { status: 401 }) };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return {
      error: NextResponse.json({ error: "دسترسی ادمین لازم است" }, { status: 403 }),
    };
  }
  return { user };
}

function webhookUrl(): string | null {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const secret = getBaleWebhookSecret();
  if (!site || !secret) return null;
  return `${site}/api/bale/webhook/${secret}`;
}

export async function GET() {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ demo: true, configured: false });
    }
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const tokenSet = Boolean(getBaleBotToken());
    const secretSet = Boolean(getBaleWebhookSecret());
    const url = webhookUrl();
    const me = tokenSet ? await getBaleMe() : null;
    const info = tokenSet ? await getBaleWebhookInfo() : null;

    return NextResponse.json({
      ok: true,
      tokenSet,
      secretSet,
      webhookUrl: url,
      bot:
        me && me.ok
          ? me.result
          : { error: me && !me.ok ? me.error : "توکن تنظیم نشده" },
      webhookInfo: info && info.ok ? info.result : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { error: "در حالت دمو وب‌هوک فعال نمی‌شود" },
        { status: 400 }
      );
    }
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    if (!getBaleBotToken()) {
      return NextResponse.json(
        { error: "BALE_BOT_TOKEN در محیط سرور تنظیم نشده است" },
        { status: 400 }
      );
    }
    const url = webhookUrl();
    if (!url) {
      return NextResponse.json(
        {
          error:
            "NEXT_PUBLIC_SITE_URL و BALE_WEBHOOK_SECRET (یا CRON_SECRET) لازم است",
        },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { action?: string };
    if (body.action === "clear") {
      const cleared = await setBaleWebhook("");
      return NextResponse.json({ ok: cleared.ok, cleared, webhookUrl: "" });
    }

    const result = await setBaleWebhook(url);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, webhookUrl: url },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, webhookUrl: url, result: result.result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در setWebhook" },
      { status: 500 }
    );
  }
}
