import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/types/database";
import { withPublicMediaUrl } from "@/lib/media/public-url";

/** Supabase caps each response at 1000 rows — page until exhausted. */
export async function fetchAllActiveProducts(
  supabase: SupabaseClient
): Promise<Product[]> {
  const pageSize = 1000;
  const all: Product[] = [];
  // ستون‌های لازم برای کارت کاتالوگ — بدون raw_import_text و فیلدهای سنگین
  const columns =
    "id,brand,model,storage,ram,color,price,stock,origin,description,image_url,is_active,category_id,created_at,updated_at,raw_import_text,category:categories(slug)";

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select(columns)
      .eq("is_active", true)
      .order("brand")
      .order("model")
      .order("price")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    const chunk = (data as unknown as Product[]) ?? [];
    all.push(...chunk.map((p) => withPublicMediaUrl(p)));
    if (chunk.length < pageSize) break;
  }

  return all;
}
