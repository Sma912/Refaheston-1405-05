import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/config";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";

export const metadata = { title: "پنل ادمین" };

export default async function AdminDashboardPage() {
  if (isDemoMode()) {
    return <AdminDashboardClient />;
  }

  const supabase = await createClient();
  const [products, orders, pending, users, recent] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_confirmation"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id, total_amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <AdminDashboardClient
      remoteStats={{
        productsCount: products.count ?? 0,
        ordersCount: orders.count ?? 0,
        pendingCount: pending.count ?? 0,
        usersCount: users.count ?? 0,
        recentOrders: recent.data ?? [],
      }}
    />
  );
}
