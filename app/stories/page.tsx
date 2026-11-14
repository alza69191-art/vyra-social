"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import { uploadMedia } from "@/lib/vyra-api";
import { ArrowLeft, ArrowRight, Camera, Check, Clock3, ImagePlus, Loader2, Play, Plus, X } from "lucide-react";

const API=(process.env.NEXT_PUBLIC_API_URL||"https://vyra-api-9pxl.onrender.com").replace(/\/+$/, "");
const IMAGE_LIMIT=15*1024*1024;
const VIDEO_LIMIT=100*1024*1024;
type Story={id:string;author_id:string;author_name:string;username?:string;avatar_url?:string|null;media_url:string;media_type:"image"|"video";caption:string|null;views_count:number;expires_at:string;created_at:string;viewed:boolean};
type StoryGroup={authorId:string;authorName:string;avatar:string|null;stories:Story[]};

function StoriesPageInner(){
 const [rows,setRows]=useState<Story[]>([]);
 const [file,setFile]=useState<File|null>(null);
 const [caption,setCaption]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [previewUrl,setPreviewUrl]=useState("");
 const [viewer,setViewer]=useState<{group:number;item:number}|null>(null);
 const [progressKey,setProgressKey]=useState(0);
 const token=()=>typeof window!=="undefined"?(sessionStorage.getItem("vyra_access_token")||""):"";
 const groups=useMemo<StoryGroup[]>(()=>{
  const map=new Map<string,StoryGroup>();
  for(const story of rows){
   const key=story.author_id;
   if(!map.has(key))map.set(key,{authorId:key,authorName:story.author_name||"عضو VYRA",avatar:story.avatar_url||null,stories:[]});
   map.get(key)!.stories.push(story);
  }
  return Array.from(map.values());
 },[rows]);
 const current=viewer?groups[viewer.group]?.stories[viewer.item]:undefined;
 const load=useCallback(async()=>{
  const r=await fetch(API+"/api/stories",{headers:{Authorization:"Bearer "+token()},cache:"no-store"});
  if(!r.ok)throw new Error("تعذر تحميل القصص. تحقق من الاتصال ثم أعد المحاولة.");
  setRows(await r.json());
 },[]);
 useEffect(()=>{load().catch(e=>setNotice(e instanceof Error?e.message:"تعذر تحميل القصص."));},[load]);
 useEffect(()=>{if(!file){setPreviewUrl("");return}const url=URL.createObjectURL(file);setPreviewUrl(url);return()=>URL.revokeObjectURL(url)},[file]);
 const closeViewer=useCallback(()=>setViewer(null),[]);
 const advance=useCallback((direction:number)=>{
  setViewer(current=>{
   if(!current)return null;
   const group=groups[current.group];
   const nextItem=current.item+direction;
   if(group&&nextItem>=0&&nextItem<group.stories.length)return {group:current.group,item:nextItem};
   const nextGroup=current.group+direction;
   if(nextGroup<0||nextGroup>=groups.length)return null;
   const nextStories=groups[nextGroup].stories;
   return {group:nextGroup,item:direction>0?0:Math.max(0,nextStories.length-1)};
  });
 },[groups]);
 useEffect(()=>{
  if(!current||current.media_type==="video")return;
  const timer=window.setTimeout(()=>advance(1),6000);
  return()=>window.clearTimeout(timer);
 },[current?.id,progressKey,advance]);
 useEffect(()=>{
  if(!current)return;
  const headers={Authorization:"Bearer "+token()};
  fetch(API+"/api/stories/"+encodeURIComponent(current.id)+"/view",{method:"POST",headers})
   .then(r=>r.ok?r.json():null)
   .then(data=>{if(data)setRows(items=>items.map(s=>s.id===current.id?{...s,views_count:data.views_count,viewed:true}:s))})
   .catch(()=>undefined);
 },[current?.id]);
 useEffect(()=>{
  if(!viewer)return;
  const key=(event:KeyboardEvent)=>{if(event.key==="Escape")closeViewer();if(event.key==="ArrowLeft")advance(1);if(event.key==="ArrowRight")advance(-1)};
  window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
 },[viewer,advance,closeViewer]);
 function selectFile(next:File|null){
  if(!next){setFile(null);return}
  const image=next.type.startsWith("image/");
  const video=next.type.startsWith("video/");
  if(!image&&!video){setNotice("اختر صورة أو فيديو بصيغة مدعومة.");return}
  if(image&&(!["image/jpeg","image/png","image/webp","image/gif"].includes(next.type)||next.size>IMAGE_LIMIT)){setNotice("الصورة يجب أن تكون JPG أو PNG أو WEBP أو GIF وبحجم لا يتجاوز 15 MB.");return}
  if(video&&(!["video/mp4","video/webm","video/quicktime"].includes(next.type)||next.size>VIDEO_LIMIT)){setNotice("الفيديو يجب أن يكون MP4 أو WEBM أو MOV وبحجم لا يتجاوز 100 MB.");return}
  setNotice("");setFile(next);
 }
 async function publish(){
  if(!file||busy)return;
  setBusy(true);setNotice("يتم رفع الوسائط...");
  try{
   const media=await uploadMedia(token(),file,"story");
   if(!media.url.startsWith("https://"))throw new Error("رابط الوسائط غير آمن.");
   const r=await fetch(API+"/api/stories",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token()},body:JSON.stringify({media_url:media.url,media_type:media.media_type==="video"?"video":"image",caption:caption.trim()||null})});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(data.detail||"تعذر نشر القصة.");
   setFile(null);setCaption("");setNotice("تم نشر قصتك وستبقى متاحة لمدة 24 ساعة.");await load();
  }catch(e){setNotice(e instanceof Error?e.message:"تعذر نشر القصة.");}
  finally{setBusy(false)}
 }
 return <main className="vyra-stories" dir="rtl">
  <div className="story-shell">
   <header className="story-header"><Link href="/" className="story-back"><ArrowRight size={17}/> العودة للرئيسية</Link><div className="story-wordmark">VYRA <span>STORIES</span></div><span className="story-header-note">لحظاتك، لمدة 24 ساعة</span></header>
   <section className="story-hero"><div><span className="story-eyebrow"><Clock3 size={14}/> قصص تختفي تلقائياً</span><h1>شارك لحظتك الآن.</h1><p>انشر صورة أو فيديو، شاهد قصص مجتمعك، وتابع عدد المشاهدات.</p></div><div className="story-hero-icon"><Camera size={34}/></div></section>
   <div className="story-columns">
    <section className="story-create-card">
     <div className="story-section-title"><div><small>ابدأ المشاركة</small><h2>إنشاء قصة جديدة</h2></div><span className="story-plus"><Plus size={19}/></span></div>
     <label className="story-upload-zone">
      {file?<div className="story-preview">{file.type.startsWith("video/")?<video src={previewUrl} controls/>:<img src={previewUrl} alt="معاينة القصة"/>}<span>{file.name}</span></div>:<><ImagePlus size={31}/><b>اختر صورة أو فيديو</b><small>JPG · PNG · WEBP · GIF · MP4 · WEBM · MOV</small><small>حتى 15 MB للصورة و100 MB للفيديو</small></>}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={e=>selectFile(e.target.files?.[0]||null)} hidden/>
     </label>
     <label className="story-caption-label">أضف وصفاً <span>اختياري</span><textarea value={caption} maxLength={500} onChange={e=>setCaption(e.target.value)} placeholder="اكتب شيئاً يرافق لحظتك..." rows={3}/></label>
     <div className="story-create-footer"><small>{caption.length}/500</small><button disabled={!file||busy} onClick={publish}>{busy?<><Loader2 size={16} className="story-spin"/> جارٍ الرفع</>:<><Plus size={16}/> نشر القصة</>}</button></div>
     {notice&&<p className="story-notice" role="status">{notice}</p>}
     <div className="story-privacy-note"><Check size={15}/> تنتهي القصة تلقائياً بعد 24 ساعة. لا تشارك معلومات حساسة.</div>
    </section>
    <section className="story-feed-card">
     <div className="story-section-title"><div><small>من مجتمع VYRA</small><h2>القصص المتاحة</h2></div><span className="story-count">{rows.length} قصة</span></div>
     {groups.length===0?<div className="story-empty"><div><Play size={25}/></div><b>لا توجد قصص حالياً</b><p>كن أول من يشارك لحظته اليوم.</p></div>:<div className="story-grid">{groups.map((group,index)=>{const unseen=group.stories.some(s=>!s.viewed);return <button key={group.authorId} className="story-person" onClick={()=>{setViewer({group:index,item:Math.max(0,group.stories.findIndex(s=>!s.viewed))});setProgressKey(v=>v+1)}}><span className={"story-avatar-ring "+(unseen?"unseen":"seen")}><span className="story-avatar-inner">{group.avatar?<img src={group.avatar} alt=""/>:group.authorName.slice(0,1)}</span></span><b>{group.authorName}</b><small>{group.stories.length} قصة</small></button>})}</div>}
     <div className="story-feed-tip"><Clock3 size={15}/> القصص مرتبة حسب أحدث نشاط، وتُحذف من العرض عند انتهاء صلاحيتها.</div>
    </section>
   </div>
  </div>
  {viewer&&current&&<div className="story-viewer" role="dialog" aria-modal="true" aria-label="عارض القصص" onClick={closeViewer}>
   <button className="story-viewer-close" onClick={closeViewer} aria-label="إغلاق"><X/></button>
   <button className="story-nav story-nav-prev" onClick={e=>{e.stopPropagation();advance(-1);setProgressKey(v=>v+1)}} aria-label="القصة السابقة"><ArrowRight/></button>
   <article className="story-viewer-card" onClick={e=>e.stopPropagation()}>
    <div className="story-progress">{groups[viewer.group].stories.map((s,i)=><span key={s.id}><i className={i<viewer.item?"done":i===viewer.item?"current":""}/></span>)}</div>
    <header><span className="story-viewer-avatar">{groups[viewer.group].avatar?<img src={groups[viewer.group].avatar} alt=""/>:groups[viewer.group].authorName.slice(0,1)}</span><div><b>{groups[viewer.group].authorName}</b><small>{new Date(current.created_at).toLocaleString("ar")}</small></div><span className="story-view-count"><EyeIcon/> {current.views_count}</span></header>
    <div className="story-viewer-media">{current.media_type==="video"?<video key={current.id} src={current.media_url} autoPlay playsInline controls onEnded={()=>advance(1)}/>:<img src={current.media_url} alt={current.caption||"قصة"}/>}</div>
    {current.caption&&<p className="story-viewer-caption">{current.caption}</p>}
   </article>
   <button className="story-nav story-nav-next" onClick={e=>{e.stopPropagation();advance(1);setProgressKey(v=>v+1)}} aria-label="القصة التالية"><ArrowLeft/></button>
  </div>}
  <style jsx>{`
   .vyra-stories{min-height:100vh;background:#f5f6f8;color:#171b25;padding:22px 18px 60px}.story-shell{max-width:1100px;margin:auto}.story-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 0 22px;border-bottom:1px solid #e4e7ec}.story-back{display:flex;align-items:center;gap:7px;text-decoration:none;color:#586174;font-weight:700;font-size:13px}.story-wordmark{font:900 18px Arial;letter-spacing:2px;color:#18243a}.story-wordmark span{font-size:9px;letter-spacing:2px;color:#d49a45;margin-right:5px}.story-header-note{font-size:11px;color:#8790a0}.story-hero{display:flex;align-items:center;justify-content:space-between;margin:24px 0 18px;padding:26px 30px;border-radius:22px;background:linear-gradient(115deg,#1d2c48,#344d73);color:#fff}.story-eyebrow{display:flex;align-items:center;gap:7px;color:#f0bf72;font-weight:800;font-size:11px}.story-hero h1{font-size:clamp(26px,4vw,36px);margin:8px 0}.story-hero p{margin:0;color:#e0e6ef;font-size:13px}.story-hero-icon{width:66px;height:66px;border-radius:20px;display:grid;place-items:center;background:#ffffff18;color:#f2bd6a}.story-columns{display:grid;grid-template-columns:minmax(290px,.9fr) minmax(0,1.3fr);gap:16px;align-items:start}.story-create-card,.story-feed-card{background:#fff;border:1px solid #e5e8ee;border-radius:19px;padding:20px;box-shadow:0 8px 28px #17233c08}.story-section-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:17px}.story-section-title small{font-size:10px;color:#c18a3c;font-weight:800}.story-section-title h2{font-size:18px;margin:4px 0 0}.story-plus{width:37px;height:37px;border-radius:12px;background:#f7f0e5;color:#c28c3d;display:grid;place-items:center}.story-upload-zone{min-height:210px;border:1.5px dashed #cbd1dc;border-radius:15px;background:#fafbfc;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:#667085;cursor:pointer;padding:14px;text-align:center}.story-upload-zone>svg{color:#d39a47}.story-upload-zone b{font-size:13px;color:#252d3c}.story-upload-zone small{font-size:10px;color:#8992a2}.story-preview{width:100%;display:flex;flex-direction:column;align-items:center;gap:9px}.story-preview img,.story-preview video{max-width:100%;max-height:250px;border-radius:10px;object-fit:contain}.story-preview span{font-size:11px;color:#596273;max-width:100%;overflow-wrap:anywhere}.story-caption-label{display:block;margin-top:16px;font-size:12px;font-weight:800}.story-caption-label>span{color:#9299a5;font-weight:400;margin-right:5px}.story-caption-label textarea{width:100%;resize:vertical;margin-top:8px;padding:12px;border:1px solid #dfe3e9;border-radius:11px;outline:none;font:inherit;font-size:12px;line-height:1.8}.story-caption-label textarea:focus{border-color:#c28c3d}.story-create-footer{display:flex;align-items:center;justify-content:space-between;margin-top:12px}.story-create-footer small{font-size:10px;color:#8992a2}.story-create-footer button{display:flex;align-items:center;gap:7px;background:linear-gradient(110deg,#263c5d,#d49a45);color:#fff;padding:10px 15px;border-radius:10px;font-size:12px;font-weight:800}.story-create-footer button:disabled{opacity:.45;cursor:not-allowed}.story-notice{font-size:12px;padding:10px 12px;border-radius:9px;background:#f1f5fa;color:#344b6d;line-height:1.7}.story-privacy-note{display:flex;align-items:center;gap:7px;margin-top:16px;color:#768092;font-size:10px}.story-privacy-note svg{color:#26865a;flex:none}.story-count{font-size:10px;color:#7b8493;background:#f2f4f7;padding:6px 9px;border-radius:20px}.story-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:15px}.story-person{display:flex;flex-direction:column;align-items:center;gap:7px;padding:12px 7px;border-radius:13px;background:#fafbfc;border:1px solid #edf0f4}.story-person:hover{background:#f3f5f8}.story-avatar-ring{width:68px;height:68px;padding:3px;border-radius:50%;display:grid;place-items:center}.story-avatar-ring.unseen{background:conic-gradient(#e2a94e,#273d60,#e2a94e)}.story-avatar-ring.seen{background:#cbd1dc}.story-avatar-inner{width:100%;height:100%;border-radius:50%;display:grid;place-items:center;background:#e9edf3;color:#293a56;font-size:22px;font-weight:900;overflow:hidden}.story-avatar-inner img,.story-viewer-avatar img{width:100%;height:100%;object-fit:cover}.story-person b{font-size:11px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.story-person small{font-size:9px;color:#9299a5}.story-empty{min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#7c8595}.story-empty>div{width:52px;height:52px;border-radius:16px;background:#f4f0e8;color:#c18a3c;display:grid;place-items:center;margin-bottom:10px}.story-empty b{font-size:13px;color:#30394a}.story-empty p{font-size:11px}.story-feed-tip{display:flex;align-items:center;gap:7px;margin-top:20px;padding-top:14px;border-top:1px solid #edf0f4;color:#8992a2;font-size:10px}.story-viewer{position:fixed;inset:0;z-index:100;background:#101522f2;display:flex;align-items:center;justify-content:center;padding:22px}.story-viewer-close{position:absolute;top:18px;right:20px;color:#fff;padding:9px}.story-viewer-card{width:min(100%,430px);height:min(88vh,780px);background:#121a29;border:1px solid #ffffff22;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 25px 90px #0008}.story-progress{display:flex;gap:4px;padding:12px 12px 4px}.story-progress span{height:3px;flex:1;background:#ffffff40;border-radius:9px;overflow:hidden}.story-progress i{display:block;height:100%;width:0;background:#fff}.story-progress i.done{width:100%}.story-progress i.current{width:30%}.story-viewer-card header{display:flex;align-items:center;gap:9px;padding:12px;color:#fff}.story-viewer-avatar{width:34px;height:34px;border-radius:50%;background:#43516a;display:grid;place-items:center;overflow:hidden}.story-viewer-card header>div{display:flex;flex-direction:column;gap:3px;flex:1}.story-viewer-card header b{font-size:11px}.story-viewer-card header small{font-size:9px;color:#b8c0ce}.story-view-count{display:flex;align-items:center;gap:5px;color:#cbd2de;font-size:11px}.story-viewer-media{flex:1;min-height:0;display:grid;place-items:center;background:#05080e}.story-viewer-media img,.story-viewer-media video{width:100%;height:100%;object-fit:contain}.story-viewer-caption{color:#fff;padding:10px 15px;margin:0;font-size:12px;line-height:1.7}.story-nav{position:absolute;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;background:#ffffff20;color:#fff;display:grid;place-items:center}.story-nav-prev{right:max(20px,calc(50% - 290px))}.story-nav-next{left:max(20px,calc(50% - 290px))}.story-spin{animation:storyspin 1s linear infinite}@keyframes storyspin{to{transform:rotate(360deg)}}@media(max-width:760px){.story-columns{grid-template-columns:1fr}.story-hero{padding:22px}.story-hero-icon{width:52px;height:52px}.story-header-note{display:none}.story-viewer{padding:0}.story-viewer-card{width:100%;height:100%;max-height:100%;border-radius:0}.story-nav{top:auto;bottom:22px}.story-nav-prev{right:12px}.story-nav-next{left:12px}}@media(max-width:420px){.vyra-stories{padding:14px 10px 40px}.story-create-card,.story-feed-card{padding:15px}.story-hero h1{font-size:25px}.story-hero p{font-size:11px}.story-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
  `}</style>
 </main>;
}

function EyeIcon(){return <span aria-hidden="true">◉</span>}
export default function StoriesPage(){return <AuthGate><StoriesPageInner/></AuthGate>}
