import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VYRA — مجتمعك، عالمك، مساحتك",
  description: "VYRA منصة اجتماعية عصرية تجمع المجتمعات والمبدعين والتواصل في مساحة واحدة.",
  applicationName: "VYRA",
  icons: { icon: "/vyra-mark.svg" },
  verification: {
    google: "lZ0Zz3K7Cplr5vKpdXp-g1gPe5deSqvOt-g39D0oWaE",
    yandex: "aa714f864cca5c0e",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
