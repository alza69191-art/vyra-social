import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "المكالمات — VYRA",
  description: "مساحة المكالمات والتواصل المباشر داخل VYRA.",
  alternates: { canonical: "/call" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PrivateRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
