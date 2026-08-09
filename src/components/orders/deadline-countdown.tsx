"use client";

import { useEffect, useState } from "react";
import {
  formatCountdown,
  msRemaining,
} from "@/lib/orders/note-templates";

export function DeadlineCountdown({
  label,
  deadlineAt,
  warnMs = 2 * 60 * 1000,
}: {
  label: string;
  deadlineAt: string | null | undefined;
  warnMs?: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = msRemaining(deadlineAt, now);
  if (remaining == null) return null;

  const expired = remaining <= 0;
  const warn = !expired && remaining <= warnMs;

  return (
    <div
      className={`rounded-xl px-3 py-2 text-sm ${
        expired
          ? "bg-rose-50 text-rose-800"
          : warn
            ? "bg-amber-50 text-amber-900"
            : "bg-sky-50 text-sky-900"
      }`}
    >
      <span className="font-medium">{label}: </span>
      <span dir="ltr" className="font-mono font-bold">
        {expired ? "تمام شد" : formatCountdown(remaining)}
      </span>
    </div>
  );
}
