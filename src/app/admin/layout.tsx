import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, Package, ShoppingBag, Users, FileUp, ClipboardList } from "lucide-react";

const links = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard },
  { href: "/admin/products", label: "محصولات", icon: Package },
  { href: "/admin/products/import", label: "ورود کالا", icon: FileUp },
  { href: "/admin/orders", label: "سفارش‌ها", icon: ShoppingBag },
  { href: "/admin/users", label: "کاربران", icon: Users },
  { href: "/admin/imports", label: "لاگ واردات", icon: ClipboardList },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="رفاهستون" width={120} height={25} className="h-6 w-auto" />
            <span className="rounded-md bg-[var(--brand-blue)] px-2 py-0.5 text-xs font-medium text-white">
              ادمین
            </span>
          </div>
          <Link href="/" className="text-sm text-slate-600 hover:text-[var(--brand-blue)]">
            بازگشت به فروشگاه
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3">
          <nav className="flex flex-col gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-[var(--brand-blue)]"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
