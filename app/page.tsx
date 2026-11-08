"use client";
import { useMemo, useState } from "react";
import { Home, Compass, Clapperboard, Users, MessageCircle, Bell, Bookmark, Radio, Store, Gavel, UsersRound, Settings, Search, Plus, Image as ImageIcon, Video, Smile, MoreHorizontal, Heart, MessageSquare, Share2, Send, ChevronDown, Sparkles, PanelLeftClose, Menu, X, Check, TrendingUp, CircleHelp, WandSparkles, Hash } from "lucide-react";

const navigation = [
  { label: "الرئيسية", icon: Home, active: true },
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
const initialPosts = [
  { id: 1, name: "ليان أحمد", handle: "@layan.ah", avatar: "ل", time: "منذ 12 دقيقة", text: "أحياناً أجمل الأفكار تبدأ بخطوة صغيرة. اليوم قررت أبدأ مشروعاً جديداً وأشارك رحلتي معكم. ✨", likes: 128, comments: 24, shares: 8, tag: "إلهام", liked: false },
  { id: 2, name: "استوديو عدسة", handle: "@lens.studio", avatar: "ع", time: "منذ 38 دقيقة", text: "تفاصيل بسيطة، لكنها تصنع فرقاً كبيراً. ما رأيكم بهذا الأسلوب البصري؟", likes: 86, comments: 17, shares: 12, tag: "تصميم", liked: true },
];

export default function HomePage() {
  const [active, setActive] = useState("الرئيسية");
  const [posts, setPosts] = useState(initialPosts);
  const [draft, setDraft] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const filteredPosts = useMemo(() => posts.filter(p => (p.text + p.name + p.tag).toLowerCase().includes(query.toLowerCase())), [posts, query]);
  function publish() {
    if (!draft.trim()) return;
    setPosts([{ id: Date.now(), name: "أنت", handle: "@your.profile", avatar: "أ", time: "الآن", text: draft.trim(), likes: 0, comments: 0, shares: 0, tag: "منشور جديد", liked: false }, ...posts]);
    setDraft(""); setNotice("تم نشر منشورك بنجاح"); setTimeout(() => setNotice(""), 2500);
  }
  function toggleLike(id: number) {
    setPosts(current => current.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p));
  }
  return <main className={focus ? "app-shell focus-mode" : "app-shell"}>
    <header className="mobile-header">
      <button className="icon-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="القائمة">{mobileOpen ? <X/> : <Menu/>}</button><Brand/>
      <button className="icon-button" onClick={() => setActive("الإشعارات")} aria-label="الإشعارات"><Bell/></button>
    </header>
    <aside className={mobileOpen ? "sidebar sidebar-open" : "sidebar"}>
      <div className="brand-row"><Brand/><button className="collapse-button" onClick={() => setFocus(!focus)} title="وضع التركيز"><PanelLeftClose size={18}/></button></div>
      <button className="profile-switch" onClick={() => setNotice("إدارة الحسابات ستتوفر قريباً")}><span className="avatar avatar-dark">أ</span><span className="profile-meta"><b>حسابك الشخصي</b><small>@your.profile</small></span><ChevronDown size={16}/></button>
      <div className="nav-caption">مساحتك</div>
      <nav className="main-nav">{navigation.map(item => { const Icon = item.icon; return <button key={item.label} className={active === item.label ? "nav-item active" : "nav-item"} onClick={() => {setActive(item.label);setMobileOpen(false);}}><Icon size={19}/><span>{item.label}</span>{item.tag && <em>{item.tag}</em>}{item.count && <small className="nav-count">{item.count}</small>}</button>; })}</nav>
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
            <textarea id="post-input" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="اكتب شيئاً يستحق المشاركة..." rows={draft ? 3 : 1}/>
            <div className="composer-footer"><div className="composer-tools"><button onClick={()=>setNotice("رفع الصور سيكون متاحاً بعد ربط التخزين")}><ImageIcon size={18}/> صورة</button><button onClick={()=>setNotice("رفع الفيديو سيكون متاحاً بعد ربط التخزين")}><Video size={18}/> فيديو</button><button onClick={()=>setNotice("الاستطلاعات ستتوفر قريباً")}><TrendingUp size={18}/> استطلاع</button><button className="emoji-tool" onClick={()=>setDraft(draft+" ✨")}><Smile size={18}/></button></div><button className="publish-button" disabled={!draft.trim()} onClick={publish}>نشر <Send size={15}/></button></div>
          </section>
          <div className="feed-heading"><div><h2>آخر المنشورات</h2><span>من مجتمعك</span></div><button className="sort-button">الأحدث أولاً <ChevronDown size={15}/></button></div>
          {filteredPosts.map(post=><article className="post-card" key={post.id}><div className="post-header"><span className="avatar avatar-soft">{post.avatar}</span><div className="post-author"><b>{post.name}</b><small>{post.handle} · {post.time}</small></div><button className="icon-button more-button" aria-label="المزيد"><MoreHorizontal/></button></div><p className="post-text">{post.text}</p><div className="post-tag"><Hash size={13}/>{post.tag}</div><div className="post-stats"><span>{post.likes} إعجاب</span><span>{post.comments} تعليق · {post.shares} مشاركة</span></div><div className="post-actions"><button className={post.liked?"liked":""} onClick={()=>toggleLike(post.id)}><Heart size={18} fill={post.liked?"currentColor":"none"}/> إعجاب</button><button onClick={()=>setNotice("التعليقات ستتوفر بعد ربط قاعدة البيانات")}><MessageSquare size={18}/> تعليق</button><button onClick={()=>setNotice("المشاركة ستتوفر قريباً")}><Share2 size={18}/> مشاركة</button></div></article>)}
          {filteredPosts.length===0 && <div className="empty-state">لا توجد منشورات تطابق بحثك.</div>}
        </div>
        <aside className="right-column">
          <section className="side-card profile-card"><div className="side-card-title"><h3>ملفك الشخصي</h3><button className="subtle-link" onClick={()=>setActive("الملف الشخصي")}>عرض</button></div><div className="profile-summary"><span className="avatar avatar-dark large-avatar">أ</span><div><b>مرحباً بك في VYRA</b><small>أكمل ملفك الشخصي</small></div></div><div className="progress-label"><span>اكتمال الملف</span><b>40%</b></div><div className="progress-track"><span/></div><button className="outline-button" onClick={()=>setActive("تعديل الملف الشخصي")}>إكمال الملف الشخصي</button></section>
          <section className="side-card pulse-card"><div className="side-card-title"><h3><TrendingUp size={17}/> رائج الآن</h3><span className="live-label">مباشر</span></div>{[["#تصميم_المستقبل","2.4 ألف منشور"],["#صناع_المحتوى","1.8 ألف منشور"],["#تقنية","960 منشور"]].map(([tag,count])=><button className="trend-row" key={tag} onClick={()=>setQuery(tag.replace("#",""))}><span><b>{tag}</b><small>{count}</small></span><MoreHorizontal size={17}/></button>)}</section>
          <section className="side-card quick-card"><div className="side-card-title"><h3>مساحات سريعة</h3><WandSparkles size={17}/></div><button onClick={()=>setActive("إنشاء قناة")}><span className="quick-icon"><Radio size={17}/></span><span><b>أنشئ قناتك</b><small>شارك فيديوهاتك وأفكارك</small></span><Plus size={17}/></button><button onClick={()=>setActive("إنشاء مجتمع")}><span className="quick-icon"><UsersRound size={17}/></span><span><b>ابدأ مجتمعاً</b><small>اجمع الأشخاص حول اهتمام</small></span><Plus size={17}/></button><button onClick={()=>setActive("إنشاء صفحة")}><span className="quick-icon"><Sparkles size={17}/></span><span><b>أنشئ صفحة</b><small>ابنِ حضورك العام</small></span><Plus size={17}/></button></section>
          <div className="footer-links"><span>حول VYRA</span><span>الخصوصية</span><span>الشروط</span><span>المساعدة</span><small>© 2026 VYRA</small></div>
        </aside></div>
      </div>
    </section>
    {notice && <div className="toast"><Check size={17}/>{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}
  </main>;
}
function Brand() { return <div className="brand"><span className="brand-mark">V</span><span className="brand-word">VYRA</span></div>; }
