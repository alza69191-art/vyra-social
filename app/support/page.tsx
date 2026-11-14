"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import { ArrowRight, Headset, Send, Plus, MessageCircle, ShieldAlert, FileWarning, LifeBuoy, Clock3, CheckCircle2, Search } from "lucide-react";

const API=(process.env.NEXT_PUBLIC_API_URL||"https://vyra-api-9pxl.onrender.com").replace(/\/+$/, "");
type Ticket={id:string;subject:string;status:string;last_message:string;created_at:string;updated_at?:string};
type Msg={id:string;sender_id:string;sender_role:string;message:string;created_at:string};
const categories=["استفسار عام","شكوى","إبلاغ عن منشور أو محتوى","إبلاغ عن حساب","مشكلة تقنية","الأمان والخصوصية","اقتراح أو ملاحظة"];

function SupportCenter(){
 const [tickets,setTickets]=useState<Ticket[]>([]);
 const [active,setActive]=useState<Ticket|null>(null);
 const [messages,setMessages]=useState<Msg[]>([]);
 const [category,setCategory]=useState(categories[0]);
 const [subject,setSubject]=useState("");
 const [reference,setReference]=useState("");
 const [draft,setDraft]=useState("");
 const [newMode,setNewMode]=useState(false);
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const token=()=>typeof window!=="undefined"?(sessionStorage.getItem("vyra_access_token")||""):"";
 const headers=()=>({Authorization:"Bearer "+token()});
 const load=useCallback(async()=>{const r=await fetch(API+"/api/support/tickets",{headers:headers(),cache:"no-store"});if(!r.ok)throw new Error("تعذر تحميل طلبات الدعم.");setTickets(await r.json())},[]);
 const open=useCallback(async(t:Ticket)=>{setActive(t);setNewMode(false);const r=await fetch(API+"/api/support/tickets/"+encodeURIComponent(t.id)+"/messages",{headers:headers(),cache:"no-store"});if(!r.ok)throw new Error("تعذر تحميل المحادثة.");setMessages(await r.json())},[]);
 useEffect(()=>{load().catch(e=>setNotice(e instanceof Error?e.message:"تعذر تحميل الطلبات."));const timer=window.setInterval(()=>{load().catch(()=>undefined);},15000);return()=>window.clearInterval(timer)},[load]);
 useEffect(()=>{if(!active)return;let live=true;const refresh=()=>fetch(API+"/api/support/tickets/"+encodeURIComponent(active.id)+"/messages",{headers:headers(),cache:"no-store"}).then(r=>r.ok?r.json():null).then(rows=>{if(live&&rows)setMessages(rows)}).catch(()=>undefined);refresh();const timer=window.setInterval(refresh,7000);return()=>{live=false;window.clearInterval(timer)}},[active?.id]);
 async function create(){if(!subject.trim()||!draft.trim()||busy)return;setBusy(true);try{const title="["+category+"] "+subject.trim();const body=draft.trim()+(reference.trim()?"\n\nرابط أو مرجع: "+reference.trim():"");const r=await fetch(API+"/api/support/tickets",{method:"POST",headers:{"Content-Type":"application/json",...headers()},body:JSON.stringify({subject:title,message:body})});const data=await r.json();if(!r.ok)throw new Error(data.detail||"تعذر إرسال الطلب.");setSubject("");setReference("");setDraft("");setNotice("وصل طلبك إلى فريق الدعم بشكل خاص.");await load();await open(data)}catch(e){setNotice(e instanceof Error?e.message:"حدث خطأ أثناء الإرسال.")}finally{setBusy(false)}}
 async function send(){if(!active||!draft.trim()||busy||active.status==="closed")return;setBusy(true);try{const r=await fetch(API+"/api/support/tickets/"+encodeURIComponent(active.id)+"/messages",{method:"POST",headers:{"Content-Type":"application/json",...headers()},body:JSON.stringify({message:draft.trim()})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.detail||"تعذر إرسال الرد.");setDraft("");const m=await fetch(API+"/api/support/tickets/"+encodeURIComponent(active.id)+"/messages",{headers:headers(),cache:"no-store"});if(m.ok)setMessages(await m.json());await load()}catch(e){setNotice(e instanceof Error?e.message:"تعذر إرسال الرد.")}finally{setBusy(false)}}
 function startNew(cat=categories[0]){setActive(null);setMessages([]);setNewMode(true);setCategory(cat);setSubject("");setReference("");setDraft("");}
 return <main dir="rtl" className="vyra-support-page">
  <div className="vyra-support-wrap">
   <header className="vyra-support-top"><Link href="/" className="vyra-support-back"><ArrowRight size={17}/> العودة إلى VYRA</Link><span className="vyra-support-brand">VYRA <b>CARE</b></span></header>
   <section className="vyra-support-hero"><div className="vyra-support-icon"><Headset size={27}/></div><div><small>مركز العناية بالمجتمع</small><h1>كيف يمكننا مساعدتك؟</h1><p>الاستفسارات والشكاوى والبلاغات تصل إلى فريق الدعم في محادثة خاصة لا يراها سواك وفريق الدعم المخوّل.</p></div></section>
   <div className="vyra-support-shortcuts">
    <button onClick={()=>startNew("شكوى")}><FileWarning/><b>تقديم شكوى</b><small>مشكلة أو تجربة تحتاج إلى مراجعة</small></button>
    <button onClick={()=>startNew("إبلاغ عن منشور أو محتوى")}><ShieldAlert/><b>الإبلاغ عن محتوى</b><small>محتوى مخالف أو مسيء أو مضلل</small></button>
    <button onClick={()=>startNew("إبلاغ عن حساب")}><LifeBuoy/><b>الإبلاغ عن حساب</b><small>انتحال أو مضايقة أو نشاط مشبوه</small></button>
   </div>
   {notice&&<div className="vyra-support-notice" role="status">{notice}<button onClick={()=>setNotice("")}>إغلاق</button></div>}
   <div className="vyra-support-layout">
    <aside className="vyra-support-card vyra-support-list"><div className="vyra-support-list-head"><div><b>طلباتي</b><small>سجل تواصلك مع الدعم</small></div><button onClick={()=>startNew()} aria-label="طلب جديد"><Plus size={18}/></button></div>
     <button className="vyra-support-new" onClick={()=>startNew()}><Plus size={17}/> إنشاء طلب جديد</button>
     {tickets.map(t=><button key={t.id} className={"vyra-support-ticket "+(active?.id===t.id?"selected":"")} onClick={()=>open(t).catch(e=>setNotice(e.message))}><span><b>{t.subject}</b><small>{t.last_message||"لا توجد رسائل"}</small></span><em className={t.status==="closed"?"closed":""}>{t.status==="closed"?"مغلقة":"مفتوحة"}</em></button>)}
     {!tickets.length&&<p className="vyra-support-empty">لا توجد طلبات بعد. يمكنك إنشاء طلب جديد في أي وقت.</p>}
    </aside>
    <section className="vyra-support-card vyra-support-thread">
     {newMode?<><div className="vyra-support-section-title"><div><small>رسالة خاصة</small><h2>إرسال طلب إلى الدعم</h2></div><span><ShieldAlert size={21}/></span></div>
      <label>نوع الطلب<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>عنوان الطلب<input value={subject} maxLength={140} onChange={e=>setSubject(e.target.value)} placeholder="اكتب عنواناً واضحاً"/></label>
      <label>رابط المحتوى أو الحساب (اختياري)<input dir="ltr" value={reference} onChange={e=>setReference(e.target.value)} placeholder="https://..."/></label>
      <label>التفاصيل<textarea value={draft} maxLength={5000} onChange={e=>setDraft(e.target.value)} placeholder="اشرح المشكلة أو سبب البلاغ، وأضف التفاصيل التي تساعدنا على المراجعة..." rows={7}/></label>
      <div className="vyra-support-form-foot"><small>{draft.length}/5000 · لا ترسل كلمات مرور أو رموز تحقق.</small><button disabled={busy||!subject.trim()||!draft.trim()} onClick={create}><Send size={16}/>{busy?"يتم الإرسال...":"إرسال بشكل خاص"}</button></div>
     </>:active?<><div className="vyra-support-section-title"><div><small>رقم الطلب · {active.id.slice(0,8)}</small><h2>{active.subject}</h2></div><span className={active.status==="closed"?"status-closed":"status-open"}>{active.status==="closed"?"مغلقة":"قيد المتابعة"}</span></div>
      <div className="vyra-support-messages">{messages.map(m=><article key={m.id} className={"vyra-support-message "+(m.sender_role==="support"?"from-support":"from-user")}><small>{m.sender_role==="support"?"فريق دعم VYRA":"أنت"} · {new Date(m.created_at).toLocaleString("ar")}</small><p>{m.message}</p></article>)}{!messages.length&&<p className="vyra-support-empty">لا توجد رسائل في هذا الطلب.</p>}</div>
      {active.status==="closed"?<p className="vyra-support-closed"><CheckCircle2 size={17}/> أُغلق هذا الطلب. أنشئ طلباً جديداً إذا احتجت إلى متابعة أخرى.</p>:<div className="vyra-support-reply"><textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={2} placeholder="اكتب ردك أو أضف معلومات جديدة..."/><button disabled={busy||!draft.trim()} onClick={send}><Send size={17}/> إرسال</button></div>}
     </>:<div className="vyra-support-welcome"><MessageCircle size={38}/><h2>تواصل مباشر وآمن</h2><p>اختر طلباً من القائمة أو ابدأ شكوى أو بلاغاً. ستصلك ردود فريق الدعم هنا، كما يظهر إشعار عند وصول رد جديد.</p><button onClick={()=>startNew()}><Plus size={17}/> ابدأ طلباً جديداً</button><small><Clock3 size={14}/> يمكنك متابعة حالة كل طلب من هذه الصفحة.</small></div>}
    </section>
   </div>
   <footer className="vyra-support-footer">VYRA · مركز المساعدة والدعم · حافظ على خصوصية بيانات الدخول</footer>
  </div>
  <style jsx>{`
   .vyra-support-page{min-height:100vh;background:var(--vyra-page,#f4f6fc);color:var(--vyra-text,#202433);padding:26px 18px 60px}
   .vyra-support-wrap{max-width:1120px;margin:auto}.vyra-support-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
   .vyra-support-back{display:inline-flex;align-items:center;gap:8px;color:var(--vyra-muted,#667085);text-decoration:none;font-weight:650}
   .vyra-support-brand{font-weight:900;letter-spacing:2px}.vyra-support-brand b{color:#e49a32}
   .vyra-support-hero{display:flex;align-items:center;gap:18px;margin:24px 0 18px;padding:26px;border-radius:22px;background:linear-gradient(115deg,#202b45,#344a70);color:#fff;box-shadow:0 16px 40px #192a471c}
   .vyra-support-icon{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;background:#ffffff1b;color:#f2b75e;flex:none}
   .vyra-support-hero small,.vyra-support-section-title small{color:#eab45e;font-weight:800}.vyra-support-hero h1{font-size:clamp(24px,4vw,34px);margin:5px 0}.vyra-support-hero p{margin:0;color:#e0e7f2;line-height:1.9;max-width:750px}
   .vyra-support-shortcuts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}
   .vyra-support-shortcuts button{display:grid;justify-items:start;gap:7px;text-align:right;padding:17px;border:1px solid var(--vyra-border,#e3e7ef);border-radius:16px;background:var(--vyra-card,#fff);color:inherit;cursor:pointer}
   .vyra-support-shortcuts svg{color:#d88d2c}.vyra-support-shortcuts small{color:var(--vyra-muted,#667085)}
   .vyra-support-notice{display:flex;justify-content:space-between;gap:12px;padding:12px 15px;margin:12px 0;border-radius:12px;background:#edf7f1;color:#176b42}.vyra-support-notice button{color:inherit;text-decoration:underline}
   .vyra-support-layout{display:grid;grid-template-columns:minmax(260px,.78fr) minmax(0,1.6fr);gap:14px}
   .vyra-support-card{background:var(--vyra-card,#fff);border:1px solid var(--vyra-border,#e3e7ef);border-radius:18px;padding:17px;box-shadow:0 8px 26px #18243b08}
   .vyra-support-list-head{display:flex;justify-content:space-between;align-items:center}.vyra-support-list-head small{display:block;color:var(--vyra-muted,#667085);margin-top:4px}.vyra-support-list-head button,.vyra-support-new{border-radius:10px;background:#263a5a;color:#fff;padding:9px 12px}
   .vyra-support-new{display:flex;align-items:center;gap:8px;width:100%;justify-content:center;margin:15px 0}
   .vyra-support-ticket{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:12px 9px;border-top:1px solid var(--vyra-border,#e3e7ef);text-align:right;color:inherit}
   .vyra-support-ticket.selected{background:var(--vyra-soft,#f2f5fa);border-radius:10px}.vyra-support-ticket span{min-width:0}.vyra-support-ticket b,.vyra-support-ticket small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vyra-support-ticket small{color:var(--vyra-muted,#667085);margin-top:5px;max-width:220px}.vyra-support-ticket em{font-size:11px;font-style:normal;color:#16824e;white-space:nowrap}.vyra-support-ticket em.closed{color:#8b93a3}
   .vyra-support-empty{color:var(--vyra-muted,#667085);line-height:1.9;font-size:13px}
   .vyra-support-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--vyra-border,#e3e7ef);padding-bottom:14px;margin-bottom:16px}.vyra-support-section-title h2{font-size:20px;margin:5px 0 0;overflow-wrap:anywhere}.vyra-support-section-title>span{font-size:12px;white-space:nowrap}.status-open{color:#16824e}.status-closed{color:#8992a3}
   .vyra-support-thread label{display:block;font-size:13px;font-weight:700;margin:14px 0}.vyra-support-thread input,.vyra-support-thread select,.vyra-support-thread textarea,.vyra-support-reply textarea{display:block;width:100%;margin-top:7px;border:1px solid var(--vyra-border,#dce2ec);border-radius:11px;padding:12px;background:var(--vyra-input,#fff);color:inherit;font:inherit;outline:none}.vyra-support-thread input:focus,.vyra-support-thread select:focus,.vyra-support-thread textarea:focus{border-color:#d99436;box-shadow:0 0 0 3px #d994361a}
   .vyra-support-form-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.vyra-support-form-foot small{color:var(--vyra-muted,#667085)}.vyra-support-form-foot button,.vyra-support-reply button,.vyra-support-welcome button{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border-radius:11px;background:linear-gradient(110deg,#eaa63e,#d47a25);color:#fff;font-weight:800}.vyra-support-form-foot button:disabled,.vyra-support-reply button:disabled{opacity:.5;cursor:not-allowed}
   .vyra-support-messages{min-height:290px;max-height:480px;overflow:auto;padding:4px 2px 14px}.vyra-support-message{max-width:88%;padding:12px 14px;border-radius:14px;margin:10px 0}.vyra-support-message.from-support{background:var(--vyra-soft,#f1f4f9);margin-left:auto}.vyra-support-message.from-user{background:#fff5e7;border:1px solid #f3dfc2;margin-right:auto}.vyra-support-message small{color:var(--vyra-muted,#667085)}.vyra-support-message p{white-space:pre-wrap;line-height:1.85;margin:6px 0 0}
   .vyra-support-reply{display:flex;align-items:end;gap:9px;border-top:1px solid var(--vyra-border,#e3e7ef);padding-top:12px}.vyra-support-reply textarea{resize:vertical;min-width:0}.vyra-support-reply button{flex:none}.vyra-support-closed{display:flex;align-items:center;gap:8px;color:#667085}
   .vyra-support-welcome{min-height:410px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--vyra-muted,#667085);padding:25px}.vyra-support-welcome>svg{color:#d88d2c}.vyra-support-welcome h2{color:var(--vyra-text,#202433);margin:14px 0 5px}.vyra-support-welcome p{max-width:500px;line-height:2}.vyra-support-welcome small{display:flex;align-items:center;gap:6px;margin-top:17px}
   .vyra-support-footer{text-align:center;color:var(--vyra-muted,#8992a3);font-size:12px;margin-top:22px}
   @media(max-width:760px){.vyra-support-layout{grid-template-columns:1fr}.vyra-support-shortcuts{grid-template-columns:1fr}.vyra-support-hero{align-items:flex-start;padding:20px}.vyra-support-hero-icon{display:none}.vyra-support-card{padding:13px}.vyra-support-reply{flex-direction:column;align-items:stretch}.vyra-support-reply button{width:100%}}
  `}</style>
 </main>
}
export default function SupportPage(){return <AuthGate><SupportCenter/></AuthGate>}
