"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  orderId: string;
  /** اثرانگشت اولیه وضعیت سفارش از سرور */
  stamp: string;
};

/**
 * وقتی ادمین وضعیت را عوض می‌کند، بدون رفرش دستی صفحه مشتری به‌روز می‌شود.
 */
export function OrderLiveRefresh({ orderId, stamp }: Props) {
  const router = useRouter();
  const stampRef = useRef(stamp);

  useEffect(() => {
    stampRef.current = stamp;
  }, [stamp]);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;

    async function check() {
      if (stopped || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const res = await fetch(`/api/orders/${orderId}/live`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { stamp?: string };
        if (data.stamp && data.stamp !== stampRef.current) {
          stampRef.current = data.stamp;
          router.refresh();
        }
      } catch {
        // شبکه موقتاً قطع — بعداً دوباره چک می‌شود
      } finally {
        inFlight = false;
      }
    }

    const interval = window.setInterval(check, 4000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    void check();

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [orderId, router]);

  return (
    <p className="text-xs text-slate-400" aria-live="polite">
      وضعیت سفارش به‌صورت خودکار به‌روز می‌شود
    </p>
  );
}
