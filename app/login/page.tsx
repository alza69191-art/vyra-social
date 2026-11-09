"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";

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
      const auth = getSupabaseBrowserClient().auth;
      const cleanEmail = email.trim();
      if (mode === "signup") {
        const { data, error: authError } = await auth.signUp({
          email: cleanEmail,
          password,
        });
        if (authError) throw authError;
        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setMessage("تم إنشاء الحساب. إذا كان تأكيد البريد مفعّلاً، افتح رسالة التأكيد ثم سجّل الدخول.");
        }
      } else {
        const { error: authError } = await auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (authError) throw authError;
        router.replace("/");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إكمال العملية.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark">V</span><b>VYRA</b></div>
        <h1>{mode === "login" ? "مرحباً بعودتك" : "إنشاء حساب جديد"}</h1>
        <p>{mode === "login" ? "سجّل الدخول باستخدام بريدك الإلكتروني وكلمة المرور." : "أنشئ حسابك في VYRA باستخدام بريدك الإلكتروني وكلمة المرور."}</p>
        <form onSubmit={submit}>
          <label>
            البريد الإلكتروني
            <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
          </label>
          <label>
            كلمة المرور
            <input type="password" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" />
          </label>
          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-message">{message}</div>}
          <button type="submit" disabled={busy}>{busy ? "يرجى الانتظار..." : mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}</button>
        </form>
        <button
          type="button"
          className="auth-back"
          disabled={busy}
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}
        >
          {mode === "login" ? "ليس لديك حساب؟ إنشاء حساب" : "لديك حساب بالفعل؟ تسجيل الدخول"}
        </button>
        <small>بالمتابعة، أنت توافق على شروط استخدام VYRA.</small>
      </section>
    </main>
  );
}
