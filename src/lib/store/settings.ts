import { unstable_cache } from "next/cache";
import {
  DEFAULT_STORE_SETTINGS,
  DEMO_STORE_SETTINGS,
  type StoreSettings,
} from "@/lib/store/defaults";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/demo/config";

function coalesce(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value;
}

function parseMarkupPercent(raw: unknown, fallback: number): number {
  if (raw == null) return fallback;
  const n =
    typeof raw === "number"
      ? raw
      : Number(String(raw).replace(/[^\d.-]/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n * 1000) / 1000));
}

function fromRow(row: Record<string, unknown> | null | undefined): StoreSettings {
  const base = DEFAULT_STORE_SETTINGS;
  if (!row) return { ...base };
  return {
    id: 1,
    contact_phone: coalesce(row.contact_phone, base.contact_phone),
    order_tracking_phone: coalesce(
      row.order_tracking_phone,
      base.order_tracking_phone
    ),
    payment_sheba: coalesce(row.payment_sheba, base.payment_sheba),
    payment_card_number: coalesce(
      row.payment_card_number,
      base.payment_card_number
    ),
    payment_card_holder: coalesce(
      row.payment_card_holder,
      base.payment_card_holder
    ),
    bale_admin_phone: coalesce(row.bale_admin_phone, base.bale_admin_phone),
    bale_products_channel_url: coalesce(
      row.bale_products_channel_url,
      base.bale_products_channel_url
    ),
    bale_loan_bot_url: coalesce(
      row.bale_loan_bot_url,
      base.bale_loan_bot_url
    ),
    enamad_code: coalesce(row.enamad_code, base.enamad_code),
    enamad_url: coalesce(row.enamad_url, base.enamad_url),
    ecommerce_license_number: coalesce(
      row.ecommerce_license_number,
      base.ecommerce_license_number
    ),
    ecommerce_license_url: coalesce(
      row.ecommerce_license_url,
      base.ecommerce_license_url
    ),
    store_address: coalesce(row.store_address, base.store_address),
    shipping_cost:
      row.shipping_cost == null
        ? base.shipping_cost
        : typeof row.shipping_cost === "number"
          ? row.shipping_cost
          : typeof row.shipping_cost === "bigint"
            ? Number(row.shipping_cost)
            : Number(String(row.shipping_cost).replace(/[^\d.-]/g, "")) ||
              base.shipping_cost,
    payment_window_minutes: (() => {
      const raw = row.payment_window_minutes;
      if (raw == null) return base.payment_window_minutes;
      const n =
        typeof raw === "number"
          ? raw
          : Number(String(raw).replace(/[^\d]/g, ""));
      if (!Number.isFinite(n)) return base.payment_window_minutes;
      return Math.min(180, Math.max(1, Math.round(n)));
    })(),
    admin_confirm_window_minutes: (() => {
      const raw = row.admin_confirm_window_minutes;
      if (raw == null) return base.admin_confirm_window_minutes;
      const n =
        typeof raw === "number"
          ? raw
          : Number(String(raw).replace(/[^\d]/g, ""));
      if (!Number.isFinite(n)) return base.admin_confirm_window_minutes;
      return Math.min(180, Math.max(1, Math.round(n)));
    })(),
    markup_percent_mobile: parseMarkupPercent(
      row.markup_percent_mobile,
      base.markup_percent_mobile
    ),
    markup_percent_iphone_noreg: parseMarkupPercent(
      row.markup_percent_iphone_noreg,
      base.markup_percent_iphone_noreg
    ),
    markup_percent_tablet: parseMarkupPercent(
      row.markup_percent_tablet,
      base.markup_percent_tablet
    ),
    markup_percent_ipad: parseMarkupPercent(
      row.markup_percent_ipad,
      base.markup_percent_ipad
    ),
    markup_percent_xiaomi_pad: parseMarkupPercent(
      row.markup_percent_xiaomi_pad,
      base.markup_percent_xiaomi_pad
    ),
    markup_percent_console: parseMarkupPercent(
      row.markup_percent_console,
      base.markup_percent_console
    ),
    markup_percent_laptop: parseMarkupPercent(
      row.markup_percent_laptop,
      base.markup_percent_laptop
    ),
    markup_percent_accessory: parseMarkupPercent(
      row.markup_percent_accessory,
      base.markup_percent_accessory
    ),
    markup_percent_audio: parseMarkupPercent(
      row.markup_percent_audio,
      base.markup_percent_audio
    ),
    footer_tagline: coalesce(row.footer_tagline, base.footer_tagline),
    about_content: coalesce(row.about_content, base.about_content),
    terms_content: coalesce(row.terms_content, base.terms_content),
    updated_at:
      typeof row.updated_at === "string" ? row.updated_at : base.updated_at,
  };
}

