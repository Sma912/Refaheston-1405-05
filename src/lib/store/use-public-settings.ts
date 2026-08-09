"use client";

import { useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demo/config";
import { useDemoStore } from "@/lib/demo/store";
import {
  DEFAULT_STORE_SETTINGS,
  type StoreSettings,
} from "@/lib/store/defaults";

export function usePublicStoreSettings(initial?: StoreSettings) {
  const demo = isDemoMode();
  const demoSettings = useDemoStore((s) => s.settings);
  const [settings, setSettings] = useState<StoreSettings>(
    initial ?? DEFAULT_STORE_SETTINGS
  );

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/store/settings");
        const payload = (await res.json()) as { settings?: StoreSettings };
        if (!cancelled && payload.settings) {
          setSettings({ ...DEFAULT_STORE_SETTINGS, ...payload.settings, id: 1 });
        }
      } catch {
        // keep initial
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo]);

  return demo ? demoSettings : settings;
}
