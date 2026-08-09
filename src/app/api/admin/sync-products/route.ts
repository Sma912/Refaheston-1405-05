import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/config";
import { createClient } from "@/lib/supabase/server";
import { syncProductsFromChannelText } from "@/lib/products/sync-server";
import type { ProductListScope } from "@/lib/products/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      rawText?: string;
      forceScope?: ProductListScope | "auto";
    };

    const rawText = body.rawText?.trim() ?? "";
    if (!rawText) {
      return NextResponse.json(
        { error: "متن کانال خالی است" },
        { status: 400 }
      );
    }

    if (isDemoMode()) {
      return NextResponse.json(
        {
          error:
            "در حالت دمو همگام‌سازی از کلاینت انجام می‌شود؛ این API برای حالت واقعی است.",
          demo: true,
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "وارد شوید" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "دسترسی ادمین لازم است" }, { status: 403 });
    }

    const stats = await syncProductsFromChannelText({
      rawText,
      importedBy: user.id,
      forceScope: body.forceScope ?? "auto",
    });

    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در همگام‌سازی" },
      { status: 500 }
    );
  }
}
