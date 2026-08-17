"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingCart,
  User,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronDown,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCartStore } from "@/lib/cart/store";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_ADMIN } from "@/lib/demo/data";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types/database";

const PRODUCT_MENU = [
  { href: "/", label: "همه محصولات", cat: "" },
  { href: "/?cat=mobile", label: "موبایل", cat: "mobile" },
  {
    href: "/?cat=iphone-noreg",
    label: "آیفون بدون رجیستری",
    cat: "iphone-noreg",
  },
  {
    href: "/?cat=android-noreg",
    label: "اندروید بدون رجیستری",
    cat: "android-noreg",
  },
  { href: "/?cat=ipad", label: "آیپد", cat: "ipad" },
  { href: "/?cat=xiaomi-pad", label: "تبلت شیائومی", cat: "xiaomi-pad" },
  { href: "/?cat=console", label: "کنسول بازی", cat: "console" },
  { href: "/?cat=laptop", label: "لپ‌تاپ", cat: "laptop" },
  { href: "/?cat=tablet", label: "تبلت", cat: "tablet" },
  { href: "/?cat=accessory", label: "لوازم جانبی", cat: "accessory" },
  { href: "/?cat=audio", label: "صوتی و اسپیکر", cat: "audio" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalItems = useCartStore((s) =>
    s.items.reduce((n, i) => n + i.quantity, 0)
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const demo = isDemoMode();
  const dropRef = useRef<HTMLDivElement>(null);
  const activeCat = searchParams.get("cat") ?? "";

  useEffect(() => {
    let mounted = true;

    if (demo) {
      setProfile(DEMO_ADMIN);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (mounted) {
        setProfile(data);
        setLoading(false);
      }
    }

    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => load());

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, demo]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!dropRef.current?.contains(e.target as Node)) {
        setProductsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function logout() {
    if (demo) {
      router.push("/");
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    setProfile(null);
    router.push("/");
    router.refresh();
  }

  const otherNav = [
    { href: "/about", label: "درباره ما" },
    { href: "/orders", label: "سفارش‌های من" },
    { href: "/profile", label: "پروفایل" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/logo.png"
            alt="رفاهستون"
            width={160}
            height={33}
            className="h-8 w-auto"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <div className="relative" ref={dropRef}>
            <button
              type="button"
              onClick={() => setProductsOpen((v) => !v)}
              className={`inline-flex items-center gap-1 text-sm font-medium transition-colors ${
                pathname === "/"
                  ? "text-[var(--brand-red)]"
                  : "text-slate-600 hover:text-[var(--brand-blue)]"
              }`}
              aria-expanded={productsOpen}
            >
              محصولات
              <ChevronDown
                className={`h-4 w-4 transition ${productsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {productsOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {PRODUCT_MENU.map((item) => {
                  const active =
                    pathname === "/" &&
                    (item.cat ? activeCat === item.cat : !activeCat);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setProductsOpen(false)}
                      className={`block px-4 py-2.5 text-sm transition ${
                        active
                          ? "bg-slate-50 font-semibold text-[var(--brand-blue)]"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {otherNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "text-[var(--brand-red)]"
                  : "text-slate-600 hover:text-[var(--brand-blue)]"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {profile?.role === "admin" && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-blue)]"
            >
              <Shield className="h-4 w-4" />
              پنل ادمین
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/cart" className="relative rounded-lg p-2 hover:bg-slate-100">
            <ShoppingCart className="h-5 w-5 text-slate-700" />
            {totalItems > 0 && (
              <span className="absolute -left-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand-red)] px-1 text-[10px] font-bold text-white">
                {totalItems}
              </span>
            )}
          </Link>

          {!loading && profile ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="hidden sm:inline-flex"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </Button>
          ) : (
            !loading && (
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/login">
                  <User className="h-4 w-4" />
                  ورود
                </Link>
              </Button>
            )
          )}

          <button
            type="button"
            className="rounded-lg p-2 hover:bg-slate-100 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="منو"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setMobileProductsOpen((v) => !v)}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
            >
              محصولات
              <ChevronDown
                className={`h-4 w-4 transition ${mobileProductsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {mobileProductsOpen && (
              <div className="mb-1 mr-2 space-y-1 border-r border-slate-100 pr-2">
                {PRODUCT_MENU.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
            {otherNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
              >
                {item.label}
              </Link>
            ))}
            {profile?.role === "admin" && (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
              >
                پنل ادمین
              </Link>
            )}
            {profile ? (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="rounded-lg px-3 py-2 text-right text-sm text-rose-600 hover:bg-rose-50"
              >
                خروج
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
              >
                ورود / ثبت‌نام
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
