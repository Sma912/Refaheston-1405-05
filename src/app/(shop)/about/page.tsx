import { AboutPageClient } from "@/components/content/about-page-client";
import { getStoreSettings } from "@/lib/store/settings";

export const metadata = { title: "درباره ما" };

export default async function AboutPage() {
  const settings = await getStoreSettings();
  return <AboutPageClient initialSettings={settings} />;
}
