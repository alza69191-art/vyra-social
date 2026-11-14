"use client";
import { FormEvent, useEffect, useState } from "react";
import { Github, Mail, X, ShieldCheck, Users, MessageCircle, Image as ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";

const API_BASE=(process.env.NEXT_PUBLIC_API_URL||"https://vyra-api-9pxl.onrender.com").replace(/\/$/,"");
export default function LoginPage(){
 const router=useRouter();
 const [mode,setMode]=useState<"login"|"signup">("login");
 const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [code,setCode]=useState("");
 const [verificationPending,setVerificationPending]=useState(false); const [busy,setBusy]=useState(false);
 const [error,setError]=useState(""); const [message,setMessage]=useState("");
 const [chooserOpen,setChooserOpen]=useState(false); const [emailOpen,setEmailOpen]=useState(false);
 useEffect(()=>{const value=new URLSearchParams(window.location.search).get("oauth_error");if(value){setError(value==="provider_not_configured"?"تسجيل الدخول الاجتماعي غير مهيأ بعد على الخادم.":value==="account_link_conflict"?"تعذر ربط هذا الحساب. تواصل مع الدعم.":"فشل تسجيل الدخول عبر المزود. حاول مرة أخرى.");setChooserOpen(true);}},[]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");setMessage("");
  try{const response=await fetch(API_BASE+"/api/auth/"+(mode==="signup"?"register":"login"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase(),password})});
   const data=await response.json().catch(()=>({}));if(!response.ok){if(mode==="signup"&&response.status===503){setVerificationPending(true);setMessage(data.detail||"تم إنشاء الحساب لكن تعذر إرسال رمز التحقق. أعد المحاولة.");return;}throw new Error(data.detail||"تعذر إكمال العملية.");}
   if(data.verification_required){setVerificationPending(true);setMessage("أرسلنا رمز تحقق إلى بريدك. أدخله لإكمال إنشاء الحساب.");return;}
   sessionStorage.setItem("vyra_access_token",data.access_token);sessionStorage.setItem("vyra_user",JSON.stringify(data.user));router.replace("/");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"تعذر الاتصال بالخادم.");}finally{setBusy(false);}
 }
 async function verifyEmail(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");
  try{const response=await fetch(API_BASE+"/api/auth/verify-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase(),code})});
   const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||"تعذر التحقق من الرمز.");
   sessionStorage.setItem("vyra_access_token",data.access_token);sessionStorage.setItem("vyra_user",JSON.stringify(data.user));router.replace("/");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"تعذر التحقق.");}finally{setBusy(false);}
 }
 async function resendCode(){setBusy(true);setError("");try{const response=await fetch(API_BASE+"/api/auth/resend-verification",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase()})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||"تعذر إرسال الرمز.");setMessage(data.message||"تم إرسال رمز جديد.");}catch(e){setError(e instanceof Error?e.message:"تعذر إرسال الرمز.");}finally{setBusy(false);}}
 return <main className="auth-page" dir="rtl">
  <header className="vyra-public-header"><div className="vyra-public-brand"><span className="brand-mark">V</span><b>VYRA</b></div><button className="vyra-public-login" onClick={()=>setChooserOpen(true)}>تسجيل الدخول</button></header>
  <section className="vyra-public-hero">
   <div className="vyra-hero-copy"><div className="vyra-hero-kicker"><Users size={15}/> مجتمعك الرقمي في مكان واحد</div>
    <h1>تواصل، شارك، واكتشف عالمك على <span>VYRA.</span></h1>
    <p>مساحة اجتماعية تجمع الأصدقاء والمجتمعات والقصص والرسائل في تجربة واحدة سهلة وسريعة، بهوية عصرية وألوان نابضة بالحياة.</p>
    <button className="vyra-public-login" onClick={()=>setChooserOpen(true)}>ابدأ الآن — تسجيل الدخول</button>
   </div>
   <div className="vyra-hero-visual" aria-hidden="true"><div className="vyra-social-preview"><div className="vyra-preview-top"><span className="vyra-preview-avatar"/><span className="vyra-preview-lines"><i/><i/></span></div><div className="vyra-preview-content"/><div className="vyra-preview-actions"><span><MessageCircle size={14}/> تفاعل</span><span><Users size={14}/> مجتمع</span><span><ImageIcon size={14}/> مشاركة</span></div></div></div>
  </section>
  {chooserOpen&&<div className="vyra-auth-modal" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget){setChooserOpen(false);setEmailOpen(false);}}}>
   <section className="vyra-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="vyra-auth-title">
    <button className="vyra-auth-close" aria-label="إغلاق" onClick={()=>{setChooserOpen(false);setEmailOpen(false);}}><X size={19}/></button>
    {!emailOpen?<><h2 id="vyra-auth-title">مرحباً بك في VYRA</h2><p>اختر الطريقة التي تفضّلها للدخول إلى حسابك أو إنشاء حساب جديد.</p>
     <div className="vyra-provider-list">
      <a className="vyra-provider" href={API_BASE+"/api/auth/oauth/google"}><b style={{color:"#4285F4",fontSize:19}}>G</b> المتابعة باستخدام Google</a>
      <a className="vyra-provider" href={API_BASE+"/api/auth/oauth/github"}><Github size={19}/> المتابعة باستخدام GitHub</a>
      <button className="vyra-provider vyra-provider-email" onClick={()=>setEmailOpen(true)}><Mail size={18}/> المتابعة بالبريد الإلكتروني</button>
     </div><small style={{display:"flex",alignItems:"center",gap:7,color:"#7b858d",fontSize:11}}><ShieldCheck size={15}/> خيارات تسجيل آمنة — لا تشارك كلمة مرورك مع أي جهة.</small>
    </>:<><button className="auth-back" onClick={()=>{setEmailOpen(false);setError("");setMessage("");}}>← طرق تسجيل الدخول</button>
     <section className="auth-card"><div className="auth-brand"><span className="brand-mark">V</span><b>VYRA</b></div>
      <h1>{verificationPending?"تأكيد البريد الإلكتروني":mode==="login"?"مرحباً بعودتك":"إنشاء حساب جديد"}</h1>
      <p>{verificationPending?"أدخل رمز التحقق المكوّن من 6 أرقام الذي أرسلناه إلى بريدك.":mode==="login"?"سجّل الدخول باستخدام بريدك الإلكتروني وكلمة المرور.":"أنشئ حسابك في VYRA وابدأ التواصل مع مجتمعك."}</p>
      {verificationPending?<form onSubmit={verifyEmail}><label>رمز التحقق<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"/></label>
       {error&&<div className="auth-error">{error}</div>}{message&&<div className="auth-message">{message}</div>}
       <button type="submit" disabled={busy||code.length!==6}>{busy?"جارٍ التحقق...":"تأكيد البريد الإلكتروني"}</button>
       <button type="button" className="auth-back" disabled={busy} onClick={resendCode}>إعادة إرسال الرمز</button>
       <button type="button" className="auth-back" onClick={()=>{setVerificationPending(false);setCode("");setMessage("");}}>العودة</button>
      </form>:<form onSubmit={submit}>
       <label>البريد الإلكتروني<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label>
       <label>كلمة المرور<input type="password" required minLength={10} maxLength={128} autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="10 أحرف على الأقل"/></label>
       {error&&<div className="auth-error">{error}</div>}{message&&<div className="auth-message">{message}</div>}
       <button type="submit" disabled={busy}>{busy?"يرجى الانتظار...":mode==="login"?"تسجيل الدخول":"إنشاء الحساب"}</button>
      </form>}
      {!verificationPending&&<button type="button" className="auth-back" disabled={busy} onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");setMessage("");}}>{mode==="login"?"ليس لديك حساب؟ إنشاء حساب":"لديك حساب بالفعل؟ تسجيل الدخول"}</button>}
      <small>كلمات المرور تُخزّن مشفّرة، ولا تُحفظ كنص مكشوف.</small>
     </section>
    </>}
   </section>
  </div>}
 </main>;
}
