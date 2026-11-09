"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token) { router.replace("/login"); return; }
    setReady(true);
  }, [router]);
  if (!ready) return <main className="auth-loading" dir="rtl"><span className="brand-mark">V</span><p>جارٍ التحقق من جلسة الدخول...</p></main>;
  return <>{children}</>;
}
