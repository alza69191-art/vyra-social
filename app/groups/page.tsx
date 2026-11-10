"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";

const API = (process.env.NEXT_PUBLIC_API_URL || "https://vyra-api-9pxl.onrender.com").replace(/\/$/, "");
type Group = {id:string;name:string;description:string|null;members:number};
export default function GroupsPage(){return <AuthGate><Groups /></AuthGate>}
function Groups(){
 const [items,setItems]=useState<Group[]>([]),[name,setName]=useState(""),[description,setDescription]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 async function load(){const r=await fetch(API+"/api/groups");if(!r.ok)throw new Error("تعذر تحميل المجتمعات");setItems(await r.json())}
 useEffect(()=>{load().catch(e=>setNotice(e.message))},[]);
 async function create(e:FormEvent){e.preventDefault();const token=sessionStorage.getItem("vyra_access_token");if(!token)return;setBusy(true);try{const r=await fetch(API+"/api/groups",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({name,description,privacy:"public"})});const d=await r.json();if(!r.ok)throw new Error(d.detail||"تعذر إنشاء المجتمع");setName("");setDescription("");await load();setNotice("تم إنشاء المجتمع");}catch(e){setNotice(e instanceof Error?e.message:"حدث خطأ")}finally{setBusy(false)}}
 async function join(id:string){const token=sessionStorage.getItem("vyra_access_token");if(!token)return;const r=await fetch(API+"/api/groups/"+id+"/join",{method:"POST",headers:{Authorization:"Bearer "+token}});const d=await r.json();setNotice(r.ok?(d.joined?"أنت عضو في هذا المجتمع":"تعذر الانضمام"):d.detail||"تعذر الانضمام")}
 return <main dir="rtl" style={{minHeight:"100vh",background:"#fff",color:"#000",padding:24}}><section style={{maxWidth:850,margin:"auto"}}><Link href="/" style={{color:"#000"}}>← العودة إلى VYRA</Link><h1>المجتمعات</h1><p>أنشئ مجتمعاً عاماً أو انضم إلى مجتمعات الأعضاء.</p><form onSubmit={create} style={{display:"grid",gap:10,border:"1px solid #000",padding:18,borderRadius:12}}><h2>إنشاء مجتمع</h2><input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="اسم المجتمع" style={field}/><textarea maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="وصف المجتمع" style={field}/><button disabled={busy} style={button}>{busy?"جارٍ الإنشاء...":"إنشاء المجتمع"}</button></form><h2>اكتشف المجتمعات</h2><div style={{display:"grid",gap:12}}>{items.map(g=><article key={g.id} style={{border:"1px solid #000",borderRadius:12,padding:16}}><h3>{g.name}</h3><p>{g.description||"لا يوجد وصف."}</p><small>{g.members} أعضاء</small><button onClick={()=>join(g.id)} style={button}>انضمام</button></article>)}</div>{notice&&<p role="status">{notice}</p>}</section></main>
}
const field={padding:12,border:"1px solid #000",borderRadius:8,background:"#fff",color:"#000",font:"inherit"} as const;
const button={padding:"10px 16px",background:"#000",color:"#fff",border:0,borderRadius:8,cursor:"pointer",marginTop:10} as const;
