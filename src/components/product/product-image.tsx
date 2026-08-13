"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { toPublicMediaUrl } from "@/lib/media/public-url";

type Props = {
  productId?: string;
  brand: string;
  model: string;
  color?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  fallbackUrl?: string | null;
  /** Above-the-fold cards: load immediately */
  priority?: boolean;
  /** Skip /api/product-image (e.g. laptops — phone catalog matches are wrong). */
  skipRemoteResolve?: boolean;
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
 * Prefer DB image_url (same-origin /media) — no extra round-trip.
 * Only call /api/product-image when no stored URL exists.
 */
export function ProductImage({
  brand,
  model,
  color,
  alt,
  className,
  imageClassName,
  fallbackUrl,
  priority = false,
  skipRemoteResolve = false,
}: Props) {
  const initial = toPublicMediaUrl(fallbackUrl) ?? null;
  const [src, setSrc] = useState<string | null>(
    initial && !initial.endsWith(".svg") ? initial : null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const next = toPublicMediaUrl(fallbackUrl);
    if (next && !next.endsWith(".svg")) {
      setSrc(next);
      setFailed(false);
      return;
    }

    if (skipRemoteResolve) {
      setSrc(null);
      setFailed(true);
      return;
    }

    let cancelled = false;
    resolveImageUrl(brand, model, color).then((url) => {
      if (cancelled) return;
      const normalized = toPublicMediaUrl(url);
      if (!normalized || normalized.endsWith(".svg")) {
        setFailed(true);
        return;
      }
      setSrc(normalized);
      setFailed(false);
    });

    return () => {
      cancelled = true;
    };
  }, [brand, model, color, fallbackUrl, skipRemoteResolve]);

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
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
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
