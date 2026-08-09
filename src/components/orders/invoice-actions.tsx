"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InvoiceDocument } from "@/components/orders/invoice-document";
import type { InvoiceViewModel } from "@/lib/orders/totals";
import { toast } from "sonner";

export function InvoiceActions({
  model,
  allowExport,
}: {
  model: InvoiceViewModel;
  /** فقط ادمین: پرینت و PDF */
  allowExport: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  function printInvoice() {
    const node = ref.current?.querySelector(".invoice-sheet") as HTMLElement | null;
    if (!node) {
      toast.error("فاکتور برای پرینت پیدا نشد");
      return;
    }

    // فقط فاکتور را در پنجره جدا پرینت می‌گیریم تا layout ادمین قاطی نشود
    const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1200");
    if (!win) {
      toast.error("پنجره پرینت مسدود شد؛ pop-up را اجازه دهید");
      return;
    }

    win.document.open();
    win.document.write(`<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>فاکتور #${model.order.id.slice(0, 8)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #0f172a;
      font-family: Tahoma, Vazirmatn, Arial, sans-serif;
    }
    body { padding: 8px; }
  </style>
</head>
<body>${node.outerHTML}</body>
</html>`);
    win.document.close();

    const trigger = () => {
      try {
        win.focus();
        win.print();
      } finally {
        // بعضی مرورگرها بلافاصله می‌بندند؛ کمی تأخیر امن‌تر است
        window.setTimeout(() => {
          try {
            win.close();
          } catch {
            // ignore
          }
        }, 300);
      }
    };

    if (win.document.readyState === "complete") {
      window.setTimeout(trigger, 250);
    } else {
      win.onload = () => window.setTimeout(trigger, 250);
    }
  }

  async function downloadPdf() {
    const node = ref.current?.querySelector(".invoice-sheet") as HTMLElement | null;
    if (!node) {
      toast.error("فاکتور برای PDF پیدا نشد");
      return;
    }

    setBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      // کلون موقت خارج از layout تا رندر دقیق‌تر باشد
      const host = document.createElement("div");
      host.style.cssText =
        "position:fixed;left:-10000px;top:0;width:800px;background:#fff;z-index:-1;";
      const clone = node.cloneNode(true) as HTMLElement;
      host.appendChild(clone);
      document.body.appendChild(host);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 800,
      });

      document.body.removeChild(host);

      const img = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const ratio = Math.min(
        usableWidth / canvas.width,
        usableHeight / canvas.height
      );
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      const x = (pageWidth - w) / 2;
      const y = margin;
      pdf.addImage(img, "PNG", x, y, w, h);
      pdf.save(`invoice-${model.order.id.slice(0, 8)}.pdf`);
      toast.success("PDF با همان قالب صفحه ذخیره شد");
    } catch (err) {
      console.error(err);
      toast.error("ساخت PDF ناموفق بود؛ پرینت را امتحان کنید");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {allowExport && (
        <div className="no-print flex flex-wrap gap-2">
          <Button type="button" onClick={printInvoice}>
            پرینت فاکتور
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={downloadPdf}
            disabled={busy}
          >
            {busy ? "در حال ساخت PDF..." : "دانلود PDF"}
          </Button>
        </div>
      )}
      {!allowExport && (
        <p className="no-print rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          این فاکتور فقط برای مشاهده است. پرینت و دانلود PDF در اختیار ادمین است.
        </p>
      )}
      <div
        ref={ref}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <InvoiceDocument model={model} />
      </div>
    </div>
  );
}
