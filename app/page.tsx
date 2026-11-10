"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPublicPosts, createPost, toggleReaction, getComments, createComment, uploadMedia, getPostMedia, type VyraComment } from "@/lib/vyra-api";
import AuthGate from "@/components/auth-gate";
import { Home, Compass, Clapperboard, Users, MessageCircle, Bell, Bookmark, Radio, Store, Gavel, UsersRound, Settings, Search, Plus, Image as ImageIcon, Video, Smile, MoreHorizontal, Heart, MessageSquare, Share2, Send, ChevronDown, Sparkles, PanelLeftClose, Menu, X, Check, TrendingUp, CircleHelp, WandSparkles, Hash } from "lucide-react";

const navigation = [
  { label: "الرئيسية", icon: Home, active: true },
  { label: "الذكاء الاصطناعي", icon: Sparkles },
  { label: "استكشف", icon: Compass },
  { label: "VYRA Pulse", icon: Clapperboard, tag: "جديد" },
  { label: "الأصدقاء", icon: Users },
  { label: "الرسائل", icon: MessageCircle, count: "3" },
  { label: "الإشعارات", icon: Bell, count: "5" },
  { label: "القنوات", icon: Radio },
  { label: "المجتمعات", icon: UsersRound },
  { label: "السوق", icon: Store },
  { label: "المزادات", icon: Gavel },
  { label: "المحفوظات", icon: Bookmark },
];
const stories = [
  { name: "قصتك", initials: "+", own: true },
  { name: "ليان", initials: "ل", tone: "story-a" },
  { name: "آدم", initials: "أ", tone: "story-b" },
  { name: "سارة", initials: "س", tone: "story-c" },
  { name: "كريم", initials: "ك", tone: "story-d" },
  { name: "نور", initials: "ن", tone: "story-e" },
];
const initialPosts: Array<{ id: string | number; name: string; handle: string; avatar: string; time: string; text: string; likes: number; comments: number; shares: number; tag: string; liked: boolean; media?: Array<{ url: string; media_type: string }> }> = [];

export default function HomePage() { return <AuthGate><HomeFeed /></AuthGate>; }

