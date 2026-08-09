import { isDemoMode } from "@/lib/demo/config";
import { DEMO_ADMIN } from "@/lib/demo/data";
import { createClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/cart/checkout-form";

export const metadata = { title: "ثبت سفارش" };

export default async function CheckoutPage() {
  let phone: string | null = null;

  if (isDemoMode()) {
    phone = DEMO_ADMIN.phone;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", user.id)
        .maybeSingle();
      phone = data?.phone ?? null;
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ثبت سفارش</h1>
      {isDemoMode() && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          در حالت بررسی، ثبت سفارش واقعی انجام نمی‌شود — فقط UI را تست کنید. برای تست کامل سبد،
          محصول را اضافه کنید و فرم را ببینید.
        </p>
      )}
      <CheckoutForm defaultPhone={phone} />
    </div>
  );
}
