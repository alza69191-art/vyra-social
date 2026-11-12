"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPublicPosts, createPost, toggleReaction, getComments, createComment, uploadMedia, toggleBookmark, deletePost, updatePost, getMyProfile, type VyraComment } from "@/lib/vyra-api";
import AuthGate from "@/components/auth-gate";
import { Home, Compass, Clapperboard, Users, MessageCircle, Bell, Bookmark, Radio, Store, Gavel, UsersRound, Settings, Search, Plus, Image as ImageIcon, Video, Smile, MoreHorizontal, Heart, MessageSquare, Share2, Send, ChevronDown, Sparkles, PanelLeftClose, Menu, X, Check, TrendingUp, CircleHelp, WandSparkles, Hash } from "lucide-react";

const navigation = [
  { label: "الرئيسية", icon: Home, active: true },
  { label: "الرسائل", icon: MessageCircle },
  { label: "القصص", icon: Clapperboard },
  { label: "قناتي", icon: TrendingUp },
  { label: "الإعلانات", icon: Radio },
  { label: "الذكاء الاصطناعي", icon: Sparkles },
  { label: "المجتمعات", icon: UsersRound },
  { label: "الأسواق", icon: Store },
  { label: "الصفحات", icon: Compass },
  { label: "المحفوظات", icon: Bookmark },
  { label: "مركز المساعدة", icon: CircleHelp },
];
const stories = [{ name: "قصتك", initials: "+", own: true }];
const initialPosts: Array<{ id: string | number; authorId?: string; visibility?: "public"|"followers"|"private"; name: string; handle: string; avatar: string; time: string; text: string; likes: number; comments: number; shares: number; tag: string; liked: boolean; media?: Array<{ url: string; media_type: string }> }> = [];

export default function HomePage() { return <AuthGate><HomeFeed /></AuthGate>; }

