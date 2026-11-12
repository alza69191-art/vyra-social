"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronDown, ShieldCheck, UserRound, Image, Users, Flag, CircleHelp, BookOpen, ArrowRight, LockKeyhole } from "lucide-react";

const sections = [
 { title:"الحساب وتسجيل الدخول", icon:UserRound, items:[
  ["كيف أنشئ حساباً؟","افتح صفحة التسجيل، أدخل بياناتك المطلوبة، ثم أكمل خطوات التحقق المتاحة. استخدم بريداً تملكه وكلمة مرور قوية."],
  ["كيف أسجل الدخول؟","استخدم البريد الإلكتروني وكلمة المرور أو خيار تسجيل الدخول عبر Google أو GitHub إذا كان متاحاً في صفحة الدخول."],
  ["كيف أعدّل ملفي الشخصي؟","من القائمة الجانبية اختر حسابك الشخصي أو إعدادات الحساب. يمكنك تعديل اسم العرض واسم المستخدم والنبذة والصورة الشخصية وصورة الغلاف."],
  ["كيف أجعل حسابي خاصاً؟","افتح إعدادات الحساب وفعّل خيار «حساب خاص» ثم احفظ التغييرات. قد تظل بعض المعلومات الأساسية ظاهرة لتشغيل الخدمة."]
 ]},
 { title:"المنشورات والتفاعل", icon:Image, items:[
  ["كيف أنشر نصاً أو صورة أو فيديو؟","من الصفحة الرئيسية استخدم مربع إنشاء منشور. اكتب النص أو اختر ملفات الوسائط ثم اضغط «نشر»."],
  ["كيف أتفاعل مع منشور؟","استخدم زر «إعجاب» للتفاعل، وزر «تعليق» لعرض التعليقات وإضافة تعليق."],
  ["كيف أحفظ منشوراً؟","اضغط رمز الحفظ في رأس المنشور. ستجد المنشورات المحفوظة في قسم «المحفوظات»."],
  ["ما أنواع الملفات المدعومة؟","يدعم الرفع صور JPEG وPNG وWEBP وGIF وفيديو MP4 وWEBM وMOV وفق حدود الحجم التي يطبقها التطبيق ومزود التخزين."]
 ]},
 { title:"المجتمعات والصفحات", icon:Users, items:[
  ["كيف أنشئ مجتمعاً؟","افتح «المجتمعات»، أدخل اسم المجتمع ووصفه ثم اضغط «إنشاء المجتمع»."],
  ["كيف أنضم إلى مجتمع؟","من صفحة المجتمعات اختر المجتمع المناسب واضغط «انضمام»."],
  ["كيف أنشئ صفحة عامة؟","افتح «الصفحات»، أدخل اسم الصفحة وتصنيفها ووصفها ثم اضغط «إنشاء صفحة»."],
  ["كيف أتابع صفحة؟","من قائمة الصفحات اضغط «متابعة». يمكنك إلغاء المتابعة من الزر نفسه."]
 ]},
 { title:"الخصوصية والأمان", icon:ShieldCheck, items:[
  ["كيف أحمي حسابي؟","استخدم كلمة مرور فريدة، لا تشارك رمز التحقق أو كلمة المرور، وسجّل الخروج من الأجهزة المشتركة."],
  ["كيف أتعامل مع رابط مشبوه؟","لا تفتح الروابط غير الموثوقة ولا تدخل بيانات الدخول في صفحات وصلت إليها عبر رسائل مجهولة. تحقق من عنوان الموقع."],
  ["كيف أبلغ عن إساءة؟","احتفظ برابط المحتوى أو تفاصيله، ثم تواصل مع فريق الدعم عبر قناة الدعم المتاحة في المنصة. أدوات الإبلاغ المباشر داخل المنشورات قيد التطوير إذا لم يظهر زر الإبلاغ."]
 ]},
 { title:"الميزات والتنقل", icon:CircleHelp, items:[
  ["ما الأقسام المتاحة حالياً؟","الصفحة الرئيسية، الذكاء الاصطناعي، المجتمعات، الأسواق، الصفحات، المحفوظات، الملف الشخصي ومركز المساعدة."],
  ["هل الرسائل والأحداث والإشعارات متاحة؟","لا تعرض هذه النسخة وظائف الرسائل الخاصة والأحداث والإشعارات الكاملة كميزات مكتملة. ستظهر هنا إرشاداتها بعد تفعيلها فعلياً."]
 ]}
];
export default function HelpPage(){
 const [query,setQuery]=useState("");
 const [opened,setOpened]=useState<string|null>(null);
 const filtered=useMemo(()=>sections.map(s=>({...s,items:s.items.filter(([q,a])=>(q+" "+a+" "+s.title).toLowerCase().includes(query.toLowerCase()))})).filter(s=>s.items.length),[query]);
 return <main dir="rtl" style={{minHeight:"100vh",background:"#f7f7f7",color:"#171717",padding:"28px 18px 60px"}}>
  <div style={{maxWidth:980,margin:"0 auto"}}>
   <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
    <Link href="/" style={{color:"#171717",textDecoration:"none",fontWeight:700}}>← العودة إلى VYRA</Link>
    <Link href="/help/glossary" style={linkStyle}><BookOpen size={17}/> قاموس المصطلحات</Link>
   </header>
   <section style={{background:"#fff",border:"1px solid #e8e8e8",borderRadius:22,padding:"38px 24px",marginTop:22,textAlign:"center"}}>
    <div style={{width:54,height:54,borderRadius:17,background:"#111",color:"#fff",display:"grid",placeItems:"center",margin:"0 auto 14px"}}><CircleHelp size={27}/></div>
    <p style={{color:"#777",margin:"0 0 8px"}}>مركز مساعدة VYRA</p><h1 style={{fontSize:30,margin:"0 0 10px"}}>كيف يمكننا مساعدتك؟</h1>
    <p style={{color:"#777",margin:"0 auto 20px",maxWidth:600,lineHeight:1.9}}>ابحث عن إجابات حول الحساب والمنشورات والمجتمعات والصفحات والخصوصية.</p>
    <label style={{maxWidth:620,margin:"auto",display:"flex",alignItems:"center",gap:10,padding:"0 14px",height:50,border:"1px solid #ddd",borderRadius:12,background:"#fafafa"}}><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث في مواضيع المساعدة..." style={{flex:1,minWidth:0,border:0,outline:0,background:"transparent",font:"inherit"}}/></label>
   </section>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,margin:"28px 2px 14px",flexWrap:"wrap"}}><h2 style={{fontSize:20,margin:0}}>تصفح موضوعات المساعدة</h2><span style={{fontSize:12,color:"#777"}}>{filtered.reduce((n,s)=>n+s.items.length,0)} مقالة</span></div>
   <div style={{display:"grid",gap:14}}>
    {filtered.map(section=>{const Icon=section.icon;return <section key={section.title} style={cardStyle}>
     <h3 style={{display:"flex",alignItems:"center",gap:10,fontSize:16,margin:"0 0 10px"}}><span style={iconStyle}><Icon size={19}/></span>{section.title}</h3>
     {section.items.map(([q,a])=>{const key=section.title+q;const active=opened===key;return <div key={key} style={{borderTop:"1px solid #eee"}}>
      <button onClick={()=>setOpened(active?null:key)} aria-expanded={active} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"15px 2px",textAlign:"right",fontWeight:600}}>{q}<ChevronDown size={18} style={{transform:active?"rotate(180deg)":"none",transition:".2s",flex:"none"}}/></button>
      {active&&<p style={{margin:"-2px 0 16px",paddingInlineEnd:4,color:"#666",lineHeight:2}}>{a}</p>}
     </div>})}
    </section>})}
    {!filtered.length&&<div style={{...cardStyle,textAlign:"center",color:"#777"}}>لا توجد نتائج مطابقة. جرّب كلمة بحث أخرى.</div>}
   </div>
   <section style={{...cardStyle,marginTop:18,display:"flex",alignItems:"center",justifyContent:"space-between",gap:15,flexWrap:"wrap"}}>
    <div style={{display:"flex",alignItems:"center",gap:12}}><LockKeyhole size={22}/><div><b>حافظ على أمان حسابك</b><p style={{margin:"4px 0 0",fontSize:12,color:"#777"}}>لا تشارك كلمة المرور أو رموز التحقق مع أي شخص.</p></div></div>
    <Link href="/account" style={linkStyle}>إعدادات الحساب <ArrowRight size={16}/></Link>
   </section>
   <footer style={{textAlign:"center",color:"#999",fontSize:12,marginTop:25}}>VYRA · مركز المساعدة</footer>
  </div>
 </main>
}
const cardStyle={background:"#fff",border:"1px solid #e8e8e8",borderRadius:16,padding:20} as const;
const iconStyle={width:36,height:36,borderRadius:11,background:"#f1f1f1",display:"grid",placeItems:"center"} as const;
const linkStyle={display:"inline-flex",alignItems:"center",gap:8,color:"#171717",textDecoration:"none",border:"1px solid #ddd",borderRadius:10,padding:"10px 13px",fontSize:13,fontWeight:600} as const;
