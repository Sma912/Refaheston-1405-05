import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_STORE_SETTINGS } from "@/lib/store/defaults";
import { getStoreSettings } from "@/lib/store/settings";
import {
  clampWindowMinutes,
  DEFAULT_ADMIN_CONFIRM_WINDOW_MINUTES,
  DEFAULT_PAYMENT_WINDOW_MINUTES,
} from "@/lib/orders/note-templates";

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
  "bale_loan_bot_url",
  "enamad_code",
  "enamad_url",
  "ecommerce_license_number",
  "ecommerce_license_url",
  "store_address",
  "shipping_cost",
  "payment_window_minutes",
  "admin_confirm_window_minutes",
  "markup_percent_mobile",
  "markup_percent_iphone_noreg",
  "markup_percent_tablet",
  "markup_percent_ipad",
  "markup_percent_xiaomi_pad",
  "markup_percent_console",
  "markup_percent_laptop",
  "markup_percent_accessory",
  "markup_percent_audio",
  "footer_tagline",
  "about_content",
  "terms_content",
] as const;

function parseNonNegInt(value: unknown, fallback = 0) {
  const n =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

function parseMarkupPercent(value: unknown, fallback = 2.7) {
  const n =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/[^\d.-]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(100, Math.round(n * 1000) / 1000);
}

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
        updatePayload[key] = parseNonNegInt(value, 0);
      } else if (key === "payment_window_minutes") {
        updatePayload[key] = clampWindowMinutes(
          value,
          DEFAULT_PAYMENT_WINDOW_MINUTES
        );
      } else if (key === "admin_confirm_window_minutes") {
        updatePayload[key] = clampWindowMinutes(
          value,
          DEFAULT_ADMIN_CONFIRM_WINDOW_MINUTES
        );
      } else if (key.startsWith("markup_percent_")) {
        updatePayload[key] = parseMarkupPercent(value, 2.7);
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
      const msg = typeof error.message === "string" ? error.message : "";
      const missingCol =
        msg.includes("shipping_cost") ||
        msg.includes("bale_loan_bot_url") ||
        msg.includes("payment_window_minutes") ||
        msg.includes("admin_confirm_window_minutes") ||
        msg.includes("markup_percent_");
      if (missingCol) {
        const withoutMissing = { ...updatePayload };
        for (const col of [
          "shipping_cost",
          "bale_loan_bot_url",
          "payment_window_minutes",
          "admin_confirm_window_minutes",
          "markup_percent_mobile",
          "markup_percent_iphone_noreg",
          "markup_percent_tablet",
          "markup_percent_ipad",
          "markup_percent_xiaomi_pad",
          "markup_percent_console",
          "markup_percent_laptop",
          "markup_percent_accessory",
          "markup_percent_audio",
        ]) {
          if (msg.includes(col) || (col.startsWith("markup_percent_") && msg.includes("markup_percent_"))) {
            delete withoutMissing[col];
          }
        }
        // اگر خطای کلی روی markup بود همهٔ ستون‌های markup را حذف کن
        if (msg.includes("markup_percent_")) {
          for (const col of Object.keys(withoutMissing)) {
            if (col.startsWith("markup_percent_")) delete withoutMissing[col];
          }
        }
        const retry = await supabase
          .from("store_settings")
          .upsert(withoutMissing)
          .select("*")
          .single();
        if (retry.error) {
          return NextResponse.json(
            {
              error: retry.error.message,
              hint: "migrationهای supabase/migrations را در SQL Editor اجرا کنید (از جمله 0015)",
            },
            { status: 500 }
          );
        }
        revalidateTag("store-settings");
        return NextResponse.json({
          ok: true,
          settings: retry.data,
          warning:
            "ذخیره شد، ولی بعضی ستون‌های جدید در دیتابیس نیست. migration مربوط را اجرا کنید.",
        });
      }

      return NextResponse.json(
        {
          error: error.message,
          hint: "فایل‌های migration در supabase/migrations را در SQL Editor اجرا کنید",
        },
        { status: 500 }
      );
    }

    revalidateTag("store-settings");
    return NextResponse.json({ ok: true, settings: data });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 500 }
    );
  }
}
