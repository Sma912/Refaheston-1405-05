"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  productId?: string;
  brand: string;
  model: string;
  color?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  fallbackUrl?: string | null;
};

/** Deduplicate concurrent resolves for the same brand|model. */
const resolveCache = new Map<string, Promise<string | null>>();

function resolveImageUrl(brand: string, model: string, color?: string | null) {
  const key = `${brand}|${model}`.toLowerCase();
  const existing = resolveCache.get(key);
  if (existing) return existing;

  const params = new URLSearchParams({ brand, model, redirect: "0" });
  if (color) params.set("color", color);

  const promise = fetch(`/api/product-image?${params.toString()}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { url?: string } | null) => data?.url ?? null)
    .catch(() => null);

  resolveCache.set(key, promise);
  return promise;
}

/**
 * Resolves product image through the API once, then points <img> at the
 * local static file (avoids broken lazy-load + redirect).
 */
export function ProductImage({
  brand,
  model,
  color,
  alt,
  className,
  imageClassName,
  fallbackUrl,
}: Props) {
  const [src, setSrc] = useState<string | null>(
    fallbackUrl && !fallbackUrl.endsWith(".svg") ? fallbackUrl : null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (fallbackUrl && !fallbackUrl.endsWith(".svg")) {
      setSrc(fallbackUrl);
      setFailed(false);
      return;
    }

    let cancelled = false;
    resolveImageUrl(brand, model, color).then((url) => {
      if (cancelled) return;
      if (!url) {
        setFailed(true);
        return;
      }
      setSrc(url);
      setFailed(false);
    });

    return () => {
      cancelled = true;
    };
  }, [brand, model, color, fallbackUrl]);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50",
        className
      )}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cn(
            "h-full w-full object-contain p-3 transition duration-300",
            imageClassName
          )}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 p-4 text-slate-400">
          <Smartphone className="h-12 w-12" />
          <span className="text-[11px]">{brand}</span>
        </div>
      )}
    </div>
  );
}
