import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_ORDERS, DEMO_ORDER_ITEMS, DEMO_USERS } from "@/lib/demo/data";
import { DEMO_STORE_SETTINGS } from "@/lib/store/defaults";
import { getStoreSettings } from "@/lib/store/settings";
import { InvoiceActions } from "@/components/orders/invoice-actions";
import type { Order, OrderItem } from "@/types/database";
import type { InvoiceViewModel } from "@/lib/orders/totals";

type Props = { params: Promise<{ id: string }> };

export const metadata = { title: "فاکتور سفارش" };

export default async function AdminInvoicePage({ params }: Props) {
  const { id } = await params;

  let model: InvoiceViewModel | null = null;

  if (isDemoMode()) {
    const order = DEMO_ORDERS.find((o) => o.id === id);
    if (!order) notFound();
    const profile = DEMO_USERS.find((u) => u.id === order.user_id);
    model = {
      order,
      items: DEMO_ORDER_ITEMS.filter((i) => i.order_id === id),
      customer: {
        fullName: profile?.full_name ?? null,
        phone: profile?.phone ?? order.contact_phone,
      },
      settings: DEMO_STORE_SETTINGS,
    };
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: me } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (me?.role !== "admin") redirect("/");

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!order) notFound();

    const [{ data: items }, { data: profile }, settings] = await Promise.all([
      supabase.from("order_items").select("*").eq("order_id", id),
      supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", (order as Order).user_id)
        .maybeSingle(),
      getStoreSettings(),
    ]);

    model = {
      order: order as Order,
      items: (items as OrderItem[]) ?? [],
      customer: {
        fullName: profile?.full_name ?? null,
        phone: profile?.phone ?? (order as Order).contact_phone,
      },
      settings,
    };
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">فاکتور سفارش</h1>
          <p className="text-sm text-slate-500" dir="ltr">
            #{id.slice(0, 8)}
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="text-sm text-[var(--brand-blue)] hover:underline"
        >
          بازگشت به سفارش‌ها
        </Link>
      </div>
      <InvoiceActions model={model} allowExport />
    </div>
  );
}
