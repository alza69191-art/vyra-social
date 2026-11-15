import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "تسجيل الدخول أو إنشاء حساب — VYRA",
  description: "سجّل الدخول إلى حساب VYRA أو أنشئ حساباً جديداً.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
