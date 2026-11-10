"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import { getSavedPosts, toggleBookmark, type VyraPost } from "@/lib/vyra-api";

export default function SavedPage() {
  return <AuthGate><SavedPosts /></AuthGate>;
}
function SavedPosts() {
  const [posts, setPosts] = useState<VyraPost[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  async function load() {
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token) return;
    try { setPosts(await getSavedPosts(token)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "تعذر تحميل المحفوظات."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  async function remove(id: string) {
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token) return;
    try {
      await toggleBookmark(token, id);
      setPosts(current => current.filter(post => post.id !== id));
      setMessage("تمت إزالة المنشور من المحفوظات.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر إزالة المنشور."); }
  }
  return <main dir="rtl" style={{minHeight:"100vh",background:"#fff",color:"#000",padding:24}}>
    <section style={{maxWidth:850,margin:"auto"}}>
      <Link href="/" style={{color:"#000"}}>← العودة إلى VYRA</Link>
      <h1>المنشورات المحفوظة</h1>
      <p>هذه المنشورات محفوظة في حسابك ويمكنك إزالتها متى شئت.</p>
      {busy ? <p>جارٍ تحميل المحفوظات...</p> : posts.length ? <div style={{display:"grid",gap:12}}>
        {posts.map(post => <article key={post.id} style={{border:"1px solid #000",borderRadius:12,padding:16}}>
          <p style={{whiteSpace:"pre-wrap",lineHeight:1.8}}>{post.body || "منشور يحتوي على وسائط."}</p>
          <small>{new Date(post.created_at).toLocaleString("ar")}</small>
          <div><button onClick={() => remove(post.id)} style={{marginTop:12,padding:"9px 14px",background:"#000",color:"#fff",borderRadius:8}}>إزالة من المحفوظات</button></div>
        </article>)}
      </div> : <p>لا توجد منشورات محفوظة حتى الآن.</p>}
      {message && <p role="status">{message}</p>}
    </section>
  </main>;
}
