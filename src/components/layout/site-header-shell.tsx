"use client";

import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";

/** useSearchParams in header needs a Suspense boundary */
export function SiteHeaderWithSuspense() {
  return (
    <Suspense
      fallback={
        <header className="sticky top-0 z-40 h-16 border-b border-slate-200/80 bg-white/90" />
      }
    >
      <SiteHeader />
    </Suspense>
  );
}
