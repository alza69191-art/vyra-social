import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VYRA — Your world, in one place",
  description: "A new space for people, creators and communities.",
  applicationName: "VYRA",
  icons: { icon: "/vyra-mark.svg" },
  verification: {
    google: "lZ0Zz3K7Cplr5vKpdXp-g1gPe5deSqvOt-g39D0oWaE",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
