"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import { ArrowRight, PhoneOff, LoaderCircle } from "lucide-react";

declare global { interface Window { JitsiMeetExternalAPI?: new (domain:string, options:Record<string,unknown>)=>{dispose:()=>void}; } }

export default function CallPage(){return <AuthGate><CallRoom/></AuthGate>}
function CallRoom(){
 const params=useParams<{room:string}>();
 const router=useRouter();
 const container=useRef<HTMLDivElement>(null);
 const api=useRef<{dispose:()=>void}|null>(null);
 const [status,setStatus]=useState("جارٍ تجهيز غرفة المكالمة...");
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let cancelled=false;
  const room=String(params.room||"").replace(/[^a-zA-Z0-9-]/g,"").slice(0,100);
  if(!room){setStatus("رابط المكالمة غير صالح.");setFailed(true);return;}
  const start=()=>{
   if(cancelled||!container.current||!window.JitsiMeetExternalAPI)return;
   try{
    const instance=new window.JitsiMeetExternalAPI("meet.jit.si",{
     roomName:room,
     parentNode:container.current,
     width:"100%",
     height:"100%",
     userInfo:{displayName:JSON.parse(sessionStorage.getItem("vyra_user")||"{}").display_name||"عضو VYRA"},
     configOverwrite:{prejoinPageEnabled:true,disableDeepLinking:true,enableWelcomePage:false},
     interfaceConfigOverwrite:{APP_NAME:"VYRA Calls",MOBILE_APP_PROMO:false,SHOW_JITSI_WATERMARK:false,SHOW_BRAND_WATERMARK:false},
    });
    api.current=instance;setStatus("المكالمة جاهزة. اسمح للمتصفح باستخدام الميكروفون والكاميرا.");
   }catch{setStatus("تعذر فتح غرفة المكالمة.");setFailed(true);}
  };
  if(window.JitsiMeetExternalAPI){start();}
  else{
   const script=document.createElement("script");
   script.src="https://meet.jit.si/external_api.js";script.async=true;
   script.onload=start;script.onerror=()=>{setStatus("تعذر تحميل خدمة المكالمات. حاول مرة أخرى.");setFailed(true);};
   document.body.appendChild(script);
  }
  return()=>{cancelled=true;api.current?.dispose();api.current=null;};
 },[params.room]);
 return <main dir="rtl" style={{minHeight:"100vh",background:"#17191f",color:"#fff",padding:16}}>
  <header style={{maxWidth:1200,margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
   <Link href="/messages" style={{display:"inline-flex",alignItems:"center",gap:8,color:"#fff",textDecoration:"none"}}><ArrowRight size={17}/> العودة إلى الرسائل</Link>
   <b style={{letterSpacing:2}}>VYRA CALLS</b>
   <button onClick={()=>{api.current?.dispose();router.push("/messages");}} style={{display:"inline-flex",alignItems:"center",gap:7,padding:"10px 14px",borderRadius:10,background:"#b42318",color:"#fff"}}><PhoneOff size={16}/> إنهاء المكالمة</button>
  </header>
  <p style={{maxWidth:1200,margin:"0 auto 10px",color:"#c5c7d0",fontSize:13}}>{status}</p>
  {failed&&<button onClick={()=>location.reload()} style={{display:"block",margin:"10px auto",padding:"9px 15px",borderRadius:9,background:"#fff",color:"#222"}}>إعادة المحاولة</button>}
  <div ref={container} style={{maxWidth:1200,height:"calc(100vh - 110px)",minHeight:480,margin:"auto",borderRadius:16,overflow:"hidden",background:"#242833"}}/>
  <p style={{maxWidth:1200,margin:"10px auto",fontSize:11,color:"#a8aab2"}}>تُدار المكالمة عبر خدمة Jitsi Meet العامة. لا تستخدم الغرفة لمناقشة معلومات حساسة؛ رابط الدعوة يمنح من يملكه إمكانية محاولة الانضمام.</p>
 </main>;
}
