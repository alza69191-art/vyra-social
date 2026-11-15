"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import { createPost, getPublicPosts, uploadMedia } from "@/lib/vyra-api";
import { ArrowRight, Plus, Video, X } from "lucide-react";

type Reel={id:string;author_name:string;author_username:string;body:string|null;created_at:string;media:Array<{url:string;media_type:string}>};
function token(){return typeof window==="undefined"?"":sessionStorage.getItem("vyra_access_token")||""}
export default function ReelsPage(){return <AuthGate><Reels/></AuthGate>}
function Reels(){
 const [rows,setRows]=useState<Reel[]>([]),[show,setShow]=useState(false),[file,setFile]=useState<File|null>(null),[caption,setCaption]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 async function load(){const all=await getPublicPosts(80,0);setRows(all.filter((p:any)=>Array.isArray(p.media)&&p.media.some((m:any)=>m.media_type==="video")).map((p:any)=>({...p,media:p.media.filter((m:any)=>m.media_type==="video")})))}
 useEffect(()=>{load().catch(()=>setNotice("تعذر تحميل مقاطع ريلز."))},[]);
 useEffect(()=>{
  const videos=Array.from(document.querySelectorAll<HTMLVideoElement>(".vyra-reel-video"));
  if(!("IntersectionObserver" in window)){videos.forEach(v=>v.pause());return;}
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
   const video=entry.target as HTMLVideoElement;
   if(entry.isIntersecting&&entry.intersectionRatio>=0.65)video.play().catch(()=>undefined);
   else video.pause();
  }),{threshold:[0,0.65,1]});
  videos.forEach(v=>observer.observe(v));
  return()=>observer.disconnect();
 },[reels.length]);
 async function publish(e:React.FormEvent){e.preventDefault();if(!file||!token()||busy)return;setBusy(true);try{const post=await createPost(token(),caption,"public");const uploaded=await uploadMedia(token(),file,"post",post.id);if(uploaded.media_type!=="video")throw new Error("اختر ملف فيديو صالحاً.");setNotice("تم نشر الريلز.");setShow(false);setFile(null);setCaption("");await load()}catch(e){setNotice(e instanceof Error?e.message:"تعذر نشر الفيديو")}finally{setBusy(false)}}
 const reels=useMemo(()=>rows, [rows]);
 return <main dir="rtl" style={{minHeight:"100vh",background:"#0d1020",color:"#fff",padding:16}}><header style={{maxWidth:900,margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><Link href="/" style={{display:"inline-flex",gap:8,alignItems:"center",color:"#fff",textDecoration:"none"}}><ArrowRight size={18}/> العودة إلى VYRA</Link><b style={{letterSpacing:3}}>VYRA REELS</b><button onClick={()=>setShow(true)} style={action}><Plus size={17}/> إنشاء ريلز</button></header>{notice&&<p role="status" style={{textAlign:"center",color:"#d6d8ff"}}>{notice}</p>}
 <section style={{maxWidth:560,height:"calc(100vh - 90px)",minHeight:520,margin:"auto",overflowY:"auto",scrollSnapType:"y mandatory",borderRadius:22,background:"#171b35"}}>{reels.map((r)=><article key={r.id} style={{height:"100%",minHeight:520,position:"relative",scrollSnapAlign:"start",display:"grid",placeItems:"center",background:"#080a12"}}>{r.media.map((m,i)=><video className="vyra-reel-video" key={m.url+i} src={m.url} controls playsInline muted loop style={{width:"100%",height:"100%",objectFit:"contain"}}/>)}<div style={{position:"absolute",right:18,bottom:22,left:18,pointerEvents:"none",textShadow:"0 2px 10px #000"}}><b>{r.author_name||"عضو VYRA"}</b><p style={{margin:"7px 0",lineHeight:1.7}}>{r.body}</p><small style={{color:"#d1d2dc"}}>{new Date(r.created_at).toLocaleDateString("ar")}</small></div></article>)}{!reels.length&&<div style={{height:"100%",display:"grid",placeItems:"center",textAlign:"center",padding:30}}><div><Video size={45}/><h2>ابدأ مشاهدة الريلز</h2><p style={{color:"#a9adc7"}}>ستظهر هنا مقاطع الفيديو المنشورة للعامة. انشر أول مقطع لك.</p><button onClick={()=>setShow(true)} style={action}><Plus size={16}/> نشر أول ريلز</button></div></div>}</section>
 {show&&<div style={overlay} onClick={()=>setShow(false)}><form onSubmit={publish} onClick={e=>e.stopPropagation()} style={modal}><div style={{display:"flex",justifyContent:"space-between"}}><h2 style={{margin:0}}>إنشاء ريلز</h2><button type="button" onClick={()=>setShow(false)}><X/></button></div><p style={{color:"#7a809d",margin:"0 0 5px"}}>انشر فيديو قصيراً عاماً ليظهر في موجز الريلز.</p><label style={upload}>{file?.name||"اختيار فيديو"}<input hidden type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><textarea value={caption} onChange={e=>setCaption(e.target.value)} maxLength={2000} placeholder="اكتب وصف الفيديو (اختياري)" style={textarea}/><button disabled={!file||busy} style={action}>{busy?"جارٍ الرفع...":"نشر الريلز"}</button></form></div>}
 </main>
}
const action:React.CSSProperties={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 14px",border:0,borderRadius:11,background:"linear-gradient(120deg,#7165f5,#45b9e8)",color:"#fff",font:"inherit",cursor:"pointer"};
const overlay:React.CSSProperties={position:"fixed",inset:0,zIndex:90,background:"#050715bb",display:"grid",placeItems:"center",padding:16};
const modal:React.CSSProperties={width:"min(100%,480px)",display:"grid",gap:14,padding:22,borderRadius:20,background:"#fff",color:"#202541"};
const upload:React.CSSProperties={padding:18,border:"1px dashed #a9add0",borderRadius:12,textAlign:"center",cursor:"pointer"};
const textarea:React.CSSProperties={width:"100%",minHeight:100,padding:12,border:"1px solid #dfe3f0",borderRadius:12,font:"inherit"};
