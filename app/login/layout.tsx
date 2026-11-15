import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "تسجيل الدخول أو إنشاء حساب — VYRA",
  description: "افتح حسابك على VYRA بأمان، أو أنشئ حساباً جديداً باستخدام البريد الإلكتروني أو خيارات تسجيل الدخول المتاحة.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
