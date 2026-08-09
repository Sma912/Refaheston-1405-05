import { TermsPageClient } from "@/components/content/terms-page-client";
import { getStoreSettings } from "@/lib/store/settings";

export const metadata = { title: "شرایط اختصاصی" };

export default async function TermsPage() {
  const settings = await getStoreSettings();
  return <TermsPageClient initialSettings={settings} />;
}
