import type { CSSProperties } from "react";
import { formatJalaliDate } from "@/lib/utils/date";
import { formatPriceToman } from "@/lib/utils/price";
import { ORDER_STATUS_LABELS } from "@/lib/utils/order-status";
import {
  orderPayable,
  orderShipping,
  orderSubtotal,
  toMoney,
  type InvoiceViewModel,
} from "@/lib/orders/totals";

/** استایل‌های اینلاین تا پرینت/PDF به CSS متغیر و layout وابسته نباشند */
const sheetStyle: CSSProperties = {
  direction: "rtl",
  background: "#ffffff",
  color: "#0f172a",
  fontFamily: "Tahoma, Vazirmatn, Arial, sans-serif",
  maxWidth: "800px",
  margin: "0 auto",
  padding: "28px",
  boxSizing: "border-box",
};

export function InvoiceDocument({
  model,
  id = "invoice-document",
}: {
  model: InvoiceViewModel;
  id?: string;
}) {
  const { order, items, customer, settings } = model;
  const fallbackShip = toMoney(settings.shipping_cost, 0);
  const subtotal = orderSubtotal(order);
  const shipping = orderShipping(order, fallbackShip);
  const payable = orderPayable(order, fallbackShip);

  return (
    <div id={id} className="invoice-sheet" style={sheetStyle}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "16px",
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: "20px",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            فروشگاه اینترنتی
          </p>
          <h1
            style={{
              margin: "4px 0 0",
              fontSize: "26px",
              fontWeight: 800,
              color: "#1e3a8a",
            }}
          >
            رفاهستون
          </h1>
          {settings.store_address ? (
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#64748b" }}>
              {settings.store_address}
            </p>
          ) : null}
          {settings.contact_phone ? (
            <p
              style={{ margin: "2px 0 0", fontSize: "12px", direction: "ltr" }}
            >
              {settings.contact_phone}
            </p>
          ) : null}
        </div>
        <div style={{ textAlign: "left", fontSize: "13px", direction: "ltr" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>
            Invoice #{order.id.slice(0, 8)}
          </p>
          <p style={{ margin: "4px 0 0", color: "#64748b" }}>
            {formatJalaliDate(order.created_at, true)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
            {ORDER_STATUS_LABELS[order.status]}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginTop: "20px",
          fontSize: "13px",
        }}
      >
        <div
          style={{
            background: "#f8fafc",
            borderRadius: "12px",
            padding: "14px",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 700 }}>
            خریدار
          </h2>
          <p style={{ margin: 0 }}>{customer.fullName || "—"}</p>
          <p style={{ margin: "4px 0 0", direction: "ltr" }}>
            {customer.phone || order.contact_phone}
          </p>
          <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.7 }}>
            {order.shipping_address}
          </p>
        </div>
        <div
          style={{
            background: "#f8fafc",
            borderRadius: "12px",
            padding: "14px",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 700 }}>
            اطلاعات پرداخت
          </h2>
          {settings.payment_card_number ? (
            <p style={{ margin: "0 0 4px", direction: "ltr" }}>
              کارت: {settings.payment_card_number}
            </p>
          ) : null}
          {settings.payment_sheba ? (
            <p
              style={{
                margin: "0 0 4px",
                direction: "ltr",
                fontFamily: "monospace",
                fontSize: "12px",
                wordBreak: "break-all",
              }}
            >
              شبا: {settings.payment_sheba}
            </p>
          ) : null}
          {settings.payment_card_holder ? (
            <p style={{ margin: "0 0 4px" }}>
              به نام: {settings.payment_card_holder}
            </p>
          ) : null}
          {order.payment_ref ? (
            <p style={{ margin: "8px 0 0", direction: "ltr" }}>
              پیگیری پرداخت: {order.payment_ref}
            </p>
          ) : null}
        </div>
      </div>

      <div
        style={{
          marginTop: "22px",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr style={{ background: "#f1f5f9", color: "#475569" }}>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>ردیف</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>
                شرح کالا
              </th>
              <th style={{ padding: "10px 12px", textAlign: "center" }}>
                تعداد
              </th>
              <th style={{ padding: "10px 12px", textAlign: "left" }}>مبلغ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 12px" }}>{index + 1}</td>
                <td style={{ padding: "10px 12px" }}>
                  {item.product_title ?? "محصول"}
                  {item.color ? ` — ${item.color}` : ""}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                  {item.quantity}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    direction: "ltr",
                  }}
                >
                  {formatPriceToman(item.unit_price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "18px", fontSize: "13px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <span style={{ color: "#64748b" }}>جمع کالا</span>
          <span>{formatPriceToman(subtotal)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <span style={{ color: "#64748b" }}>هزینه ارسال</span>
          <span>{formatPriceToman(shipping)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #e2e8f0",
            paddingTop: "10px",
            fontSize: "16px",
            fontWeight: 800,
          }}
        >
          <span>مبلغ قابل پرداخت</span>
          <span style={{ color: "#e11d48" }}>{formatPriceToman(payable)}</span>
        </div>
      </div>

      {order.notes ? (
        <p
          style={{
            marginTop: "18px",
            background: "#fffbeb",
            color: "#92400e",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "13px",
          }}
        >
          یادداشت: {order.notes}
        </p>
      ) : null}

      {order.tracking_number ? (
        <p
          style={{
            marginTop: "10px",
            fontSize: "13px",
            direction: "ltr",
          }}
        >
          کد رهگیری ارسال: {order.tracking_number}
        </p>
      ) : null}

      <div
        style={{
          marginTop: "28px",
          borderTop: "1px solid #f1f5f9",
          paddingTop: "12px",
          textAlign: "center",
          fontSize: "11px",
          color: "#94a3b8",
        }}
      >
        فاکتور رفاهستون — پس از پرداخت، رسید را از طریق بله ارسال کنید.
      </div>
    </div>
  );
}
