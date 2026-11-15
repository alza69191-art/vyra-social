import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الإشعارات — VYRA",
  description: "راجع التنبيهات والتحديثات المتعلقة بحسابك في VYRA.",
  alternates: { canonical: "/notifications" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PrivateRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
