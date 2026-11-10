"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
const API=(process.env.NEXT_PUBLIC_API_URL||"https://vyra-api-9pxl.onrender.com").replace(/\/$/,"");
type Page={id:string;name:string;description:string|null;category:string|null;followers:number};
export default function PagesPage(){return <AuthGate><Pages /></AuthGate>}
function Pages(){
 const [items,setItems]=useState<Page[]>([]),[name,setName]=useState(""),[description,setDescription]=useState(""),[category,setCategory]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 async function load(){const r=await fetch(API+"/api/pages");if(!r.ok)throw new Error("تعذر تحميل الصفحات");setItems(await r.json())}
 useEffect(()=>{load().catch(e=>setNotice(e.message))},[]);
 async function create(e:FormEvent){e.preventDefault();const token=sessionStorage.getItem("vyra_access_token");if(!token)return;setBusy(true);try{const r=await fetch(API+"/api/pages",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({name,description,category})});const d=await r.json();if(!r.ok)throw new Error(d.detail||"تعذر إنشاء الصفحة");setName("");setDescription("");setCategory("");await load();setNotice("تم إنشاء الصفحة");}catch(e){setNotice(e instanceof Error?e.message:"حدث خطأ")}finally{setBusy(false)}}
 async function follow(id:string){const token=sessionStorage.getItem("vyra_access_token");if(!token)return;const r=await fetch(API+"/api/pages/"+id+"/follow",{method:"POST",headers:{Authorization:"Bearer "+token}});const d=await r.json();setNotice(r.ok?(d.following?"تمت متابعة الصفحة":"تم إلغاء المتابعة"):d.detail||"تعذر تنفيذ الطلب");}
 return <main dir="rtl" style={{minHeight:"100vh",background:"#fff",color:"#000",padding:24}}><section style={{maxWidth:850,margin:"auto"}}><Link href="/" style={{color:"#000"}}>← العودة إلى VYRA</Link><h1>الصفحات</h1><p>أنشئ صفحة عامة لعلامتك أو مشروعك أو محتواك.</p><form onSubmit={create} style={{display:"grid",gap:10,border:"1px solid #000",padding:18,borderRadius:12}}><h2>إنشاء صفحة</h2><input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="اسم الصفحة" style={field}/><input maxLength={60} value={category} onChange={e=>setCategory(e.target.value)} placeholder="التصنيف" style={field}/><textarea maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="وصف الصفحة" style={field}/><button disabled={busy} style={button}>{busy?"جارٍ الإنشاء...":"إنشاء الصفحة"}</button></form><h2>الصفحات العامة</h2><div style={{display:"grid",gap:12}}>{items.map(p=><article key={p.id} style={{border:"1px solid #000",borderRadius:12,padding:16}}><h3>{p.name}</h3><p>{p.description||"لا يوجد وصف."}</p><small>{p.category||"عام"} · {p.followers} متابع</small><button onClick={()=>follow(p.id)} style={button}>متابعة / إلغاء المتابعة</button></article>)}</div>{notice&&<p role="status">{notice}</p>}</section></main>
}
const field={padding:12,border:"1px solid #000",borderRadius:8,background:"#fff",color:"#000",font:"inherit"} as const;
const button={padding:"10px 16px",background:"#000",color:"#fff",border:0,borderRadius:8,cursor:"pointer",marginTop:10} as const;
