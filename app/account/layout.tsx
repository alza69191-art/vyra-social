import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "إعدادات الحساب والملف الشخصي — VYRA",
  description: "إدارة بيانات حساب VYRA وإعدادات الملف الشخصي والخصوصية.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PrivateRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
