import { CartView } from "@/components/cart/cart-view";

export const metadata = { title: "سبد خرید" };

export default function CartPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">سبد خرید</h1>
      <CartView />
    </div>
  );
}
