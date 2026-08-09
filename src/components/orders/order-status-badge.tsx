import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/utils/order-status";
import type { OrderStatus } from "@/types/database";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium",
        ORDER_STATUS_COLORS[status]
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
