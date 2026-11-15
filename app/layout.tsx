import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./vyra-nexus.css";
import "./payoneer-facebook.css";
import "./vyra-brand.css";
import "./payoneer-inspired.css";
import "./vyra-final-theme.css";
import VyraWorkspaceNav from "@/components/vyra-workspace-nav";

export const metadata: Metadata = {
  metadataBase: new URL("https://vyra-web-rs1b.onrender.com"),
  title: {
    default: "VYRA — منصة اجتماعية للتواصل ومشاركة المحتوى",
    template: "%s | VYRA",
  },
  description: "اكتشف VYRA، منصة اجتماعية للتواصل مع الأصدقاء ومشاركة المنشورات والصور والفيديوهات والقصص والريلز واكتشاف المجتمعات.",
  alternates: { canonical: "/" },
  applicationName: "VYRA",
  keywords: ["VYRA", "منصة اجتماعية", "شبكة اجتماعية", "مشاركة الصور والفيديو", "مجتمعات رقمية", "تواصل اجتماعي"],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: "website",
    siteName: "VYRA",
    url: "/",
    title: "VYRA — منصتك الاجتماعية",
    description: "تواصل وشارك واكتشف مجتمعك على VYRA.",
    locale: "ar_AR",
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "VYRA" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ff4800",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body><VyraWorkspaceNav />{children}</body>
    </html>
  );
}
