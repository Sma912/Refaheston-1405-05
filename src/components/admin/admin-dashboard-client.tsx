"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_ORDERS, DEMO_PRODUCTS, DEMO_USERS } from "@/lib/demo/data";
import { useDemoStore } from "@/lib/demo/store";
import { formatPriceToman } from "@/lib/utils/price";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AdminDashboardClient({
  remoteStats,
}: {
  remoteStats?: {
    productsCount: number;
    ordersCount: number;
    pendingCount: number;
    usersCount: number;
    recentOrders: { id: string; total_amount: number }[];
  };
}) {
  const demo = isDemoMode();
  const products = useDemoStore((s) => s.products);
  const orders = useDemoStore((s) => s.orders);
  const users = useDemoStore((s) => s.users);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const productsCount = demo
    ? hydrated
      ? products.length
      : DEMO_PRODUCTS.length
    : remoteStats?.productsCount ?? 0;
  const ordersCount = demo
    ? hydrated
      ? orders.length
      : DEMO_ORDERS.length
    : remoteStats?.ordersCount ?? 0;
  const pendingCount = demo
    ? (hydrated ? orders : DEMO_ORDERS).filter(
        (o) => o.status === "pending_confirmation"
      ).length
    : remoteStats?.pendingCount ?? 0;
  const usersCount = demo
    ? hydrated
      ? users.length
      : DEMO_USERS.length
    : remoteStats?.usersCount ?? 0;
  const recentOrders = demo
    ? (hydrated ? orders : DEMO_ORDERS).slice(0, 5)
    : remoteStats?.recentOrders ?? [];

  const stats = [
    { label: "محصولات", value: productsCount },
    { label: "سفارش‌ها", value: ordersCount },
    { label: "در انتظار تأیید", value: pendingCount },
    { label: "کاربران", value: usersCount },
  ];

  return (
    <div className="space-y-6">
      {demo && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          حالت بررسی — داده‌ها از فروشگاه/ورود کالا همگام می‌شوند. تصاویر بار اول انتخاب و
          لوکال کش می‌شوند.
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">داشبورد</h1>
        <Button asChild>
          <Link href="/admin/products/import">ورود کالا با کپی‌پیست</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {s.value.toLocaleString("fa-IR")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>آخرین سفارش‌ها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentOrders.length === 0 && (
            <p className="text-sm text-slate-500">سفارشی وجود ندارد.</p>
          )}
          {recentOrders.map((o) => (
            <Link
              key={o.id}
              href="/admin/orders"
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span dir="ltr">#{o.id.slice(0, 8)}</span>
              <span>{formatPriceToman(o.total_amount)}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
