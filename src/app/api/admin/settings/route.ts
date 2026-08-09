import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_STORE_SETTINGS } from "@/lib/store/defaults";
import { getStoreSettings } from "@/lib/store/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KEYS = [
  "contact_phone",
  "order_tracking_phone",
  "payment_sheba",
  "payment_card_number",
  "payment_card_holder",
  "bale_admin_phone",
  "bale_products_channel_url",
  "enamad_code",
  "enamad_url",
  "ecommerce_license_number",
  "ecommerce_license_url",
  "store_address",
  "shipping_cost",
  "footer_tagline",
  "about_content",
  "terms_content",
] as const;

export async function GET() {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ settings: DEMO_STORE_SETTINGS, demo: true });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "وارد شوید" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "دسترسی ادمین لازم است" }, { status: 403 });
    }

    const settings = await getStoreSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { error: "در حالت دمو از ذخیره محلی استفاده کنید", demo: true },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "وارد شوید" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "دسترسی ادمین لازم است" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const updatePayload: Record<string, unknown> = {
      id: 1,
      updated_by: user.id,
    };
    let fieldCount = 0;
    for (const key of ALLOWED_KEYS) {
      if (!(key in body)) continue;
      const value = body[key];
      if (key === "shipping_cost") {
        const n =
          typeof value === "number"
            ? value
            : Number(String(value ?? "").replace(/[^\d]/g, ""));
        updatePayload[key] = Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
      } else {
        updatePayload[key] =
          typeof value === "string" ? value.trim() || null : null;
      }
      fieldCount += 1;
    }

    if (fieldCount === 0) {
      return NextResponse.json(
        { error: "داده‌ای برای ذخیره نیست" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("store_settings")
      .upsert(updatePayload)
      .select("*")
      .single();

    if (error) {
      // اگر migration هزینه ارسال هنوز اجرا نشده، بدون shipping_cost دوباره تلاش کن
      const missingShipping =
        typeof error.message === "string" &&
        error.message.includes("shipping_cost");
      if (missingShipping && "shipping_cost" in updatePayload) {
        const { shipping_cost: _ignored, ...withoutShipping } = updatePayload;
        const retry = await supabase
          .from("store_settings")
          .upsert(withoutShipping)
          .select("*")
          .single();
        if (retry.error) {
          return NextResponse.json(
            {
              error: retry.error.message,
              hint: "migration 0005_shipping_cost.sql را در Supabase اجرا کنید",
            },
            { status: 500 }
          );
        }
        return NextResponse.json({
          ok: true,
          settings: retry.data,
          warning:
            "ذخیره شد، ولی ستون هزینه ارسال هنوز در دیتابیس نیست. migration 0005 را اجرا کنید.",
        });
      }

      return NextResponse.json(
        {
          error: error.message,
          hint: error.message.includes("shipping_cost")
            ? "فایل supabase/migrations/0005_shipping_cost.sql را در SQL Editor اجرا کنید"
            : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, settings: data });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 500 }
    );
  }
}
