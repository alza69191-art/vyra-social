"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, LoaderCircle, Send, Sparkles, Copy, Plus, WandSparkles, BrainCircuit, Check, ImagePlus, X, Link2, Unplug, Image as ImageIcon, Download } from "lucide-react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";

type PuterUser = { username?: string; uuid?: string; email?: string };
type PuterResponse = { message?: { content?: string | Array<{text?:string}>; images?: Array<{image_url?:{url?:string}}> }; };
type PuterSDK = {
  auth: { isSignedIn: () => boolean; signIn: () => Promise<unknown>; signOut: () => Promise<unknown>; getUser: () => Promise<PuterUser> };
  ai: {
    chat: (prompt: string | Array<{role:string;content:unknown}>, mediaOrOptions?: File | {model?:string}, options?: {model?:string}) => Promise<PuterResponse | string>;
    txt2img: (prompt: string, options?: { test_mode?: boolean }) => Promise<HTMLImageElement>;
  };
};
declare global { interface Window { puter?: PuterSDK } }

type Message = { role: "user" | "assistant"; content: string; imageUrl?: string };
const prompts = ["اشرح لي فكرة معقدة بطريقة مبسطة", "اكتب وصفاً احترافياً لمنتج جديد", "اقترح خطة محتوى لأسبوع كامل", "حلّل فكرة مشروع وحوّلها إلى خطوات"];

export default function AIChatPage() { return <AuthGate><AIChat /></AuthGate>; }

