"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/config";
import { useDemoStore } from "@/lib/demo/store";
import type { Order, OrderItem, OrderStatus } from "@/types/database";
import { ALL_ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/utils/order-status";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatPriceToman } from "@/lib/utils/price";
import { formatJalaliDate } from "@/lib/utils/date";
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
  | "cancel";

export default function AdminOrdersPage() {
  const demo = isDemoMode();
  const demoOrders = useDemoStore((s) => s.orders);
  const updateOrder = useDemoStore((s) => s.updateOrder);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "all">("pending_confirmation");
  const [selected, setSelected] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (demo) {
      const list =
        filter === "all"
          ? demoOrders
          : demoOrders.filter((o) => o.status === filter);
      setOrders(list);
      return;
    }
    const supabase = createClient();
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") query = query.eq("status", filter);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    setOrders((data as Order[]) ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, demo, demoOrders]);

  async function openOrder(order: Order) {
    setSelected(order);
    setNotes(order.notes ?? "");
    setConfirmedAmount(
      String(order.confirmed_amount ?? order.total_amount ?? "")
    );
    setPaymentRef(order.payment_ref ?? "");
    setTrackingNumber(order.tracking_number ?? "");
    setItems([]);

    if (demo) return;

    const supabase = createClient();
    const { data } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);
    setItems((data as OrderItem[]) ?? []);
  }

  async function runAction(action: ActionKey) {
    if (!selected) return;
    setSaving(true);

    const amount = Number(confirmedAmount.replace(/[^\d]/g, "")) || null;

    if (demo) {
      const now = new Date().toISOString();
      const patch: Partial<Order> = { notes: notes.trim() || null };
      if (action === "approve_invoice") {
        patch.status = "awaiting_payment";
        patch.confirmed_amount = amount ?? selected.total_amount;
        patch.invoice_sent_at = now;
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
          confirmedAmount: amount,
          paymentRef: paymentRef.trim() || null,
          trackingNumber: trackingNumber.trim() || null,
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        warning?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        toast.error(payload.error ?? "عملیات ناموفق بود");
      } else {
        toast.success(payload.warning ?? "انجام شد و پیام بله ارسال شد");
        setSelected(null);
        load();
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  }

  const status = selected?.status;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مدیریت سفارش‌ها</h1>
        <p className="mt-1 text-sm text-slate-500">
          تأیید موجودی، ارسال فاکتور و شبا در بله، ثبت رسید و رهگیری ارسال
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
                <TableCell>{formatJalaliDate(o.created_at, true)}</TableCell>
                <TableCell>
                  {formatPriceToman(o.confirmed_amount ?? o.total_amount)}
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
              <p className="mt-1 text-sm text-slate-600">
                {selected.shipping_address}
              </p>
              <p className="text-sm" dir="ltr">
                {selected.contact_phone}
              </p>
            </div>
            <OrderStatusBadge status={selected.status} />
          </div>

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
              <label className="mb-1 block text-sm">مبلغ نهایی فاکتور (تومان)</label>
              <Input
                dir="ltr"
                inputMode="numeric"
                value={confirmedAmount}
                onChange={(e) => setConfirmedAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">شماره پیگیری پرداخت</label>
              <Input
                dir="ltr"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="پس از دریافت رسید"
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
            <div>
              <label className="mb-1 block text-sm">یادداشت ادمین</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
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
            {(status === "awaiting_payment" ||
              status === "pending_confirmation") && (
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
