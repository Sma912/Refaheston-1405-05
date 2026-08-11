"use client";

import { useCallback, useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demo/config";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type WebhookStatus = {
  tokenSet?: boolean;
  secretSet?: boolean;
  webhookUrl?: string | null;
  bot?: { id?: number; username?: string; first_name?: string; error?: string };
  webhookInfo?: { url?: string; pending_update_count?: number; last_error_message?: string } | null;
  error?: string;
  demo?: boolean;
};

export function BaleChannelWebhookPanel() {
  const demo = isDemoMode();
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (demo) {
      setStatus({ demo: true });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bale/webhook");
      const data = (await res.json()) as WebhookStatus;
      if (!res.ok) {
        setStatus({ error: data.error ?? "خطا در دریافت وضعیت" });
        return;
      }
      setStatus(data);
    } catch {
      setStatus({ error: "ارتباط با سرور برقرار نشد" });
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/bale/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set" }),
      });
      const data = (await res.json()) as { error?: string; webhookUrl?: string };
      if (!res.ok) {
        toast.error(data.error ?? "ثبت وب‌هوک ناموفق بود");
        return;
      }
      toast.success("وب‌هوک بله به سایت وصل شد");
      await refresh();
    } catch {
      toast.error("خطا در اتصال وب‌هوک");
    } finally {
      setSaving(false);
    }
  }

  if (demo) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        همگام‌سازی خودکار کانال بله در حالت دمو غیرفعال است.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
      <div>
        <h2 className="font-semibold text-slate-900">همگام‌سازی خودکار از کانال بله</h2>
        <p className="mt-1 text-sm text-slate-600">
          وقتی بازو لیست محصولات را در کانال می‌گذارد (با 📱 و 💰)، حدود ۲۵ ثانیه بعد همان
          متن روی سایت همگام می‌شود. بازو باید ادمین کانال باشد تا آپدیت کانال را بگیرد؛ اگر
          خودش پست می‌کند و آپدیت نمی‌آید، از endpoint مستقیم{" "}
          <code className="text-xs" dir="ltr">
            /api/bale/push-sync
          </code>{" "}
          استفاده کنید.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">در حال بررسی...</p>
      ) : status?.error ? (
        <p className="text-sm text-rose-600">{status.error}</p>
      ) : (
        <ul className="space-y-1 text-sm text-slate-700">
          <li>
            توکن بازو:{" "}
            {status?.tokenSet ? (
              <span className="text-emerald-700">تنظیم شده</span>
            ) : (
              <span className="text-rose-600">نیاز به BALE_BOT_TOKEN در Vercel</span>
            )}
          </li>
          <li>
            رمز وب‌هوک:{" "}
            {status?.secretSet ? (
              <span className="text-emerald-700">تنظیم شده</span>
            ) : (
              <span className="text-rose-600">نیاز به BALE_WEBHOOK_SECRET</span>
            )}
          </li>
          <li>
            بازو:{" "}
            {status?.bot?.username
              ? `@${status.bot.username}`
              : status?.bot?.error ?? "—"}
          </li>
          <li className="break-all" dir="ltr">
            Webhook: {status?.webhookInfo?.url || status?.webhookUrl || "—"}
          </li>
          {status?.webhookInfo?.last_error_message ? (
            <li className="text-rose-600">
              آخرین خطای بله: {status.webhookInfo.last_error_message}
            </li>
          ) : null}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={connect} disabled={saving || loading}>
          {saving ? "در حال اتصال..." : "اتصال / به‌روزرسانی وب‌هوک"}
        </Button>
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
          بررسی وضعیت
        </Button>
      </div>
    </div>
  );
}
