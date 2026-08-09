"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/config";
import { useDemoStore } from "@/lib/demo/store";
import type { Product } from "@/types/database";
import { formatPriceToman } from "@/lib/utils/price";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export default function AdminProductsPage() {
  const demo = isDemoMode();
  const demoProducts = useDemoStore((s) => s.products);
  const setProducts = useDemoStore((s) => s.setProducts);
  const [products, setLocalProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [editing, setEditing] = useState<Product | null>(null);

  async function load() {
    if (demo) {
      setLocalProducts(demoProducts);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setLocalProducts((data as Product[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, demoProducts]);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;

    if (demo) {
      setProducts(
        demoProducts.map((p) => (p.id === editing.id ? { ...editing } : p))
      );
      toast.success("ذخیره شد (دمو)");
      setEditing(null);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({
        price: Number(editing.price),
        stock: Number(editing.stock),
        is_active: editing.is_active,
        description: editing.description,
        image_url: editing.image_url,
      })
      .eq("id", editing.id);
    if (error) toast.error(error.message);
    else {
      toast.success("ذخیره شد");
      setEditing(null);
      load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">محصولات</h1>
        <Button asChild>
          <Link href="/admin/products/import">ورود با کپی‌پیست</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-slate-500">در حال بارگذاری...</p>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>برند / مدل</TableHead>
                <TableHead>رنگ</TableHead>
                <TableHead>قیمت</TableHead>
                <TableHead>موجودی</TableHead>
                <TableHead>فعال</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">
                      {p.brand} {p.model}
                    </div>
                    <div className="text-xs text-slate-500">
                      {[p.storage, p.ram, p.origin].filter(Boolean).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell>{p.color}</TableCell>
                  <TableCell>{formatPriceToman(p.price)}</TableCell>
                  <TableCell>{p.stock}</TableCell>
                  <TableCell>{p.is_active ? "بله" : "خیر"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                      ویرایش
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <form
          onSubmit={saveEdit}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold">
            ویرایش: {editing.brand} {editing.model} — {editing.color}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm">قیمت (تومان)</label>
              <Input
                type="number"
                value={editing.price}
                onChange={(e) =>
                  setEditing({ ...editing, price: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">موجودی</label>
              <Input
                type="number"
                value={editing.stock}
                onChange={(e) =>
                  setEditing({ ...editing, stock: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">آدرس تصویر</label>
              <Input
                value={editing.image_url ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, image_url: e.target.value || null })
                }
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) =>
                    setEditing({ ...editing, is_active: e.target.checked })
                  }
                />
                فعال
              </label>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm">توضیحات</label>
            <Input
              value={editing.description ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, description: e.target.value || null })
              }
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit">ذخیره</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              انصراف
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
