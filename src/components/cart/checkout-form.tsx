"use client";

import { useEffect, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";

const ADDRESS_STORAGE_KEY = "refahestoon_checkout_address";

export function CheckoutForm({
  defaultPhone,
  defaultAddress,
}: {
  defaultPhone?: string | null;
  defaultAddress?: string | null;
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
  const [fieldErrors, setFieldErrors] = useState<{
    phone?: string;
    address?: string;
  }>({});
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultPhone) {
      setPhone(sanitizePhoneInput(defaultPhone));
    }
  }, [defaultPhone]);

  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem(ADDRESS_STORAGE_KEY)?.trim() ?? "";
    } catch {
      saved = "";
    }
    const initial = (defaultAddress?.trim() || saved).trim();
    if (initial) setAddress(initial);
  }, [defaultAddress]);

  function showValidation(message: string, focus: "address" | "phone") {
    setError(message);
    setFieldErrors(
      focus === "address"
        ? { address: message }
        : { phone: message }
    );
    toast.error(message);
    const el = focus === "address" ? addressRef.current : phoneRef.current;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (items.length === 0) {
      setError("سبد خرید خالی است");
      toast.error("سبد خرید خالی است");
      return;
    }

    const trimmedAddress = address.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedAddress) {
      showValidation("لطفاً آدرس ارسال را وارد کنید", "address");
      return;
    }
    if (!trimmedPhone) {
      showValidation("لطفاً شماره تماس را وارد کنید", "phone");
      return;
    }

    const contactPhone = normalizePhone(phone);
    if (!contactPhone || contactPhone.length !== PHONE_LOCAL_LENGTH) {
      showValidation(
        "شماره تماس ۱۱ رقمی معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹)",
        "phone"
      );
      return;
    }
    setPhone(contactPhone);
    setAddress(trimmedAddress);

    setLoading(true);
    try {
      if (demo) {
        try {
          localStorage.setItem(ADDRESS_STORAGE_KEY, trimmedAddress);
        } catch {
          /* ignore */
        }
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
          shipping_address: trimmedAddress,
          contact_phone: contactPhone,
        })
        .select("id")
        .single();

      if (orderError || !order) {
        const msg = orderError?.message || "ثبت سفارش ناموفق بود";
        setError(msg);
        toast.error(msg);
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
        toast.error(itemsError.message);
        return;
      }

      try {
        localStorage.setItem(ADDRESS_STORAGE_KEY, trimmedAddress);
      } catch {
        /* ignore */
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
      toast.error("خطا در ثبت سفارش");
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
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
    >
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="space-y-1.5">
          <Label htmlFor="phone">شماره تماس</Label>
          <Input
            ref={phoneRef}
            id="phone"
            inputMode="tel"
            dir="ltr"
            className={cn(
              "text-left tracking-wide",
              fieldErrors.phone && "border-rose-500 focus-visible:ring-rose-500"
            )}
            value={phone}
            onChange={(e) => {
              setPhone(sanitizePhoneInput(e.target.value));
              if (fieldErrors.phone) {
                setFieldErrors((prev) => ({ ...prev, phone: undefined }));
              }
            }}
            placeholder="09123456789"
            maxLength={PHONE_LOCAL_LENGTH}
            autoComplete="tel"
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
          />
          {fieldErrors.phone && (
            <p id="phone-error" className="text-sm text-rose-600">
              {fieldErrors.phone}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">آدرس ارسال</Label>
          <Textarea
            ref={addressRef}
            id="address"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (fieldErrors.address) {
                setFieldErrors((prev) => ({ ...prev, address: undefined }));
              }
            }}
            placeholder="استان، شهر، خیابان، پلاک، واحد..."
            className={cn(
              fieldErrors.address &&
                "border-rose-500 focus-visible:ring-rose-500"
            )}
            aria-invalid={Boolean(fieldErrors.address)}
            aria-describedby={fieldErrors.address ? "address-error" : undefined}
          />
          {fieldErrors.address && (
            <p id="address-error" className="text-sm text-rose-600">
              {fieldErrors.address}
            </p>
          )}
        </div>
        {error && !fieldErrors.address && !fieldErrors.phone && (
          <p className="text-sm text-rose-600">{error}</p>
        )}
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
