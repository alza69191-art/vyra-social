import json
import os
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, select, desc
from sqlalchemy.orm import Mapped, mapped_column, Session

from backend.database import Base, SessionLocal
from backend import models
from backend.security import current_user
from backend.marketplace_admin import read_settings, save_setting
from backend.marketplace_orders import MarketplaceOrder, MarketplaceOrderLine, _admin

router = APIRouter(tags=["marketplace-shipping"])
admin_router = APIRouter(prefix="/api/admin/shipping", tags=["marketplace-shipping-admin"])

DEFAULT_RATES = {"USD": 5, "EUR": 5, "ILS": 18, "SAR": 18, "AED": 18}
DEFAULT_FREE_THRESHOLDS = {"USD": 100, "EUR": 100, "ILS": 350, "SAR": 375, "AED": 375}
CARRIERS = ["Aramex", "DHL", "FedEx", "UPS", "Palestine Post", "Local Courier", "Other"]
SHIPMENT_STATUSES = {"label_created", "picked_up", "in_transit", "out_for_delivery", "delivered", "exception", "returned"}


class MarketplaceShipment(Base):
    __tablename__ = "marketplace_shipments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("marketplace_orders.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    carrier: Mapped[str] = mapped_column(String(80), nullable=False)
    tracking_number: Mapped[str] = mapped_column(String(120), nullable=False)
    tracking_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="label_created", index=True)
    estimated_delivery_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    shipping_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class MarketplaceShipmentEvent(Base):
    __tablename__ = "marketplace_shipment_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shipment_id: Mapped[str] = mapped_column(ForeignKey("marketplace_shipments.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    location: Mapped[str | None] = mapped_column(String(180), nullable=True)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


def get_db():
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def shipping_settings(db: Session):
    values = read_settings(db)
    return {
        "shipping_enabled": values.get("shipping_enabled", True),
        "shipping_rates": values.get("shipping_rates", DEFAULT_RATES),
        "free_shipping_thresholds": values.get("free_shipping_thresholds", DEFAULT_FREE_THRESHOLDS),
        "estimated_delivery_days_min": values.get("estimated_delivery_days_min", 3),
        "estimated_delivery_days_max": values.get("estimated_delivery_days_max", 10),
        "carriers": values.get("shipping_carriers", CARRIERS),
    }


def shipment_out(db: Session, shipment: MarketplaceShipment):
    events = db.scalars(select(MarketplaceShipmentEvent).where(
        MarketplaceShipmentEvent.shipment_id == shipment.id
    ).order_by(MarketplaceShipmentEvent.created_at)).all()
    return {
        "id": shipment.id, "order_id": shipment.order_id, "carrier": shipment.carrier,
        "tracking_number": shipment.tracking_number, "tracking_url": shipment.tracking_url,
        "status": shipment.status, "estimated_delivery_at": shipment.estimated_delivery_at,
        "shipped_at": shipment.shipped_at, "delivered_at": shipment.delivered_at,
        "shipping_cost": float(shipment.shipping_cost), "notes": shipment.notes,
        "created_at": shipment.created_at, "updated_at": shipment.updated_at,
        "events": [{"status": e.status, "description": e.description, "location": e.location, "created_at": e.created_at} for e in events],
    }


class ShippingSettingsInput(BaseModel):
    shipping_enabled: bool | None = None
    shipping_rates: dict[str, Decimal] | None = None
    free_shipping_thresholds: dict[str, Decimal] | None = None
    estimated_delivery_days_min: int | None = Field(default=None, ge=1, le=90)
    estimated_delivery_days_max: int | None = Field(default=None, ge=1, le=120)
    carriers: list[str] | None = Field(default=None, min_length=1, max_length=30)

    @field_validator("shipping_rates", "free_shipping_thresholds")
    @classmethod
    def validate_currency_values(cls, value):
        if value is None:
            return value
        allowed = {"USD", "EUR", "ILS", "SAR", "AED"}
        if any(k not in allowed or v < 0 or v > Decimal("1000000") for k, v in value.items()):
            raise ValueError("Invalid currency or shipping amount")
        return {k: float(v) for k, v in value.items()}


class ShipmentInput(BaseModel):
    carrier: str = Field(min_length=2, max_length=80)
    tracking_number: str = Field(min_length=3, max_length=120)
    tracking_url: str | None = Field(default=None, max_length=2000)
    status: str = Field(default="label_created", pattern="^(label_created|picked_up|in_transit|out_for_delivery|delivered|exception|returned)$")
    estimated_delivery_at: datetime | None = None
    shipping_cost: Decimal = Field(default=Decimal("0"), ge=0, le=Decimal("1000000"))
    notes: str | None = Field(default=None, max_length=1000)
    description: str = Field(default="تم إنشاء بيانات الشحنة", min_length=3, max_length=500)
    location: str | None = Field(default=None, max_length=180)


