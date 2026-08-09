import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/config";
import { notifyAdminNewOrder } from "@/lib/bale/order-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ ok: true, demo: true, skipped: true });
    }

    const body = (await req.json()) as { orderId?: string };
    const orderId = body.orderId?.trim();
    if (!orderId) {
      return NextResponse.json({ error: "orderId لازم است" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "وارد شوید" }, { status: 401 });
    }

    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!order || order.user_id !== user.id) {
      return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
    }

    const result = await notifyAdminNewOrder(orderId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطای داخلی" },
      { status: 500 }
    );
  }
}
