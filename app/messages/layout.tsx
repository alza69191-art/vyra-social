import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الرسائل الخاصة — VYRA",
  description: "افتح محادثاتك الخاصة وتابع تواصلك مع أعضاء VYRA.",
  alternates: { canonical: "/messages" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PrivateRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
