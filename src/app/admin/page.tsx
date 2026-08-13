import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/config";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";
import type { OrderStatus } from "@/types/database";

export const metadata = { title: "پنل ادمین" };

type RecentOrderRow = {
  id: string;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  contact_phone: string;
  customer_name: string | null;
};

async function countByStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  status: OrderStatus
) {
  const { count } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("status", status);
  return count ?? 0;
}

export default async function AdminDashboardPage() {
  if (isDemoMode()) {
    return <AdminDashboardClient />;
  }

  const supabase = await createClient();
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();

  const [
    products,
    activeProducts,
    orders,
    users,
    pending,
    awaitingPayment,
    paid,
    preparing,
    shipped,
    todayOrders,
    recent,
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    countByStatus(supabase, "pending_confirmation"),
    countByStatus(supabase, "awaiting_payment"),
    countByStatus(supabase, "paid"),
    countByStatus(supabase, "preparing"),
    countByStatus(supabase, "shipped"),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfDay),
    supabase
      .from("orders")
      .select(
        "id, total_amount, status, created_at, contact_phone, profiles:user_id(full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const recentOrders: RecentOrderRow[] = (recent.data ?? []).map((row) => {
    const raw = row as {
      id: string;
      total_amount: number;
      status: OrderStatus;
      created_at: string;
      contact_phone: string;
      profiles?:
        | { full_name: string | null }
        | { full_name: string | null }[]
        | null;
    };
    const profile = Array.isArray(raw.profiles)
      ? raw.profiles[0]
      : raw.profiles;
    return {
      id: raw.id,
      total_amount: raw.total_amount,
      status: raw.status,
      created_at: raw.created_at,
      contact_phone: raw.contact_phone,
      customer_name: profile?.full_name ?? null,
    };
  });

  return (
    <AdminDashboardClient
      remoteStats={{
        productsCount: products.count ?? 0,
        activeProductsCount: activeProducts.count ?? 0,
        ordersCount: orders.count ?? 0,
        pendingCount: pending,
        awaitingPaymentCount: awaitingPayment,
        paidCount: paid,
        preparingCount: preparing,
        shippedCount: shipped,
        todayOrdersCount: todayOrders.count ?? 0,
        usersCount: users.count ?? 0,
        recentOrders,
      }}
    />
  );
}
