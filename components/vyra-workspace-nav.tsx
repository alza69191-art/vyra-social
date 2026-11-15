"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home, MessageCircle, Clapperboard, Video, Radio, PlusCircle, Sparkles,
  UsersRound, Store, Compass, Bookmark, Bell, UserRound, Settings,
  CircleHelp, Headphones, ShieldCheck
} from "lucide-react";

const groups = [
  {
    title: "مساحة العمل",
    items: [
      { href: "/", label: "الرئيسية", icon: Home },
      { href: "/messages", label: "الرسائل", icon: MessageCircle },
      { href: "/notifications", label: "مركز التنبيهات", icon: Bell },
    ],
  },
  {
    title: "المحتوى والمجتمع",
    items: [
      { href: "/create", label: "إنشاء محتوى", icon: PlusCircle },
      { href: "/stories", label: "القصص", icon: Clapperboard },
      { href: "/reels", label: "ريلز", icon: Video },
      { href: "/channel", label: "قناتي", icon: Radio },
      { href: "/groups", label: "المجتمعات", icon: UsersRound },
      { href: "/pages", label: "الصفحات", icon: Compass },
      { href: "/friends", label: "الأصدقاء", icon: UserRound },
      { href: "/market", label: "السوق", icon: Store },
      { href: "/saved", label: "المحفوظات", icon: Bookmark },
    ],
  },
  {
    title: "الأدوات والإدارة",
    items: [
      { href: "/ai", label: "أدوات الذكاء الاصطناعي", icon: Sparkles },
      { href: "/ads", label: "الإعلانات", icon: Radio },
      { href: "/account", label: "حسابي", icon: UserRound },
      { href: "/settings", label: "الإعدادات", icon: Settings },
    ],
  },
];

export default function VyraWorkspaceNav() {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(Boolean(sessionStorage.getItem("vyra_access_token")));
  }, [pathname]);

  if (!authenticated || pathname === "/login" || pathname === "/help" || pathname.startsWith("/help/")) return null;

  return (
    <aside className="vyra-workspace-sidebar" dir="rtl" aria-label="قائمة VYRA الرئيسية">
      <Link href="/" className="vyra-sidebar-brand" aria-label="VYRA">
        <img src="/brand/vyra-logo.svg" alt="VYRA" />
      </Link>
      <div className="vyra-sidebar-account">
        <span className="vyra-sidebar-avatar">V</span>
        <span><b>مساحة VYRA</b><small>حسابك الشخصي</small></span>
        <ShieldCheck size={16} />
      </div>
      <nav className="vyra-sidebar-nav">
        {groups.map((group) => (
          <section className="vyra-sidebar-group" key={group.title}>
            <h2>{group.title}</h2>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
              return (
                <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </section>
        ))}
      </nav>
      <div className="vyra-sidebar-bottom">
        <Link href="/support"><Headphones size={18}/><span>مركز الدعم</span></Link>
        <small>VYRA · مساحة رقمية واحدة</small>
      </div>
    </aside>
  );
}
