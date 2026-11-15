"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGate from "@/components/auth-gate";
import { uploadMedia } from "@/lib/vyra-api";
import { ArrowRight, Store, Plus, ImagePlus, LockKeyhole } from "lucide-react";

const API=(process.env.NEXT_PUBLIC_API_URL||"https://vyra-api-9pxl.onrender.com").replace(/\/$/,"");
type Listing={id:string;title:string;description:string;price:number;currency:string;category:string;condition:string;media_url?:string|null;media_type?:string|null;seller_name:string;created_at:string};
function token(){return typeof window==="undefined"?"":sessionStorage.getItem("vyra_access_token")||""}
export default function CommunityMarketPage(){return <AuthGate><CommunityMarket/></AuthGate>}
function CommunityMarket(){
 const params=useParams<{id:string}>();const groupId=String(params.id||"");
 const [items,setItems]=useState<Listing[]>([]),[name,setName]=useState("سوق المجتمع"),[privacy,setPrivacy]=useState("public");
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[media,setMedia]=useState<File|null>(null);
 const [form,setForm]=useState({title:"",description:"",price:"",currency:"USD",category:"متنوع",condition:"new"});
 async function load(){const r=await fetch(API+"/api/groups/"+encodeURIComponent(groupId)+"/market/listings",{headers:{Authorization:"Bearer "+token()},cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.detail||"تعذر تحميل سوق المجتمع");setItems(d)}
 useEffect(()=>{if(!groupId)return;load().catch(e=>setNotice(e.message));},[groupId]);
 async function create(e:FormEvent){e.preventDefault();if(!token())return;setBusy(true);try{let media_url:string|undefined,media_type:string|undefined;if(media){const u=await uploadMedia(token(),media,"market");media_url=u.url;media_type=u.media_type}
 const r=await fetch(API+"/api/groups/"+encodeURIComponent(groupId)+"/market/listings",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token()},body:JSON.stringify({...form,price:Number(form.price),media_url,media_type})});
 const d=await r.json();if(!r.ok)throw new Error(d.detail||"تعذر نشر المنتج");setItems(v=>[d,...v]);setForm({title:"",description:"",price:"",currency:"USD",category:"متنوع",condition:"new"});setMedia(null);setShow(false);setNotice("تم نشر المنتج داخل سوق المجتمع.");}catch(e){setNotice(e instanceof Error?e.message:"حدث خطأ أثناء النشر")}finally{setBusy(false)}}
 return <main dir="rtl" style={{minHeight:"100vh",background:"#f4f6fc",padding:22,color:"#202541"}}><div style={{maxWidth:1050,margin:"auto"}}><Link href="/groups" style={{display:"inline-flex",alignItems:"center",gap:8,color:"#7165f5",textDecoration:"none"}}><ArrowRight size={17}/> العودة للمجتمعات</Link>
 <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",margin:"26px 0"}}><div><small style={{letterSpacing:2,color:"#7165f5",fontWeight:800}}>VYRA COMMUNITY COMMERCE</small><h1 style={{margin:"7px 0",fontSize:34}}>سوق المجتمع</h1><p style={{color:"#78809b",margin:0}}>مساحة بيع وشراء مرتبطة بالمجتمع، مع صلاحيات عضوية المجتمع.</p></div><button onClick={()=>setShow(true)} style={primary}><Plus size={17}/> إضافة منتج</button></header>
 {notice&&<p role="status" style={noticeStyle}>{notice}</p>}
 <div style={grid}>{items.map(x=><article key={x.id} style={card}>{x.media_url&&(x.media_type==="video"?<video controls src={x.media_url} style={mediaStyle}/>:<img src={x.media_url} alt="" style={mediaStyle}/>)}<div style={{padding:17}}><small style={{color:"#7165f5"}}>{x.category} · {x.condition==="new"?"جديد":x.condition==="used"?"مستعمل":"مجدد"}</small><h3>{x.title}</h3><p style={{color:"#78809b",lineHeight:1.8}}>{x.description}</p><strong style={{fontSize:20}}>{x.price.toLocaleString("en-US")} {x.currency}</strong><small style={{display:"block",marginTop:9,color:"#78809b"}}>بواسطة {x.seller_name}</small></div></article>)}</div>
 {items.length===0&&<section style={{...card,padding:35,textAlign:"center"}}><Store size={34}/><h2>السوق جاهز لمجتمعك</h2><p style={{color:"#78809b"}}>لم يضف الأعضاء منتجات بعد. ابدأ بإضافة أول منتج.</p></section>}
 {show&&<div style={overlay} onClick={()=>setShow(false)}><form onSubmit={create} onClick={e=>e.stopPropagation()} style={modal}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2>إضافة منتج إلى سوق المجتمع</h2><button type="button" onClick={()=>setShow(false)}>×</button></div><label>اسم المنتج<input required minLength={3} maxLength={140} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={field}/></label><label>الوصف<textarea required minLength={5} maxLength={4000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={field}/></label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><label>السعر<input required type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} style={field}/></label><label>العملة<select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})} style={field}><option>USD</option><option>ILS</option><option>EUR</option></select></label></div><label>التصنيف<input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={field}/></label><label>الحالة<select value={form.condition} onChange={e=>setForm({...form,condition:e.target.value})} style={field}><option value="new">جديد</option><option value="used">مستعمل</option><option value="refurbished">مجدد</option></select></label><label style={{display:"flex",alignItems:"center",gap:8,padding:12,border:"1px dashed #cbd0e5",borderRadius:12,cursor:"pointer"}}><ImagePlus size={20}/> {media?.name||"إرفاق صورة أو فيديو"}<input hidden type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={e=>setMedia(e.target.files?.[0]||null)}/></label><button disabled={busy} style={primary}>{busy?"جارٍ النشر...":"نشر المنتج في المجتمع"}</button><small style={{color:"#78809b",display:"flex",gap:6,alignItems:"center"}}><LockKeyhole size={14}/> النشر متاح للأعضاء النشطين فقط.</small></form></div>}
 </div></main>
}
const card:React.CSSProperties={background:"#fff",border:"1px solid #e4e8f3",borderRadius:18,overflow:"hidden",boxShadow:"0 12px 35px #252d4a0b"};
const grid:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(245px,1fr))",gap:16};
const mediaStyle:React.CSSProperties={width:"100%",height:190,objectFit:"cover",background:"#e9ebf5"};
const primary:React.CSSProperties={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,padding:"12px 18px",border:0,borderRadius:12,background:"linear-gradient(120deg,#7165f5,#45b9e8)",color:"#fff",font:"inherit",cursor:"pointer"};
const field:React.CSSProperties={display:"block",width:"100%",padding:11,border:"1px solid #dfe3f0",borderRadius:10,marginTop:6,font:"inherit",background:"#fff"};
const overlay:React.CSSProperties={position:"fixed",inset:0,zIndex:100,background:"#171b3580",display:"grid",placeItems:"center",padding:16};
const modal:React.CSSProperties={width:"min(100%,560px)",maxHeight:"90vh",overflow:"auto",display:"grid",gap:13,padding:22,borderRadius:20,background:"#fff",boxShadow:"0 25px 80px #1114"};
const noticeStyle:React.CSSProperties={padding:12,background:"#fff",borderRadius:10,color:"#7165f5"};
