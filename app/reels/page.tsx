"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import { createPost, deletePost, getPublicReels, uploadVideoDirect, type VyraPost } from "@/lib/vyra-api";
import { ArrowRight, Plus, Video, X, UploadCloud, RefreshCw, Play, CheckCircle2 } from "lucide-react";

function token() {
  return typeof window === "undefined" ? "" : sessionStorage.getItem("vyra_access_token") || "";
}

function Reels() {
  const [rows, setRows] = useState<VyraPost[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [show, setShow] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const start = reset ? 0 : offset;
      const next = await getPublicReels(24, start);
      setRows((current) => reset ? next : [...current, ...next]);
      setOffset(start + next.length);
      setHasMore(next.length === 24);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر تحميل مقاطع الريلز.");
    } finally {
      setLoading(false);
    }
  }, [offset, loading]);

  useEffect(() => { void load(true); }, []);

  useEffect(() => {
    const root = listRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const videos = Array.from(root.querySelectorAll<HTMLVideoElement>("video[data-reel]"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
          video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      });
    }, { threshold: [0, 0.7, 1] });
    videos.forEach((video) => observer.observe(video));
    return () => observer.disconnect();
  }, [rows]);

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !token() || busy) return;
    if (!file.type.startsWith("video/")) {
      setNotice("اختر ملف فيديو صالحاً بصيغة مدعومة.");
      return;
    }
    setBusy(true);
    setProgress(0);
    setNotice("");
    let postId: string | null = null;
    try {
      const post = await createPost(token(), caption.trim(), "public");
      postId = post.id;
      await uploadVideoDirect(token(), file, post.id, setProgress);
      setNotice("تم رفع الفيديو والتحقق منه ونشره. سيظهر الآن في قائمة الريلز.");
      setShow(false);
      setFile(null);
      setCaption("");
      setOffset(0);
      await load(true);
    } catch (error) {
      if (postId) {
        try { await deletePost(token(), postId); } catch { /* preserve the original upload error */ }
      }
      setNotice(error instanceof Error ? error.message : "تعذر نشر الريلز. حاول مجدداً.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <main className="vyra-reels-page" dir="rtl">
      <header className="vyra-reels-header">
        <div className="vyra-reels-brand">
          <Link href="/" aria-label="العودة إلى VYRA"><ArrowRight size={18}/> الرئيسية</Link>
          <div><span>VYRA</span><small>مقاطع الفيديو القصيرة</small></div>
        </div>
        <button className="vyra-reels-primary" onClick={() => setShow(true)}><Plus size={17}/> إنشاء ريلز</button>
      </header>

      <section className="vyra-reels-intro">
        <div><span className="vyra-reels-eyebrow"><Video size={15}/> اكتشف الفيديو</span><h1>الريلز</h1><p>كل المنشورات التي تحتوي على فيديو عام تظهر هنا تلقائياً.</p></div>
        <div className="vyra-reels-intro-note"><Play size={17}/><span>تشغيل ذكي للمقاطع الظاهرة على الشاشة</span></div>
      </section>

      {notice && <p className="vyra-reels-notice" role="status">{notice}</p>}

      <section className="vyra-reels-grid" ref={listRef} aria-label="قائمة الريلز">
        {rows.map((post) => (
          <article className="vyra-reel-card" key={post.id}>
            <div className="vyra-reel-media">
              {(post.media || []).filter((media) => media.media_type === "video").map((media, index) => (
                <video data-reel key={media.url + index} src={media.url} controls playsInline muted loop preload="metadata" />
              ))}
              <span className="vyra-reel-play"><Play size={15} fill="currentColor"/></span>
            </div>
            <div className="vyra-reel-copy">
              <b>{post.author_name || "عضو VYRA"}</b>
              <p>{post.body || "مقطع جديد على VYRA"}</p>
              <small>{post.created_at ? new Date(post.created_at).toLocaleDateString("ar") : ""}</small>
            </div>
          </article>
        ))}
      </section>

      {!loading && rows.length === 0 && (
        <div className="vyra-reels-empty"><span><Video size={27}/></span><h2>لا توجد مقاطع بعد</h2><p>انشر فيديو من استوديو الإنشاء أو أنشئ أول ريلز لك.</p><button className="vyra-reels-primary" onClick={() => setShow(true)}><Plus size={16}/> نشر أول ريلز</button></div>
      )}
      {hasMore && rows.length > 0 && <div className="vyra-reels-load"><button className="vyra-reels-secondary" disabled={loading} onClick={() => void load()}><RefreshCw size={15}/>{loading ? "جارٍ التحميل..." : "تحميل المزيد"}</button></div>}
      {loading && <div className="vyra-reels-loading">جارٍ تحميل الفيديوهات...</div>}

      {show && (
        <div className="vyra-reels-overlay" onClick={() => !busy && setShow(false)}>
          <form className="vyra-reels-modal" onSubmit={publish} onClick={(event) => event.stopPropagation()}>
            <div className="vyra-reels-modal-head"><div><span className="vyra-reels-eyebrow"><Video size={15}/> نشر فيديو</span><h2>إنشاء ريلز جديد</h2></div><button type="button" aria-label="إغلاق" disabled={busy} onClick={() => setShow(false)}><X size={20}/></button></div>
            <label className="vyra-reels-file">
              <UploadCloud size={24}/>
              <b>{file ? file.name : "اختر ملف فيديو"}</b>
              <small>{file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · ${file.type || "فيديو"}` : "MP4 أو WebM أو MOV — الرفع المباشر يدعم الملفات الكبيرة"}</small>
              <input type="file" hidden accept="video/mp4,video/webm,video/quicktime" disabled={busy} onChange={(event) => setFile(event.target.files?.[0] || null)}/>
            </label>
            <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={2000} placeholder="اكتب وصف الفيديو (اختياري)"/>
            {busy && <div className="vyra-reels-progress"><div><span>رفع الفيديو إلى التخزين مباشرة</span><b>{progress}%</b></div><i><span style={{width: progress + "%"}}/></i><small>لا تمر بيانات الفيديو الكبيرة عبر خادم VYRA.</small></div>}
            <button className="vyra-reels-primary vyra-reels-submit" disabled={!file || busy}>{busy ? "جارٍ الرفع والتحقق..." : "نشر الريلز"}</button>
            <small className="vyra-reels-privacy"><CheckCircle2 size={14}/> سيتم نشر الفيديو كمنشور عام وإضافته تلقائياً إلى قائمة الريلز.</small>
          </form>
        </div>
      )}
    </main>
  );
}

export default function ReelsPage() {
  return <AuthGate><Reels/></AuthGate>;
}
