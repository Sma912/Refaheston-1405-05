/**
 * احراز هویت کرون‌های Vercel — فقط Bearer CRON_SECRET.
 * Vercel هنگام وجود CRON_SECRET خودش Authorization را می‌فرستد.
 */
export function authorizeCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("[cron] CRON_SECRET is not configured");
    return false;
  }
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}