function AIChat() {
  const [puterReady, setPuterReady] = useState(false);
  const [connectedUser, setConnectedUser] = useState<PuterUser | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(-1);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [toolMode, setToolMode] = useState<"chat" | "image">("chat");
  const bottom = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const existing = document.querySelector<HTMLScriptElement>('script[data-puter-sdk="true"]');
    const load = () => {
      if (!active || !window.puter) return;
      setPuterReady(true);
      try {
        if (window.puter.auth.isSignedIn()) window.puter.auth.getUser().then(user => { if (active) setConnectedUser(user); }).catch(() => {});
      } catch { /* SDK may still be initializing */ }
    };
    if (window.puter) load();
    else if (existing) {
      existing.addEventListener("load", load);
      existing.addEventListener("error", () => active && setError("تعذر تحميل خدمة Puter. تحقق من الاتصال بالإنترنت."));
    } else {
      const script = document.createElement("script");
      script.src = "https://js.puter.com/v2/";
      script.async = true;
      script.dataset.puterSdk = "true";
      script.onload = load;
      script.onerror = () => active && setError("تعذر تحميل خدمة Puter. تحقق من الاتصال بالإنترنت.");
      document.head.appendChild(script);
    }
    return () => { active = false; };
  }, []);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function connectPuter() {
    if (!window.puter || connecting) return;
    setConnecting(true); setError("");
    try {
      await window.puter.auth.signIn();
      const user = await window.puter.auth.getUser();
      setConnectedUser(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "لم يكتمل ربط حساب Puter.");
    } finally { setConnecting(false); }
  }

  async function disconnectPuter() {
    try { await window.puter?.auth.signOut(); setConnectedUser(null); }
    catch { setError("تعذر فصل حساب Puter حالياً."); }
  }

  function responseText(result: PuterResponse | string): string {
    if (typeof result === "string") return result;
    const value = result?.message?.content;
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(part => part.text || "").join("\n");
    return "تمت المعالجة.";
  }

  async function send(event?: FormEvent, override?: string) {
    event?.preventDefault();
    const prompt = (override ?? input).trim();
    if ((!prompt && !image) || busy) return;
    if (!window.puter?.auth.isSignedIn()) { setError("اربط حساب Puter أولاً لاستخدام الصديق الذكي."); return; }
    setInput(""); setError("");
    const preview = imagePreview;
    const selectedImage = image;
    const next = [...messages, { role: "user" as const, content: prompt || "حلّل الصورة المرفقة.", ...(preview ? { imageUrl: preview } : {}) }];
    setMessages(next); setBusy(true);
    try {
      if (toolMode === "image") {
        const result = await window.puter.ai.chat(prompt || "أنشئ صورة إبداعية.", { model: "gemini-3.1-flash-image-preview" });
        const text = responseText(result);
        const generated = typeof result === "object" ? result.message?.images?.[0]?.image_url?.url : undefined;
        setMessages([...next, { role: "assistant", content: text, ...(generated ? { imageUrl: generated } : {}) }]);
      } else {
        const result = await window.puter.ai.chat(
          prompt || "حلّل الصورة المرفقة ووصف ما تراه بدقة.",
          selectedImage || undefined,
          { model: "gpt-5.4-nano" }
        );
        setMessages([...next, { role: "assistant", content: responseText(result) }]);
      }
      setImage(null); setImagePreview("");
      if (imageInput.current) imageInput.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تنفيذ الطلب عبر Puter. تحقق من ربط الحساب وحصته.");
    } finally { setBusy(false); }
  }

  async function downloadGeneratedImage(url: string, index: number) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("تعذر تنزيل الصورة.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `vyra-ai-image-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
      setError("لم يسمح مصدر الصورة بالتنزيل المباشر. فُتحت الصورة في نافذة جديدة؛ يمكنك حفظها منها.");
    }
  }

  function chooseImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("يمكن إرفاق الصور فقط حالياً."); return; }
    if (file.size > 7 * 1024 * 1024) { setError("الحد الأقصى لحجم الصورة 7 ميجابايت."); return; }
    setError(""); setImage(file); setImagePreview(URL.createObjectURL(file)); setToolMode("chat");
  }

  return <main dir="rtl" style={{ minHeight: "100vh", background: "#f4f2ed", color: "#211f1b", padding: "22px 16px" }}>
    <div style={{ maxWidth: 1050, margin: "auto" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#777", textDecoration: "none" }}><ArrowRight size={17} /> العودة إلى VYRA</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 40, height: 40, borderRadius: 13, display: "grid", placeItems: "center", background: "#211f1b", color: "#fff" }}><Sparkles /></div><div><b style={{ letterSpacing: 2 }}>VYRA AI</b><small style={{ display: "block", color: "#888" }}>الصديق الذكي</small></div></div>
        <button onClick={() => { setMessages([]); setError(""); setInput(""); setImage(null); setImagePreview(""); }} style={outline}><Plus size={16} /> محادثة جديدة</button>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 245px", gap: 16, marginTop: 24 }}>
        <div style={chatPanel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderBottom: "1px solid #eee", paddingBottom: 16 }}>
            <div><small style={{ color: "#a47742", fontWeight: 800, letterSpacing: 1 }}>VYRA INTELLIGENCE</small><h1 style={{ fontSize: 25, margin: "5px 0" }}>صديقك الذكي</h1><p style={{ color: "#888", margin: 0 }}>محادثة ذكية وتحليل الصور وتوليدها عبر Puter.</p></div>
            {connectedUser ? <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ color: "#18794e", fontSize: 12 }}>● متصل {connectedUser.username ? "بـ " + connectedUser.username : "بحساب Puter"}</span><button onClick={disconnectPuter} style={smallButton}><Unplug size={14} /> فصل</button></div> : <button onClick={connectPuter} disabled={!puterReady || connecting} style={connectButton}>{connecting ? <LoaderCircle size={16} className="animate-spin" /> : <Link2 size={16} />}{puterReady ? "ربط حساب Puter" : "جارٍ تحميل Puter..."}</button>}
          </div>

          {!connectedUser && <div style={{ marginTop: 14, padding: 13, borderRadius: 12, background: "#f8f4ec", color: "#70552f", fontSize: 13, lineHeight: 1.8 }}>اربط حساب Puter مرة واحدة لتفعيل الصديق الذكي. الربط اختياري ولا يؤثر على بقية VYRA. تتم معالجة طلبات الذكاء الاصطناعي وفق نظام Puter وحصة حسابك.</div>}

          <div style={{ minHeight: 390, maxHeight: "58vh", overflowY: "auto", padding: "18px 2px" }}>
            {messages.length === 0 ? <div style={{ textAlign: "center", padding: "48px 12px" }}><div style={{ width: 64, height: 64, borderRadius: 22, margin: "0 auto 16px", display: "grid", placeItems: "center", background: "#f3ede3", color: "#9a6a2d" }}><BrainCircuit size={30} /></div><h2 style={{ margin: "0 0 8px" }}>أهلاً، أنا صديقك في VYRA</h2><p style={{ color: "#888", margin: 0 }}>ابدأ محادثة أو اطلب إنشاء صورة.</p></div> : messages.map((m, i) => <article key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-start" : "flex-end", marginBottom: 14 }}><div style={{ maxWidth: "88%", background: m.role === "user" ? "#f4f1eb" : "#211f1b", color: m.role === "user" ? "#211f1b" : "#fff", borderRadius: 16, padding: "13px 15px", lineHeight: 1.9, whiteSpace: "pre-wrap" }}><small style={{ display: "block", opacity: .65, marginBottom: 5 }}>{m.role === "user" ? "أنت" : "صديق VYRA"}</small>{m.imageUrl && <img src={m.imageUrl} alt="مرفق أو صورة مولدة" style={{ display: "block", maxWidth: 300, maxHeight: 260, objectFit: "contain", borderRadius: 10, marginBottom: 8 }} />}{m.content}{m.role === "assistant" && <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 9 }}><button onClick={async () => { await navigator.clipboard?.writeText(m.content); setCopied(i); }} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", opacity: .75, fontSize: 11 }}>{copied === i ? <Check size={13} /> : <Copy size={13} />} {copied === i ? "تم النسخ" : "نسخ الإجابة"}</button>{m.imageUrl && <button onClick={() => downloadGeneratedImage(m.imageUrl!, i)} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", fontSize: 11, fontWeight: 700 }}><Download size={14} /> تنزيل الصورة</button>}</div>}</div></article>)}{busy && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a6334" }}><LoaderCircle size={17} className="animate-spin" /> جارٍ تنفيذ طلبك عبر Puter...</div>}<div ref={bottom} />
          </div>

          {error && <p role="alert" style={{ background: "#fff2f0", color: "#b42318", padding: 11, borderRadius: 10 }}>{error}</p>}
          {imagePreview && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f7f5f1", borderRadius: 12, marginBottom: 8 }}><img src={imagePreview} alt="معاينة الصورة" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 8 }} /><span style={{ fontSize: 12, flex: 1 }}>{image?.name}</span><button type="button" onClick={() => { setImage(null); setImagePreview(""); if (imageInput.current) imageInput.current.value = ""; }} aria-label="إزالة الصورة"><X size={17} /></button></div>}
          <div style={{ display: "flex", gap: 8, marginBottom: 9 }}>
            <button type="button" onClick={() => setToolMode("chat")} style={toolMode === "chat" ? activeTool : inactiveTool}><Bot size={15} /> محادثة وتحليل</button>
            <button type="button" onClick={() => { setToolMode("image"); setImage(null); setImagePreview(""); }} style={toolMode === "image" ? activeTool : inactiveTool}><ImageIcon size={15} /> توليد صورة</button>
          </div>
          <form onSubmit={send} style={{ display: "flex", gap: 9, alignItems: "end", padding: 9, border: "1px solid #e8e1d7", borderRadius: 15, background: "#faf9f6" }}>
            <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => chooseImage(e.target.files?.[0])} />
            <button type="button" title="إرفاق صورة للتحليل" onClick={() => imageInput.current?.click()} style={{ width: 42, height: 42, borderRadius: 11, display: "grid", placeItems: "center", background: "#eee9df", color: "#72552f" }}><ImagePlus size={19} /></button>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={toolMode === "image" ? "صف الصورة التي تريد إنشاءها..." : "اكتب رسالتك أو أرفق صورة..."} rows={2} maxLength={12000} style={{ flex: 1, minWidth: 0, resize: "vertical", border: 0, outline: 0, background: "transparent", font: "inherit", padding: 9 }} />
            <button disabled={(!input.trim() && !image) || busy || !connectedUser} aria-label="إرسال" style={{ width: 43, height: 43, borderRadius: 12, display: "grid", placeItems: "center", background: "#211f1b", color: "#fff", opacity: ((!input.trim() && !image) || busy || !connectedUser) ? .5 : 1 }}><Send size={18} /></button>
          </form>
          <small style={{ display: "block", color: "#999", marginTop: 10 }}>تُرسل الملفات التي تختارها إلى Puter لمعالجتها. لا ترفق معلومات شخصية حساسة.</small>
        </div>

        <aside style={{ display: "grid", alignContent: "start", gap: 12 }}>
          <section style={side}><h3 style={{ margin: "0 0 12px", display: "flex", alignItems: "center", gap: 7 }}><WandSparkles size={17} /> اقتراحات سريعة</h3>{prompts.map(p => <button key={p} onClick={() => send(undefined, p)} disabled={!connectedUser || busy} style={promptButton}>{p}</button>)}</section>
          <section style={side}><h3 style={{ margin: "0 0 9px" }}>عن الربط</h3><p style={{ fontSize: 12, color: "#888", lineHeight: 1.8, margin: 0 }}>يستخدم VYRA مكتبة Puter الرسمية. لا نطلب منك مفتاح API، وحساب Puter منفصل عن حساب VYRA.</p><a href="https://docs.puter.com/AI/" target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, color: "#8a6334", fontSize: 12 }}>توثيق Puter الرسمي ↗</a></section>
        </aside>
      </section>
    </div>
  </main>;
}

const chatPanel = { background: "#fff", border: "1px solid #e9e4dc", borderRadius: 20, padding: 22, boxShadow: "0 10px 35px #29201408" } as const;
const side = { background: "#fff", border: "1px solid #e9e4dc", borderRadius: 16, padding: 16 } as const;
const outline = { display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 13px", border: "1px solid #e4ddd2", borderRadius: 10, background: "#fff", cursor: "pointer" } as const;
const connectButton = { ...outline, background: "#211f1b", color: "#fff", borderColor: "#211f1b" } as const;
const smallButton = { display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 9px", border: "1px solid #e4ddd2", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 11 } as const;
const activeTool = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 11px", borderRadius: 9, border: "1px solid #211f1b", background: "#211f1b", color: "#fff", cursor: "pointer", fontSize: 12 } as const;
const inactiveTool = { ...activeTool, background: "#fff", color: "#625746", borderColor: "#e4ddd2" } as const;
const promptButton = { display: "block", width: "100%", textAlign: "right" as const, padding: "10px 11px", marginTop: 7, borderRadius: 10, background: "#f7f5f1", color: "#5c4a34", fontSize: 12, lineHeight: 1.6, cursor: "pointer" } as const;
