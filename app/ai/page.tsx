"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, LoaderCircle, Send, Sparkles, Copy, Plus, WandSparkles, BrainCircuit, Check, ImagePlus, X } from "lucide-react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";

type Message={role:"user"|"assistant";content:string;imageUrl?:string};
const API_BASE=(process.env.NEXT_PUBLIC_API_URL||"https://vyra-api-9pxl.onrender.com").replace(/\/$/,"");
const prompts=["اكتب وصفاً احترافياً لمنتج جديد","اقترح خطة محتوى لأسبوع كامل","حلّل فكرة مشروع وحوّلها إلى خطوات","اكتب منشوراً جذاباً لمنصة اجتماعية"];

export default function AIChatPage(){return <AuthGate><AIChat/></AuthGate>}
function AIChat(){
 const [messages,setMessages]=useState<Message[]>([]);
 const [input,setInput]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [copied,setCopied]=useState(-1);
 const [image,setImage]=useState<File|null>(null);
 const [imagePreview,setImagePreview]=useState("");
 const bottom=useRef<HTMLDivElement>(null);
 const imageInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth"})},[messages,busy]);

 async function send(event?:FormEvent,override?:string){
  event?.preventDefault();
  const prompt=(override??input).trim();
  if((!prompt&&!image)||busy)return;
  const token=sessionStorage.getItem("vyra_access_token");
  if(!token){setError("انتهت جلسة الدخول. سجّل الدخول مجدداً.");return;}
  setInput("");setError("");
  const imageData=image?await new Promise<string>((resolve,reject)=>{
   const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(new Error("تعذرت قراءة الصورة."));reader.readAsDataURL(image);
  }):undefined;
  const next=[...messages,{role:"user" as const,content:prompt||"حلّل الصورة المرفقة.",...(imagePreview?{imageUrl:imagePreview}:{})}];
  setMessages(next);setBusy(true);
  try{
   const response=await fetch(API_BASE+"/api/ai/chat",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({prompt:prompt||"حلّل الصورة المرفقة وصف ما تراه بدقة.",history:messages.slice(-12).map(m=>({role:m.role,content:m.content})),...(imageData?{image_data:imageData}:{})})});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(payload.detail||"تعذر الحصول على رد.");
   setMessages([...next,{role:"assistant",content:payload.reply}]);
   setImage(null);setImagePreview("");if(imageInput.current)imageInput.current.value="";
  }catch(err){setError(err instanceof Error?err.message:"حدث خطأ.")}
  finally{setBusy(false)}
 }
 function chooseImage(file?:File){
  if(!file)return;
  if(!file.type.startsWith("image/")){setError("يمكن إرفاق الصور فقط.");return;}
  if(file.size>7*1024*1024){setError("الحد الأقصى لحجم الصورة 7 ميجابايت.");return;}
  setError("");setImage(file);setImagePreview(URL.createObjectURL(file));
 }
 return <main dir="rtl" style={{minHeight:"100vh",background:"#f4f2ed",color:"#211f1b",padding:"22px 16px"}}>
  <div style={{maxWidth:1050,margin:"auto"}}>
   <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
    <Link href="/" style={{display:"inline-flex",alignItems:"center",gap:8,color:"#777",textDecoration:"none"}}><ArrowRight size={17}/> العودة إلى VYRA</Link>
    <div style={{display:"flex",alignItems:"center",gap:9}}><div style={{width:40,height:40,borderRadius:13,display:"grid",placeItems:"center",background:"#211f1b",color:"#fff"}}><Sparkles/></div><div><b style={{letterSpacing:2}}>VYRA AI</b><small style={{display:"block",color:"#888"}}>المساعد الذكي</small></div></div>
    <button onClick={()=>{setMessages([]);setError("");setInput("");setImage(null);setImagePreview("");}} style={outline}><Plus size={16}/> محادثة جديدة</button>
   </header>
   <section style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 245px",gap:16,marginTop:24}}>
    <div style={chatPanel}>
     <div style={{display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #eee",paddingBottom:16}}><div><small style={{color:"#a47742",fontWeight:800,letterSpacing:1}}>VYRA INTELLIGENCE</small><h1 style={{fontSize:25,margin:"5px 0"}}>مساعد VYRA الذكي</h1><p style={{color:"#888",margin:0}}>اسأل، حلّل الصور، خطّط، واكتب بمساعدة الذكاء الاصطناعي.</p></div></div>
     <div style={{minHeight:390,maxHeight:"58vh",overflowY:"auto",padding:"18px 2px"}}>
      {messages.length===0?<div style={{textAlign:"center",padding:"48px 12px"}}><div style={{width:64,height:64,borderRadius:22,margin:"0 auto 16px",display:"grid",placeItems:"center",background:"#f3ede3",color:"#9a6a2d"}}><BrainCircuit size={30}/></div><h2 style={{margin:"0 0 8px"}}>ما الذي تريد إنجازه اليوم؟</h2><p style={{color:"#888",margin:0}}>اكتب سؤالك أو أرفق صورة لطلب تحليلها.</p></div>:messages.map((m,i)=><article key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-start":"flex-end",marginBottom:14}}><div style={{maxWidth:"88%",background:m.role==="user"?"#f4f1eb":"#211f1b",color:m.role==="user"?"#211f1b":"#fff",borderRadius:16,padding:"13px 15px",lineHeight:1.9,whiteSpace:"pre-wrap"}}><small style={{display:"block",opacity:.65,marginBottom:5}}>{m.role==="user"?"أنت":"VYRA AI"}</small>{m.imageUrl&&<img src={m.imageUrl} alt="الصورة المرفقة" style={{display:"block",maxWidth:230,maxHeight:180,objectFit:"contain",borderRadius:10,marginBottom:8}}/>}{m.content}{m.role==="assistant"&&<button onClick={async()=>{await navigator.clipboard?.writeText(m.content);setCopied(i)}} style={{display:"flex",alignItems:"center",gap:6,marginTop:9,color:"inherit",opacity:.75,fontSize:11}}>{copied===i?<Check size={13}/>:<Copy size={13}/>} {copied===i?"تم النسخ":"نسخ الإجابة"}</button>}</div></article>)}{busy&&<div style={{display:"flex",alignItems:"center",gap:8,color:"#8a6334"}}><LoaderCircle size={17} className="animate-spin"/> جارٍ تحليل طلبك...</div>}<div ref={bottom}/>
     </div>
     {error&&<p role="alert" style={{background:"#fff2f0",color:"#b42318",padding:11,borderRadius:10}}>{error}</p>}
     {imagePreview&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"#f7f5f1",borderRadius:12,marginBottom:8}}><img src={imagePreview} alt="معاينة الصورة" style={{width:54,height:54,objectFit:"cover",borderRadius:8}}/><span style={{fontSize:12,flex:1}}>{image?.name}</span><button type="button" onClick={()=>{setImage(null);setImagePreview("");if(imageInput.current)imageInput.current.value="";}} aria-label="إزالة الصورة"><X size={17}/></button></div>}
     <form onSubmit={send} style={{display:"flex",gap:9,alignItems:"end",padding:9,border:"1px solid #e8e1d7",borderRadius:15,background:"#faf9f6"}}>
      <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e=>chooseImage(e.target.files?.[0])}/>
      <button type="button" title="إرفاق صورة" onClick={()=>imageInput.current?.click()} style={{width:42,height:42,borderRadius:11,display:"grid",placeItems:"center",background:"#eee9df",color:"#72552f"}}><ImagePlus size={19}/></button>
      <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="اكتب سؤالك أو أرفق صورة..." rows={2} maxLength={12000} style={{flex:1,minWidth:0,resize:"vertical",border:0,outline:0,background:"transparent",font:"inherit",padding:9}}/>
      <button disabled={(!input.trim()&&!image)||busy} aria-label="إرسال" style={{width:43,height:43,borderRadius:12,display:"grid",placeItems:"center",background:"#211f1b",color:"#fff",opacity:((!input.trim()&&!image)||busy)?0.5:1}}><Send size={18}/></button>
     </form>
     <small style={{display:"block",color:"#999",marginTop:10}}>الصور المرفقة ترسل للمزود الذكي لمعالجتها. لا ترفق معلومات شخصية حساسة.</small>
    </div>
    <aside style={{display:"grid",alignContent:"start",gap:12}}><section style={side}><h3 style={{margin:"0 0 12px",display:"flex",alignItems:"center",gap:7}}><WandSparkles size={17}/> أدوات سريعة</h3>{prompts.map(p=><button key={p} onClick={()=>send(undefined,p)} style={promptButton}>{p}</button>)}</section><section style={side}><h3 style={{margin:"0 0 9px"}}>المساعد الذكي</h3><p style={{fontSize:12,color:"#888",lineHeight:1.8,margin:0}}>يساعدك في الأسئلة والشرح والكتابة والأفكار وتحليل الصور المرفقة.</p></section></aside>
   </section>
  </div>
 </main>
}
const chatPanel={background:"#fff",border:"1px solid #e9e4dc",borderRadius:20,padding:22,boxShadow:"0 10px 35px #29201408"} as const;
const side={background:"#fff",border:"1px solid #e9e4dc",borderRadius:16,padding:16} as const;
const outline={display:"inline-flex",alignItems:"center",gap:7,padding:"10px 13px",border:"1px solid #e4ddd2",borderRadius:10,background:"#fff",cursor:"pointer"} as const;
const promptButton={display:"block",width:"100%",textAlign:"right" as const,padding:"10px 11px",marginTop:7,borderRadius:10,background:"#f7f5f1",color:"#5c4a34",fontSize:12,lineHeight:1.6,cursor:"pointer"} as const;
