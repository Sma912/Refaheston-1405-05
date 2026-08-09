"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart/store";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/config";
import { formatPriceToman } from "@/lib/utils/price";
import { productTitle } from "@/lib/parser/bale-phone-parser";
import {
  normalizePhone,
  PHONE_LOCAL_LENGTH,
  sanitizePhoneInput,
} from "@/lib/utils/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function CheckoutForm({
  defaultPhone,
}: {
  defaultPhone?: string | null;
}) {
  const router = useRouter();
  const demo = isDemoMode();
  const { items, totalAmount, clear } = useCartStore();
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(() =>
    defaultPhone ? sanitizePhoneInput(defaultPhone) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (items.length === 0) {
      setError("سبد خرید خالی است");
      return;
    }
    if (!address.trim() || !phone.trim()) {
      setError("آدرس و شماره تماس الزامی است");
      return;
    }
    const contactPhone = normalizePhone(phone);
    if (!contactPhone || contactPhone.length !== PHONE_LOCAL_LENGTH) {
      setError("شماره تماس ۱۱ رقمی معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹)");
      return;
    }
    setPhone(contactPhone);

    setLoading(true);
    try {
      if (demo) {
        clear();
        toast.success("سفارش نمونه ثبت شد (حالت بررسی)");
        router.push("/orders/success?id=demo-order-1");
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?next=/checkout");
        return;
      }

      const total = totalAmount();
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          status: "pending_confirmation",
          total_amount: total,
          shipping_address: address.trim(),
          contact_phone: contactPhone,
        })
        .select("id")
        .single();

      if (orderError || !order) {
        setError(orderError?.message || "ثبت سفارش ناموفق بود");
        return;
      }

      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
        color: item.color,
        product_title: productTitle(item),
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        setError(itemsError.message);
        return;
      }

      try {
        await fetch("/api/orders/notify-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        });
      } catch {
        // ثبت سفارش موفق است؛ اطلاع ادمین نباید checkout را متوقف کند
      }

      clear();
      router.push(`/orders/success?id=${order.id}`);
    } catch {
      setError("خطا در ثبت سفارش");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
        سبد خرید خالی است.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="space-y-1.5">
          <Label htmlFor="phone">شماره تماس</Label>
          <Input
            id="phone"
            inputMode="tel"
            dir="ltr"
            className="text-left tracking-wide"
            value={phone}
            onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
            placeholder="09123456789"
            maxLength={PHONE_LOCAL_LENGTH}
            autoComplete="tel"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">آدرس ارسال</Label>
          <Textarea
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="استان، شهر، خیابان، پلاک، واحد..."
            required
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">اقلام سفارش</h2>
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-2">
              <span className="text-slate-600">
                {item.brand} {item.model} ({item.color}) × {item.quantity}
              </span>
              <span className="shrink-0 font-medium">
                {formatPriceToman(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-slate-100 pt-3">
          <span>جمع کل</span>
          <span className="font-bold text-[var(--brand-red)]">
            {formatPriceToman(totalAmount())}
          </span>
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "در حال ثبت..." : "ثبت سفارش"}
        </Button>
      </aside>
    </form>
  );
}
