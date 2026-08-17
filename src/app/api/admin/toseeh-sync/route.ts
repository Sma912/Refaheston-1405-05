import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/config";
import { syncToseehFromTelegram } from "@/lib/toseeh/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "وارد شوید" }, { status: 401 }) };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "دسترسی ادمین لازم است" }, { status: 403 }) };
  }
  return { user };
}

/** همگام‌سازی دستی کانال تلگرام توسعه همراه → سایت + بله */
export async function POST(req: Request) {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { error: "در حالت دمو همگام‌سازی تلگرام غیرفعال است" },
        { status: 400 }
      );
    }

    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const body = (await req.json().catch(() => ({}))) as {
      postToBale?: boolean;
      channel?: string;
    };

    const result = await syncToseehFromTelegram({
      postToBale: body.postToBale !== false,
      channel: body.channel || "toseehhamrah",
      limit: 50,
    });

    return NextResponse.json({ ok: result.ok, result });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در همگام‌سازی" },
      { status: 500 }
    );
  }
}
