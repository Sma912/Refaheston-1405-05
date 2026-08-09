import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "رفاهستون | فروشگاه موبایل",
    template: "%s | رفاهستون",
  },
  description:
    "فروشگاه اینترنتی رفاهستون — خرید گوشی موبایل با تأیید موجودی و پرداخت از طریق بله",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className={`${vazirmatn.variable} antialiased`}>
        {children}
        <Toaster richColors position="top-center" dir="rtl" />
      </body>
    </html>
  );
}
