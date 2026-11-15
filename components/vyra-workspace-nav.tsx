"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "الرئيسية" },
  { href: "/messages", label: "الرسائل" },
  { href: "/groups", label: "المجتمعات" },
  { href: "/market", label: "السوق" },
  { href: "/ai", label: "الذكاء الاصطناعي" },
  { href: "/notifications", label: "التنبيهات" },
  { href: "/account", label: "الحساب" },
  { href: "/settings", label: "الإعدادات" },
];

export default function VyraWorkspaceNav() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/login" || pathname === "/help" || pathname.startsWith("/help/")) return null;
  return (
    <div className="vyra-workspace-bar" dir="rtl">
      <Link href="/" className="vyra-workspace-logo" aria-label="VYRA">
        <img src="/brand/vyra-logo.svg" alt="VYRA" />
      </Link>
      <nav className="vyra-workspace-links" aria-label="التنقل داخل VYRA">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/")) ? "active" : ""}>
            {item.label}
          </Link>
        ))}
      </nav>
      <Link href="/support" className="vyra-workspace-support">الدعم</Link>
    </div>
  );
}
