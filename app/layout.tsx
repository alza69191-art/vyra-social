import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./vyra-nexus.css";
import "./payoneer-facebook.css";

export const metadata: Metadata = {
  title: {
    default: "VYRA — مساحتك الاجتماعية",
    template: "%s | VYRA",
  },
  description: "VYRA مساحة اجتماعية للتواصل والمشاركة واكتشاف المجتمعات.",
  applicationName: "VYRA",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "VYRA" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f6fc",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
