import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { expireOverdueAwaitingOrders } from "@/lib/bale/order-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await expireOverdueAwaitingOrders();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
