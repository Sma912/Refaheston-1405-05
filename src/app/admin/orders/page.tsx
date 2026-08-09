"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/config";
import { useDemoStore } from "@/lib/demo/store";
import type { Order, OrderStatus } from "@/types/database";
import { ALL_ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/utils/order-status";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatPriceToman } from "@/lib/utils/price";
import { formatJalaliDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
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

export default function AdminOrdersPage() {
  const demo = isDemoMode();
  const demoOrders = useDemoStore((s) => s.orders);
  const updateOrder = useDemoStore((s) => s.updateOrder);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "all">("pending_confirmation");
  const [selected, setSelected] = useState<Order | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<OrderStatus>("pending_confirmation");
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

  function openOrder(order: Order) {
    setSelected(order);
    setNotes(order.notes ?? "");
    setStatus(order.status);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);

    if (demo) {
      updateOrder(selected.id, { status, notes: notes.trim() || null });
      toast.success("سفارش به‌روزرسانی شد (دمو)");
      setSelected(null);
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({ status, notes: notes.trim() || null })
      .eq("id", selected.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("سفارش به‌روزرسانی شد");
      setSelected(null);
      load();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">مدیریت سفارش‌ها</h1>

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
                <TableCell>{formatPriceToman(o.total_amount)}</TableCell>
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
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold" dir="ltr">
            سفارش #{selected.id.slice(0, 8)}
          </h2>
          <p className="text-sm text-slate-600">{selected.shipping_address}</p>
          <p className="text-sm" dir="ltr">
            {selected.contact_phone}
          </p>
          <div>
            <label className="mb-1 block text-sm">وضعیت</label>
            <select
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
            >
              {ALL_ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">یادداشت ادمین</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "در حال ذخیره..." : "ذخیره"}
            </Button>
            <Button variant="outline" onClick={() => setSelected(null)}>
              بستن
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
