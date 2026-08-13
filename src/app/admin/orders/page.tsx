"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/config";
import { useDemoStore } from "@/lib/demo/store";
import { DEMO_USERS } from "@/lib/demo/data";
import type { Order, OrderItem, OrderNote, OrderStatus } from "@/types/database";
import { ALL_ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/utils/order-status";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderNotesHistory } from "@/components/orders/order-notes-history";
import { DeadlineCountdown } from "@/components/orders/deadline-countdown";
import { formatPriceToman } from "@/lib/utils/price";
import { formatJalaliDate } from "@/lib/utils/date";
import { orderPayable } from "@/lib/orders/totals";
import {
  NOTE_TEMPLATES,
  getNoteTemplate,
  type NoteTemplateKey,
} from "@/lib/orders/note-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type ActionKey =
  | "approve_invoice"
  | "confirm_payment"
  | "mark_preparing"
  | "mark_shipped"
  | "mark_delivered"
  | "cancel"
  | "send_note";

type AdminOrderRow = Order & {
  customer_name: string | null;
};

function initialFilterFromQuery(
  status: string | null,
  hasOrderFocus: boolean
): OrderStatus | "all" {
  if (status === "all") return "all";
  if (status && (ALL_ORDER_STATUSES as string[]).includes(status)) {
    return status as OrderStatus;
  }
  // اگر از داشبورد روی یک سفارش خاص آمدیم، همه را نشان بده تا پیدا شود
  if (hasOrderFocus) return "all";
  return "pending_confirmation";
}

function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const demo = isDemoMode();
  const demoOrders = useDemoStore((s) => s.orders);
  const demoSettings = useDemoStore((s) => s.settings);
  const [settingsShipping, setSettingsShipping] = useState(0);
  const updateOrder = useDemoStore((s) => s.updateOrder);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "all">(() =>
    initialFilterFromQuery(searchParams.get("status"), Boolean(searchParams.get("order")))
  );
  const [selected, setSelected] = useState<AdminOrderRow | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [history, setHistory] = useState<OrderNote[]>([]);
  const [templateKey, setTemplateKey] = useState<NoteTemplateKey | "">("");
  const [notes, setNotes] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState("");
  const [shippingAmount, setShippingAmount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [paymentSheba, setPaymentSheba] = useState("");
  const [paymentCardNumber, setPaymentCardNumber] = useState("");
  const [paymentCardHolder, setPaymentCardHolder] = useState("");
  const [saving, setSaving] = useState(false);
  const focusOrderId = searchParams.get("order");

  const defaultShipping = demo
    ? demoSettings.shipping_cost ?? 0
    : settingsShipping;

  async function load() {
    if (demo) {
      const list =
        filter === "all"
          ? demoOrders
          : demoOrders.filter((o) => o.status === filter);
      setOrders(
        list.map((o) => ({
          ...o,
          customer_name:
            DEMO_USERS.find((u) => u.id === o.user_id)?.full_name ?? null,
        }))
      );
      return;
    }

    try {
      const settingsRes = await fetch("/api/store/settings");
      const settingsPayload = (await settingsRes.json()) as {
        settings?: { shipping_cost?: number };
      };
      if (settingsPayload.settings?.shipping_cost != null) {
        setSettingsShipping(Number(settingsPayload.settings.shipping_cost) || 0);
      }
    } catch {
      // ignore
    }

    const supabase = createClient();
    // پاک‌سازی سفارش‌های مهلت‌گذشته هنگام باز کردن پنل
    void fetch("/api/admin/orders/expire", { method: "POST" }).catch(() => null);

    let query = supabase
      .from("orders")
      .select("*, profiles:user_id(full_name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") query = query.eq("status", filter);
    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
      setOrders([]);
      return;
    }
    setOrders(
      ((data as Array<Order & { profiles?: { full_name: string | null } | null }>) ?? []).map(
        (row) => ({
          ...row,
          customer_name: row.profiles?.full_name ?? null,
        })
      )
    );
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, demo, demoOrders]);

  useEffect(() => {
    if (!focusOrderId || orders.length === 0) return;
    const match = orders.find((o) => o.id === focusOrderId);
    if (match && selected?.id !== match.id) {
      void openOrder(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOrderId, orders]);

  async function openOrder(order: AdminOrderRow) {
    setSelected(order);
    setTemplateKey("");
    setNotes(order.notes ?? "");
    setConfirmedAmount(
      String(order.confirmed_amount ?? order.total_amount ?? "")
    );
    setShippingAmount(
      String(
        order.shipping_amount != null
          ? order.shipping_amount
          : defaultShipping
      )
    );
    setPaymentRef(order.payment_ref ?? "");
    setTrackingNumber(order.tracking_number ?? "");
    setPaymentSheba("");
    setPaymentCardNumber("");
    setPaymentCardHolder("");
    setItems([]);
    setHistory([]);

    if (demo) {
      setPaymentSheba(demoSettings.payment_sheba ?? "");
      setPaymentCardNumber(demoSettings.payment_card_number ?? "");
      setPaymentCardHolder(demoSettings.payment_card_holder ?? "");
      return;
    }

    try {
      const settingsRes = await fetch("/api/admin/settings");
      const settingsPayload = (await settingsRes.json()) as {
        settings?: {
          payment_sheba?: string;
          payment_card_number?: string;
          payment_card_holder?: string;
          shipping_cost?: number;
        };
      };
      const s = settingsPayload.settings;
      if (s) {
        setPaymentSheba(s.payment_sheba ?? "");
        setPaymentCardNumber(s.payment_card_number ?? "");
        setPaymentCardHolder(s.payment_card_holder ?? "");
        if (order.shipping_amount == null && s.shipping_cost != null) {
          setShippingAmount(String(s.shipping_cost));
        }
      }
    } catch {
      // keep empty; admin can type manually
    }

    const supabase = createClient();
    const [{ data: itemRows }, { data: noteRows }] = await Promise.all([
      supabase.from("order_items").select("*").eq("order_id", order.id),
      supabase
        .from("order_notes")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false }),
    ]);
    setItems((itemRows as OrderItem[]) ?? []);
    setHistory((noteRows as OrderNote[]) ?? []);
  }

  function applyTemplate(key: NoteTemplateKey | "") {
    setTemplateKey(key);
    if (!key) return;
    const t = getNoteTemplate(key);
    if (t) setNotes(t.body);
  }

  const previewPayable = useMemo(() => {
    if (!selected) return 0;
    const sub =
      Number(confirmedAmount.replace(/[^\d]/g, "")) ||
      selected.confirmed_amount ||
      selected.total_amount;
    const ship =
      Number(shippingAmount.replace(/[^\d]/g, "")) ||
      selected.shipping_amount ||
      0;
    return sub + ship;
  }, [selected, confirmedAmount, shippingAmount]);

  async function runAction(action: ActionKey) {
    if (!selected) return;
    setSaving(true);

    const amount = Number(confirmedAmount.replace(/[^\d]/g, "")) || null;
    const ship = Number(shippingAmount.replace(/[^\d]/g, ""));
    const shipValue = Number.isFinite(ship) ? ship : null;

    if (demo) {
      const now = new Date().toISOString();
      if (action === "send_note") {
        toast.success("پیام دمو ثبت شد (بدون بله)");
        setSaving(false);
        return;
      }
      const patch: Partial<Order> = { notes: notes.trim() || null };
      if (action === "approve_invoice") {
        if (!paymentSheba.trim() && !paymentCardNumber.trim()) {
          toast.error("حداقل شبا یا شماره کارت را برای پیام بله وارد کنید");
          setSaving(false);
          return;
        }
        patch.status = "awaiting_payment";
        patch.confirmed_amount = amount ?? selected.total_amount;
        patch.shipping_amount =
          shipValue != null ? shipValue : defaultShipping;
        patch.invoice_sent_at = now;
        patch.payment_deadline_at = new Date(
          Date.now() + 10 * 60 * 1000
        ).toISOString();
        patch.admin_confirm_deadline_at = new Date(
          Date.now() + 15 * 60 * 1000
        ).toISOString();
      } else if (action === "confirm_payment") {
        if (!paymentRef.trim()) {
          toast.error("شماره پیگیری پرداخت الزامی است");
          setSaving(false);
          return;
        }
        patch.status = "paid";
        patch.payment_ref = paymentRef.trim();
        patch.payment_confirmed_at = now;
      } else if (action === "mark_preparing") {
        patch.status = "preparing";
      } else if (action === "mark_shipped") {
        if (!trackingNumber.trim()) {
          toast.error("کد رهگیری ارسال الزامی است");
          setSaving(false);
          return;
        }
        patch.status = "shipped";
        patch.tracking_number = trackingNumber.trim();
        patch.shipped_at = now;
      } else if (action === "mark_delivered") {
        patch.status = "delivered";
      } else if (action === "cancel") {
        patch.status = "cancelled";
      }
      updateOrder(selected.id, patch);
      toast.success("سفارش به‌روزرسانی شد (دمو — بدون بله)");
      setSelected(null);
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/orders/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selected.id,
          action,
          notes,
          templateKey: templateKey || null,
          confirmedAmount: amount,
          shippingAmount: shipValue,
          paymentRef: paymentRef.trim() || null,
          trackingNumber: trackingNumber.trim() || null,
          paymentSheba: paymentSheba.trim() || null,
          paymentCardNumber: paymentCardNumber.trim() || null,
          paymentCardHolder: paymentCardHolder.trim() || null,
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        warning?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        toast.error(payload.error ?? "عملیات ناموفق بود");
      } else if (payload.warning) {
        toast.error(payload.warning);
        if (action === "send_note") {
          openOrder({ ...selected, notes: notes.trim() || selected.notes });
          load();
        } else {
          setSelected(null);
          load();
        }
      } else {
        toast.success("انجام شد و پیام بله ارسال شد");
        if (action === "send_note") {
          openOrder({ ...selected, notes: notes.trim() || selected.notes });
          load();
        } else {
          setSelected(null);
          load();
        }
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  }

  const status = selected?.status;
  const selectedTemplate = getNoteTemplate(templateKey);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مدیریت سفارش‌ها</h1>
        <p className="mt-1 text-sm text-slate-500">
          مهلت مشتری برای واریز: ۱۰ دقیقه — مهلت تأیید ادمین: ۱۵ دقیقه
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          همه
        </Button>
        {ALL_ORDER_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {ORDER_STATUS_LABELS[s]}
          </Button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>شناسه</TableHead>
              <TableHead>مشتری</TableHead>
              <TableHead>تاریخ</TableHead>
              <TableHead>مبلغ</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell dir="ltr">#{o.id.slice(0, 8)}</TableCell>
                <TableCell>
                  <div className="text-sm font-medium">
                    {o.customer_name || "بدون نام"}
                  </div>
                  <div className="text-xs text-slate-500" dir="ltr">
                    {o.contact_phone}
                  </div>
                </TableCell>
                <TableCell>{formatJalaliDate(o.created_at, true)}</TableCell>
                <TableCell>
                  {formatPriceToman(
                    orderPayable(o, defaultShipping)
                  )}
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={o.status} />
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => openOrder(o)}>
                    مدیریت
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold" dir="ltr">
                سفارش #{selected.id.slice(0, 8)}
              </h2>
              <p className="mt-1 text-sm font-medium">
                مشتری: {selected.customer_name || "بدون نام"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {selected.shipping_address}
              </p>
              <p className="text-sm" dir="ltr">
                {selected.contact_phone}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <OrderStatusBadge status={selected.status} />
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/orders/${selected.id}/invoice`}>
                  مشاهده فاکتور / پرینت
                </Link>
              </Button>
            </div>
          </div>

          {status === "awaiting_payment" && (
            <div className="grid gap-2 md:grid-cols-2">
              <DeadlineCountdown
                label="مهلت واریز مشتری (۱۰ دقیقه)"
                deadlineAt={selected.payment_deadline_at}
              />
              <DeadlineCountdown
                label="مهلت تأیید ادمین (۱۵ دقیقه)"
                deadlineAt={selected.admin_confirm_deadline_at}
              />
            </div>
          )}

          {items.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span>
                    {item.product_title ?? "محصول"}
                    {item.color ? ` — ${item.color}` : ""} × {item.quantity}
                  </span>
                  <span>{formatPriceToman(item.unit_price * item.quantity)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm">جمع کالا (تومان)</label>
              <Input
                dir="ltr"
                inputMode="numeric"
                value={confirmedAmount}
                onChange={(e) => setConfirmedAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">هزینه ارسال (تومان)</label>
              <Input
                dir="ltr"
                inputMode="numeric"
                value={shippingAmount}
                onChange={(e) => setShippingAmount(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              مبلغ قابل پرداخت فاکتور:{" "}
              <span className="font-bold text-[var(--brand-red)]">
                {formatPriceToman(previewPayable)}
              </span>
            </div>

            {(status === "pending_confirmation" ||
              status === "awaiting_payment") && (
              <div className="md:col-span-2 space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
                <div>
                  <h3 className="font-semibold text-slate-800">
                    حساب واریز برای پیام بله
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    این اطلاعات روی سایت نمایش داده نمی‌شود. فقط در پیام بله همین
                    سفارش می‌رود. می‌توانید مقادیر پیش‌فرض را تغییر دهید.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm">شماره شبا</label>
                    <Input
                      dir="ltr"
                      value={paymentSheba}
                      onChange={(e) => setPaymentSheba(e.target.value)}
                      placeholder="IR…"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">شماره کارت</label>
                    <Input
                      dir="ltr"
                      value={paymentCardNumber}
                      onChange={(e) => setPaymentCardNumber(e.target.value)}
                      placeholder="۶۰۳۷…"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm">
                      نام صاحب حساب / کارت
                    </label>
                    <Input
                      value={paymentCardHolder}
                      onChange={(e) => setPaymentCardHolder(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm">شماره پیگیری پرداخت</label>
              <Input
                dir="ltr"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="پس از دریافت رسید — حداکثر ۱۵ دقیقه"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">کد رهگیری ارسال</label>
              <Input
                dir="ltr"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="پست / تیپاکس / پیک"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-dashed border-slate-200 p-4">
            <h3 className="font-semibold">پیام آماده / یادداشت برای مشتری</h3>
            <select
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
              value={templateKey}
              onChange={(e) =>
                applyTemplate(e.target.value as NoteTemplateKey | "")
              }
            >
              <option value="">انتخاب پیام آماده…</option>
              {NOTE_TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="متن پیام برای مشتری (یا از پیام آماده استفاده کنید)"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => runAction("send_note")}
                disabled={saving || !notes.trim()}
              >
                ارسال پیام به مشتری (بله)
              </Button>
              {selectedTemplate?.suggestCancel && (
                <Button
                  variant="destructive"
                  onClick={() => runAction("cancel")}
                  disabled={saving}
                >
                  ارسال پیام + لغو سفارش
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">تاریخچه یادداشت‌ها</h3>
            <OrderNotesHistory notes={history} />
          </div>

          <div className="flex flex-wrap gap-2">
            {(status === "pending_confirmation" ||
              status === "awaiting_payment") && (
              <Button
                onClick={() => runAction("approve_invoice")}
                disabled={saving}
              >
                تأیید و ارسال فاکتور در بله
              </Button>
            )}
            {status === "awaiting_payment" && (
              <Button
                variant="secondary"
                onClick={() => runAction("confirm_payment")}
                disabled={saving}
              >
                تأیید پرداخت (رسید)
              </Button>
            )}
            {(status === "paid" || status === "preparing") && (
              <Button
                variant="secondary"
                onClick={() => runAction("mark_preparing")}
                disabled={saving}
              >
                در حال آماده‌سازی
              </Button>
            )}
            {(status === "paid" ||
              status === "preparing" ||
              status === "shipped") && (
              <Button
                onClick={() => runAction("mark_shipped")}
                disabled={saving}
              >
                ثبت ارسال + پیام بله
              </Button>
            )}
            {status === "shipped" && (
              <Button
                variant="secondary"
                onClick={() => runAction("mark_delivered")}
                disabled={saving}
              >
                تحویل شد
              </Button>
            )}
            {status !== "delivered" && status !== "cancelled" && (
              <Button
                variant="destructive"
                onClick={() => runAction("cancel")}
                disabled={saving}
              >
                لغو سفارش
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelected(null)}>
              بستن
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPageWithSuspense() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-slate-500">
          در حال بارگذاری سفارش‌ها…
        </div>
      }
    >
      <AdminOrdersPage />
    </Suspense>
  );
}
