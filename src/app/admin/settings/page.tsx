"use client";

import { useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demo/config";
import { useDemoStore } from "@/lib/demo/store";
import {
  DEFAULT_STORE_SETTINGS,
  type StoreSettings,
} from "@/lib/store/defaults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function AdminSettingsPage() {
  const demo = isDemoMode();
  const demoSettings = useDemoStore((s) => s.settings);
  const setDemoSettings = useDemoStore((s) => s.setSettings);
  const [form, setForm] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  const [toseehSyncing, setToseehSyncing] = useState(false);
  const [toseehResult, setToseehResult] = useState<string | null>(null);

  useEffect(() => {
    if (demo) {
      setForm(demoSettings);
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const payload = (await res.json()) as {
          settings?: StoreSettings;
          error?: string;
        };
        if (!res.ok) {
          toast.error(payload.error ?? "بارگذاری تنظیمات ناموفق بود");
          return;
        }
        if (payload.settings) {
          setForm({ ...DEFAULT_STORE_SETTINGS, ...payload.settings, id: 1 });
        }
      } catch {
        toast.error("خطا در ارتباط با سرور");
      } finally {
        setLoading(false);
      }
    })();
  }, [demo, demoSettings]);

  function update<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    if (demo) {
      setDemoSettings(form);
      toast.success("تنظیمات دمو ذخیره شد");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await res.json()) as { error?: string; warning?: string; hint?: string };
      if (!res.ok) toast.error(payload.error ?? "ذخیره ناموفق بود");
      else toast.success(payload.warning ?? "تنظیمات ذخیره شد");
      if (payload.hint) toast.message(payload.hint);
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  }

  async function syncToseehNow() {
    if (demo) {
      toast.message("در حالت دمو همگام‌سازی تلگرام فعال نیست");
      return;
    }
    setToseehSyncing(true);
    setToseehResult(null);
    try {
      const res = await fetch("/api/admin/toseeh-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postToBale: true, channel: "toseehhamrah" }),
      });
      const payload = (await res.json()) as {
        error?: string;
        result?: {
          ok?: boolean;
          scanned?: number;
          processed?: Array<{ kind: string; products: number; siteUpserted: number; baleChunks: number }>;
          skipped?: Array<{ reason: string }>;
          errors?: string[];
        };
      };
      if (!res.ok) {
        toast.error(payload.error ?? "همگام‌سازی ناموفق بود");
        setToseehResult(payload.error ?? "خطا");
        return;
      }
      const r = payload.result;
      const lines = [
        `پیام‌های خوانده‌شده: ${r?.scanned ?? 0}`,
        `لیست‌های پردازش‌شده: ${r?.processed?.length ?? 0}`,
        ...(r?.processed ?? []).map(
          (p) =>
            `• ${p.kind}: ${p.products} کالا → سایت ${p.siteUpserted} | بله ${p.baleChunks} پیام`
        ),
        r?.errors?.length ? `خطاها: ${r.errors.join(" | ")}` : "",
      ].filter(Boolean);
      setToseehResult(lines.join("\n"));
      if (r?.ok) toast.success("همگام‌سازی توسعه همراه انجام شد");
      else toast.error("همگام‌سازی ناقص بود — جزئیات را ببینید");
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setToseehSyncing(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">در حال بارگذاری...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تنظیمات فروشگاه</h1>
        <p className="mt-1 text-sm text-slate-500">
          اطلاعات تماس، پرداخت، مجوزها و محتوای صفحات درباره ما / شرایط
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">همگام‌سازی توسعه همراه (تلگرام)</h2>
        <p className="text-sm text-slate-500">
          وقتی لیست‌ها در کانال آمد، با این دکمه از{" "}
          <span dir="ltr" className="font-mono text-xs">
            t.me/toseehhamrah
          </span>{" "}
          خوانده می‌شوند، گوشی‌های رجیستری/شرکتی رد می‌شوند، بقیه در دسته‌های
          توسعه همراه (نه موبایل همراه‌تل) با درصد تنظیمات به سایت می‌روند و با
          حفظ فرمت کانال به بله ارسال می‌شوند.
        </p>
        <Button
          type="button"
          onClick={() => void syncToseehNow()}
          disabled={toseehSyncing}
          variant="default"
        >
          {toseehSyncing
            ? "در حال خواندن و ارسال..."
            : "خواندن الان از تلگرام → سایت + بله"}
        </Button>
        {toseehResult ? (
          <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700 ring-1 ring-slate-200">
            {toseehResult}
          </pre>
        ) : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">تماس و پیگیری</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="شماره تماس فروشگاه">
            <Input
              dir="ltr"
              value={form.contact_phone}
              onChange={(e) => update("contact_phone", e.target.value)}
              placeholder="0912…"
            />
          </Field>
          <Field label="شماره پیگیری سفارش" hint="برای پشتیبانی و پیگیری وضعیت سفارش">
            <Input
              dir="ltr"
              value={form.order_tracking_phone}
              onChange={(e) => update("order_tracking_phone", e.target.value)}
              placeholder="0912…"
            />
          </Field>
          <Field
            label="شماره ادمین بله"
            hint="اعلان سفارش‌های جدید به این شماره در بله ارسال می‌شود"
          >
            <Input
              dir="ltr"
              value={form.bale_admin_phone}
              onChange={(e) => update("bale_admin_phone", e.target.value)}
              placeholder="0912…"
            />
          </Field>
          <Field label="آدرس فروشگاه / انبار (اختیاری)">
            <Input
              value={form.store_address}
              onChange={(e) => update("store_address", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">پرداخت پیش‌فرض (فقط پیام بله)</h2>
        <p className="text-sm text-slate-500">
          این مقادیر روی سایت نمایش داده نمی‌شوند. هنگام تأیید فاکتور در پنل سفارش،
          می‌توانید برای همان سفارش حساب/کارت دیگری وارد کنید.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="شماره شبا">
            <Input
              dir="ltr"
              value={form.payment_sheba}
              onChange={(e) => update("payment_sheba", e.target.value)}
              placeholder="IR…"
            />
          </Field>
          <Field label="شماره کارت">
            <Input
              dir="ltr"
              value={form.payment_card_number}
              onChange={(e) => update("payment_card_number", e.target.value)}
            />
          </Field>
          <Field label="نام صاحب حساب / کارت">
            <Input
              value={form.payment_card_holder}
              onChange={(e) => update("payment_card_holder", e.target.value)}
            />
          </Field>
          <Field
            label="هزینه ارسال پیش‌فرض (تومان)"
            hint="روی فاکتور اعمال می‌شود؛ در هر سفارش قابل تغییر است"
          >
            <Input
              dir="ltr"
              inputMode="numeric"
              value={String(form.shipping_cost ?? 0)}
              onChange={(e) =>
                update(
                  "shipping_cost",
                  Number(e.target.value.replace(/[^\d]/g, "")) || 0
                )
              }
            />
          </Field>
          <Field
            label="مهلت واریز مشتری (دقیقه)"
            hint="بعد از صدور فاکتور، مشتری این مدت برای واریز و ارسال رسید فرصت دارد"
          >
            <Input
              dir="ltr"
              inputMode="numeric"
              value={String(form.payment_window_minutes ?? 10)}
              onChange={(e) =>
                update(
                  "payment_window_minutes",
                  Number(e.target.value.replace(/[^\d]/g, "")) || 1
                )
              }
            />
          </Field>
          <Field
            label="مهلت تأیید پرداخت ادمین (دقیقه)"
            hint="از زمان صدور فاکتور؛ اگر تا این زمان تأیید نشود سفارش لغو می‌شود"
          >
            <Input
              dir="ltr"
              inputMode="numeric"
              value={String(form.admin_confirm_window_minutes ?? 15)}
              onChange={(e) =>
                update(
                  "admin_confirm_window_minutes",
                  Number(e.target.value.replace(/[^\d]/g, "")) || 1
                )
              }
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">کانال بله و مجوزها</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="لینک کانال بله (لیست محصولات)"
            hint="مثال: https://ble.ir/YourChannel"
          >
            <Input
              dir="ltr"
              value={form.bale_products_channel_url}
              onChange={(e) =>
                update("bale_products_channel_url", e.target.value)
              }
            />
          </Field>
          <Field
            label="لینک ربات بله وام بانک رسالت"
            hint="بنر تبلیغاتی صفحه اصلی به این آدرس می‌رود"
          >
            <Input
              dir="ltr"
              value={form.bale_loan_bot_url}
              onChange={(e) => update("bale_loan_bot_url", e.target.value)}
              placeholder="https://ble.ir/..."
            />
          </Field>
          <Field label="شماره مجوز فروشگاه اینترنتی">
            <Input
              dir="ltr"
              value={form.ecommerce_license_number}
              onChange={(e) =>
                update("ecommerce_license_number", e.target.value)
              }
            />
          </Field>
          <Field label="لینک مجوز / اینماد کسب‌وکار">
            <Input
              dir="ltr"
              value={form.ecommerce_license_url}
              onChange={(e) => update("ecommerce_license_url", e.target.value)}
            />
          </Field>
          <Field label="کد اینماد">
            <Input
              dir="ltr"
              value={form.enamad_code}
              onChange={(e) => update("enamad_code", e.target.value)}
            />
          </Field>
          <Field label="لینک اینماد" hint="لینک trustseal اینماد">
            <Input
              dir="ltr"
              value={form.enamad_url}
              onChange={(e) => update("enamad_url", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">درصد سود هر گروه</h2>
        <p className="text-sm text-slate-500">
          قیمت فروشگاه = قیمت ورودی لیست × (۱ + درصد ÷ ۱۰۰). مثلاً ۲.۷٪ یعنی ضرب در
          ۱.۰۲۷. موبایل همراه‌تل جدا از کانال توسعه همراه است؛ اندروید بدون رجیستر
          دستهٔ خودش را دارد و با همراه‌تل قاطی نمی‌شود.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ["markup_percent_mobile", "موبایل (همراه‌تل)"],
              ["markup_percent_iphone_noreg", "آیفون بدون رجیستری"],
              ["markup_percent_ipad", "آیپد"],
              ["markup_percent_xiaomi_pad", "تبلت شیائومی"],
              ["markup_percent_tablet", "تبلت عمومی"],
              ["markup_percent_console", "کنسول بازی"],
              ["markup_percent_laptop", "لپ‌تاپ"],
              ["markup_percent_accessory", "لوازم جانبی"],
              ["markup_percent_audio", "صوتی و اسپیکر"],
            ] as const
          ).map(([key, label]) => (
            <Field
              key={key}
              label={`${label} (%)`}
              hint="عدد اعشاری مجاز است؛ مثلاً 2.7"
            >
              <Input
                dir="ltr"
                inputMode="decimal"
                value={String(form[key] ?? 2.7)}
                onChange={(e) =>
                  update(
                    key,
                    Number(
                      e.target.value.replace(/[^\d.-]/g, "").replace(",", ".")
                    ) || 0
                  )
                }
              />
            </Field>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">محتوای صفحات</h2>
        <Field label="متن کوتاه فوتر">
          <Textarea
            rows={3}
            value={form.footer_tagline}
            onChange={(e) => update("footer_tagline", e.target.value)}
          />
        </Field>
        <Field label="درباره ما">
          <Textarea
            rows={10}
            value={form.about_content}
            onChange={(e) => update("about_content", e.target.value)}
          />
        </Field>
        <Field label="شرایط اختصاصی">
          <Textarea
            rows={12}
            value={form.terms_content}
            onChange={(e) => update("terms_content", e.target.value)}
          />
        </Field>
      </section>

      <Button onClick={save} disabled={saving} size="lg">
        {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
      </Button>
    </div>
  );
}
