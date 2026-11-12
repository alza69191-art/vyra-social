"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import { uploadMedia } from "@/lib/vyra-api";

const API=(process.env.NEXT_PUBLIC_API_URL||"https://vyra-api-9pxl.onrender.com").replace(/\/$/,"");
type Story={id:string;author_id:string;author_name:string;media_url:string;media_type:"image"|"video";caption:string|null;views_count:number;expires_at:string;viewed:boolean};
export default function StoriesPage(){return <AuthGate><Stories/></AuthGate>}
function Stories(){
 const [rows,setRows]=useState<Story[]>([]),[file,setFile]=useState<File|null>(null),[caption,setCaption]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const token=()=>sessionStorage.getItem("vyra_access_token")||"";
 async function load(){const r=await fetch(API+"/api/stories",{headers:{Authorization:"Bearer "+token()},cache:"no-store"});if(r.ok)setRows(await r.json())}
 useEffect(()=>{load().catch(()=>setNotice("تعذر تحميل القصص"))},[]);
 async function publish(){if(!file||busy)return;setBusy(true);setNotice("جارٍ رفع القصة...");try{const media=await uploadMedia(token(),file,"story");const r=await fetch(API+"/api/stories",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token()},body:JSON.stringify({media_url:media.url,media_type:media.media_type==="video"?"video":"image",caption})});const d=await r.json();if(!r.ok)throw new Error(d.detail||"تعذر نشر القصة");setFile(null);setCaption("");setNotice("تم نشر القصة. ستختفي بعد 24 ساعة.");await load()}catch(e){setNotice(e instanceof Error?e.message:"تعذر نشر القصة")}finally{setBusy(false)}}
 async function view(s:Story){try{const r=await fetch(API+"/api/stories/"+s.id+"/view",{method:"POST",headers:{Authorization:"Bearer "+token()}});const d=await r.json();if(r.ok)setRows(v=>v.map(x=>x.id===s.id?{...x,views_count:d.views_count,viewed:true}:x))}catch{}}
 return <main dir="rtl" style={{minHeight:"100vh",background:"#f5f4f1",padding:24,color:"#24211d"}}><div style={{maxWidth:950,margin:"auto"}}><Link href="/" style={{color:"#956b36"}}>← العودة للرئيسية</Link><h1 style={{fontSize:32}}>القصص</h1><p style={{color:"#777"}}>شارك صورة أو فيديو لمدة 24 ساعة، وتابع عدد المشاهدات.</p><section style={card}><h2>إنشاء قصة</h2><input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={e=>setFile(e.target.files?.[0]||null)}/><textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="أضف وصفاً للقصة (اختياري)" style={input}/><button disabled={!file||busy} onClick={publish} style={button}>{busy?"جارٍ النشر...":"نشر القصة"}</button>{notice&&<p>{notice}</p>}</section><h2>القصص المتاحة</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>{rows.map(s=><article key={s.id} style={card} onClick={()=>view(s)}><b>{s.author_name}</b>{s.media_type==="video"?<video src={s.media_url} controls style={media}/>:<img src={s.media_url} alt="قصة" style={media}/>}<p>{s.caption}</p><small>المشاهدات: {s.views_count} · تنتهي: {new Date(s.expires_at).toLocaleString("ar")}</small></article>)}</div>{rows.length===0&&<p style={{color:"#888"}}>لا توجد قصص حالياً.</p>}</div></main>
}
const card:React.CSSProperties={background:"#fff",border:"1px solid #e9e4dc",borderRadius:16,padding:18,marginBottom:16};
const input:React.CSSProperties={display:"block",width:"100%",minHeight:75,margin:"12px 0",padding:12,border:"1px solid #ddd",borderRadius:10,font:"inherit"};
const button:React.CSSProperties={background:"#24211d",color:"#fff",padding:"11px 20px",border:0,borderRadius:10,cursor:"pointer"};
const media:React.CSSProperties={width:"100%",maxHeight:380,objectFit:"contain",borderRadius:12,marginTop:12,background:"#111"};