function HomeFeed() {
  const [active, setActive] = useState("الرئيسية");
  const [posts, setPosts] = useState<Array<{ id: string | number; authorId?: string; visibility?: "public"|"followers"|"private"; name: string; handle: string; avatar: string; time: string; text: string; likes: number; comments: number; shares: number; tag: string; liked: boolean; media?: Array<{ url: string; media_type: string }> }>>(initialPosts);
  const [draft, setDraft] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  useEffect(()=>{const saved=localStorage.getItem("vyra_default_audience");if(saved==="public"||saved==="followers"||saved==="private")setVisibility(saved);},[]);
  const [reactionMenu, setReactionMenu] = useState<string | null>(null);
  const [postMenu, setPostMenu] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editVisibility, setEditVisibility] = useState<"public" | "followers" | "private">("public");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const mediaInput = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [sponsoredAds, setSponsoredAds] = useState<Array<{id:string;brand_name:string;title:string;body:string|null;destination_url:string;media_url:string|null}>>([]);
  useEffect(()=>{fetch((process.env.NEXT_PUBLIC_API_URL||"https://vyra-api-9pxl.onrender.com").replace(/\/+$/,"")+"/api/ads?limit=4",{cache:"no-store"}).then(r=>r.ok?r.json():[]).then(setSponsoredAds).catch(()=>setSponsoredAds([]));},[]);
  useEffect(() => { const token=sessionStorage.getItem("vyra_access_token"); if(!token)return; const load=()=>fetch((process.env.NEXT_PUBLIC_API_URL||"https://vyra-api-9pxl.onrender.com").replace(/\/$/,"")+"/api/notifications",{headers:{Authorization:"Bearer "+token},cache:"no-store"}).then(r=>r.ok?r.json():[]).then(rows=>setUnreadNotifications(rows.filter((n:any)=>!n.read).length)).catch(()=>undefined); load(); const timer=setInterval(load,20000); return()=>clearInterval(timer); },[]);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const [commentPost, setCommentPost] = useState<string | null>(null);
  const [comments, setComments] = useState<VyraComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  useEffect(() => {
    const token = sessionStorage.getItem("vyra_access_token");
    if (token) getMyProfile(token).then(profile => setCurrentUserId(profile.id)).catch(() => undefined);
    let activeRequest = true;
    getPublicPosts(30, 0).then(rows => {
      if (!activeRequest) return;
      setPosts(rows.map(row => ({
        id: row.id,
        authorId: row.author_id,
        visibility: row.visibility,
        name: row.author_name || "عضو VYRA",
        handle: "@" + (row.author_username || "member"),
        avatar: row.avatar_url || "V",
        time: new Date(row.created_at).toLocaleString("ar"),
        text: row.body || "",
        likes: row.likes_count || 0,
        comments: row.comments_count || 0,
        shares: 0,
        tag: "منشور",
        liked: false,
        media: row.media || [],
      })));
    }).catch((error) => {
      setPosts([]);
      setNotice(error instanceof Error ? error.message : "تعذر تحميل المنشورات.");
    });
    return () => { activeRequest = false; };
  }, []);
  const filteredPosts = useMemo(() => posts.filter(p => (p.text + p.name + p.tag).toLowerCase().includes(query.toLowerCase())), [posts, query]);
  async function publish() {
    const body = draft.trim();
    const token = sessionStorage.getItem("vyra_access_token");
    if ((!body && selectedFiles.length === 0) || !token) return;
    let createdPostId: string | null = null;
    try {
      const created = await createPost(token, body, visibility);
      createdPostId = created.id;
      setNotice("جارٍ رفع الصور والفيديوهات...");
      const uploaded: Array<{url:string;media_type:string}> = [];
      for (let index = 0; index < selectedFiles.length; index += 2) {
        const batch = selectedFiles.slice(index, index + 2);
        const results = await Promise.all(batch.map(file => uploadMedia(token, file, "post", created.id)));
        uploaded.push(...results.map(item => ({ url: item.url, media_type: item.media_type })));
      }
      setPosts(current => [{ id: created.id, authorId: created.author_id, visibility: created.visibility, name: "أنت", handle: "@your.profile", avatar: "أ", time: "الآن", text: created.body || "", likes: 0, comments: 0, shares: 0, tag: "منشور جديد", liked: false, media: uploaded }, ...current]);
      setDraft(""); setSelectedFiles([]); setVisibility("public"); setNotice("تم نشر المنشور ورفع الوسائط"); setTimeout(() => setNotice(""), 2500);
    } catch (error) {
      if (createdPostId) { try { await deletePost(token, createdPostId); } catch { /* Keep the original publish error visible. */ } }
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
    try { const item = await createComment(token, commentPost, commentDraft.trim()); setComments(current => [...current, item]); setPosts(current => current.map(post => String(post.id) === commentPost ? { ...post, comments: post.comments + 1 } : post)); setCommentDraft(""); }
    catch (error) { setNotice(error instanceof Error ? error.message : "تعذر إضافة التعليق"); }
  }

  const viewedPosts = useRef(new Set<string>());
  async function trackPostView(id: string | number) {
    const key = String(id);
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token || viewedPosts.current.has(key)) return;
    viewedPosts.current.add(key);
    try { await fetch((process.env.NEXT_PUBLIC_API_URL || "https://vyra-api-9pxl.onrender.com").replace(/\\/$/, "") + "/api/posts/" + encodeURIComponent(key) + "/view", { method: "POST", headers: { Authorization: "Bearer " + token } }); }
    catch { viewedPosts.current.delete(key); }
  }

  async function savePost(id: string | number) {
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token) return;
    try {
      const result = await toggleBookmark(token, String(id));
      setNotice(result.saved ? "تم حفظ المنشور في المحفوظات." : "تمت إزالة المنشور من المحفوظات.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر حفظ المنشور.");
    }
  }
  async function toggleLike(id: string | number, reaction: "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry" | "dislike" = "like") {
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token) return;
    try {
      const result = await toggleReaction(token, String(id), reaction);
      setPosts(current => current.map(p => p.id === id ? { ...p, liked: result.reacted, likes: Math.max(0, p.likes + (result.reacted ? (p.liked ? 0 : 1) : -1)) } : p));
      setReactionMenu(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر حفظ التفاعل");
      setTimeout(() => setNotice(""), 3000);
    }
  }
  return <main className={focus ? "app-shell focus-mode" : "app-shell"}>
    <header className="mobile-header">
      <button className="icon-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="القائمة">{mobileOpen ? <X/> : <Menu/>}</button><Brand/>
      
    </header>
    <aside className={mobileOpen ? "sidebar sidebar-open" : "sidebar"}>
      <div className="brand-row"><Brand/><button className="collapse-button" onClick={() => setFocus(!focus)} title="وضع التركيز"><PanelLeftClose size={18}/></button></div>
      <button className="profile-switch" onClick={() => setAccountMenu(value=>!value)}><span className="avatar avatar-dark">V</span><span className="profile-meta"><b>حسابك الشخصي</b><small>ملفك على VYRA</small></span><ChevronDown size={16}/></button>
      {accountMenu&&<div style={{position:"absolute",top:112,right:18,zIndex:40,width:230,background:"#fff",border:"1px solid #eee",borderRadius:15,padding:8,boxShadow:"0 15px 45px #0002"}}><div style={{padding:"10px 11px",borderBottom:"1px solid #eee",marginBottom:5}}><b>إدارة حسابك</b><small style={{display:"block",color:"#888",marginTop:3}}>إعدادات VYRA والاختصارات</small></div>{[["الملف الشخصي","/account"],["الإعدادات","/settings"],["الأصدقاء","/friends"],["قناتي","/channel"],["القصص","/stories"],["الإعلانات","/ads"],["الرسائل","/messages"],["الإشعارات","/notifications"],["الدعم الفني","/support"],["المحفوظات والمفضلة","/saved"],["الذكاء الاصطناعي","/ai"],["مركز المساعدة","/help"]].map(([label,url])=><button key={url} onClick={()=>window.location.href=url} style={{display:"block",width:"100%",textAlign:"right",padding:10,borderRadius:8}}>{label}</button>)}<button onClick={()=>{sessionStorage.removeItem("vyra_access_token");sessionStorage.removeItem("vyra_user");window.location.href="/login"}} style={{display:"block",width:"100%",textAlign:"right",padding:10,color:"#b42318",borderTop:"1px solid #eee",marginTop:4}}>تسجيل الخروج</button></div>}
      <div className="nav-caption">مساحتك</div>
      <nav className="main-nav">{navigation.map(item => { const Icon = item.icon; return <button key={item.label} className={active === item.label ? "nav-item active" : "nav-item"} onClick={() => {if(item.label === "الرسائل"){window.location.href="/messages";return;}if(item.label === "القصص"){window.location.href="/stories";return;}if(item.label === "قناتي"){window.location.href="/channel";return;}if(item.label === "الإعلانات"){window.location.href="/ads";return;}if(item.label === "الذكاء الاصطناعي"){window.location.href="/ai";return;}if(item.label === "المجتمعات"){window.location.href="/groups";return;}if(item.label === "الأسواق"){window.location.href="/market";return;}if(item.label === "الصفحات"){window.location.href="/pages";return;}if(item.label === "المحفوظات"){window.location.href="/saved";return;}if(item.label === "مركز المساعدة"){window.location.href="/help";return;}setActive(item.label);setMobileOpen(false);}}><Icon size={19}/><span>{item.label}</span></button>; })}</nav>
      <div className="nav-caption secondary-caption">إدارة وتخصيص</div>
      <nav className="main-nav"><button className="nav-item" onClick={() => {window.location.href="/account";}}><Settings size={19}/><span>إعدادات الحساب</span></button></nav>
      <div className="sidebar-bottom"><div className="online-dot"/><span>مساحتك جاهزة للإبداع</span></div>
    </aside>
    <section className="main-area">
      <div className="topbar"><div className="breadcrumb"><span>مساحتك</span><span className="crumb-slash">/</span><b>{active}</b></div>
        <div className="top-actions"><button className="icon-button" aria-label="الإشعارات" title="الإشعارات" onClick={()=>window.location.href="/notifications"} style={{position:"relative"}}><Bell size={19}/>{unreadNotifications>0&&<span style={{position:"absolute",top:-3,left:-3,minWidth:17,height:17,padding:"0 4px",borderRadius:20,background:"#c0392b",color:"#fff",fontSize:10,lineHeight:"17px"}}>{unreadNotifications>99?"99+":unreadNotifications}</span>}</button><label className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث في المنشورات المحمّلة..."/><kbd>⌘ K</kbd></label><span className="avatar avatar-dark top-avatar">أ</span></div>
      </div>
      <div className="content-wrap">
        <div className="welcome-row"><div><div className="eyebrow"><Sparkles size={14}/> مساحتك الاجتماعية</div><h1>مرحباً بعودتك<span>.</span></h1><p>اكتشف الجديد، وشارك لحظاتك مع مجتمعك.</p></div><button className="black-button" onClick={() => document.getElementById("composer")?.scrollIntoView({behavior:"smooth"})}><Plus size={18}/> إنشاء منشور</button></div>
        <div className="content-grid"><div className="feed-column">
          
          <section className="composer-card" id="composer"><div className="composer-top"><span className="avatar avatar-dark">أ</span><button className="composer-input" onClick={()=>document.getElementById("post-input")?.focus()}>بماذا تفكر اليوم؟</button></div>
            <textarea id="post-input" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="اكتب شيئاً يستحق المشاركة..." rows={draft ? 3 : 1}/>{selectedFiles.length>0 && <div style={{display:"flex",gap:8,flexWrap:"wrap",padding:"8px 0"}}>{selectedFiles.map((file,index)=><span key={index} style={{border:"1px solid #000",padding:"5px 9px",borderRadius:8,fontSize:12}}>{file.name}<button type="button" onClick={()=>setSelectedFiles(items=>items.filter((_,i)=>i!==index))} style={{marginInlineStart:8}}>×</button></span>)}</div>}<input ref={mediaInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple hidden onChange={e=>{const next=Array.from(e.target.files||[]);const valid=next.filter(file=>{const max=file.type.startsWith("video/")?100:15;if(file.size>max*1024*1024){setNotice(`الحد الأقصى للملف ${max} MB: ${file.name}`);return false;}return true;});setSelectedFiles(current=>[...current,...valid].slice(0,5));e.currentTarget.value="";}}/>
            <div className="composer-footer"><div className="composer-tools"><button type="button" onClick={()=>mediaInput.current?.click()}><ImageIcon size={18}/> صورة / فيديو</button><button className="emoji-tool" onClick={()=>setDraft(draft+" ✨")}><Smile size={18}/></button><label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#777"}}>الجمهور <select value={visibility} onChange={e=>setVisibility(e.target.value as "public"|"followers"|"private")} style={{border:"1px solid #ddd",borderRadius:7,padding:"5px",background:"#fff",font:"inherit",color:"#222"}}><option value="public">عام</option><option value="followers">المتابعون</option><option value="private">أنا فقط</option></select></label></div><button className="publish-button" disabled={!draft.trim() && selectedFiles.length === 0} onClick={publish}>نشر <Send size={15}/></button></div>
          </section>
          <div className="feed-heading"><div><h2>آخر المنشورات</h2><span>من مجتمعك</span></div><span className="sort-button" aria-label="ترتيب المنشورات">الأحدث أولاً</span></div>
          {sponsoredAds.map(ad=><article className="post-card" key={"ad-"+ad.id}><div className="post-header"><span className="avatar avatar-soft">AD</span><div className="post-author"><b>{ad.brand_name}</b><small>إعلان ممول · VYRA</small></div></div><h3>{ad.title}</h3>{ad.body&&<p>{ad.body}</p>}{ad.media_url&&<img src={ad.media_url} alt="" style={{width:"100%",maxHeight:320,objectFit:"contain",borderRadius:12}}/>}<a href={ad.destination_url} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",marginTop:10,padding:"9px 14px",borderRadius:9,background:"#24211d",color:"#fff",textDecoration:"none"}}>زيارة الموقع</a></article>)}
          {filteredPosts.map(post=><article className="post-card" key={post.id} onMouseEnter={()=>trackPostView(post.id)} onTouchStart={()=>trackPostView(post.id)}><div className="post-header">{post.avatar.startsWith("http") ? <img className="avatar avatar-soft" src={post.avatar} alt="" style={{objectFit:"cover"}}/> : <span className="avatar avatar-soft">{post.avatar}</span>}<div className="post-author"><b>{post.name}</b><small>{post.handle} · {post.time}</small></div><div style={{position:"relative"}}><button className="icon-button more-button" aria-label="خيارات المنشور" title="خيارات المنشور" onClick={()=>setPostMenu(postMenu===String(post.id)?null:String(post.id))}><MoreHorizontal/></button>{postMenu===String(post.id)&&<div style={{position:"absolute",left:0,top:40,zIndex:8,minWidth:180,background:"#fff",border:"1px solid #eee",borderRadius:13,padding:7,boxShadow:"0 12px 35px #0002",display:"grid",gap:3}}><button onClick={()=>{savePost(post.id);setPostMenu(null)}} style={menuItem}><Bookmark size={15}/> حفظ في المفضلة</button>{post.authorId===currentUserId&&<><button onClick={()=>{setEditingPost(String(post.id));setEditDraft(post.text);setEditVisibility(post.visibility || "public");setPostMenu(null)}} style={menuItem}><Settings size={15}/> تعديل المنشور</button><button onClick={async()=>{const token=sessionStorage.getItem("vyra_access_token");if(!token)return;if(!window.confirm("هل تريد حذف هذا المنشور نهائياً؟"))return;try{await deletePost(token,String(post.id));setPosts(items=>items.filter(item=>item.id!==post.id));setNotice("تم حذف المنشور");}catch(error){setNotice(error instanceof Error?error.message:"تعذر حذف المنشور");}setPostMenu(null)}} style={{...menuItem,color:"#b42318"}}><X size={15}/> حذف المنشور</button></>}</div>}</div></div><p className="post-text">{post.text}</p>{post.media?.length ? <div style={{display:"grid",gap:8,margin:"12px 0"}}>{post.media.map((item,index)=>item.media_type==="video" ? <video key={index} src={item.url} controls playsInline preload="none" style={{width:"100%",maxHeight:420,borderRadius:12}}/> : <img key={index} src={item.url} alt="وسائط المنشور" loading="lazy" style={{width:"100%",maxHeight:480,objectFit:"contain",borderRadius:12}}/>)}</div> : null}<div className="post-tag"><Hash size={13}/>{post.tag}</div><div className="post-stats"><span>{post.likes} إعجاب</span><span>{post.comments} تعليق</span></div><div className="post-actions"><div style={{position:"relative"}}><button className={post.liked?"liked":""} onClick={()=>toggleLike(post.id)} onContextMenu={e=>{e.preventDefault();setReactionMenu(reactionMenu===String(post.id)?null:String(post.id));}}><Heart size={18} fill={post.liked?"currentColor":"none"}/> إعجاب</button><button aria-label="اختيار تفاعل" title="اختيار تفاعل" onClick={()=>setReactionMenu(reactionMenu===String(post.id)?null:String(post.id))} style={{fontSize:10,marginInlineStart:4}}>⌄</button>{reactionMenu===String(post.id)&&<div style={{position:"absolute",bottom:"calc(100% + 8px)",right:0,zIndex:5,display:"flex",gap:5,padding:8,background:"#fff",border:"1px solid #eee",borderRadius:14,boxShadow:"0 8px 30px #0002"}}>{[["👍","like"],["❤️","love"],["🤗","care"],["😂","haha"],["😮","wow"],["😢","sad"],["😡","angry"],["👎","dislike"]].map(([emoji,type])=><button key={type} title={type} onClick={()=>toggleLike(post.id,type as "like"|"love"|"care"|"haha"|"wow"|"sad"|"angry"|"dislike")} style={{fontSize:21,padding:3}}>{emoji}</button>)}</div>}</div><button onClick={()=>openComments(post.id)}><MessageSquare size={18}/> تعليق</button><button onClick={async()=>{const url=window.location.origin+"/?post="+post.id;try{if(navigator.share)await navigator.share({title:"منشور على VYRA",url});else{await navigator.clipboard.writeText(url);setNotice("تم نسخ رابط المنشور");}}catch{setNotice("تعذر فتح المشاركة");}}}><Share2 size={18}/> مشاركة</button></div></article>)}
          {filteredPosts.length===0 && <div className="empty-state">لا توجد منشورات تطابق بحثك.</div>}
        </div>
        <aside className="right-column">
          
          
          <section className="side-card quick-card"><div className="side-card-title"><h3>مساحات سريعة</h3><WandSparkles size={17}/></div><button onClick={()=>{window.location.href="/groups";}}><span className="quick-icon"><UsersRound size={17}/></span><span><b>استكشف المجتمعات</b><small>أنشئ مجتمعاً أو انضم لآخر</small></span><Plus size={17}/></button><button onClick={()=>{window.location.href="/pages";}}><span className="quick-icon"><Sparkles size={17}/></span><span><b>إدارة الصفحات</b><small>أنشئ صفحة عامة</small></span><Plus size={17}/></button><button onClick={()=>{window.location.href="/market";}}><span className="quick-icon"><Store size={17}/></span><span><b>الأسواق</b><small>اعرض منتجاتك واكتشف العروض</small></span><Plus size={17}/></button></section>
          <div className="footer-links"><small>© 2026 VYRA</small></div>
        </aside></div>
      </div>
    </section>
    {editingPost && <div style={{position:"fixed",inset:0,zIndex:90,background:"rgba(0,0,0,.5)",display:"grid",placeItems:"center",padding:16}} onClick={()=>setEditingPost(null)}><section dir="rtl" onClick={e=>e.stopPropagation()} style={{width:"min(560px,100%)",background:"#fff",borderRadius:18,padding:22,boxShadow:"0 25px 80px #0003"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={{margin:0}}>تعديل المنشور</h2><button onClick={()=>setEditingPost(null)}>✕</button></div><textarea value={editDraft} onChange={e=>setEditDraft(e.target.value)} rows={6} maxLength={10000} style={{width:"100%",marginTop:16,padding:13,border:"1px solid #ddd",borderRadius:12,resize:"vertical",font:"inherit"}}/><label style={{display:"grid",gap:6,marginTop:12}}>الجمهور<select value={editVisibility} onChange={e=>setEditVisibility(e.target.value as typeof editVisibility)} style={{padding:11,border:"1px solid #ddd",borderRadius:9,background:"#fff"}}><option value="public">عام</option><option value="followers">المتابعون</option><option value="private">أنا فقط</option></select></label><button className="black-button" style={{marginTop:16,width:"100%",justifyContent:"center"}} onClick={async()=>{const token=sessionStorage.getItem("vyra_access_token");if(!token||!editingPost)return;try{await updatePost(token,editingPost,editDraft,editVisibility);setPosts(items=>items.map(item=>String(item.id)===editingPost?{...item,text:editDraft,visibility:editVisibility}:item));setEditingPost(null);setNotice("تم تحديث المنشور");}catch(error){setNotice(error instanceof Error?error.message:"تعذر تعديل المنشور");}}}>حفظ التعديلات</button></section></div>}
    {commentPost && <div style={{position:"fixed",inset:0,zIndex:80,background:"rgba(0,0,0,.45)",display:"grid",placeItems:"center",padding:16}} onClick={()=>setCommentPost(null)}><section dir="rtl" onClick={e=>e.stopPropagation()} style={{width:"min(520px,100%)",maxHeight:"80vh",overflow:"auto",background:"#fff",borderRadius:16,padding:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={{margin:0}}>التعليقات</h2><button onClick={()=>setCommentPost(null)}>إغلاق ✕</button></div><div style={{padding:"18px 0",minHeight:100}}>{comments.length ? comments.map(item=><article key={item.id} style={{padding:"10px 0",borderBottom:"1px solid #eee"}}><p style={{margin:"0 0 5px"}}>{item.body}</p><small style={{color:"#888"}}>{new Date(item.created_at).toLocaleString("ar")}</small></article>) : <p style={{color:"#888"}}>لا توجد تعليقات بعد.</p>}</div><div style={{display:"flex",gap:8}}><input value={commentDraft} onChange={e=>setCommentDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendComment();}} placeholder="اكتب تعليقاً..." style={{flex:1,minWidth:0,padding:11,border:"1px solid #ddd",borderRadius:9}}/><button onClick={sendComment} disabled={!commentDraft.trim()} style={{background:"#090909",color:"#fff",padding:"0 16px",borderRadius:9}}>إرسال</button></div></section></div>}
    {notice && <div className="toast"><Check size={17}/>{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}
  </main>;
}
function Brand() { return <div className="brand"><span className="brand-mark">V</span><span className="brand-word">VYRA</span></div>; }

const menuItem = {display:"flex",alignItems:"center",gap:9,padding:"10px 11px",borderRadius:8,textAlign:"right",fontSize:12,whiteSpace:"nowrap"} as const;
