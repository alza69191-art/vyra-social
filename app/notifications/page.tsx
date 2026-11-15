"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import {ArrowRight,Bell,CheckCheck,MessageCircle,Users,Heart,MessageSquare,Info} from "lucide-react";
const API=(process.env.NEXT_PUBLIC_API_URL||"https://vyra-api-9pxl.onrender.com").replace(/\/+$/, "");
type N={id:string;kind:string;target_id:string|null;read:boolean;created_at:string};
function Notifications(){
 const [rows,setRows]=useState<N[]>([]),[notice,setNotice]=useState("");
 const token=()=>sessionStorage.getItem("vyra_access_token")||"";
 async function load(){
  try{
   const r=await fetch(API+"/api/notifications",{headers:{Authorization:"Bearer "+token()},cache:"no-store"});
   if(!r.ok)throw new Error("تعذر تحميل الإشعارات");
   setRows(await r.json());setNotice("");
  }catch{setNotice("تعذر تحميل الإشعارات. تحقق من الاتصال ثم أعد المحاولة.");}
 }
 useEffect(()=>{void load();const t=window.setInterval(()=>void load(),15000);return()=>window.clearInterval(t)},[]);
 async function markAll(){
  try{const r=await fetch(API+"/api/notifications/read-all",{method:"PUT",headers:{Authorization:"Bearer "+token()}});if(!r.ok)throw new Error();await load();}
  catch{setNotice("تعذر تحديث حالة الإشعارات.");}
 }
 const label=(k:string)=>k==="support_reply"?"رد جديد من الدعم الفني":k==="support_new_ticket"?"طلب دعم جديد":k==="support_message"?"رسالة جديدة في تذكرة الدعم":k==="friend_request"?"طلب صداقة جديد":k==="friend_accepted"?"تم قبول طلب الصداقة":k==="message"?"رسالة جديدة":k==="like"?"تفاعل جديد":k==="comment"?"تعليق جديد":"تحديث جديد في VYRA";
 const Icon=({kind}:{kind:string})=>kind.startsWith("support_")?<MessageCircle size={18}/>:kind.startsWith("friend_")?<Users size={18}/>:kind==="like"?<Heart size={18}/>:kind==="comment"?<MessageSquare size={18}/>:<Info size={18}/>;
 return <main className="vyra-notifications" dir="rtl">
  <div className="vyra-notifications-wrap">
   <Link href="/" className="vyra-notifications-back"><ArrowRight size={16}/> العودة إلى VYRA</Link>
   <header className="vyra-notifications-head"><div className="vyra-notifications-title"><span><Bell size={23}/></span><div><small>مركز التنبيهات</small><h1>الإشعارات</h1><p>تابع ردود الدعم والتحديثات المهمة في حسابك.</p></div></div><button className="vyra-notifications-mark" onClick={markAll}><CheckCheck size={16}/> تحديد الكل كمقروء</button></header>
   {notice&&<p className="vyra-notifications-alert" role="status">{notice}</p>}
   <section className="vyra-notifications-list">
    {rows.map(n=><Link key={n.id} href={n.kind.startsWith("support_")?"/support":n.kind.startsWith("ad_")?"/ads":n.kind.startsWith("friend_")?"/friends":"/"} onClick={()=>{if(!n.read)fetch(API+"/api/notifications/"+n.id+"/read",{method:"PUT",headers:{Authorization:"Bearer "+token()}}).catch(()=>undefined)}} className={"vyra-notification "+(n.read?"is-read":"is-unread")}><span className="vyra-notification-icon"><Icon kind={n.kind}/></span><span className="vyra-notification-copy"><b>{label(n.kind)}</b><small>{new Date(n.created_at).toLocaleString("ar")}</small></span>{!n.read&&<i aria-label="غير مقروء"/>}</Link>)}
    {!rows.length&&!notice&&<div className="vyra-notifications-empty"><span><Bell size={25}/></span><b>لا توجد إشعارات حالياً</b><p>ستظهر هنا ردود فريق الدعم والتحديثات الجديدة.</p></div>}
   </section>
  </div>
 </main>
}
export default function Page(){return <AuthGate><Notifications/></AuthGate>}
