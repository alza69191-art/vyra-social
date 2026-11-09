"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { ArrowRight, Bot, LoaderCircle, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
type Message = { role: "user" | "assistant"; content: string };
export default function AIChatPage() { return <AuthGate><AIChat /></AuthGate>; }
function AIChat() {
 const [messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const bottom=useRef<HTMLDivElement>(null);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth"});},[messages,busy]);
 async function send(e:FormEvent){e.preventDefault();const prompt=input.trim();if(!prompt||busy)return;setInput("");setError("");const next=[...messages,{role:"user" as const,content:prompt}];setMessages(next);setBusy(true);
 try{const {data}=await getSupabaseBrowserClient().auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("سجّل الدخول أولاً لاستخدام مساعد VYRA.");
 const res=await fetch("/api/ai/chat",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({prompt,history:messages.slice(-12)})});const payload=await res.json();if(!res.ok)throw new Error(payload.detail||"تعذر الحصول على رد.");setMessages([...next,{role:"assistant",content:payload.reply}]);
 }catch(err){setError(err instanceof Error?err.message:"حدث خطأ.");}finally{setBusy(false);}}
 return <main className="ai-page" dir="rtl"><header className="ai-header"><Link href="/" className="ai-back"><ArrowRight size={18}/> العودة إلى VYRA</Link><div className="ai-brand"><span><Bot size={20}/></span><b>VYRA AI</b></div><span className="ai-status">متعدد المزودات</span></header>
 <section className="ai-chat"><div className="ai-intro"><span className="ai-logo"><Sparkles size={28}/></span><h1>مساعد VYRA الذكي</h1><p>محادثة موحدة مع تحويل تلقائي بين مزودي الذكاء الاصطناعي عند تعطل أحدهم.</p></div>
 <div className="ai-messages">{messages.map((m,i)=><div className={m.role==="user"?"ai-message user-message":"ai-message bot-message"} key={i}><b>{m.role==="user"?"أنت":"VYRA AI"}</b><p>{m.content}</p></div>)}{busy&&<div className="ai-loading"><LoaderCircle size={17}/> يفكر الآن...</div>}<div ref={bottom}/></div>
 {error&&<div className="ai-error">{error}</div>}<form className="ai-form" onSubmit={send}><textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="اكتب سؤالك هنا..." rows={2} maxLength={12000}/><button disabled={!input.trim()||busy} aria-label="إرسال"><Send size={18}/></button></form><small className="ai-disclaimer">قد تختلف الإجابات حسب المزود المتاح. لا تشارك كلمات المرور أو البيانات الحساسة.</small></section></main>;
}
