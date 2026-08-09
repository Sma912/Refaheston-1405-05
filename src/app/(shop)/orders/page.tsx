import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_ORDERS } from "@/lib/demo/data";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatPriceToman } from "@/lib/utils/price";
import { formatJalaliDate } from "@/lib/utils/date";
import type { Order } from "@/types/database";
import { Button } from "@/components/ui/button";

export const metadata = { title: "سفارش‌های من" };

export default async function OrdersPage() {
  let orders: Order[] = [];

  if (isDemoMode()) {
    orders = DEMO_ORDERS;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return (
        <div className="text-center">
          <p className="mb-4 text-slate-500">برای مشاهده سفارش‌ها وارد شوید.</p>
          <Button asChild>
            <Link href="/login?next=/orders">ورود</Link>
          </Button>
        </div>
      );
    }

    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    orders = (data as Order[]) ?? [];
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">سفارش‌های من</h1>
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-slate-500">
          هنوز سفارشی ثبت نکرده‌اید.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[var(--brand-blue)]/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <p className="font-medium" dir="ltr">
                  #{order.id.slice(0, 8)}
                </p>
                <p className="text-sm text-slate-500">
                  {formatJalaliDate(order.created_at, true)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <OrderStatusBadge status={order.status} />
                <span className="font-bold text-[var(--brand-red)]">
                  {formatPriceToman(order.confirmed_amount != null
                    ? (order.confirmed_amount + (order.shipping_amount ?? 0))
                    : order.total_amount)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
