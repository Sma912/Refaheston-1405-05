"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_ORDERS, DEMO_PRODUCTS, DEMO_USERS } from "@/lib/demo/data";
import { useDemoStore } from "@/lib/demo/store";
import { formatPriceToman } from "@/lib/utils/price";
import { formatJalaliDate } from "@/lib/utils/date";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@/types/database";

type RecentOrder = {
  id: string;
  total_amount: number;
  status?: OrderStatus;
  created_at?: string;
  contact_phone?: string;
  customer_name?: string | null;
};

/** در فارسی معمولاً آخرین بخش نام، نام خانوادگی است */
function familyNameFromFull(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "بدون نام";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || trimmed;
}

export function AdminDashboardClient({
  remoteStats,
}: {
  remoteStats?: {
    productsCount: number;
    activeProductsCount: number;
    ordersCount: number;
    pendingCount: number;
    awaitingPaymentCount: number;
    paidCount: number;
    preparingCount: number;
    shippedCount: number;
    todayOrdersCount: number;
    usersCount: number;
    recentOrders: RecentOrder[];
  };
}) {
  const demo = isDemoMode();
  const products = useDemoStore((s) => s.products);
  const orders = useDemoStore((s) => s.orders);
  const users = useDemoStore((s) => s.users);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const liveOrders = demo ? (hydrated ? orders : DEMO_ORDERS) : [];
  const liveProducts = demo ? (hydrated ? products : DEMO_PRODUCTS) : [];

  const productsCount = demo
    ? liveProducts.length
    : remoteStats?.productsCount ?? 0;
  const activeProductsCount = demo
    ? liveProducts.filter((p) => p.is_active).length
    : remoteStats?.activeProductsCount ?? 0;
  const ordersCount = demo
    ? liveOrders.length
    : remoteStats?.ordersCount ?? 0;
  const pendingCount = demo
    ? liveOrders.filter((o) => o.status === "pending_confirmation").length
    : remoteStats?.pendingCount ?? 0;
  const awaitingPaymentCount = demo
    ? liveOrders.filter((o) => o.status === "awaiting_payment").length
    : remoteStats?.awaitingPaymentCount ?? 0;
  const paidCount = demo
    ? liveOrders.filter((o) => o.status === "paid").length
    : remoteStats?.paidCount ?? 0;
  const preparingCount = demo
    ? liveOrders.filter((o) => o.status === "preparing").length
    : remoteStats?.preparingCount ?? 0;
  const shippedCount = demo
    ? liveOrders.filter((o) => o.status === "shipped").length
    : remoteStats?.shippedCount ?? 0;
  const todayOrdersCount = demo
    ? liveOrders.filter((o) => {
        const d = new Date(o.created_at);
        const now = new Date();
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      }).length
    : remoteStats?.todayOrdersCount ?? 0;
  const usersCount = demo
    ? hydrated
      ? users.length
      : DEMO_USERS.length
    : remoteStats?.usersCount ?? 0;

  const recentOrders: RecentOrder[] = demo
    ? [...liveOrders]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 8)
        .map((o) => ({
          id: o.id,
          total_amount: o.total_amount,
          status: o.status,
          created_at: o.created_at,
          contact_phone: o.contact_phone,
          customer_name:
            DEMO_USERS.find((u) => u.id === o.user_id)?.full_name ?? null,
        }))
    : remoteStats?.recentOrders ?? [];

  const overview = [
    { label: "محصولات فعال", value: activeProductsCount, hint: `از ${productsCount.toLocaleString("fa-IR")} کل` },
    { label: "سفارش‌های امروز", value: todayOrdersCount, hint: `کل: ${ordersCount.toLocaleString("fa-IR")}` },
    { label: "کاربران", value: usersCount, hint: "پروفایل ثبت‌شده" },
    {
      label: "نیاز به اقدام",
      value: pendingCount + awaitingPaymentCount,
      hint: "تأیید + پرداخت",
    },
  ];

  const workflow = [
    {
      label: "در انتظار تأیید",
      value: pendingCount,
      href: "/admin/orders?status=pending_confirmation",
      tone: "border-amber-200 bg-amber-50 text-amber-900",
    },
    {
      label: "در انتظار پرداخت",
      value: awaitingPaymentCount,
      href: "/admin/orders?status=awaiting_payment",
      tone: "border-orange-200 bg-orange-50 text-orange-900",
    },
    {
      label: "پرداخت‌شده",
      value: paidCount,
      href: "/admin/orders?status=paid",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    {
      label: "آماده‌سازی / ارسال",
      value: preparingCount + shippedCount,
      href: "/admin/orders?status=preparing",
      tone: "border-sky-200 bg-sky-50 text-sky-900",
    },
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
        <div>
          <h1 className="text-2xl font-bold">داشبورد</h1>
          <p className="mt-1 text-sm text-slate-500">
            خلاصه وضعیت فروشگاه و صف اقدام‌های سفارش
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/orders">همه سفارش‌ها</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/products/import">ورود کالا با کپی‌پیست</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {overview.map((s) => (
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
              <p className="mt-1 text-xs text-slate-500">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          صف کنترل سفارش‌ها
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {workflow.map((w) => (
            <Link
              key={w.label}
              href={w.href}
              className={`rounded-2xl border px-4 py-3 transition hover:shadow-sm ${w.tone}`}
            >
              <div className="text-xs font-medium opacity-80">{w.label}</div>
              <div className="mt-1 text-2xl font-bold">
                {w.value.toLocaleString("fa-IR")}
              </div>
              <div className="mt-1 text-[11px] opacity-70">مشاهده و مدیریت ←</div>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>آخرین سفارش‌ها</CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/orders?status=all">مشاهده همه</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentOrders.length === 0 && (
            <p className="text-sm text-slate-500">سفارشی وجود ندارد.</p>
          )}
          {recentOrders.map((o) => {
            const family = familyNameFromFull(o.customer_name);
            const dateLabel = o.created_at
              ? formatJalaliDate(o.created_at, true)
              : "—";
            const orderNo = o.id.slice(0, 8);
            return (
              <Link
                key={o.id}
                href={`/admin/orders?order=${o.id}`}
                className="flex flex-col gap-2 rounded-xl border border-slate-100 px-3 py-3 text-sm transition hover:border-slate-200 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{family}</span>
                    {o.customer_name &&
                      familyNameFromFull(o.customer_name) !==
                        o.customer_name.trim() && (
                        <span className="truncate text-xs text-slate-500">
                          ({o.customer_name})
                        </span>
                      )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{dateLabel}</span>
                    <span dir="ltr">#{orderNo}</span>
                    {o.contact_phone ? (
                      <span dir="ltr">{o.contact_phone}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 self-end sm:self-auto">
                  {o.status ? <OrderStatusBadge status={o.status} /> : null}
                  <span className="font-medium text-slate-800">
                    {formatPriceToman(o.total_amount)}
                  </span>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Button asChild variant="outline" className="justify-start">
          <Link href="/admin/products">مدیریت محصولات</Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link href="/admin/settings">تنظیمات فروشگاه</Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link href="/admin/orders?status=pending_confirmation">
            اقدام فوری: تأیید موجودی ({pendingCount.toLocaleString("fa-IR")})
          </Link>
        </Button>
      </div>
    </div>
  );
}
