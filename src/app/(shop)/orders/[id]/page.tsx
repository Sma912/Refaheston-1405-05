import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_ORDERS, DEMO_ORDER_ITEMS } from "@/lib/demo/data";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatPriceToman } from "@/lib/utils/price";
import { formatJalaliDate } from "@/lib/utils/date";
import { ORDER_SUCCESS_MESSAGE } from "@/lib/utils/order-status";
import type { Order, OrderItem } from "@/types/database";

type Props = { params: Promise<{ id: string }> };

export const metadata = { title: "جزئیات سفارش" };

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;

  let o: Order | null = null;
  let orderItems: OrderItem[] = [];

  if (isDemoMode()) {
    o = DEMO_ORDERS.find((x) => x.id === id) ?? null;
    orderItems = DEMO_ORDER_ITEMS.filter((i) => i.order_id === id);
  } else {
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

    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id);
    orderItems = (items as OrderItem[]) ?? [];
  }

  if (!o) notFound();

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

      {o.status === "pending_confirmation" && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
          {ORDER_SUCCESS_MESSAGE}
        </p>
      )}

      {o.status === "awaiting_payment" && (
        <p className="rounded-2xl bg-orange-50 px-4 py-3 text-sm leading-7 text-orange-900">
          فاکتور و اطلاعات پرداخت از طریق بله برایتان ارسال شده است. پس از
          واریز، رسید را در بله بفرستید.
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
              <dt className="text-slate-500">مبلغ</dt>
              <dd className="font-bold text-[var(--brand-red)]">
                {formatPriceToman(o.confirmed_amount ?? o.total_amount)}
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
          {o.notes && (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-slate-600">
              یادداشت ادمین: {o.notes}
            </p>
          )}
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
    </div>
  );
}
