import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_ORDERS } from "@/lib/demo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function stampOf(parts: Array<string | number | null | undefined>) {
  return parts.map((p) => (p == null ? "" : String(p))).join("|");
}

/** سبک برای polling صفحه جزئیات سفارش مشتری */
export async function GET(_req: Request, { params }: Props) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "شناسه نامعتبر" }, { status: 400 });
    }

    if (isDemoMode()) {
      const order = DEMO_ORDERS.find((o) => o.id === id);
      if (!order) {
        return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
      }
      return NextResponse.json({
        status: order.status,
        updated_at: order.updated_at,
        stamp: stampOf([
          order.status,
          order.updated_at,
          order.invoice_sent_at,
          order.payment_confirmed_at,
          order.payment_ref,
          order.tracking_number,
          0,
        ]),
      });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "وارد شوید" }, { status: 401 });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "status, updated_at, invoice_sent_at, payment_confirmed_at, payment_ref, tracking_number, payment_deadline_at, notes"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!order) {
      return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
    }

    const { count } = await supabase
      .from("order_notes")
      .select("*", { count: "exact", head: true })
      .eq("order_id", id);

    const notesCount = count ?? 0;
    return NextResponse.json({
      status: order.status,
      updated_at: order.updated_at,
      invoice_sent_at: order.invoice_sent_at,
      payment_confirmed_at: order.payment_confirmed_at,
      payment_ref: order.payment_ref,
      tracking_number: order.tracking_number,
      payment_deadline_at: order.payment_deadline_at,
      notes_count: notesCount,
      stamp: stampOf([
        order.status,
        order.updated_at,
        order.invoice_sent_at,
        order.payment_confirmed_at,
        order.payment_ref,
        order.tracking_number,
        order.notes,
        notesCount,
      ]),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 500 }
    );
  }
}
