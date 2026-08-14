import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/config";
import {
  DEMO_ORDERS,
  DEMO_ORDER_ITEMS,
  DEMO_USERS,
} from "@/lib/demo/data";
import { DEMO_STORE_SETTINGS } from "@/lib/store/defaults";
import { getStoreSettings } from "@/lib/store/settings";
import { expireOverdueAwaitingOrders } from "@/lib/bale/order-flow";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { InvoiceActions } from "@/components/orders/invoice-actions";
import { OrderNotesHistory } from "@/components/orders/order-notes-history";
import { DeadlineCountdown } from "@/components/orders/deadline-countdown";
import { OrderLiveRefresh } from "@/components/orders/order-live-refresh";
import { formatPriceToman } from "@/lib/utils/price";
import { formatJalaliDate } from "@/lib/utils/date";
import { ORDER_SUCCESS_MESSAGE } from "@/lib/utils/order-status";
import { orderPayable, orderShipping, orderSubtotal } from "@/lib/orders/totals";
import type { Order, OrderItem, OrderNote } from "@/types/database";

type Props = { params: Promise<{ id: string }> };

export const metadata = { title: "جزئیات سفارش" };
export const dynamic = "force-dynamic";

function orderStamp(
  order: Order,
  notesCount: number
): string {
  return [
    order.status,
    order.updated_at,
    order.invoice_sent_at,
    order.payment_confirmed_at,
    order.payment_ref,
    order.tracking_number,
    order.notes,
    String(notesCount),
  ]
    .map((v) => (v == null ? "" : String(v)))
    .join("|");
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;

  let o: Order | null = null;
  let orderItems: OrderItem[] = [];
  let orderNotes: OrderNote[] = [];
  let customerName: string | null = null;
  let settings = DEMO_STORE_SETTINGS;

  if (isDemoMode()) {
    o = DEMO_ORDERS.find((x) => x.id === id) ?? null;
    orderItems = DEMO_ORDER_ITEMS.filter((i) => i.order_id === id);
    customerName =
      DEMO_USERS.find((u) => u.id === o?.user_id)?.full_name ?? null;
    settings = DEMO_STORE_SETTINGS;
  } else {
    try {
      await expireOverdueAwaitingOrders();
    } catch (err) {
      console.error("expire on order detail", err);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) notFound();

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    o = (order as Order) ?? null;

    const [{ data: items }, { data: notes }, { data: profile }, storeSettings] =
      await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", id),
        supabase
          .from("order_notes")
          .select("*")
          .eq("order_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user.id)
          .maybeSingle(),
        getStoreSettings(),
      ]);
    orderItems = (items as OrderItem[]) ?? [];
    orderNotes = (notes as OrderNote[]) ?? [];
    customerName = profile?.full_name ?? null;
    settings = storeSettings;
  }

  if (!o) notFound();

  const showInvoice =
    Boolean(o.invoice_sent_at) ||
    o.status === "awaiting_payment" ||
    o.status === "paid" ||
    o.status === "preparing" ||
    o.status === "shipped" ||
    o.status === "delivered";

  const payMins = settings.payment_window_minutes ?? 10;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">جزئیات سفارش</h1>
          <p className="mt-1 text-sm text-slate-500" dir="ltr">
            #{o.id}
          </p>
        </div>
        <OrderStatusBadge status={o.status} />
      </div>

      <OrderLiveRefresh orderId={o.id} stamp={orderStamp(o, orderNotes.length)} />

      {o.status === "pending_confirmation" && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
          {ORDER_SUCCESS_MESSAGE}
        </p>
      )}

      {o.status === "awaiting_payment" && (
        <div className="space-y-2">
          <p className="rounded-2xl bg-orange-50 px-4 py-3 text-sm leading-7 text-orange-900">
            فاکتور صادر شده است. لطفاً ظرف{" "}
            <strong>{payMins} دقیقه</strong> واریز کنید و رسید را در بله
            بفرستید. در غیر این صورت سفارش لغو می‌شود.
          </p>
          <DeadlineCountdown
            label="زمان باقی‌مانده برای واریز و ارسال رسید"
            deadlineAt={o.payment_deadline_at}
          />
        </div>
      )}

      {o.status === "cancelled" && (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-900">
          این سفارش لغو شده است.
          {o.notes ? ` دلیل: ${o.notes}` : ""}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
          <h2 className="mb-3 font-semibold">اطلاعات سفارش</h2>
          <dl className="space-y-2">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">تاریخ</dt>
              <dd>{formatJalaliDate(o.created_at, true)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">جمع کالا</dt>
              <dd>{formatPriceToman(orderSubtotal(o))}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">ارسال</dt>
              <dd>
                {formatPriceToman(orderShipping(o, settings.shipping_cost))}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">قابل پرداخت</dt>
              <dd className="font-bold text-[var(--brand-red)]">
                {formatPriceToman(orderPayable(o, settings.shipping_cost))}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">تماس</dt>
              <dd dir="ltr">{o.contact_phone}</dd>
            </div>
            {o.payment_ref && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">پیگیری پرداخت</dt>
                <dd dir="ltr">{o.payment_ref}</dd>
              </div>
            )}
            {o.tracking_number && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">رهگیری ارسال</dt>
                <dd dir="ltr">{o.tracking_number}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
          <h2 className="mb-3 font-semibold">آدرس ارسال</h2>
          <p className="leading-7 text-slate-700">{o.shipping_address}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">اقلام</h2>
        <ul className="divide-y divide-slate-100">
          {orderItems.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <span>
                {item.product_title ?? "محصول"}
                {item.color ? ` — ${item.color}` : ""} × {item.quantity}
              </span>
              <span className="font-medium">
                {formatPriceToman(item.unit_price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {orderNotes.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">پیام‌ها و یادداشت‌های سفارش</h2>
          <OrderNotesHistory notes={orderNotes} />
        </section>
      )}

      {showInvoice && o.status !== "cancelled" && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">فاکتور</h2>
          <InvoiceActions
            allowExport={false}
            model={{
              order: o,
              items: orderItems,
              customer: {
                fullName: customerName,
                phone: o.contact_phone,
              },
              settings,
            }}
          />
        </section>
      )}
    </div>
  );
}
