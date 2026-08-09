import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getStoreSettings } from "@/lib/store/settings";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getStoreSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
        {children}
      </main>
      <SiteFooter initialSettings={settings} />
    </div>
  );
}
