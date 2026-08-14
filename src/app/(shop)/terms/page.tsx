import { TermsPageClient } from "@/components/content/terms-page-client";
import { getPublicStoreSettings } from "@/lib/store/settings";

export const metadata = { title: "شرایط اختصاصی" };

export default async function TermsPage() {
  const settings = await getPublicStoreSettings();
  return <TermsPageClient initialSettings={settings} />;
}
