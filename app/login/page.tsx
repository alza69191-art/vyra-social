"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email,setEmail] = useState("");
  const [code,setCode] = useState("");
  const [stage,setStage] = useState<"email"|"code">("email");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  async function submit(event:FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const auth = getSupabaseBrowserClient().auth;
      if (stage === "email") {
        const {error:sendError} = await auth.signInWithOtp({email:email.trim(), options:{shouldCreateUser:true}});
        if (sendError) throw sendError;
        setStage("code"); setMessage("أرسلنا رمز التحقق إلى بريدك الإلكتروني.");
      } else {
        const {error:verifyError} = await auth.verifyOtp({email:email.trim(),token:code.trim(),type:"email"});
        if (verifyError) throw verifyError;
        router.replace("/");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر إكمال تسجيل الدخول."); }
    finally { setBusy(false); }
  }
  return <main className="auth-page" dir="rtl">
    <section className="auth-card">
      <div className="auth-brand"><span className="brand-mark">V</span><b>VYRA</b></div>
      <h1>{stage==="email"?"مرحباً بك في VYRA":"تحقق من بريدك الإلكتروني"}</h1>
      <p>{stage==="email"?"سجّل الدخول أو أنشئ حساباً باستخدام بريدك الإلكتروني.":"أدخل رمز التحقق الذي وصلك عبر البريد الإلكتروني."}</p>
      <form onSubmit={submit}>
        <label>البريد الإلكتروني<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={stage==="code"} placeholder="name@example.com"/></label>
        {stage==="code"&&<label>رمز التحقق<input inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={8} value={code} onChange={e=>setCode(e.target.value)} placeholder="أدخل الرمز"/></label>}
        {error&&<div className="auth-error">{error}</div>}{message&&<div className="auth-message">{message}</div>}
        <button disabled={busy}>{busy?"يرجى الانتظار...":stage==="email"?"إرسال رمز التحقق":"تأكيد الرمز والدخول"}</button>
      </form>
      {stage==="code"&&<button className="auth-back" onClick={()=>{setStage("email");setCode("");setMessage("");}}>تغيير البريد الإلكتروني</button>}
      <small>بالمتابعة، أنت توافق على شروط استخدام VYRA.</small>
    </section>
  </main>;
}
