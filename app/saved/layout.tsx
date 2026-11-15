import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "المحفوظات — VYRA",
  description: "اعرض المنشورات التي حفظتها للرجوع إليها لاحقاً في VYRA.",
  alternates: { canonical: "/saved" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PrivateRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