function HomeFeed() {
  const [active, setActive] = useState("الرئيسية");
  const [posts, setPosts] = useState<Array<{ id: string | number; name: string; handle: string; avatar: string; time: string; text: string; likes: number; comments: number; shares: number; tag: string; liked: boolean }>>(initialPosts);
  const [draft, setDraft] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const mediaInput = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const [commentPost, setCommentPost] = useState<string | null>(null);
  const [comments, setComments] = useState<VyraComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  useEffect(() => {
    let activeRequest = true;
    getPublicPosts(30, 0).then(rows => {
      if (!activeRequest || rows.length === 0) return;
      setPosts(rows.map((row, index) => ({
        id: row.id,
        name: "عضو VYRA",
        handle: "@member",
        avatar: "V",
        time: new Date(row.created_at).toLocaleString("ar"),
        text: row.body || "",
        likes: 0,
        comments: 0,
        shares: 0,
        tag: "منشور",
        liked: false,
      })));
    }).catch(() => {
      setPosts([]);
    });
    return () => { activeRequest = false; };
  }, []);
  const filteredPosts = useMemo(() => posts.filter(p => (p.text + p.name + p.tag).toLowerCase().includes(query.toLowerCase())), [posts, query]);
  async function publish() {
    const body = draft.trim();
    const token = sessionStorage.getItem("vyra_access_token");
    if (!body || !token) return;
    try {
      const created = await createPost(token, body, "public");
      setPosts(current => [{ id: created.id, name: "أنت", handle: "@your.profile", avatar: "أ", time: "الآن", text: created.body || "", likes: 0, comments: 0, shares: 0, tag: "منشور جديد", liked: false }, ...current]);
      setDraft(""); setNotice("تم حفظ المنشور في قاعدة البيانات"); setTimeout(() => setNotice(""), 2500);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر نشر المنشور");
      setTimeout(() => setNotice(""), 3500);
    }
  }
  async function openComments(id: string | number) {
    setCommentPost(String(id)); setComments([]);
    try { setComments(await getComments(String(id))); } catch (error) { setNotice(error instanceof Error ? error.message : "تعذر تحميل التعليقات"); }
  }
  async function sendComment() {
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token || !commentPost || !commentDraft.trim()) return;
    try { const item = await createComment(token, commentPost, commentDraft.trim()); setComments(current => [...current, item]); setCommentDraft(""); }
    catch (error) { setNotice(error instanceof Error ? error.message : "تعذر إضافة التعليق"); }
  }
  async function toggleLike(id: string | number) {
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token) return;
    try {
      const result = await toggleReaction(token, String(id));
      setPosts(current => current.map(p => p.id === id ? { ...p, liked: result.reacted, likes: Math.max(0, p.likes + (result.reacted ? 1 : -1)) } : p));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر حفظ التفاعل");
      setTimeout(() => setNotice(""), 3000);
    }
  }
  return <main className={focus ? "app-shell focus-mode" : "app-shell"}>
    <header className="mobile-header">
      <button className="icon-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="القائمة">{mobileOpen ? <X/> : <Menu/>}</button><Brand/>
      <button className="icon-button" onClick={() => setActive("الإشعارات")} aria-label="الإشعارات"><Bell/></button>
    </header>
    <aside className={mobileOpen ? "sidebar sidebar-open" : "sidebar"}>
      <div className="brand-row"><Brand/><button className="collapse-button" onClick={() => setFocus(!focus)} title="وضع التركيز"><PanelLeftClose size={18}/></button></div>
      <button className="profile-switch" onClick={() => { window.location.href="/account"; }}><span className="avatar avatar-dark">أ</span><span className="profile-meta"><b>حسابك الشخصي</b><small>@your.profile</small></span><ChevronDown size={16}/></button>
      <div className="nav-caption">مساحتك</div>
      <nav className="main-nav">{navigation.map(item => { const Icon = item.icon; return <button key={item.label} className={active === item.label ? "nav-item active" : "nav-item"} onClick={() => {if(item.label === "الذكاء الاصطناعي"){window.location.href="/ai";return;}setActive(item.label);setMobileOpen(false);}}><Icon size={19}/><span>{item.label}</span>{item.tag && <em>{item.tag}</em>}{item.count && <small className="nav-count">{item.count}</small>}</button>; })}</nav>
      <div className="nav-caption secondary-caption">إدارة وتخصيص</div>
      <nav className="main-nav"><button className="nav-item" onClick={() => setActive("الإعدادات")}><Settings size={19}/><span>الإعدادات</span></button><button className="nav-item" onClick={() => setActive("مركز المساعدة")}><CircleHelp size={19}/><span>مركز المساعدة</span></button></nav>
      <div className="sidebar-bottom"><div className="online-dot"/><span>مساحتك جاهزة للإبداع</span></div>
    </aside>
    <section className="main-area">
      <div className="topbar"><div className="breadcrumb"><span>مساحتك</span><span className="crumb-slash">/</span><b>{active}</b></div>
        <div className="top-actions"><label className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث في VYRA..."/><kbd>⌘ K</kbd></label><button className="icon-button top-icon" aria-label="الرسائل" onClick={() => setActive("الرسائل")}><MessageCircle/></button><button className="icon-button top-icon notification-icon" aria-label="الإشعارات" onClick={() => setActive("الإشعارات")}><Bell/><i/></button><span className="avatar avatar-dark top-avatar">أ</span></div>
      </div>
      <div className="content-wrap">
        <div className="welcome-row"><div><div className="eyebrow"><Sparkles size={14}/> مساحتك الاجتماعية</div><h1>مرحباً بعودتك<span>.</span></h1><p>اكتشف الجديد، وشارك لحظاتك مع مجتمعك.</p></div><button className="black-button" onClick={() => document.getElementById("composer")?.scrollIntoView({behavior:"smooth"})}><Plus size={18}/> إنشاء منشور</button></div>
        <div className="content-grid"><div className="feed-column">
          <section className="stories-panel"><div className="section-heading"><div><h2>اللحظات</h2><p>حكايات قصيرة من مجتمعك</p></div><button className="text-button" onClick={() => setActive("القصص")}>عرض الكل <span>←</span></button></div>
            <div className="stories-row">{stories.map(s=><button className="story" key={s.name} onClick={()=>setNotice(s.own?"إضافة قصة ستتوفر قريباً":"عرض القصة قريباً")}><span className={s.own?"story-ring own-story":"story-ring"}><span className={s.own?"story-avatar own-avatar":"story-avatar "+s.tone}>{s.initials}</span></span><small>{s.name}</small></button>)}</div>
          </section>
          <section className="composer-card" id="composer"><div className="composer-top"><span className="avatar avatar-dark">أ</span><button className="composer-input" onClick={()=>document.getElementById("post-input")?.focus()}>بماذا تفكر اليوم؟</button><button className="icon-button" aria-label="خيارات"><MoreHorizontal/></button></div>
            <textarea id="post-input" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="اكتب شيئاً يستحق المشاركة..." rows={draft ? 3 : 1}/>{selectedFiles.length>0 && <div style={{display:"flex",gap:8,flexWrap:"wrap",padding:"8px 0"}}>{selectedFiles.map((file,index)=><span key={index} style={{border:"1px solid #000",padding:"5px 9px",borderRadius:8,fontSize:12}}>{file.name}<button type="button" onClick={()=>setSelectedFiles(items=>items.filter((_,i)=>i!==index))} style={{marginInlineStart:8}}>×</button></span>)}</div>}<input ref={mediaInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple hidden onChange={e=>{const next=Array.from(e.target.files||[]);setSelectedFiles(current=>[...current,...next].slice(0,5));e.currentTarget.value="";}}/>
            <div className="composer-footer"><div className="composer-tools"><button type="button" onClick={()=>mediaInput.current?.click()}><ImageIcon size={18}/> صورة / فيديو</button><button onClick={()=>setNotice("الاستطلاعات ستتوفر قريباً")}><TrendingUp size={18}/> استطلاع</button><button className="emoji-tool" onClick={()=>setDraft(draft+" ✨")}><Smile size={18}/></button></div><button className="publish-button" disabled={!draft.trim()} onClick={publish}>نشر <Send size={15}/></button></div>
          </section>
          <div className="feed-heading"><div><h2>آخر المنشورات</h2><span>من مجتمعك</span></div><button className="sort-button">الأحدث أولاً <ChevronDown size={15}/></button></div>
          {filteredPosts.map(post=><article className="post-card" key={post.id}><div className="post-header"><span className="avatar avatar-soft">{post.avatar}</span><div className="post-author"><b>{post.name}</b><small>{post.handle} · {post.time}</small></div><button className="icon-button more-button" aria-label="المزيد"><MoreHorizontal/></button></div><p className="post-text">{post.text}</p>{post.media?.length ? <div style={{display:"grid",gap:8,margin:"12px 0"}}>{post.media.map((item,index)=>item.media_type==="video" ? <video key={index} src={item.url} controls playsInline style={{width:"100%",maxHeight:420,borderRadius:12}}/> : <img key={index} src={item.url} alt="وسائط المنشور" loading="lazy" style={{width:"100%",maxHeight:480,objectFit:"contain",borderRadius:12}}/>)}</div> : null}<div className="post-tag"><Hash size={13}/>{post.tag}</div><div className="post-stats"><span>{post.likes} إعجاب</span><span>{post.comments} تعليق · {post.shares} مشاركة</span></div><div className="post-actions"><button className={post.liked?"liked":""} onClick={()=>toggleLike(post.id)}><Heart size={18} fill={post.liked?"currentColor":"none"}/> إعجاب</button><button onClick={()=>openComments(post.id)}><MessageSquare size={18}/> تعليق</button><button onClick={()=>setNotice("المشاركة ستتوفر قريباً")}><Share2 size={18}/> مشاركة</button></div></article>)}
          {filteredPosts.length===0 && <div className="empty-state">لا توجد منشورات تطابق بحثك.</div>}
        </div>
        <aside className="right-column">
          <section className="side-card profile-card"><div className="side-card-title"><h3>ملفك الشخصي</h3><button className="subtle-link" onClick={()=>{window.location.href="/account";}}>عرض</button></div><div className="profile-summary"><span className="avatar avatar-dark large-avatar">أ</span><div><b>مرحباً بك في VYRA</b><small>أكمل ملفك الشخصي</small></div></div><div className="progress-label"><span>اكتمال الملف</span><b>40%</b></div><div className="progress-track"><span/></div><button className="outline-button" onClick={()=>{window.location.href="/account";}}>إكمال الملف الشخصي</button></section>
          <section className="side-card pulse-card"><div className="side-card-title"><h3><TrendingUp size={17}/> رائج الآن</h3><span className="live-label">مباشر</span></div>{[["#تصميم_المستقبل","2.4 ألف منشور"],["#صناع_المحتوى","1.8 ألف منشور"],["#تقنية","960 منشور"]].map(([tag,count])=><button className="trend-row" key={tag} onClick={()=>setQuery(tag.replace("#",""))}><span><b>{tag}</b><small>{count}</small></span><MoreHorizontal size={17}/></button>)}</section>
          <section className="side-card quick-card"><div className="side-card-title"><h3>مساحات سريعة</h3><WandSparkles size={17}/></div><button onClick={()=>setActive("إنشاء قناة")}><span className="quick-icon"><Radio size={17}/></span><span><b>أنشئ قناتك</b><small>شارك فيديوهاتك وأفكارك</small></span><Plus size={17}/></button><button onClick={()=>setActive("إنشاء مجتمع")}><span className="quick-icon"><UsersRound size={17}/></span><span><b>ابدأ مجتمعاً</b><small>اجمع الأشخاص حول اهتمام</small></span><Plus size={17}/></button><button onClick={()=>setActive("إنشاء صفحة")}><span className="quick-icon"><Sparkles size={17}/></span><span><b>أنشئ صفحة</b><small>ابنِ حضورك العام</small></span><Plus size={17}/></button></section>
          <div className="footer-links"><span>حول VYRA</span><span>الخصوصية</span><span>الشروط</span><span>المساعدة</span><small>© 2026 VYRA</small></div>
        </aside></div>
      </div>
    </section>
    {commentPost && <div style={{position:"fixed",inset:0,zIndex:80,background:"rgba(0,0,0,.45)",display:"grid",placeItems:"center",padding:16}} onClick={()=>setCommentPost(null)}><section dir="rtl" onClick={e=>e.stopPropagation()} style={{width:"min(520px,100%)",maxHeight:"80vh",overflow:"auto",background:"#fff",borderRadius:16,padding:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={{margin:0}}>التعليقات</h2><button onClick={()=>setCommentPost(null)}>إغلاق ✕</button></div><div style={{padding:"18px 0",minHeight:100}}>{comments.length ? comments.map(item=><article key={item.id} style={{padding:"10px 0",borderBottom:"1px solid #eee"}}><p style={{margin:"0 0 5px"}}>{item.body}</p><small style={{color:"#888"}}>{new Date(item.created_at).toLocaleString("ar")}</small></article>) : <p style={{color:"#888"}}>لا توجد تعليقات بعد.</p>}</div><div style={{display:"flex",gap:8}}><input value={commentDraft} onChange={e=>setCommentDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendComment();}} placeholder="اكتب تعليقاً..." style={{flex:1,minWidth:0,padding:11,border:"1px solid #ddd",borderRadius:9}}/><button onClick={sendComment} disabled={!commentDraft.trim()} style={{background:"#090909",color:"#fff",padding:"0 16px",borderRadius:9}}>إرسال</button></div></section></div>}
    {notice && <div className="toast"><Check size={17}/>{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}
  </main>;
}
function Brand() { return <div className="brand"><span className="brand-mark">V</span><span className="brand-word">VYRA</span></div>; }
