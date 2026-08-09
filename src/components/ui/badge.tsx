import * as React from "react";
import { cn } from "@/lib/utils";

const Badge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "secondary" | "outline";
  }
>(({ className, variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
      variant === "default" &&
        "border-transparent bg-[var(--brand-blue)] text-white",
      variant === "secondary" && "border-transparent bg-slate-100 text-slate-800",
      variant === "outline" && "border-slate-200 text-slate-700",
      className
    )}
    {...props}
  />
));
Badge.displayName = "Badge";

export { Badge };
