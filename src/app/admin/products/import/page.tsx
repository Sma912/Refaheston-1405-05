"use client";

import { useMemo, useState } from "react";
import { parseBalePhoneText, isNonRegistryOrigin } from "@/lib/parser/bale-phone-parser";
import { formatPriceToman } from "@/lib/utils/price";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_SAMPLE_IMPORT_TEXT } from "@/lib/demo/data";
import { useDemoStore } from "@/lib/demo/store";
import type { ProductListScope, ProductSyncStats } from "@/lib/products/sync";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const SCOPE_LABEL: Record<ProductListScope, string> = {
  mobile: "موبایل",
  "iphone-noreg": "آیفون بدون رجیستری",
};

export default function ImportProductsPage() {
  const demo = isDemoMode();
  const syncFromChannelText = useDemoStore((s) => s.syncFromChannelText);
  const [raw, setRaw] = useState(demo ? DEMO_SAMPLE_IMPORT_TEXT : "");
  const [forceScope, setForceScope] = useState<ProductListScope | "auto">(
    "auto"
  );
  const [saving, setSaving] = useState(false);
  const [lastStats, setLastStats] = useState<ProductSyncStats | null>(null);

  const parsed = useMemo(() => {
    if (!raw.trim()) return null;
    return parseBalePhoneText(raw);
  }, [raw]);

  const previewScopes = useMemo(() => {
    if (!parsed) return [];
    const set = new Set<ProductListScope>();
    for (const p of parsed.products) {
      set.add(isNonRegistryOrigin(p.origin) ? "iphone-noreg" : "mobile");
    }
    return [...set];
  }, [parsed]);

  async function confirmImport() {
    if (!parsed || parsed.products.length === 0) {
      toast.error("محصولی برای ورود وجود ندارد");
      return;
    }

    setSaving(true);
    try {
      if (demo) {
        const stats = syncFromChannelText(raw, forceScope);
        setLastStats(stats);
        toast.success(
          `همگام شد: ${stats.updated.toLocaleString("fa-IR")} به‌روز، ${stats.inserted.toLocaleString("fa-IR")} جدید، ${stats.deactivated.toLocaleString("fa-IR")} غیرفعال`
        );
        return;
      }

      const res = await fetch("/api/admin/sync-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: raw, forceScope }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        stats?: ProductSyncStats;
      };
      if (!res.ok || !data.stats) {
        toast.error(data.error ?? "همگام‌سازی ناموفق بود");
        return;
      }
      setLastStats(data.stats);
      toast.success(
        `همگام شد: ${data.stats.updated.toLocaleString("fa-IR")} به‌روز، ${data.stats.inserted.toLocaleString("fa-IR")} جدید، ${data.stats.deactivated.toLocaleString("fa-IR")} غیرفعال`
      );
      setRaw("");
    } catch (err) {
      console.error(err);
      toast.error("ورود کالا ناموفق بود");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">همگام‌سازی کالا از کانال بله</h1>
        <p className="mt-1 text-sm text-slate-500">
          متن لیست را کپی‌پیست کنید. کالاهای موجود به‌روز می‌شوند؛ موارد حذف‌شده از
          همان دسته غیرفعال می‌گردند. لیست موبایل و آیفون بدون رجیستری جداگانه
          همگام می‌شوند.
        </p>
      </div>

      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="متن لیست گوشی‌ها را اینجا بچسبانید..."
        className="min-h-[220px] font-mono text-xs leading-6"
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">محدوده همگام‌سازی</label>
        <select
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          value={forceScope}
          onChange={(e) =>
            setForceScope(e.target.value as ProductListScope | "auto")
          }
        >
          <option value="auto">خودکار از روی متن</option>
          <option value="mobile">فقط موبایل</option>
          <option value="iphone-noreg">فقط آیفون بدون رجیستری</option>
        </select>
      </div>

      {parsed && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              {parsed.products.length.toLocaleString("fa-IR")} واریانت · دسته‌ها:{" "}
              {previewScopes.map((s) => SCOPE_LABEL[s]).join("، ") || "—"}
            </p>
            <Button
              onClick={confirmImport}
              disabled={saving || parsed.products.length === 0}
            >
              {saving ? "در حال همگام‌سازی..." : "تأیید و همگام‌سازی"}
            </Button>
          </div>

          {parsed.errors.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="mb-1 font-medium">هشدارهای پارس:</p>
              <ul className="list-disc pr-5">
                {parsed.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {lastStats && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              آخرین همگام‌سازی: {lastStats.updated.toLocaleString("fa-IR")} به‌روز ·{" "}
              {lastStats.inserted.toLocaleString("fa-IR")} جدید ·{" "}
              {lastStats.deactivated.toLocaleString("fa-IR")} غیرفعال · محدوده:{" "}
              {lastStats.scopes.map((s) => SCOPE_LABEL[s]).join("، ")}
            </div>
          )}

          <div className="max-h-[420px] overflow-auto rounded-2xl border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>دسته</TableHead>
                  <TableHead>برند</TableHead>
                  <TableHead>مدل</TableHead>
                  <TableHead>حافظه</TableHead>
                  <TableHead>رم</TableHead>
                  <TableHead>مبدأ</TableHead>
                  <TableHead>رنگ</TableHead>
                  <TableHead>قیمت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.products.map((p, idx) => (
                  <TableRow key={`${p.brand}-${p.model}-${p.color}-${idx}`}>
                    <TableCell>
                      {SCOPE_LABEL[
                        isNonRegistryOrigin(p.origin) ? "iphone-noreg" : "mobile"
                      ]}
                    </TableCell>
                    <TableCell>{p.brand}</TableCell>
                    <TableCell>{p.model}</TableCell>
                    <TableCell>{p.storage ?? "—"}</TableCell>
                    <TableCell>{p.ram ?? "—"}</TableCell>
                    <TableCell>{p.origin ?? "—"}</TableCell>
                    <TableCell>{p.color}</TableCell>
                    <TableCell>{formatPriceToman(p.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
