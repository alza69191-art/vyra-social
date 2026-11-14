import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./vyra-nexus.css";
import "./payoneer-facebook.css";
import "./vyra-theme.css";

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
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <Script id="vyra-theme-init" strategy="beforeInteractive">{`(function(){try{var raw=localStorage.getItem("vyra_preferences");var saved=raw?JSON.parse(raw):{};var preference=saved.theme==="dark"||saved.theme==="light"?saved.theme:"system";var dark=preference==="dark"||(preference==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.vyraTheme=dark?"dark":"light";}catch(_){document.documentElement.dataset.vyraTheme="light";}})();`}</Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
