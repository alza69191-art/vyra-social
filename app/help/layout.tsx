import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مركز مساعدة VYRA — دليل الاستخدام والأسئلة الشائعة",
  description: "دليل عربي لاستخدام VYRA: إنشاء الحساب، تسجيل الدخول، نشر المحتوى، التفاعل، المجتمعات، الصفحات، الخصوصية والأمان.",
  alternates: { canonical: "/help" },
  openGraph: { type: "article", url: "/help", title: "مركز مساعدة VYRA", description: "إجابات وإرشادات لاستخدام منصة VYRA الاجتماعية.", locale: "ar_AR" },
  robots: { index: true, follow: true },
};

export default function HelpLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
