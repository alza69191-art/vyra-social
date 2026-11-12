"use client";
import { FormEvent, useEffect, useState } from "react";
import { Github } from "lucide-react";
import { useRouter } from "next/navigation";

const API_BASE=(process.env.NEXT_PUBLIC_API_URL||"https://vyra-api-9pxl.onrender.com").replace(/\/$/,"");
export default function LoginPage(){
 const router=useRouter();
 const [mode,setMode]=useState<"login"|"signup">("login");
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [code,setCode]=useState("");
 const [verificationPending,setVerificationPending]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 useEffect(()=>{const value=new URLSearchParams(window.location.search).get("oauth_error");if(value)setError(value==="provider_not_configured"?"تسجيل الدخول الاجتماعي غير مهيأ بعد على الخادم.":value==="account_link_conflict"?"تعذر ربط هذا الحساب. تواصل مع الدعم.":"فشل تسجيل الدخول عبر المزود. حاول مرة أخرى.");},[]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch(API_BASE+"/api/auth/"+(mode==="signup"?"register":"login"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase(),password})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok){if(mode==="signup"&&response.status===503){setVerificationPending(true);setMessage(data.detail||"تم إنشاء الحساب لكن تعذر إرسال رمز التحقق. أعد المحاولة.");return;}throw new Error(data.detail||"تعذر إكمال العملية.");}
   if(data.verification_required){setVerificationPending(true);setMessage("أرسلنا رمز تحقق إلى بريدك. أدخله لإكمال إنشاء الحساب.");return;}
   sessionStorage.setItem("vyra_access_token",data.access_token);sessionStorage.setItem("vyra_user",JSON.stringify(data.user));router.replace("/");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"تعذر الاتصال بالخادم.");}finally{setBusy(false);}
 }
 async function verifyEmail(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");
  try{
   const response=await fetch(API_BASE+"/api/auth/verify-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase(),code})});
   const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||"تعذر التحقق من الرمز.");
   sessionStorage.setItem("vyra_access_token",data.access_token);sessionStorage.setItem("vyra_user",JSON.stringify(data.user));router.replace("/");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"تعذر التحقق.");}finally{setBusy(false);}
 }
 async function resendCode(){
  setBusy(true);setError("");
  try{const response=await fetch(API_BASE+"/api/auth/resend-verification",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase()})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||"تعذر إرسال الرمز.");setMessage(data.message||"تم إرسال رمز جديد.");}
  catch(e){setError(e instanceof Error?e.message:"تعذر إرسال الرمز.");}finally{setBusy(false);}
 }
 return <main className="auth-page" dir="rtl"><section className="auth-card">
  <div className="auth-brand"><span className="brand-mark">V</span><b>VYRA</b></div>
  <h1>{verificationPending?"تأكيد البريد الإلكتروني":mode==="login"?"مرحباً بعودتك":"إنشاء حساب جديد"}</h1>
  <p>{verificationPending?"أدخل رمز التحقق المكوّن من 6 أرقام الذي أرسلناه إلى بريدك.":mode==="login"?"سجّل الدخول باستخدام بريدك الإلكتروني وكلمة المرور.":"أنشئ حسابك في VYRA وابدأ التواصل مع مجتمعك."}</p>
  {!verificationPending&&<div style={{display:"grid",gap:10,margin:"18px 0"}}>
   <a href={API_BASE+"/api/auth/oauth/google"} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:13,border:"1px solid #dfe2ef",borderRadius:12,color:"#25294b",background:"#fff",fontWeight:700,textDecoration:"none"}}><span style={{fontWeight:900,color:"#4285F4"}}>G</span> المتابعة باستخدام Google</a>
   <a href={API_BASE+"/api/auth/oauth/github"} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:13,border:"1px solid #dfe2ef",borderRadius:12,color:"#25294b",background:"#fff",fontWeight:700,textDecoration:"none"}}><Github size={19}/> المتابعة باستخدام GitHub</a>
  </div>}
  {!verificationPending&&<div style={{display:"flex",alignItems:"center",gap:12,color:"#8990a8",fontSize:12,margin:"8px 0 16px"}}><span style={{height:1,background:"#e6e8f0",flex:1}}/>أو بالبريد الإلكتروني<span style={{height:1,background:"#e6e8f0",flex:1}}/></div>}
  {verificationPending?<form onSubmit={verifyEmail}>
   <label>رمز التحقق<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"/></label>
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
 </section></main>;
}
