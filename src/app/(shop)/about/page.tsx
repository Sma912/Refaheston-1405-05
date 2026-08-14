import { AboutPageClient } from "@/components/content/about-page-client";
import { getPublicStoreSettings } from "@/lib/store/settings";

export const metadata = { title: "درباره ما" };

export default async function AboutPage() {
  const settings = await getPublicStoreSettings();
  return <AboutPageClient initialSettings={settings} />;
}
