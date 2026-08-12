/** Upload / public URL helpers for VPS-hosted product media. */

export function mediaBaseUrl(): string {
  return (
    process.env.MEDIA_BASE_URL ||
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
    "http://62.220.123.167/refahston-media"
  ).replace(/\/$/, "");
}

export function mediaPublicUrl(relPath: string): string {
  const rel = relPath.replace(/^\/+/, "");
  return `${mediaBaseUrl()}/${rel}`;
}

export async function uploadMediaFile(
  relPath: string,
  bytes: Buffer | Uint8Array,
  contentType = "application/octet-stream"
): Promise<string> {
  const uploadUrl = (
    process.env.MEDIA_UPLOAD_URL ||
    "http://62.220.123.167/refahston-media-api/upload"
  ).replace(/\/$/, "");
  const secret = process.env.MEDIA_UPLOAD_SECRET?.trim();
  if (!secret) {
    throw new Error("MEDIA_UPLOAD_SECRET is not set");
  }
  const rel = relPath.replace(/^\/+/, "");
  const res = await fetch(
    `${uploadUrl}?path=${encodeURIComponent(rel)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": contentType,
      },
      body: bytes as BodyInit,
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`media upload ${res.status}: ${text.slice(0, 200)}`);
  }
  return mediaPublicUrl(rel);
}

export async function mirrorRemoteImageToMedia(
  sourceUrl: string,
  relPath: string
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RefahestonMedia/1.0)",
        Accept: "image/*,*/*",
      },
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/jpeg";
    return await uploadMediaFile(relPath, buf, ct);
  } catch {
    return null;
  }
}
