import { formatJalaliDate } from "@/lib/utils/date";
import { formatPriceToman } from "@/lib/utils/price";
import { ORDER_STATUS_LABELS } from "@/lib/utils/order-status";
import {
  orderPayable,
  orderShipping,
  orderSubtotal,
  type InvoiceViewModel,
} from "@/lib/orders/totals";

export function InvoiceDocument({
  model,
  id = "invoice-document",
}: {
  model: InvoiceViewModel;
  id?: string;
}) {
  const { order, items, customer, settings } = model;
  const subtotal = orderSubtotal(order);
  const shipping = orderShipping(order);
  const payable = orderPayable(order);

  return (
    <div
      id={id}
      dir="rtl"
      className="mx-auto max-w-3xl bg-white p-6 text-slate-900 md:p-8"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm text-slate-500">فروشگاه اینترنتی</p>
          <h1 className="text-2xl font-extrabold text-[var(--brand-blue)]">
            رفاهستون
          </h1>
          {settings.store_address ? (
            <p className="mt-1 text-xs text-slate-500">{settings.store_address}</p>
          ) : null}
          {settings.contact_phone ? (
            <p className="text-xs" dir="ltr">
              {settings.contact_phone}
            </p>
          ) : null}
        </div>
        <div className="text-left text-sm" dir="ltr">
          <p className="font-semibold">Invoice #{order.id.slice(0, 8)}</p>
          <p className="text-slate-500">{formatJalaliDate(order.created_at, true)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {ORDER_STATUS_LABELS[order.status]}
          </p>
        </div>
      </header>

      <section className="mt-5 grid gap-4 text-sm md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4">
          <h2 className="mb-2 font-semibold">خریدار</h2>
          <p>{customer.fullName || "—"}</p>
          <p dir="ltr">{customer.phone || order.contact_phone}</p>
          <p className="mt-2 leading-6 text-slate-600">{order.shipping_address}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <h2 className="mb-2 font-semibold">اطلاعات پرداخت</h2>
          {settings.payment_card_number ? (
            <p dir="ltr">کارت: {settings.payment_card_number}</p>
          ) : null}
          {settings.payment_sheba ? (
            <p className="break-all font-mono text-xs" dir="ltr">
              شبا: {settings.payment_sheba}
            </p>
          ) : null}
          {settings.payment_card_holder ? (
            <p>به نام: {settings.payment_card_holder}</p>
          ) : null}
          {order.payment_ref ? (
            <p className="mt-2" dir="ltr">
              پیگیری پرداخت: {order.payment_ref}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-right font-medium">ردیف</th>
              <th className="px-3 py-2 text-right font-medium">شرح کالا</th>
              <th className="px-3 py-2 text-center font-medium">تعداد</th>
              <th className="px-3 py-2 text-left font-medium">مبلغ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2">
                  {item.product_title ?? "محصول"}
                  {item.color ? ` — ${item.color}` : ""}
                </td>
                <td className="px-3 py-2 text-center">{item.quantity}</td>
                <td className="px-3 py-2 text-left" dir="ltr">
                  {formatPriceToman(item.unit_price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-5 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">جمع کالا</span>
          <span>{formatPriceToman(subtotal)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">هزینه ارسال</span>
          <span>{formatPriceToman(shipping)}</span>
        </div>
        <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-base font-bold">
          <span>مبلغ قابل پرداخت</span>
          <span className="text-[var(--brand-red)]">
            {formatPriceToman(payable)}
          </span>
        </div>
      </section>

      {order.notes ? (
        <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          یادداشت: {order.notes}
        </p>
      ) : null}

      {order.tracking_number ? (
        <p className="mt-3 text-sm" dir="ltr">
          کد رهگیری ارسال: {order.tracking_number}
        </p>
      ) : null}

      <footer className="mt-8 border-t border-slate-100 pt-3 text-center text-xs text-slate-400">
        فاکتور رفاهستون — پس از پرداخت، رسید را از طریق بله ارسال کنید.
      </footer>
    </div>
  );
}
