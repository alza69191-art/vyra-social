"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, LoaderCircle, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";

type Message = { role: "user" | "assistant"; content: string };
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://vyra-api-9pxl.onrender.com").replace(/\/$/, "");

export default function AIChatPage() { return <AuthGate><AIChat /></AuthGate>; }
function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || busy) return;
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token) { setError("انتهت جلسة الدخول. سجّل الدخول مجدداً."); return; }
    setInput("");
    setError("");
    const next = [...messages, { role: "user" as const, content: prompt }];
    setMessages(next);
    setBusy(true);
    try {
      const response = await fetch(API_BASE + "/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ prompt, history: messages.slice(-12) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "تعذر الحصول على رد.");
      setMessages([...next, { role: "assistant", content: payload.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="ai-page" dir="rtl">
    <header className="ai-header">
      <Link href="/" className="ai-back"><ArrowRight size={18}/> العودة إلى VYRA</Link>
      <div className="ai-brand"><span><Bot size={20}/></span><b>VYRA AI</b></div>
      <span className="ai-status">متعدد المزودات</span>
    </header>
    <section className="ai-chat">
      <div className="ai-intro"><span className="ai-logo"><Sparkles size={28}/></span><h1>مساعد VYRA الذكي</h1><p>محادثة موحدة مع تحويل تلقائي بين مزودي الذكاء الاصطناعي عند تعطل أحدهم.</p></div>
      <div className="ai-messages">
        {messages.map((message, index) => <div className={message.role === "user" ? "ai-message user-message" : "ai-message bot-message"} key={index}><b>{message.role === "user" ? "أنت" : "VYRA AI"}</b><p>{message.content}</p></div>)}
        {busy && <div className="ai-loading"><LoaderCircle size={17}/> يفكر الآن...</div>}
        <div ref={bottom}/>
      </div>
      {error && <div className="ai-error">{error}</div>}
      <form className="ai-form" onSubmit={send}>
        <textarea value={input} onChange={event => setInput(event.target.value)} placeholder="اكتب سؤالك هنا..." rows={2} maxLength={12000}/>
        <button disabled={!input.trim() || busy} aria-label="إرسال"><Send size={18}/></button>
      </form>
      <small className="ai-disclaimer">قد تختلف الإجابات حسب المزود المتاح. لا تشارك كلمات المرور أو البيانات الحساسة.</small>
    </section>
  </main>;
}
