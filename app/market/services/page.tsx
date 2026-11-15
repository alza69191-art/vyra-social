"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import { ArrowRight, BriefcaseBusiness, CheckCircle2 } from "lucide-react";

const API=(process.env.NEXT_PUBLIC_API_URL||"https://vyra-api-9pxl.onrender.com").replace(/\/$/,"");
const labels:Record<string,string>={manual_transfer:"تحويل بنكي",paypal:"PayPal",payoneer:"Payoneer",cash_on_delivery:"الدفع عند الاستلام",card:"بطاقة بنكية"};
type Config={marketplace_enabled:boolean;user_service_publishing:boolean;admin_only_publishing:boolean;service_categories:string[];payment_methods:string[]};
function ServiceForm(){
 const [config,setConfig]=useState<Config|null>(null);const [form,setForm]=useState({title:"",description:"",price:"",currency:"USD",category:"",payment_methods:["manual_transfer"],image_url:""});
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 useEffect(()=>{fetch(API+"/api/marketplace/config",{cache:"no-store"}).then(r=>r.json()).then(setConfig).catch(()=>setError("تعذر تحميل إعدادات المتجر."));},[]);
 async function submit(e:FormEvent){e.preventDefault();const token=sessionStorage.getItem("vyra_access_token");if(!token){setError("انتهت الجلسة. سجّل الدخول مجدداً.");return;}setBusy(true);setError("");setNotice("");try{const r=await fetch(API+"/api/marketplace/products",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({...form,item_type:"service",price:Number(form.price)})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||"تعذر نشر الخدمة");setNotice(d.status==="pending"?"أُرسلت الخدمة للمراجعة قبل النشر.":"تم نشر خدمتك بنجاح.");setForm({...form,title:"",description:"",price:"",image_url:""});}catch(e){setError(e instanceof Error?e.message:"حدث خطأ");}finally{setBusy(false);}}
 const disabled=!config||!config.marketplace_enabled||config.admin_only_publishing||!config.user_service_publishing;
 return <main dir="rtl" className="service-publish"><header><Link href="/market"><ArrowRight size={17}/> العودة للسوق</Link><b>VYRA <span>MARKET</span></b></header><section className="publish-card"><div className="publish-icon"><BriefcaseBusiness size={27}/></div><small>مساحة المستقلين</small><h1>انشر خدمتك على <em>VYRA.</em></h1><p>اعرض مهارتك وحدد السعر والتصنيف وطرق الدفع المتاحة.</p>{error&&<div className="publish-alert error">{error}</div>}{notice&&<div className="publish-alert success"><CheckCircle2 size={17}/>{notice}</div>}
 {disabled?<div className="disabled-note">نشر الخدمات من حسابات المستخدمين متوقف حالياً بقرار من إدارة المنصة.</div>:<form onSubmit={submit}>
 <label>اسم الخدمة<input required minLength={3} maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="مثال: تصميم متجر إلكتروني"/></label>
 <label>وصف الخدمة<textarea required minLength={10} maxLength={10000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="اشرح ما الذي سيحصل عليه العميل..."/></label>
 <div className="two"><label>السعر<input required type="number" min="0.01" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label><label>العملة<select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option>USD</option><option>EUR</option><option>ILS</option><option>SAR</option><option>AED</option></select></label></div>
 <label>التصنيف<select required value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="">اختر التصنيف</option>{config?.service_categories?.map(c=><option key={c}>{c}</option>)}</select></label>
 <label>رابط صورة الخدمة (اختياري)<input type="url" value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})} placeholder="https://..."/></label>
 <div className="pay-label">طرق الدفع التي تقبلها</div><div className="pay-options">{config?.payment_methods?.map(m=><label key={m}><input type="checkbox" checked={form.payment_methods.includes(m)} onChange={()=>setForm({...form,payment_methods:form.payment_methods.includes(m)?form.payment_methods.filter(x=>x!==m):[...form.payment_methods,m]})}/>{labels[m]||m}</label>)}</div>
 <button disabled={busy||!form.payment_methods.length}>{busy?"جارٍ الإرسال...":"إرسال الخدمة للنشر"}</button></form>}
 </section></main>;
}
export default function Page(){return <AuthGate><ServiceForm/></AuthGate>;}
