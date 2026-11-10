"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import { ArrowRight, MapPin, Plus, ShoppingBag, Tag } from "lucide-react";

const API = (process.env.NEXT_PUBLIC_API_URL || "https://vyra-api-9pxl.onrender.com").replace(/\/$/, "");
type Listing = {
  id: string; title: string; description: string; price: number; currency: "USD" | "ILS" | "EUR";
  category: string; condition: "new" | "used" | "refurbished"; location: string | null;
  status: string; owner_id: string; seller_name: string; seller_username: string; created_at: string;
};
const field = { width: "100%", padding: 12, border: "1px solid #ddd", borderRadius: 10, background: "#fff", color: "#111", font: "inherit" } as const;
const button = { padding: "11px 16px", background: "#111", color: "#fff", border: 0, borderRadius: 10, cursor: "pointer", font: "inherit" } as const;

export default function MarketPage() { return <AuthGate><Market /></AuthGate>; }
function Market() {
  const [items, setItems] = useState<Listing[]>([]);
  const [myUserId, setMyUserId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("الكل");
  const [form, setForm] = useState({ title: "", description: "", price: "", currency: "USD", category: "إلكترونيات", condition: "new", location: "" });
  async function load() {
    const response = await fetch(API + "/api/market/listings?limit=60", { cache: "no-store" });
    if (!response.ok) throw new Error("تعذر تحميل السوق حالياً");
    setItems(await response.json());
  }
  useEffect(() => {
    load().catch(error => setNotice(error.message));
    const token = sessionStorage.getItem("vyra_access_token");
    if (token) fetch(API + "/api/me", { headers: { Authorization: "Bearer " + token }, cache: "no-store" })
      .then(response => response.ok ? response.json() : null).then(profile => { if (profile?.id) setMyUserId(profile.id); }).catch(() => undefined);
  }, []);
  const categories = ["الكل", ...Array.from(new Set(items.map(item => item.category)))];
  const visible = categoryFilter === "الكل" ? items : items.filter(item => item.category === categoryFilter);
  async function createListing(event: FormEvent) {
    event.preventDefault();
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token) return;
    setBusy(true);
    try {
      const response = await fetch(API + "/api/market/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ ...form, price: Number(form.price) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "تعذر نشر الإعلان");
      setItems(current => [data, ...current]);
      setForm({ title: "", description: "", price: "", currency: "USD", category: "إلكترونيات", condition: "new", location: "" });
      setShowForm(false);
      setNotice("تم نشر إعلانك في السوق");
    } catch (error) { setNotice(error instanceof Error ? error.message : "حدث خطأ"); }
    finally { setBusy(false); }
  }
  async function markSold(id: string) {
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token) return;
    const response = await fetch(API + "/api/market/listings/" + id + "/status", {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ status: "sold" }),
    });
    if (response.ok) { setItems(current => current.filter(item => item.id !== id)); setNotice("تم تحديث حالة الإعلان"); }
    else setNotice("تعذر تحديث الإعلان");
  }
  return <main dir="rtl" style={{ minHeight: "100vh", background: "#f7f7f7", color: "#111", padding: "24px 16px" }}>
    <section style={{ maxWidth: 1080, margin: "0 auto" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#111", textDecoration: "none" }}><ArrowRight size={18}/> العودة إلى VYRA</Link>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "24px 0" }}>
        <div><div style={{ color: "#d97706", fontWeight: 700, fontSize: 13 }}>VYRA MARKET</div><h1 style={{ margin: "6px 0", fontSize: 32 }}>السوق</h1><p style={{ color: "#666", margin: 0 }}>اشترِ وبع وتبادل المنتجات مع مجتمع VYRA.</p></div>
        <button style={button} onClick={() => setShowForm(value => !value)}><Plus size={17} style={{ verticalAlign: "middle", marginLeft: 6 }}/> أضف إعلاناً</button>
      </header>
      {showForm && <form onSubmit={createListing} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, background: "#fff", padding: 18, border: "1px solid #e5e5e5", borderRadius: 16, marginBottom: 22 }}>
        <h2 style={{ gridColumn: "1/-1", margin: 0 }}>إعلان جديد</h2>
        <input required minLength={3} maxLength={140} placeholder="اسم المنتج أو الخدمة" style={field} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/>
        <input required type="number" min="0" step="0.01" placeholder="السعر" style={field} value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}/>
        <select style={field} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}><option value="USD">دولار USD</option><option value="ILS">شيكل ILS</option><option value="EUR">يورو EUR</option></select>
        <input required maxLength={60} placeholder="التصنيف" style={field} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}/>
        <select style={field} value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}><option value="new">جديد</option><option value="used">مستعمل</option><option value="refurbished">مجدّد</option></select>
        <input maxLength={120} placeholder="المدينة / المنطقة (اختياري)" style={field} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}/>
        <textarea required minLength={5} maxLength={4000} placeholder="تفاصيل الإعلان" style={{ ...field, gridColumn: "1/-1", minHeight: 100 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/>
        <button disabled={busy} style={{ ...button, gridColumn: "1/-1", opacity: busy ? .6 : 1 }}>{busy ? "جارٍ النشر..." : "نشر الإعلان"}</button>
      </form>}
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>{categories.map(category => <button key={category} onClick={() => setCategoryFilter(category)} style={{ border: categoryFilter === category ? "1px solid #111" : "1px solid #ddd", background: categoryFilter === category ? "#111" : "#fff", color: categoryFilter === category ? "#fff" : "#111", borderRadius: 30, padding: "8px 14px", cursor: "pointer" }}>{category}</button>)}</nav>
      {visible.length === 0 ? <div style={{ textAlign: "center", padding: 50, background: "#fff", borderRadius: 16, border: "1px solid #eee" }}><ShoppingBag size={34}/><h2>السوق جاهز لإعلاناتك</h2><p style={{ color: "#777" }}>لا توجد إعلانات في هذا التصنيف بعد. كن أول من ينشر إعلاناً.</p><button style={button} onClick={() => setShowForm(true)}>أضف أول إعلان</button></div> :
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>{visible.map(item => <article key={item.id} style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", minHeight: 230 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ color: "#b45309", fontSize: 12, fontWeight: 700 }}><Tag size={13} style={{ verticalAlign: "middle", marginLeft: 4 }}/>{item.category}</span><small style={{ color: "#777" }}>{item.condition === "new" ? "جديد" : item.condition === "used" ? "مستعمل" : "مجدّد"}</small></div>
          <h3 style={{ margin: "14px 0 8px" }}>{item.title}</h3><p style={{ color: "#666", lineHeight: 1.7, whiteSpace: "pre-wrap", flex: 1 }}>{item.description}</p>
          <strong style={{ fontSize: 22 }}>{item.price.toLocaleString("en-US")} {item.currency}</strong>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12, color: "#777", fontSize: 12 }}><span>{item.seller_name}</span><span>{item.location ? <><MapPin size={12} style={{ verticalAlign: "middle" }}/> {item.location}</> : "VYRA"}</span></div>
          {item.owner_id === myUserId && <button onClick={() => markSold(item.id)} style={{ ...button, marginTop: 12 }}>تم البيع</button>}
        </article>)}</div>}
      {notice && <p role="status" style={{ position: "fixed", bottom: 20, right: 20, background: "#111", color: "#fff", padding: "12px 18px", borderRadius: 10 }}>{notice}<button onClick={() => setNotice("")} style={{ color: "#fff", marginRight: 12 }}>×</button></p>}
    </section>
  </main>;
}
