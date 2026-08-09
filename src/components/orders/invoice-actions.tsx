"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InvoiceDocument } from "@/components/orders/invoice-document";
import type { InvoiceViewModel } from "@/lib/orders/totals";
import { toast } from "sonner";

function buildPrintHtml(title: string, invoiceHtml: string) {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff !important;
      color: #0f172a;
      font-family: Tahoma, Vazirmatn, Arial, sans-serif;
    }
    body { padding: 8px; }
  </style>
</head>
<body>${invoiceHtml}</body>
</html>`;
}

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
    const node = ref.current?.querySelector(
      ".invoice-sheet"
    ) as HTMLElement | null;
    if (!node) {
      toast.error("فاکتور برای پرینت پیدا نشد");
      return;
    }

    const title = `فاکتور #${model.order.id.slice(0, 8)}`;
    const html = buildPrintHtml(title, node.outerHTML);

    // iframe مخفی — بدون pop-up و بدون مسدود شدن مرورگر
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "print-invoice");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
    const frameWin = iframe.contentWindow;
    if (!frameDoc || !frameWin) {
      document.body.removeChild(iframe);
      toast.error("امکان پرینت در این مرورگر نیست");
      return;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    const cleanup = () => {
      window.setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {
          // ignore
        }
      }, 800);
    };

    const run = () => {
      try {
        frameWin.focus();
        frameWin.print();
      } catch (err) {
        console.error(err);
        toast.error("پرینت ناموفق بود");
      } finally {
        cleanup();
      }
    };

    // صبر کوتاه برای رندر فونت/layout
    window.setTimeout(run, 350);
  }

  async function downloadPdf() {
    const node = ref.current?.querySelector(
      ".invoice-sheet"
    ) as HTMLElement | null;
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
      pdf.addImage(img, "PNG", x, margin, w, h);
      pdf.save(`invoice-${model.order.id.slice(0, 8)}.pdf`);
      toast.success("PDF ذخیره شد");
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
