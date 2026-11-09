"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://vyra-api-9pxl.onrender.com").replace(/\/$/, "");

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/auth/${mode === "signup" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "تعذر إكمال العملية.");
      sessionStorage.setItem("vyra_access_token", data.access_token);
      sessionStorage.setItem("vyra_user", JSON.stringify(data.user));
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الاتصال بالخادم.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark">V</span><b>VYRA</b></div>
        <h1>{mode === "login" ? "مرحباً بعودتك" : "إنشاء حساب جديد"}</h1>
        <p>{mode === "login" ? "سجّل الدخول باستخدام بريدك الإلكتروني وكلمة المرور." : "أنشئ حسابك في VYRA وابدأ التواصل مع مجتمعك."}</p>
        <form onSubmit={submit}>
          <label>البريد الإلكتروني
            <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
          </label>
          <label>كلمة المرور
            <input type="password" required minLength={10} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="10 أحرف على الأقل" />
          </label>
          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-message">{message}</div>}
          <button type="submit" disabled={busy}>{busy ? "يرجى الانتظار..." : mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}</button>
        </form>
        <button type="button" className="auth-back" disabled={busy} onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>
          {mode === "login" ? "ليس لديك حساب؟ إنشاء حساب" : "لديك حساب بالفعل؟ تسجيل الدخول"}
        </button>
        <small>كلمات المرور تُخزّن مشفّرة، ولا تُحفظ كنص مكشوف.</small>
      </section>
    </main>
  );
}
