"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import { ArrowRight, Headset, Send, Plus, MessageCircle, RefreshCw, LifeBuoy, CheckCircle2, Clock3 } from "lucide-react";

const API = (process.env.NEXT_PUBLIC_API_URL || "https://vyra-api-9pxl.onrender.com").replace(/\/+$/, "");
type Ticket = { id: string; subject: string; status: string; last_message: string; created_at: string; user_name?: string };
type Msg = { id: string; sender_id: string; sender_role: string; message: string; created_at: string };

function Support() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [subject, setSubject] = useState("");
  const [draft, setDraft] = useState("");
  const [newMode, setNewMode] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const accessToken = () => sessionStorage.getItem("vyra_access_token") || "";
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(API + path, {
      ...init,
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), Authorization: "Bearer " + accessToken(), ...init.headers },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || data.error || "تعذر تنفيذ الطلب.");
    return data;
  };

  const loadTickets = useCallback(async () => {
    const data = await request("/api/support/tickets");
    setTickets(Array.isArray(data) ? data : []);
  }, []);

  const loadMessages = useCallback(async (ticketId: string) => {
    const data = await request("/api/support/tickets/" + encodeURIComponent(ticketId) + "/messages");
    setMessages(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadTickets().catch((e) => alive && setError(e instanceof Error ? e.message : "تعذر تحميل التذاكر."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [loadTickets]);

  useEffect(() => {
    if (!active?.id || newMode) return;
    const ticketId = active.id;
    const timer = window.setInterval(() => {
      loadTickets().catch(() => undefined);
      loadMessages(ticketId).catch(() => undefined);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [active?.id, newMode, loadTickets, loadMessages]);

  async function openTicket(ticket: Ticket) {
    setActive(ticket);
    setNewMode(false);
    setDraft("");
    setError("");
    try { await loadMessages(ticket.id); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر فتح المحادثة."); }
  }

  async function createTicket() {
    if (busy || subject.trim().length < 3 || !draft.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const ticket = await request("/api/support/tickets", {
        method: "POST",
        body: JSON.stringify({ subject: subject.trim(), message: draft.trim() }),
      });
      setSubject(""); setDraft("");
      await loadTickets();
      setActive(ticket); setNewMode(false);
      await loadMessages(ticket.id);
      setNotice("تم إرسال طلبك بشكل خاص إلى فريق الدعم.");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر إرسال الطلب."); }
    finally { setBusy(false); }
  }

  async function sendMessage() {
    if (!active || !draft.trim() || busy || active.status === "closed") return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("/api/support/tickets/" + encodeURIComponent(active.id) + "/messages", {
        method: "POST", body: JSON.stringify({ message: draft.trim() }),
      });
      setDraft("");
      await Promise.all([loadMessages(active.id), loadTickets()]);
      setNotice("تم إرسال رسالتك إلى فريق الدعم.");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر إرسال الرسالة."); }
    finally { setBusy(false); }
  }

  return (
    <main className="vyra-support-page" dir="rtl">
      <div className="vyra-support-wrap">
        <Link className="vyra-support-back" href="/"><ArrowRight size={16}/> العودة إلى VYRA</Link>
        <header className="vyra-support-heading">
          <span className="vyra-support-icon"><Headset size={23}/></span>
          <div><span className="vyra-support-eyebrow">مركز المساعدة</span><h1>الدعم الفني</h1><p>تواصل بشكل خاص مع فريق VYRA وتابع حالة طلباتك من مكان واحد.</p></div>
          <button className="vyra-support-new" onClick={() => { setActive(null); setMessages([]); setNewMode(true); setDraft(""); setError(""); setNotice(""); }}><Plus size={17}/> طلب دعم جديد</button>
        </header>

        {notice && <p className="vyra-support-alert success" role="status"><CheckCircle2 size={16}/>{notice}</p>}
        {error && <p className="vyra-support-alert error" role="alert">{error}</p>}

        <div className="vyra-support-layout">
          <aside className="vyra-support-list">
            <div className="vyra-support-list-head"><div><b>طلباتك</b><small>{tickets.length} تذكرة</small></div><button aria-label="تحديث الطلبات" onClick={() => loadTickets().catch(e => setError(e.message))}><RefreshCw size={16}/></button></div>
            {loading ? <div className="vyra-support-empty small">جارٍ تحميل الطلبات...</div> : tickets.map(ticket => (
              <button key={ticket.id} className={"vyra-support-ticket" + (active?.id === ticket.id ? " active" : "")} onClick={() => void openTicket(ticket)}>
                <span className="vyra-support-ticket-top"><b>{ticket.subject}</b><em className={ticket.status === "closed" ? "closed" : "open"}>{ticket.status === "closed" ? "مغلقة" : "مفتوحة"}</em></span>
                <small>{ticket.last_message || "لا توجد رسائل"}</small>
                <span className="vyra-support-ticket-date">{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString("ar") : ""}</span>
              </button>
            ))}
            {!loading && tickets.length === 0 && <div className="vyra-support-empty"><LifeBuoy size={24}/><b>لا توجد طلبات دعم</b><span>أنشئ طلباً جديداً وسنساعدك.</span></div>}
          </aside>

          <section className="vyra-support-thread">
            {newMode ? (
              <div className="vyra-support-compose-new">
                <span className="vyra-support-eyebrow">رسالة خاصة</span><h2>إرسال طلب دعم جديد</h2>
                <p>اكتب عنوان المشكلة واشرح ما تحتاج إليه. لا يمكن للأعضاء الآخرين رؤية هذه المراسلة.</p>
                <label>عنوان الطلب<input value={subject} onChange={e => setSubject(e.target.value)} maxLength={160} placeholder="مثال: مشكلة في نشر الفيديو"/></label>
                <label>تفاصيل الرسالة<textarea value={draft} onChange={e => setDraft(e.target.value)} maxLength={5000} placeholder="اشرح المشكلة أو اكتب سؤالك..." rows={7}/></label>
                <button className="vyra-support-send" disabled={busy || subject.trim().length < 3 || !draft.trim()} onClick={() => void createTicket()}><Send size={16}/>{busy ? "جارٍ الإرسال..." : "إرسال الطلب"}</button>
              </div>
            ) : active ? (
              <>
                <div className="vyra-support-thread-head"><div><span className="vyra-support-eyebrow">محادثة الدعم</span><h2>{active.subject}</h2><small>رقم الطلب: {active.id}</small></div><span className={"vyra-support-status " + (active.status === "closed" ? "closed" : "open")}>{active.status === "closed" ? "مغلقة" : "قيد المتابعة"}</span></div>
                <div className="vyra-support-messages">
                  {messages.map(message => (
                    <article key={message.id} className={"vyra-support-message " + (message.sender_role === "support" ? "from-support" : "from-user")}>
                      <span>{message.sender_role === "support" ? "فريق دعم VYRA" : "أنت"}</span>
                      <p>{message.message}</p>
                      <small>{message.created_at ? new Date(message.created_at).toLocaleString("ar") : ""}</small>
                    </article>
                  ))}
                  {messages.length === 0 && <div className="vyra-support-empty small">لا توجد رسائل في هذه المحادثة.</div>}
                </div>
                {active.status === "closed" ? <div className="vyra-support-closed"><Clock3 size={17}/> هذا الطلب مغلق حالياً. أنشئ طلباً جديداً إذا كنت تحتاج إلى متابعة أخرى.</div> : (
                  <form className="vyra-support-reply" onSubmit={e => { e.preventDefault(); void sendMessage(); }}>
                    <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} maxLength={5000} placeholder="اكتب رسالتك أو ردك هنا..."/>
                    <div><small>يصل رد فريق الدعم إلى مركز التنبيهات لديك.</small><button className="vyra-support-send" disabled={busy || !draft.trim()}><Send size={16}/>{busy ? "جارٍ الإرسال..." : "إرسال"}</button></div>
                  </form>
                )}
              </>
            ) : (
              <div className="vyra-support-empty large"><span><MessageCircle size={28}/></span><h2>كيف يمكننا مساعدتك؟</h2><p>اختر طلباً من القائمة لمتابعة المحادثة، أو أنشئ طلب دعم جديداً.</p><button className="vyra-support-new" onClick={() => setNewMode(true)}><Plus size={16}/> إنشاء طلب دعم</button></div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return <AuthGate><Support/></AuthGate>;
}
