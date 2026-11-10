"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/auth-gate";
import { getMyProfile, saveProfile, uploadMedia, type VyraProfile } from "@/lib/vyra-api";

export default function AccountPage() {
  return <AuthGate><AccountEditor /></AuthGate>;
}

function AccountEditor() {
  const router = useRouter();
  const [profile, setProfile] = useState<VyraProfile | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token) return;
    getMyProfile(token).then(value => {
      setProfile(value);
      setUsername(value.username);
      setDisplayName(value.display_name);
      setBio(value.bio || "");
      setIsPrivate(value.is_private);
    }).catch(error => setMessage(error instanceof Error ? error.message : "تعذر تحميل الحساب"))
      .finally(() => setBusy(false));
  }, []);

  async function handleMediaUpload(file: File | undefined, purpose: "avatar" | "cover") {
    if (!file) return;
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token) { router.replace("/login"); return; }
    setUploading(true); setMessage("");
    try {
      const result = await uploadMedia(token, file, purpose);
      setProfile(current => current ? { ...current, ...(purpose === "avatar" ? { avatar_url: result.url } : { cover_url: result.url }) } : current);
      setMessage(purpose === "avatar" ? "تم تحديث الصورة الشخصية." : "تم تحديث صورة الغلاف.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر رفع الصورة.");
    } finally { setUploading(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const token = sessionStorage.getItem("vyra_access_token");
    if (!token) { router.replace("/login"); return; }
    setBusy(true);
    setMessage("");
    try {
      const saved = await saveProfile(token, { username, display_name: displayName, bio: bio || null, is_private: isPrivate });
      setProfile({ ...profile!, ...saved });
      setMessage("تم حفظ تغييرات الملف الشخصي.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ التغييرات.");
    } finally {
      setBusy(false);
    }
  }

  return <main dir="rtl" style={{minHeight:"100vh",padding:"32px 18px",background:"#ffffff"}}>
    <section style={{maxWidth:620,margin:"0 auto",background:"#ffffff",border:"1px solid #000000",borderRadius:18,padding:24}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <Link href="/" style={{color:"#000000",textDecoration:"none"}}>← العودة إلى VYRA</Link>
        <button type="button" onClick={() => { sessionStorage.removeItem("vyra_access_token"); sessionStorage.removeItem("vyra_user"); router.replace("/login"); }} style={{border:"1px solid #000",borderRadius:9,padding:"9px 13px",background:"#fff",color:"#000"}}>تسجيل الخروج</button>
      </div>
      <h1 style={{fontSize:25,margin:"24px 0 6px"}}>الملف الشخصي</h1>
      <p style={{color:"#000000",marginTop:0}}>عدّل معلومات حسابك واحفظها في قاعدة البيانات.</p>
      {profile && <div style={{display:"grid",gap:12,margin:"18px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          {profile.avatar_url ? <img src={profile.avatar_url} alt="الصورة الشخصية" style={{width:76,height:76,objectFit:"cover",borderRadius:"50%",border:"1px solid #000"}}/> : <div style={{width:76,height:76,borderRadius:"50%",border:"1px solid #000",display:"grid",placeItems:"center"}}>VYRA</div>}
          <label style={{display:"grid",gap:6}}>الصورة الشخصية<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={e=>{handleMediaUpload(e.target.files?.[0],"avatar");e.currentTarget.value="";}}/></label>
        </div>
        <div style={{display:"grid",gap:8}}>
          {profile.cover_url && <img src={profile.cover_url} alt="صورة الغلاف" style={{width:"100%",maxHeight:150,objectFit:"cover",border:"1px solid #000",borderRadius:10}}/>}
          <label style={{display:"grid",gap:6}}>صورة الغلاف<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={e=>{handleMediaUpload(e.target.files?.[0],"cover");e.currentTarget.value="";}}/></label>
        </div>
        {uploading && <p>جارٍ رفع الصورة...</p>}
      </div> }
      {busy && !profile ? <p>جارٍ تحميل بيانات الحساب...</p> : <form onSubmit={submit} style={{display:"grid",gap:16,marginTop:24}}>
        <label style={{display:"grid",gap:7}}>اسم العرض<input required maxLength={80} value={displayName} onChange={e=>setDisplayName(e.target.value)} style={field}/></label>
        <label style={{display:"grid",gap:7}}>اسم المستخدم<input required minLength={3} maxLength={30} pattern="[A-Za-z0-9_.]+" value={username} onChange={e=>setUsername(e.target.value)} style={field}/></label>
        <label style={{display:"grid",gap:7}}>نبذة عنك<textarea maxLength={300} rows={4} value={bio} onChange={e=>setBio(e.target.value)} style={field}/></label>
        <label style={{display:"flex",alignItems:"center",gap:9}}><input type="checkbox" checked={isPrivate} onChange={e=>setIsPrivate(e.target.checked)}/> حساب خاص</label>
        <button disabled={busy} style={{background:"#000000",color:"#fff",border:0,borderRadius:10,padding:13,cursor:"pointer"}}>{busy ? "جارٍ الحفظ..." : "حفظ التغييرات"}</button>
      </form>}
      {message && <p role="status" style={{marginTop:16,color:"#000000"}}>{message}</p>}
    </section>
  </main>;
}

const field = {width:"100%",padding:12,border:"1px solid #000000",borderRadius:9,font:"inherit",background:"#fff"} as const;
