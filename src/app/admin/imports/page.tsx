"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/config";
import { useDemoStore } from "@/lib/demo/store";
import type { ProductImport } from "@/types/database";
import { formatJalaliDate } from "@/lib/utils/date";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export default function AdminImportsPage() {
  const demo = isDemoMode();
  const demoImports = useDemoStore((s) => s.imports);
  const [imports, setImports] = useState<ProductImport[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (demo) {
      setImports(demoImports);
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("product_imports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) toast.error(error.message);
      setImports((data as ProductImport[]) ?? []);
    })();
  }, [demo, demoImports]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">لاگ واردات محصولات</h1>
      <div className="rounded-2xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>تاریخ</TableHead>
              <TableHead>تعداد پارس‌شده</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {imports.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{formatJalaliDate(item.created_at, true)}</TableCell>
                <TableCell>{item.parsed_count.toLocaleString("fa-IR")}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="text-sm text-[var(--brand-blue)]"
                    onClick={() =>
                      setExpanded(expanded === item.id ? null : item.id)
                    }
                  >
                    {expanded === item.id ? "بستن" : "مشاهده متن"}
                  </button>
                  {expanded === item.id && (
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap">
                      {item.raw_text}
                    </pre>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
