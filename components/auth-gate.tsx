"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (!data.session) router.replace("/login");
      else setReady(true);
    }).catch(() => router.replace("/login"));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
      else if (alive) setReady(true);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [router]);
  if (!ready) return <main className="auth-loading" dir="rtl"><span className="brand-mark">V</span><p>جارٍ التحقق من جلسة الدخول...</p></main>;
  return <>{children}</>;
}
