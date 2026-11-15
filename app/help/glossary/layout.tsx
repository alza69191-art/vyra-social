import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "قاموس مصطلحات VYRA للتواصل الاجتماعي",
  description: "قاموس عربي يشرح مصطلحات VYRA مثل المنشورات والتفاعل والمتابعة والمجتمعات والصفحات والخصوصية والوسائط.",
  alternates: { canonical: "/help/glossary" },
  openGraph: { type: "article", url: "/help/glossary", title: "قاموس مصطلحات VYRA", description: "تعريفات واضحة للمفاهيم المستخدمة في منصة VYRA.", locale: "ar_AR" },
  robots: { index: true, follow: true },
};

export default function GlossaryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
