/** Convert VPS absolute media URLs to same-origin HTTPS-safe paths. */
export function toPublicMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Curated catalog assets ship in Next `public/catalog` (edge CDN — fastest).
  if (trimmed.startsWith("/catalog/")) return trimmed;
  if (trimmed.startsWith("/product-images/")) return trimmed;

  const vps = trimmed.match(/\/refahston-media\/(.+)$/i);
  const path = vps?.[1]
    ? `/media/${vps[1]}`
    : trimmed.startsWith("/media/")
      ? trimmed
      : null;

  if (path?.startsWith("/media/catalog/")) {
    return `/catalog/${path.slice("/media/catalog/".length)}`;
  }

  if (path) return path;

  // Absolute https (wikimedia, etc.) — leave as-is
  return trimmed;
}

export function withPublicMediaUrl<T extends { image_url?: string | null }>(
  row: T
): T {
  return {
    ...row,
    image_url: toPublicMediaUrl(row.image_url ?? null),
  };
}
