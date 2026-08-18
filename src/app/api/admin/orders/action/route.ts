import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/config";
import {
  expireOverdueAwaitingOrders,
  runOrderAction,
  type OrderAction,
} from "@/lib/bale/order-flow";
import type { OrderStatus } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set<OrderAction>([
  "approve_invoice",
  "confirm_payment",
  "mark_preparing",
  "mark_shipped",
  "mark_delivered",
  "cancel",
  "send_note",
  "revert_status",
]);

export async function POST(req: Request) {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { error: "در حالت دمو از ذخیره محلی استفاده کنید", demo: true },
        { status: 400 }
      );
    }

    // پاک‌سازی مهلت‌گذشته قبل از اقدام ادمین
    try {
      await expireOverdueAwaitingOrders();
    } catch (err) {
      console.error("expire before action", err);
    }

    const body = (await req.json()) as {
      orderId?: string;
      action?: string;
      notes?: string | null;
      templateKey?: string | null;
      confirmedAmount?: number | null;
      shippingAmount?: number | null;
      paymentRef?: string | null;
      trackingNumber?: string | null;
      paymentSheba?: string | null;
      paymentCardNumber?: string | null;
      paymentCardHolder?: string | null;
      targetStatus?: string | null;
      notifyCustomer?: boolean;
    };

    const orderId = body.orderId?.trim();
    const action = body.action as OrderAction | undefined;

    if (!orderId || !action || !ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "orderId و action معتبر لازم است" },
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

    const result = await runOrderAction({
      orderId,
      action,
      notes: body.notes,
      templateKey: body.templateKey,
      confirmedAmount: body.confirmedAmount,
      shippingAmount: body.shippingAmount,
      paymentRef: body.paymentRef,
      trackingNumber: body.trackingNumber,
      paymentSheba: body.paymentSheba,
      paymentCardNumber: body.paymentCardNumber,
      paymentCardHolder: body.paymentCardHolder,
      targetStatus: (body.targetStatus as OrderStatus | null | undefined) ?? null,
      notifyCustomer: body.notifyCustomer !== false,
      adminUserId: user.id,
    });

    const baleFailed = result.bale && result.bale.ok === false;

    return NextResponse.json({
      ok: true,
      order: result.order,
      bale: result.bale,
      warning: baleFailed
        ? "وضعیت سایت به‌روز شد ولی ارسال پیام بله ناموفق بود"
        : undefined,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطای داخلی" },
      { status: 500 }
    );
  }
}
