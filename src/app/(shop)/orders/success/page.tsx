import Link from "next/link";
import { ORDER_SUCCESS_MESSAGE } from "@/lib/utils/order-status";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

type Props = { searchParams: Promise<{ id?: string }> };

export const metadata = { title: "سفارش ثبت شد" };

export default async function OrderSuccessPage({ searchParams }: Props) {
  const { id } = await searchParams;

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
      <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
      <h1 className="text-2xl font-bold text-slate-900">سفارش شما ثبت شد</h1>
      {id && (
        <p className="text-sm text-slate-500">
          شماره سفارش: <span dir="ltr" className="font-mono">{id.slice(0, 8)}</span>
        </p>
      )}
      <p className="rounded-2xl bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
        {ORDER_SUCCESS_MESSAGE}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        {id && (
          <Button asChild>
            <Link href={`/orders/${id}`}>مشاهده جزئیات سفارش</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/orders">سفارش‌های من</Link>
        </Button>
      </div>
    </div>
  );
}
