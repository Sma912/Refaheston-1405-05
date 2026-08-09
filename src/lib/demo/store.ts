"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Order, Product, ProductImport, Profile } from "@/types/database";
import {
  DEMO_ADMIN,
  DEMO_IMPORTS,
  DEMO_ORDERS,
  DEMO_PRODUCTS,
  DEMO_USERS,
} from "@/lib/demo/data";
import {
  applySyncToProductList,
  buildProductSyncPlan,
  type ProductListScope,
  type ProductSyncStats,
} from "@/lib/products/sync";

interface DemoStore {
  products: Product[];
  orders: Order[];
  users: Profile[];
  imports: ProductImport[];
  seedVersion: number;
  setProducts: (products: Product[]) => void;
  upsertProducts: (products: Product[]) => void;
  syncFromChannelText: (
    rawText: string,
    forceScope?: ProductListScope | "auto"
  ) => ProductSyncStats;
  updateProductImage: (id: string, imageUrl: string) => void;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  setUserRole: (id: string, role: Profile["role"]) => void;
  addImport: (item: ProductImport) => void;
  reset: () => void;
}

const SEED_VERSION = 7;

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      products: DEMO_PRODUCTS,
      orders: DEMO_ORDERS,
      users: DEMO_USERS,
      imports: DEMO_IMPORTS,
      seedVersion: SEED_VERSION,
      setProducts: (products) => set({ products }),
      upsertProducts: (incoming) => {
        const map = new Map(
          get().products.map((p) => [
            `${p.brand}|${p.model}|${p.storage}|${p.ram}|${p.color}|${p.origin}`,
            p,
          ])
        );
        for (const p of incoming) {
          const key = `${p.brand}|${p.model}|${p.storage}|${p.ram}|${p.color}|${p.origin}`;
          const existing = map.get(key);
          map.set(
            key,
            existing
              ? {
                  ...existing,
                  ...p,
                  id: existing.id,
                  image_url: existing.image_url ?? p.image_url,
                }
              : p
          );
        }
        set({ products: [...map.values()] });
      },
      syncFromChannelText: (rawText, forceScope = "auto") => {
        const plan = buildProductSyncPlan(rawText, forceScope);
        const { products, stats } = applySyncToProductList(
          get().products,
          plan
        );
        set({
          products,
          imports: [
            {
              id: `demo-imp-${Date.now()}`,
              raw_text: rawText,
              parsed_count: stats.parsed,
              imported_by: "demo-admin-id",
              created_at: stats.stampedAt,
            },
            ...get().imports,
          ],
        });
        return stats;
      },
      updateProductImage: (id, imageUrl) =>
        set({
          products: get().products.map((p) =>
            p.id === id ? { ...p, image_url: imageUrl } : p
          ),
        }),
      updateOrder: (id, patch) =>
        set({
          orders: get().orders.map((o) =>
            o.id === id
              ? { ...o, ...patch, updated_at: new Date().toISOString() }
              : o
          ),
        }),
      setUserRole: (id, role) =>
        set({
          users: get().users.map((u) =>
            u.id === id ? { ...u, role } : u
          ),
        }),
      addImport: (item) => set({ imports: [item, ...get().imports] }),
      reset: () =>
        set({
          products: DEMO_PRODUCTS,
          orders: DEMO_ORDERS,
          users: DEMO_USERS,
          imports: DEMO_IMPORTS,
          seedVersion: SEED_VERSION,
        }),
    }),
    {
      name: "refahestoon-demo",
      version: SEED_VERSION,
      migrate: () => ({
        products: DEMO_PRODUCTS,
        orders: DEMO_ORDERS,
        users: DEMO_USERS,
        imports: DEMO_IMPORTS,
        seedVersion: SEED_VERSION,
      }),
    }
  )
);

export function getDemoAdminProfile(): Profile {
  return DEMO_ADMIN;
}
