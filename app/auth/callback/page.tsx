"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("جارٍ تأكيد تسجيل الدخول...");
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("access_token");
    if (!token) {
      setMessage("لم يصل رمز تسجيل الدخول. أعد المحاولة.");
      return;
    }
    sessionStorage.setItem("vyra_access_token", token);
    sessionStorage.removeItem("vyra_user");
    window.history.replaceState(null, "", "/auth/callback");
    router.replace("/");
    router.refresh();
  }, [router]);
  return <main className="auth-page" dir="rtl" style={{minHeight:"100vh",display:"grid",placeItems:"center"}}><section className="auth-card"><div className="auth-brand"><span className="brand-mark">V</span><b>VYRA</b></div><h1>{message}</h1></section></main>;
}
