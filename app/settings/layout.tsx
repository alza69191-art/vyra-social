import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "إعدادات VYRA",
  description: "إدارة تفضيلات حسابك وإعدادات الأمان والخصوصية في VYRA.",
  alternates: { canonical: "/settings" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PrivateRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
