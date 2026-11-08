import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "VYRA — Your world, in one place",
  description: "A new space for people, creators and communities.",
  applicationName: "VYRA",
  icons: { icon: "/vyra-mark.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
