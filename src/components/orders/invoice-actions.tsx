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
    window.print();
  }

  async function downloadPdf() {
    if (!ref.current) return;
    setBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      const x = (pageWidth - w) / 2;
      pdf.addImage(img, "PNG", x, 8, w, h);
      pdf.save(`invoice-${model.order.id.slice(0, 8)}.pdf`);
      toast.success("PDF آماده شد");
    } catch (err) {
      console.error(err);
      toast.error("ساخت PDF ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {allowExport && (
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button onClick={printInvoice}>پرینت فاکتور</Button>
          <Button variant="secondary" onClick={downloadPdf} disabled={busy}>
            {busy ? "در حال ساخت PDF..." : "دانلود PDF"}
          </Button>
        </div>
      )}
      {!allowExport && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 print:hidden">
          این فاکتور فقط برای مشاهده است. پرینت و دانلود PDF در اختیار ادمین است.
        </p>
      )}
      <div ref={ref} className="rounded-2xl border border-slate-200 shadow-sm">
        <InvoiceDocument model={model} />
      </div>
    </div>
  );
}
