"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, BookOpen } from "lucide-react";
const terms=[
 ["الخلاصة","مساحة تعرض المنشورات والتحديثات من الحسابات والصفحات والمجتمعات التي تتابعها."],
 ["المنشور","محتوى يشاركه العضو، وقد يتضمن نصاً أو صورة أو فيديو."],
 ["التفاعل","استجابة العضو لمنشور، مثل الإعجاب أو التعليق."],
 ["التعليق","رد نصي يضاف أسفل منشور للمشاركة في النقاش."],
 ["المشاركة","إعادة نشر محتوى أو إرساله إلى أشخاص آخرين؛ توفرها تعتمد على الأدوات المفعلة في VYRA."],
 ["الملف الشخصي","صفحة تعرض معلومات العضو وصورته ونبذته وبعض نشاطه وفق إعدادات الخصوصية."],
 ["اسم المستخدم","معرّف فريد أو شبه فريد يستخدم للوصول إلى حساب العضو والإشارة إليه."],
 ["المتابعة","الاشتراك في تحديثات صفحة أو حساب دون أن يعني ذلك بالضرورة وجود صداقة متبادلة."],
 ["المجتمع","مساحة تجمع أعضاء حول اهتمام أو موضوع مشترك."],
 ["مدير المجتمع","عضو لديه صلاحيات إدارة إعدادات المجتمع وأعضائه ومحتواه وفق صلاحيات المنصة."],
 ["الصفحة العامة","واجهة مخصصة لمشروع أو نشاط أو علامة أو شخصية لنشر التحديثات وجمع المتابعين."],
 ["المحفوظات","قائمة خاصة بالمنشورات التي حفظتها للرجوع إليها لاحقاً."],
 ["الإشارة","ربط عضو أو صفحة بمحتوى، بهدف الإشارة إلى مشاركته أو لفت انتباهه."],
 ["الوسائط","الصور ومقاطع الفيديو والملفات المرئية المرفقة بالمنشورات."],
 ["الخصوصية","إعدادات تحدد من يمكنه الاطلاع على معلومات الحساب أو المحتوى والتفاعل معه."],
 ["الحساب الخاص","إعداد يقيّد ظهور بعض محتوى الحساب وفق قواعد المنصة."],
 ["الحظر","منع حساب محدد من التواصل أو التفاعل معك ضمن نطاق الوظائف التي توفرها المنصة."],
 ["الإبلاغ","إرسال تنبيه إلى فريق المنصة حول محتوى أو سلوك قد يخالف القواعد."],
 ["التصيّد الاحتيالي","محاولة خداع المستخدم للحصول على كلمة المرور أو رموز التحقق أو معلوماته الشخصية."],
 ["المصادقة الثنائية","طبقة أمان إضافية تتطلب خطوة تحقق أخرى إلى جانب كلمة المرور، إذا كانت مدعومة ومفعلة."],
 ["الإشعار","تنبيه حول نشاط أو تحديث متعلق بالحساب؛ نظام الإشعارات الكامل ليس معلناً كميزة مكتملة في هذه النسخة."],
 ["الرسائل الخاصة","محادثات مباشرة بين الأعضاء؛ لا تعتبر متاحة حتى يظهر نظام مراسلة فعلي داخل VYRA."]
];
export default function GlossaryPage(){
 const [query,setQuery]=useState("");
 const list=useMemo(()=>terms.filter(([term,desc])=>(term+" "+desc).toLowerCase().includes(query.toLowerCase())),[query]);
 return <main dir="rtl" style={{minHeight:"100vh",background:"#f7f7f7",padding:"28px 18px 60px",color:"#171717"}}>
  <section style={{maxWidth:900,margin:"auto"}}>
   <Link href="/help" style={{color:"#171717",textDecoration:"none"}}>← مركز المساعدة</Link>
   <header style={{background:"#fff",border:"1px solid #e8e8e8",borderRadius:18,padding:26,marginTop:20}}>
    <BookOpen size={28}/><h1 style={{margin:"10px 0 6px"}}>قاموس مصطلحات VYRA</h1><p style={{color:"#777",margin:0}}>تعريفات مبسطة للمفاهيم المستخدمة في المنصة والتواصل الاجتماعي.</p>
    <label style={{display:"flex",alignItems:"center",gap:9,border:"1px solid #ddd",borderRadius:10,padding:"0 12px",height:46,marginTop:20}}><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن مصطلح..." style={{flex:1,minWidth:0,border:0,outline:0,font:"inherit"}}/></label>
   </header>
   <p style={{color:"#777",fontSize:12,margin:"18px 2px"}}>{list.length} مصطلح</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:12}}>
    {list.map(([term,desc])=><article key={term} style={{background:"#fff",border:"1px solid #e8e8e8",borderRadius:13,padding:17}}><h2 style={{fontSize:15,margin:"0 0 8px"}}>{term}</h2><p style={{fontSize:13,color:"#666",lineHeight:1.9,margin:0}}>{desc}</p></article>)}
   </div>
   {!list.length&&<p style={{textAlign:"center",color:"#777",padding:30}}>لم يتم العثور على المصطلح.</p>}
  </section>
 </main>
}
