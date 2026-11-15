"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import {ArrowRight,PackageCheck,RefreshCw,Truck,Clock3} from "lucide-react";

const API=(process.env.NEXT_PUBLIC_API_URL||"https://vyra-api-9pxl.onrender.com").replace(/\/$/,"");
type Row=Record<string,any>;
const orderLabels:Record<string,string>={pending_payment:"بانتظار الدفع",paid:"مدفوع",processing:"قيد التجهيز",shipped:"تم الشحن",completed:"مكتمل",cancelled:"ملغي",refunded:"مسترد"};
const shipmentLabels:Record<string,string>={label_created:"تم إنشاء بوليصة الشحن",picked_up:"استلمت شركة الشحن الطرد",in_transit:"الشحنة في الطريق",out_for_delivery:"خرجت للتسليم",delivered:"تم التسليم",exception:"تعثر التوصيل",returned:"أعيدت الشحنة"};

function SellerOrders(){
 const [orders,setOrders]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){
  setLoading(true);setError("");
  try{
   const token=sessionStorage.getItem("vyra_access_token")||"";
   const r=await fetch(API+"/api/seller/orders",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(d.detail||"تعذر تحميل طلباتك");
   setOrders(Array.isArray(d)?d:[]);
  }catch(e){setError(e instanceof Error?e.message:"حدث خطأ غير متوقع");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 return <main dir="rtl" style={{minHeight:"100vh",background:"#f6f8fb",padding:24,color:"#202938",fontFamily:"Arial,sans-serif"}}>
  <div style={{maxWidth:1050,margin:"auto"}}>
   <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
    <Link href="/market/services" style={{display:"flex",alignItems:"center",gap:8,color:"#475467",textDecoration:"none"}}><ArrowRight size={18}/> خدماتي</Link>
    <b style={{letterSpacing:2}}>VYRA <span style={{color:"#ff5a1f"}}>SELLER</span></b>
    <button onClick={()=>void load()} disabled={loading} style={{border:0,borderRadius:10,padding:"10px 14px",background:"#26364b",color:"#fff",display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><RefreshCw size={16}/> تحديث الطلبات</button>
   </header>
   <section style={{margin:"28px 0 18px"}}>
    <small style={{color:"#ff5a1f",fontWeight:800}}>مساحة البائع</small>
    <h1 style={{fontSize:30,margin:"7px 0"}}>طلبات خدماتك ومنتجاتك</h1>
    <p style={{color:"#667085"}}>تابع حالة الطلبات والعناصر الخاصة بك وحالة الشحن عند توفرها.</p>
   </section>
   {error&&<p style={{padding:13,borderRadius:12,background:"#fff0ed",color:"#b42318"}}>{error}</p>}
   {loading?<p style={{color:"#667085"}}>جارٍ تحميل الطلبات...</p>:orders.length===0?<section style={{background:"#fff",border:"1px solid #e8ebf0",borderRadius:18,padding:28,textAlign:"center"}}><PackageCheck size={32} color="#ff5a1f"/><h2>لا توجد طلبات مرتبطة بمنتجاتك بعد</h2><p style={{color:"#667085"}}>ستظهر الطلبات هنا عندما يشتري العملاء منتجاتك أو خدماتك المنشورة.</p><Link href="/market/services" style={{color:"#ff5a1f",fontWeight:800}}>إدارة خدماتي</Link></section>:
    <div style={{display:"grid",gap:14}}>{orders.map(order=><article key={order.id} style={{background:"#fff",border:"1px solid #e8ebf0",borderRadius:16,padding:18}}>
     <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
      <div><b>{order.order_number}</b><p style={{fontSize:12,color:"#98a2b3",margin:"5px 0"}}>{order.created_at?new Date(order.created_at).toLocaleString("ar"):""}</p></div>
      <b style={{color:order.status==="completed"?"#16804a":"#b54708"}}>{orderLabels[order.status]||order.status}</b>
     </div>
     <div style={{display:"grid",gap:8,marginTop:10}}>{(order.items||[]).map((item:Row,index:number)=><div key={item.product_id||index} style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",padding:"9px 0",borderTop:"1px solid #f0f2f5"}}>
      <span>{item.title} × {item.quantity}</span><b>{item.seller_net} {order.currency}</b>
     </div>)}</div>
     <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginTop:8,paddingTop:10,borderTop:"1px solid #f0f2f5",fontSize:13}}>
      <span>صافي مستحقاتك لهذه العناصر</span><b>{(order.items||[]).reduce((sum:number,item:Row)=>sum+Number(item.seller_net||0),0).toFixed(2)} {order.currency}</b>
     </div>
     {order.shipment&&<div style={{marginTop:14,padding:13,background:"#f8fafc",borderRadius:12}}>
      <b style={{display:"flex",alignItems:"center",gap:7}}><Truck size={16}/> الشحنة · {order.shipment.carrier}</b>
      <p style={{fontSize:13,color:"#475467",margin:"7px 0"}}>رقم التتبع: {order.shipment.tracking_number}</p>
      <p style={{fontSize:13,color:"#b54708"}}>{shipmentLabels[order.shipment.status]||order.shipment.status}</p>
      {order.shipment.estimated_delivery_at&&<p style={{fontSize:12,color:"#667085"}}><Clock3 size={13} style={{display:"inline",verticalAlign:"middle"}}/> التسليم المتوقع: {new Date(order.shipment.estimated_delivery_at).toLocaleString("ar")}</p>}
      {order.shipment.tracking_url&&<a href={order.shipment.tracking_url} target="_blank" rel="noreferrer" style={{color:"#ff5a1f",fontSize:13}}>فتح رابط التتبع ↗</a>}
     </div>}
    </article>)}</div>}
  </div>
 </main>;
}
export default function Page(){return <AuthGate><SellerOrders/></AuthGate>;}
