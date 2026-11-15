import json
import os
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, select, desc
from sqlalchemy.orm import Mapped, mapped_column, Session

from backend.database import Base, SessionLocal
from backend import models
from backend.security import current_user
from backend.marketplace_admin import MarketplaceProduct, read_settings, save_setting
from backend.marketplace_catalog import MarketplaceProductMeta, MarketplaceStockMovement

router = APIRouter(tags=["marketplace-orders"])
admin_router = APIRouter(prefix="/api/admin/orders", tags=["marketplace-order-administration"])


class MarketplaceCartItem(Base):
    __tablename__ = "marketplace_cart_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("marketplace_products.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_market_cart_user_product"),)


class MarketplaceOrder(Base):
    __tablename__ = "marketplace_orders"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    order_number: Mapped[str] = mapped_column(String(24), nullable=False, unique=True, index=True)
    buyer_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending_payment", index=True)
    payment_method: Mapped[str] = mapped_column(String(32), nullable=False)
    payment_status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    shipping_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    platform_commission: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    seller_net_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    commission_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    shipping_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    buyer_note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    payment_reference: Mapped[str | None] = mapped_column(String(180), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class MarketplaceOrderLine(Base):
    __tablename__ = "marketplace_order_lines"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("marketplace_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    seller_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    title_snapshot: Mapped[str] = mapped_column(String(160), nullable=False)
    item_type: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    seller_net: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)


class MarketplacePaymentRecord(Base):
    __tablename__ = "marketplace_payment_records"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("marketplace_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    method: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    external_reference: Mapped[str | None] = mapped_column(String(180), nullable=True)
    proof_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


def get_db():
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _admin(claims: dict, db: Session):
    user = db.get(models.User, claims.get("sub"))
    configured = (os.getenv("ADMIN_EMAIL") or os.getenv("SUPPORT_ADMIN_EMAIL") or "").strip().lower()
    if user is None or not user.is_active or not configured or user.email.lower() != configured:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user


def _money(value):
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _order_out(db: Session, order: MarketplaceOrder, include_buyer=False):
    lines = db.scalars(select(MarketplaceOrderLine).where(MarketplaceOrderLine.order_id == order.id)).all()
    result = {
        "id": order.id, "order_number": order.order_number, "status": order.status,
        "payment_method": order.payment_method, "payment_status": order.payment_status,
        "currency": order.currency, "subtotal": float(order.subtotal), "shipping_fee": float(order.shipping_fee),
        "platform_commission": float(order.platform_commission), "commission_percent": float(order.commission_percent),
        "seller_net_total": float(order.seller_net_total), "total": float(order.total),
        "shipping_address": order.shipping_address, "buyer_note": order.buyer_note,
        "payment_reference": order.payment_reference, "created_at": order.created_at,
        "items": [{"product_id": x.product_id, "seller_id": x.seller_id, "title": x.title_snapshot,
                   "item_type": x.item_type, "quantity": x.quantity, "unit_price": float(x.unit_price),
                   "line_total": float(x.line_total), "commission_amount": float(x.commission_amount),
                   "seller_net": float(x.seller_net)} for x in lines],
    }
    if include_buyer:
        buyer = db.get(models.User, order.buyer_id)
        result["buyer"] = {"id": buyer.id, "email": buyer.email} if buyer else None
    return result


class CartAdd(BaseModel):
    product_id: str = Field(min_length=20, max_length=36)
    quantity: int = Field(default=1, ge=1, le=1000)


class CartUpdate(BaseModel):
    quantity: int = Field(ge=1, le=1000)


class CheckoutInput(BaseModel):
    payment_method: str = Field(pattern="^(manual_transfer|cash_on_delivery|payoneer)$")
    shipping_address: str | None = Field(default=None, max_length=2000)
    buyer_note: str | None = Field(default=None, max_length=1000)


class PaymentReferenceInput(BaseModel):
    reference: str = Field(min_length=3, max_length=180)


class FinanceInput(BaseModel):
    commission_percent: Decimal = Field(ge=0, le=50)


class AdminOrderStatus(BaseModel):
    status: str = Field(pattern="^(pending_payment|paid|processing|shipped|completed|cancelled|refunded)$")
    reason: str = Field(min_length=3, max_length=300)


@router.get("/api/cart")
def get_cart(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(MarketplaceCartItem).where(MarketplaceCartItem.user_id == claims["sub"]).order_by(MarketplaceCartItem.created_at)).all()
    items, subtotal, currency = [], Decimal("0.00"), None
    for row in rows:
        product = db.get(MarketplaceProduct, row.product_id)
        if product is None or product.status != "active":
            continue
        if currency and currency != product.currency:
            raise HTTPException(status_code=409, detail="لا يمكن جمع عملات مختلفة في سلة واحدة")
        currency = product.currency
        line = _money(product.price * row.quantity)
        subtotal += line
        items.append({"id": row.id, "product_id": product.id, "title": product.title,
                      "item_type": product.item_type, "price": float(product.price), "currency": product.currency,
                      "quantity": row.quantity, "line_total": float(line), "image_url": product.image_url,
                      "seller_id": product.owner_id})
    return {"items": items, "subtotal": float(_money(subtotal)), "currency": currency or "USD", "count": sum(x["quantity"] for x in items)}


@router.post("/api/cart/items", status_code=201)
def add_cart_item(payload: CartAdd, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    settings = read_settings(db)
    if not settings.get("marketplace_enabled", True):
        raise HTTPException(status_code=403, detail="المتجر متوقف حالياً")
    product = db.get(MarketplaceProduct, payload.product_id)
    if product is None or product.status != "active" or product.item_type != "product":
        raise HTTPException(status_code=404, detail="المنتج غير متاح")
    meta = db.get(MarketplaceProductMeta, product.id)
    row = db.scalar(select(MarketplaceCartItem).where(MarketplaceCartItem.user_id == claims["sub"], MarketplaceCartItem.product_id == product.id))
    quantity = (row.quantity if row else 0) + payload.quantity
    if meta:
        if quantity < meta.min_order_qty or (meta.max_order_qty is not None and quantity > meta.max_order_qty):
            raise HTTPException(status_code=422, detail="الكمية خارج حدود الطلب لهذا المنتج")
        if meta.track_inventory and quantity > meta.stock_qty:
            raise HTTPException(status_code=409, detail="الكمية المطلوبة غير متوفرة في المخزون")
    if row:
        row.quantity = quantity
    else:
        row = MarketplaceCartItem(id=str(uuid4()), user_id=claims["sub"], product_id=product.id, quantity=quantity)
        db.add(row)
    db.commit()
    return {"added": True, "quantity": quantity}


@router.patch("/api/cart/items/{cart_item_id}")
def update_cart_item(cart_item_id: str, payload: CartUpdate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(MarketplaceCartItem).where(MarketplaceCartItem.id == cart_item_id, MarketplaceCartItem.user_id == claims["sub"]))
    if row is None:
        raise HTTPException(status_code=404, detail="Cart item not found")
    meta = db.get(MarketplaceProductMeta, row.product_id)
    if meta and meta.track_inventory and payload.quantity > meta.stock_qty:
        raise HTTPException(status_code=409, detail="الكمية المطلوبة غير متوفرة في المخزون")
    if meta and (payload.quantity < meta.min_order_qty or (meta.max_order_qty is not None and payload.quantity > meta.max_order_qty)):
        raise HTTPException(status_code=422, detail="الكمية خارج حدود الطلب")
    row.quantity = payload.quantity
    db.commit()
    return {"updated": True}


@router.delete("/api/cart/items/{cart_item_id}")
def remove_cart_item(cart_item_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(MarketplaceCartItem).where(MarketplaceCartItem.id == cart_item_id, MarketplaceCartItem.user_id == claims["sub"]))
    if row is None:
        raise HTTPException(status_code=404, detail="Cart item not found")
    db.delete(row)
    db.commit()
    return {"deleted": True}


@router.post("/api/checkout", status_code=201)
def checkout(payload: CheckoutInput, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    settings = read_settings(db)
    if not settings.get("marketplace_enabled", True):
        raise HTTPException(status_code=403, detail="المتجر متوقف حالياً")
    rows = db.scalars(select(MarketplaceCartItem).where(MarketplaceCartItem.user_id == claims["sub"]).with_for_update()).all()
    if not rows:
        raise HTTPException(status_code=409, detail="سلة التسوق فارغة")
    products = []
    for row in rows:
        product = db.get(MarketplaceProduct, row.product_id)
        if product is None or product.status != "active":
            raise HTTPException(status_code=409, detail="أحد المنتجات لم يعد متاحاً")
        products.append((row, product, db.get(MarketplaceProductMeta, product.id)))
    currencies = {p.currency for _, p, _ in products}
    if len(currencies) != 1:
        raise HTTPException(status_code=409, detail="قسّم السلة حسب العملة لإتمام الطلب")
    methods = set(settings.get("payment_methods", []))
    for _, product, _ in products:
        methods &= set(json.loads(product.payment_methods or "[]"))
    if payload.payment_method not in methods:
        raise HTTPException(status_code=422, detail="طريقة الدفع غير متاحة لجميع عناصر السلة")
    if payload.payment_method == "payoneer":
        # Personal receiving accounts/payment requests are not a consumer marketplace gateway.
        if os.getenv("PAYONEER_MARKETPLACE_ENABLED", "").lower() != "true" or not os.getenv("PAYONEER_MARKETPLACE_PROGRAM_ID"):
            raise HTTPException(status_code=503, detail="تكامل Payoneer Marketplace يحتاج موافقة Payoneer وبيانات برنامج API رسمية. لا تستخدم حساب الاستلام الشخصي لتحصيل مدفوعات المستهلكين.")
        raise HTTPException(status_code=503, detail="تم تجهيز نقطة التكامل، لكن لم يتم تفعيل API الرسمي قبل استكمال اعتماد البرنامج واختبار Sandbox.")
    if payload.payment_method not in {"manual_transfer", "cash_on_delivery"}:
        raise HTTPException(status_code=422, detail="بوابة الدفع هذه غير مهيأة للتحصيل الفعلي حالياً")
    if any(p.item_type == "product" for _, p, _ in products) and not (payload.shipping_address or "").strip():
        raise HTTPException(status_code=422, detail="أدخل عنوان الشحن للمنتجات المادية")
    commission_percent = Decimal(str(settings.get("commission_percent", 10))).quantize(Decimal("0.01"))
    if commission_percent < 0 or commission_percent > 50:
        raise HTTPException(status_code=422, detail="نسبة العمولة خارج النطاق المسموح")
    subtotal = Decimal("0.00")
    commission_total = Decimal("0.00")
    seller_net_total = Decimal("0.00")
    lines = []
    for row, product, meta in products:
        if meta and meta.track_inventory and row.quantity > meta.stock_qty:
            raise HTTPException(status_code=409, detail=f"المخزون غير كافٍ للمنتج: {product.title}")
        line_total = _money(product.price * row.quantity)
        fee = _money(line_total * commission_percent / Decimal("100")) if product.owner_id else Decimal("0.00")
        seller_net = line_total - fee if product.owner_id else Decimal("0.00")
        subtotal += line_total
        commission_total += fee
        seller_net_total += seller_net
        lines.append((row, product, meta, line_total, fee, seller_net))
    subtotal = _money(subtotal)
    commission_total = _money(commission_total)
    seller_net_total = _money(seller_net_total)
    order_id = str(uuid4())
    order_number = "VY-" + datetime.now(timezone.utc).strftime("%y%m%d") + "-" + uuid4().hex[:6].upper()
    order = MarketplaceOrder(id=order_id, order_number=order_number, buyer_id=claims["sub"],
        status="pending_payment", payment_method=payload.payment_method, payment_status="pending",
        currency=next(iter(currencies)), subtotal=subtotal, shipping_fee=Decimal("0.00"),
        platform_commission=commission_total, seller_net_total=seller_net_total, total=subtotal,
        commission_percent=commission_percent, shipping_address=payload.shipping_address,
        buyer_note=payload.buyer_note)
    db.add(order)
    for row, product, meta, line_total, fee, seller_net in lines:
        db.add(MarketplaceOrderLine(id=str(uuid4()), order_id=order_id, product_id=product.id,
            seller_id=product.owner_id, title_snapshot=product.title, item_type=product.item_type,
            quantity=row.quantity, unit_price=product.price, line_total=line_total,
            commission_amount=fee, seller_net=seller_net))
        if meta and meta.track_inventory and product.item_type == "product":
            meta.stock_qty -= row.quantity
            db.add(MarketplaceStockMovement(id=str(uuid4()), product_id=product.id, variant_id=None,
                actor_id=claims["sub"], delta=-row.quantity, reason=f"Order {order_number} stock reservation"))
        db.delete(row)
    db.add(MarketplacePaymentRecord(id=str(uuid4()), order_id=order_id, method=payload.payment_method,
        status="pending", amount=subtotal, currency=order.currency))
    db.commit()
    db.refresh(order)
    return _order_out(db, order)


@router.get("/api/orders")
def list_my_orders(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(MarketplaceOrder).where(MarketplaceOrder.buyer_id == claims["sub"]).order_by(desc(MarketplaceOrder.created_at)).limit(100)).all()
    return [_order_out(db, x) for x in rows]


@router.get("/api/orders/{order_id}")
def get_my_order(order_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    order = db.get(MarketplaceOrder, order_id)
    if order is None or order.buyer_id != claims["sub"]:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_out(db, order)


@router.post("/api/orders/{order_id}/payment-reference")
def submit_payment_reference(order_id: str, payload: PaymentReferenceInput, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    order = db.get(MarketplaceOrder, order_id)
    if order is None or order.buyer_id != claims["sub"]:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "pending_payment" or order.payment_method != "manual_transfer":
        raise HTTPException(status_code=409, detail="لا يمكن إضافة مرجع الدفع لهذا الطلب")
    order.payment_reference = payload.reference.strip()
    payment = db.scalar(select(MarketplacePaymentRecord).where(MarketplacePaymentRecord.order_id == order.id))
    if payment:
        payment.external_reference = order.payment_reference
    db.commit()
    return {"submitted": True, "status": "awaiting_admin_review"}



@admin_router.get("/finance")
def admin_finance_settings(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    _admin(claims, db)
    settings = read_settings(db)
    configured = bool(os.getenv("PAYONEER_MARKETPLACE_PROGRAM_ID") and os.getenv("PAYONEER_CLIENT_ID") and os.getenv("PAYONEER_CLIENT_SECRET"))
    approved = os.getenv("PAYONEER_MARKETPLACE_ENABLED", "").lower() == "true"
    return {
        "commission_percent": float(settings.get("commission_percent", 10)),
        "payoneer": {
            "program_configured": configured,
            "approval_flag": approved,
            "api_integration_active": False,
            "status": "awaiting_official_payoneer_program_approval" if not approved else "api_integration_not_implemented",
        },
        "note": "لا يتم استخدام حساب الاستلام الشخصي كوسيط أو حساب ضمان. يلزم اعتماد Payoneer Marketplace ودمج API الرسمي قبل التحصيل أو صرف مستحقات البائعين."
    }


@admin_router.patch("/finance")
def update_admin_finance_settings(payload: FinanceInput, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    _admin(claims, db)
    save_setting(db, "commission_percent", float(payload.commission_percent))
    db.commit()
    return admin_finance_settings(claims, db)


@admin_router.get("")
def admin_list_orders(status: str | None = Query(default=None), claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    _admin(claims, db)
    query = select(MarketplaceOrder).order_by(desc(MarketplaceOrder.created_at)).limit(300)
    if status:
        query = query.where(MarketplaceOrder.status == status)
    rows = db.scalars(query).all()
    return [_order_out(db, x, include_buyer=True) for x in rows]


@admin_router.patch("/{order_id}/status")
def admin_update_order_status(order_id: str, payload: AdminOrderStatus, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    actor = _admin(claims, db)
    order = db.get(MarketplaceOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    previous = order.status
    if previous in {"cancelled", "refunded", "completed"}:
        raise HTTPException(status_code=409, detail="هذا الطلب في حالة نهائية")
    if payload.status == "paid":
        order.payment_status = "paid"
        payment = db.scalar(select(MarketplacePaymentRecord).where(MarketplacePaymentRecord.order_id == order.id))
        if payment:
            payment.status = "paid"
    if payload.status == "cancelled":
        lines = db.scalars(select(MarketplaceOrderLine).where(MarketplaceOrderLine.order_id == order.id)).all()
        for line in lines:
            product = db.get(MarketplaceProduct, line.product_id)
            meta = db.get(MarketplaceProductMeta, line.product_id)
            if product and meta and meta.track_inventory and line.item_type == "product":
                meta.stock_qty += line.quantity
                db.add(MarketplaceStockMovement(id=str(uuid4()), product_id=line.product_id, variant_id=None,
                    actor_id=actor.id, delta=line.quantity, reason=f"Order {order.order_number} cancellation: {payload.reason}"))
        order.payment_status = "cancelled"
        payment = db.scalar(select(MarketplacePaymentRecord).where(MarketplacePaymentRecord.order_id == order.id))
        if payment:
            payment.status = "cancelled"
    if payload.status == "refunded":
        order.payment_status = "refunded"
        payment = db.scalar(select(MarketplacePaymentRecord).where(MarketplacePaymentRecord.order_id == order.id))
        if payment:
            payment.status = "refunded"
    order.status = payload.status
    db.commit()
    db.refresh(order)
    return _order_out(db, order, include_buyer=True)