/** پر کردن جاهای خالی از env (سازگاری با فاز قبل) */
export function applyEnvFallbacks(settings: StoreSettings): StoreSettings {
  return {
    ...settings,
    payment_sheba:
      settings.payment_sheba || (process.env.PAYMENT_SHEBA ?? "").trim(),
    payment_card_number:
      settings.payment_card_number ||
      (process.env.PAYMENT_CARD_NUMBER ?? "").trim(),
    payment_card_holder:
      settings.payment_card_holder ||
      (process.env.PAYMENT_CARD_HOLDER ?? "").trim(),
    bale_admin_phone:
      settings.bale_admin_phone ||
      (process.env.BALE_ADMIN_PHONE ?? "").trim(),
    bale_loan_bot_url:
      settings.bale_loan_bot_url ||
      (process.env.NEXT_PUBLIC_BALE_LOAN_BOT_URL ?? "").trim(),
  };
}

/** نسخه عمومی — شبا/کارت/شماره ادمین بله هرگز به فرانت فروشگاه نرود */
export function toPublicStoreSettings(settings: StoreSettings): StoreSettings {
  return {
    ...settings,
    payment_sheba: "",
    payment_card_number: "",
    payment_card_holder: "",
    bale_admin_phone: "",
  };
}

/** Avoid cookies() on every shop navigation — settings change rarely. */
const getStoreSettingsCached = unstable_cache(
  async (): Promise<StoreSettings> => {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        console.error("store_settings read", error);
        return applyEnvFallbacks({ ...DEFAULT_STORE_SETTINGS });
      }

      return applyEnvFallbacks(fromRow(data as Record<string, unknown> | null));
    } catch (err) {
      console.error("store_settings", err);
      return applyEnvFallbacks({ ...DEFAULT_STORE_SETTINGS });
    }
  },
  ["store-settings-v2"],
  { revalidate: 60, tags: ["store-settings"] }
);

export async function getStoreSettings(): Promise<StoreSettings> {
  if (isDemoMode()) {
    return applyEnvFallbacks({ ...DEMO_STORE_SETTINGS });
  }
  return getStoreSettingsCached();
}

/** تنظیمات قابل نمایش در فروشگاه (بدون اطلاعات بانکی) */
export async function getPublicStoreSettings(): Promise<StoreSettings> {
  return toPublicStoreSettings(await getStoreSettings());
}

/** برای ارسال فاکتور / اعلان — با service role تا همیشه در دسترس باشد */
export async function getStoreSettingsAdmin(): Promise<StoreSettings> {
  if (isDemoMode()) {
    return applyEnvFallbacks({ ...DEMO_STORE_SETTINGS });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("store_settings admin read", error);
      return applyEnvFallbacks({ ...DEFAULT_STORE_SETTINGS });
    }

    return applyEnvFallbacks(fromRow(data as Record<string, unknown> | null));
  } catch (err) {
    console.error("store_settings admin", err);
    return applyEnvFallbacks({ ...DEFAULT_STORE_SETTINGS });
  }
}

export type StoreSettingsUpdate = Partial<
  Omit<StoreSettings, "id" | "updated_at">
>;
