import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { withPublicMediaUrl } from "@/lib/media/public-url";
import type { Product } from "@/types/database";

/** Cookie-free anon client — public catalog reads stay fast & cacheable. */
function publicCatalogClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** Deduped per-request: metadata + page share one fetch. */
export const getActiveProductById = cache(
  async (id: string): Promise<Product | null> => {
    const supabase = publicCatalogClient();
    const { data, error } = await supabase
      .from("products")
      .select("*, category:categories(slug)")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !data) return null;
    return withPublicMediaUrl(data as Product);
  }
);

export const getProductVariants = cache(
  async (product: Product): Promise<Product[]> => {
    const supabase = publicCatalogClient();
    const { data } = await supabase
      .from("products")
      .select("*, category:categories(slug)")
      .eq("is_active", true)
      .eq("brand", product.brand)
      .eq("model", product.model)
      .eq("storage", product.storage)
      .eq("ram", product.ram)
      .eq("origin", product.origin);
    const rows = (data as Product[]) ?? [product];
    return rows.map((row) => withPublicMediaUrl(row));
  }
);