class ShipmentStatusInput(BaseModel):
    status: str = Field(pattern="^(label_created|picked_up|in_transit|out_for_delivery|delivered|exception|returned)$")
    description: str = Field(min_length=3, max_length=500)
    location: str | None = Field(default=None, max_length=180)


@router.get("/api/shipping/config")
def public_shipping_config(db: Session = Depends(get_db)):
    cfg = shipping_settings(db)
    return {"shipping_enabled": cfg["shipping_enabled"], "shipping_rates": cfg["shipping_rates"],
            "free_shipping_thresholds": cfg["free_shipping_thresholds"],
            "estimated_delivery_days_min": cfg["estimated_delivery_days_min"],
            "estimated_delivery_days_max": cfg["estimated_delivery_days_max"]}


@router.get("/api/orders/{order_id}/tracking")
def my_order_tracking(order_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    order = db.get(MarketplaceOrder, order_id)
    if order is None or order.buyer_id != claims["sub"]:
        raise HTTPException(status_code=404, detail="Order not found")
    shipment = db.scalar(select(MarketplaceShipment).where(MarketplaceShipment.order_id == order.id))
    return {"order_id": order.id, "order_number": order.order_number,
            "order_status": order.status, "shipment": shipment_out(db, shipment) if shipment else None}


@router.get("/api/seller/orders")
def seller_orders(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    user = db.get(models.User, claims.get("sub"))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid account")
    profile = db.get(models.Profile, user.id)
    if profile is None:
        return []
    order_ids = db.scalars(select(MarketplaceOrderLine.order_id).where(
        MarketplaceOrderLine.seller_id == profile.id
    ).distinct()).all()
    if not order_ids:
        return []
    orders = db.scalars(select(MarketplaceOrder).where(MarketplaceOrder.id.in_(order_ids))
                        .order_by(desc(MarketplaceOrder.created_at)).limit(200)).all()
    output = []
    for order in orders:
        lines = db.scalars(select(MarketplaceOrderLine).where(
            MarketplaceOrderLine.order_id == order.id,
            MarketplaceOrderLine.seller_id == profile.id)).all()
        shipment = db.scalar(select(MarketplaceShipment).where(MarketplaceShipment.order_id == order.id))
        output.append({
            "id": order.id, "order_number": order.order_number, "status": order.status,
            "currency": order.currency, "created_at": order.created_at,
            "items": [{"title": x.title_snapshot, "quantity": x.quantity, "line_total": float(x.line_total),
                       "seller_net": float(x.seller_net)} for x in lines],
            "shipment": shipment_out(db, shipment) if shipment else None,
        })
    return output


@admin_router.get("/settings")
def admin_get_shipping_settings(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    _admin(claims, db)
    return shipping_settings(db)


@admin_router.patch("/settings")
def admin_update_shipping_settings(payload: ShippingSettingsInput, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    _admin(claims, db)
    values = payload.model_dump(exclude_unset=True)
    if "estimated_delivery_days_min" in values and "estimated_delivery_days_max" in values:
        if values["estimated_delivery_days_min"] > values["estimated_delivery_days_max"]:
            raise HTTPException(status_code=422, detail="Minimum delivery days cannot exceed maximum")
    elif "estimated_delivery_days_min" in values or "estimated_delivery_days_max" in values:
        current = shipping_settings(db)
        minimum = values.get("estimated_delivery_days_min", current["estimated_delivery_days_min"])
        maximum = values.get("estimated_delivery_days_max", current["estimated_delivery_days_max"])
        if minimum > maximum:
            raise HTTPException(status_code=422, detail="Minimum delivery days cannot exceed maximum")
    if "carriers" in values:
        values["shipping_carriers"] = list(dict.fromkeys(x.strip()[:80] for x in values.pop("carriers") if x.strip()))
        if not values["shipping_carriers"]:
            raise HTTPException(status_code=422, detail="At least one carrier is required")
    for key, value in values.items():
        save_setting(db, key, value)
    db.commit()
    return shipping_settings(db)


@admin_router.get("/shipments")
def admin_list_shipments(status: str | None = None, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    _admin(claims, db)
    query = select(MarketplaceShipment).order_by(desc(MarketplaceShipment.created_at)).limit(300)
    if status:
        query = query.where(MarketplaceShipment.status == status)
    return [shipment_out(db, row) for row in db.scalars(query).all()]


@admin_router.put("/orders/{order_id}")
def admin_create_or_update_shipment(order_id: str, payload: ShipmentInput, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    actor = _admin(claims, db)
    order = db.get(MarketplaceOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    existing_shipment = db.scalar(select(MarketplaceShipment).where(MarketplaceShipment.order_id == order.id))
    if existing_shipment is None and order.status in {"cancelled", "refunded", "completed"}:
        raise HTTPException(status_code=409, detail="لا يمكن إنشاء شحنة لطلب في حالة نهائية")
    if order.payment_method != "cash_on_delivery" and order.payment_status != "paid":
        raise HTTPException(status_code=409, detail="يجب تأكيد الدفع قبل إنشاء الشحنة")
    lines = db.scalars(select(MarketplaceOrderLine).where(MarketplaceOrderLine.order_id == order.id)).all()
    if not any(x.item_type == "product" for x in lines):
        raise HTTPException(status_code=409, detail="This order does not contain shippable products")
    cfg = shipping_settings(db)
    if payload.carrier not in cfg["carriers"]:
        raise HTTPException(status_code=422, detail="Choose a carrier enabled in shipping settings")
    shipment = db.scalar(select(MarketplaceShipment).where(MarketplaceShipment.order_id == order.id))
    now = datetime.now(timezone.utc)
    if shipment is None:
        estimated = payload.estimated_delivery_at or (now + timedelta(days=cfg["estimated_delivery_days_min"]))
        shipment = MarketplaceShipment(id=str(uuid4()), order_id=order.id, carrier=payload.carrier,
            tracking_number=payload.tracking_number.strip(), tracking_url=payload.tracking_url,
            status=payload.status, estimated_delivery_at=estimated,
            shipping_cost=payload.shipping_cost, notes=payload.notes)
        db.add(shipment)
        db.flush()
    else:
        shipment.carrier = payload.carrier
        shipment.tracking_number = payload.tracking_number.strip()
        shipment.tracking_url = payload.tracking_url
        shipment.estimated_delivery_at = payload.estimated_delivery_at or shipment.estimated_delivery_at or (now + timedelta(days=cfg["estimated_delivery_days_min"]))
        shipment.shipping_cost = payload.shipping_cost
        shipment.notes = payload.notes
        shipment.status = payload.status
    if payload.status in {"picked_up", "in_transit", "out_for_delivery", "delivered"} and shipment.shipped_at is None:
        shipment.shipped_at = now
    if payload.status == "delivered":
        shipment.delivered_at = now
        # COD is not financially settled merely because the carrier marked delivery.
        # Keep the order shipped until an administrator confirms cash collection.
        order.status = "shipped" if order.payment_method == "cash_on_delivery" and order.payment_status != "paid" else "completed"
    elif payload.status in {"picked_up", "in_transit", "out_for_delivery"}:
        order.status = "shipped"
    elif order.status in {"pending_payment", "paid"}:
        order.status = "processing"
    db.add(MarketplaceShipmentEvent(id=str(uuid4()), shipment_id=shipment.id,
        status=payload.status, description=payload.description.strip(), location=payload.location,
        actor_id=actor.id))
    db.commit()
    db.refresh(shipment)
    return shipment_out(db, shipment)


@admin_router.post("/shipments/{shipment_id}/events")
def admin_add_shipment_event(shipment_id: str, payload: ShipmentStatusInput, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    actor = _admin(claims, db)
    shipment = db.get(MarketplaceShipment, shipment_id)
    if shipment is None:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if payload.status not in SHIPMENT_STATUSES:
        raise HTTPException(status_code=422, detail="Unsupported shipment status")
    now = datetime.now(timezone.utc)
    shipment.status = payload.status
    if payload.status in {"picked_up", "in_transit", "out_for_delivery", "delivered"} and shipment.shipped_at is None:
        shipment.shipped_at = now
    if payload.status == "delivered":
        shipment.delivered_at = now
    order = db.get(MarketplaceOrder, shipment.order_id)
    if order:
        if payload.status == "delivered":
            order.status = "shipped" if order.payment_method == "cash_on_delivery" and order.payment_status != "paid" else "completed"
        elif payload.status in {"picked_up", "in_transit", "out_for_delivery"}:
            order.status = "shipped"
        elif payload.status == "returned":
            order.status = "processing"
    db.add(MarketplaceShipmentEvent(id=str(uuid4()), shipment_id=shipment.id,
        status=payload.status, description=payload.description.strip(), location=payload.location,
        actor_id=actor.id))
    db.commit()
    db.refresh(shipment)
    return shipment_out(db, shipment)
