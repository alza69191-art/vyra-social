import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الدعم الفني الخاص — VYRA",
  description: "تواصل مع فريق دعم VYRA وتابع طلبات المساعدة الخاصة بحسابك.",
  alternates: { canonical: "/support" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PrivateRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
