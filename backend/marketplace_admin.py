import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, select, desc, func
from sqlalchemy.orm import Mapped, mapped_column, Session

from backend.database import Base, SessionLocal
from backend import models
from backend.security import current_user

router = APIRouter(tags=["marketplace"])
admin_router = APIRouter(prefix="/api/admin/marketplace", tags=["marketplace-administration"])


class PlatformSetting(Base):
    __tablename__ = "platform_settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class MarketplaceProduct(Base):
    __tablename__ = "marketplace_products"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    item_type: Mapped[str] = mapped_column(String(20), nullable=False, default="product", index=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    payment_methods: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    image_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    created_by_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


DEFAULT_SETTINGS = {
    "marketplace_enabled": True,
    "user_product_publishing": True,
    "user_service_publishing": True,
    "admin_only_publishing": False,
    "product_approval_required": True,
    "payment_methods": ["manual_transfer", "paypal", "payoneer"],
    "product_categories": ["تقنية وإلكترونيات", "ملابس وإكسسوارات", "منتجات رقمية", "منزل ومكتب", "أخرى"],
    "service_categories": ["برمجة وتطوير", "تصميم وإبداع", "تسويق رقمي", "فيديو وموشن", "كتابة وترجمة", "أخرى"],
    "commission_percent": 10,
}


def get_db():
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_admin(claims: dict, db: Session):
    configured = (os.getenv("ADMIN_EMAIL") or os.getenv("SUPPORT_ADMIN_EMAIL") or "").strip().lower()
    actor = db.get(models.User, claims.get("sub"))
    if not configured or actor is None or not actor.is_active or actor.email.lower() != configured:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return actor


def read_settings(db: Session):
    rows = db.scalars(select(PlatformSetting)).all()
    values = dict(DEFAULT_SETTINGS)
    for row in rows:
        try:
            values[row.key] = json.loads(row.value)
        except (ValueError, TypeError):
            values[row.key] = row.value
    return values


def save_setting(db: Session, key: str, value):
    row = db.get(PlatformSetting, key)
    encoded = json.dumps(value, ensure_ascii=False)
    if row is None:
        db.add(PlatformSetting(key=key, value=encoded))
    else:
        row.value = encoded


def audit(db: Session, actor, action: str, target_type: str, target_id: str, reason: str):
    db.add(models.AdminAuditLog(id=str(uuid4()), actor_id=actor.id, action=action,
        target_type=target_type, target_id=target_id, reason=(reason or action)[:500]))


class ProductInput(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=10, max_length=10000)
    item_type: str = Field(default="product", pattern="^(product|service)$")
    price: Decimal = Field(gt=0, le=Decimal("99999999"))
    currency: str = Field(default="USD", pattern="^(USD|EUR|ILS|SAR|AED)$")
    category: str = Field(min_length=2, max_length=80)
    payment_methods: list[str] = Field(min_length=1, max_length=8)
    image_url: str | None = Field(default=None, max_length=2000)
    status: str | None = Field(default=None, pattern="^(pending|active|paused)$")

    @field_validator("payment_methods")
    @classmethod
    def validate_methods(cls, value):
        allowed = {"manual_transfer", "paypal", "payoneer", "cash_on_delivery", "card"}
        if not value or any(x not in allowed for x in value):
            raise ValueError("Unsupported payment method")
        return list(dict.fromkeys(value))


class ProductStatus(BaseModel):
    status: str = Field(pattern="^(pending|active|paused|rejected)$")
    reason: str = Field(min_length=3, max_length=500)


class SettingsInput(BaseModel):
    marketplace_enabled: bool | None = None
    user_product_publishing: bool | None = None
    user_service_publishing: bool | None = None
    admin_only_publishing: bool | None = None
    product_approval_required: bool | None = None
    payment_methods: list[str] | None = Field(default=None, max_length=8)
    product_categories: list[str] | None = Field(default=None, max_length=60)
    service_categories: list[str] | None = Field(default=None, max_length=60)
    commission_percent: Decimal | None = Field(default=None, ge=0, le=50)


def product_out(item: MarketplaceProduct):
    return {
        "id": item.id, "owner_id": item.owner_id, "title": item.title,
        "description": item.description, "item_type": item.item_type,
        "price": float(item.price), "currency": item.currency, "category": item.category,
        "payment_methods": json.loads(item.payment_methods or "[]"),
        "image_url": item.image_url, "status": item.status,
        "created_by_admin": item.created_by_admin, "created_at": item.created_at,
    }


@router.get("/api/marketplace/config")
def public_config(db: Session = Depends(get_db)):
    settings = read_settings(db)
    return {key: settings[key] for key in DEFAULT_SETTINGS}


@router.get("/api/marketplace/products")
def public_products(item_type: str | None = Query(default=None, pattern="^(product|service)$"),
                    db: Session = Depends(get_db)):
    settings = read_settings(db)
    if not settings["marketplace_enabled"]:
        return []
    query = select(MarketplaceProduct).where(MarketplaceProduct.status == "active")
    if item_type:
        query = query.where(MarketplaceProduct.item_type == item_type)
    rows = db.scalars(query.order_by(desc(MarketplaceProduct.created_at)).limit(100)).all()
    return [product_out(row) for row in rows]


@router.post("/api/marketplace/products", status_code=201)
def seller_create_product(payload: ProductInput, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    settings = read_settings(db)
    if not settings["marketplace_enabled"]:
        raise HTTPException(status_code=403, detail="Marketplace is currently disabled")
    if settings["admin_only_publishing"]:
        raise HTTPException(status_code=403, detail="Publishing is restricted to administrators")
    permission_key = "user_service_publishing" if payload.item_type == "service" else "user_product_publishing"
    if not settings[permission_key]:
        raise HTTPException(status_code=403, detail="Publishing for this item type is disabled")
    profile = db.get(models.Profile, claims.get("sub"))
    if profile is None:
        raise HTTPException(status_code=409, detail="Create your profile before publishing")
    allowed_categories = settings["service_categories"] if payload.item_type == "service" else settings["product_categories"]
    if payload.category not in allowed_categories:
        raise HTTPException(status_code=422, detail="Choose a category enabled by the platform")
    allowed_methods = set(settings["payment_methods"])
    if not set(payload.payment_methods).issubset(allowed_methods):
        raise HTTPException(status_code=422, detail="A selected payment method is not enabled")
    status = "pending" if settings["product_approval_required"] else "active"
    item = MarketplaceProduct(id=str(uuid4()), owner_id=profile.id, title=payload.title.strip(),
        description=payload.description.strip(), item_type=payload.item_type, price=payload.price,
        currency=payload.currency, category=payload.category,
        payment_methods=json.dumps(payload.payment_methods), image_url=payload.image_url,
        status=status, created_by_admin=False)
    db.add(item)
    db.commit()
    db.refresh(item)
    return product_out(item)


@admin_router.get("/settings")
def admin_get_settings(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    require_admin(claims, db)
    return read_settings(db)


@admin_router.patch("/settings")
def admin_update_settings(payload: SettingsInput, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    actor = require_admin(claims, db)
    values = payload.model_dump(exclude_unset=True)
    allowed_methods = {"manual_transfer", "paypal", "payoneer", "cash_on_delivery", "card"}
    for key in ("payment_methods",):
        if key in values and (not values[key] or any(x not in allowed_methods for x in values[key])):
            raise HTTPException(status_code=422, detail="Invalid payment methods")
    for key in ("product_categories", "service_categories"):
        if key in values and (not values[key] or any(not str(x).strip() or len(str(x)) > 80 for x in values[key])):
            raise HTTPException(status_code=422, detail="Categories cannot be empty")
        if key in values:
            values[key] = list(dict.fromkeys(str(x).strip() for x in values[key]))
    if "commission_percent" in values:
        values["commission_percent"] = float(values["commission_percent"])
    for key, value in values.items():
        save_setting(db, key, value)
    audit(db, actor, "marketplace_settings_updated", "platform", "marketplace", "Updated marketplace publishing and payment controls")
    db.commit()
    return read_settings(db)


@admin_router.get("/products")
def admin_list_products(status: str | None = Query(default=None), db: Session = Depends(get_db),
                        claims: dict = Depends(current_user)):
    require_admin(claims, db)
    query = select(MarketplaceProduct)
    if status and status in {"pending", "active", "paused", "rejected"}:
        query = query.where(MarketplaceProduct.status == status)
    rows = db.scalars(query.order_by(desc(MarketplaceProduct.created_at)).limit(200)).all()
    output = [product_out(row) for row in rows]
    legacy_rows = db.scalars(select(models.MarketListing)
        .where(models.MarketListing.group_id.is_(None))
        .order_by(desc(models.MarketListing.created_at)).limit(200)).all()
    output.extend([{
        "id": row.id, "owner_id": row.owner_id, "title": row.title,
        "description": row.description, "item_type": "product",
        "price": float(row.price), "currency": row.currency, "category": row.category,
        "payment_methods": ["manual_transfer"], "image_url": row.media_url,
        "status": row.status, "created_by_admin": False, "created_at": row.created_at,
        "legacy_listing": True
    } for row in legacy_rows if not status or row.status == status])
    return output


@admin_router.post("/products", status_code=201)
def admin_create_product(payload: ProductInput, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    actor = require_admin(claims, db)
    settings = read_settings(db)
    methods = set(settings["payment_methods"])
    if not set(payload.payment_methods).issubset(methods):
        raise HTTPException(status_code=422, detail="A selected payment method is not enabled")
    categories = settings["service_categories"] if payload.item_type == "service" else settings["product_categories"]
    if payload.category not in categories:
        raise HTTPException(status_code=422, detail="Choose an enabled category")
    item = MarketplaceProduct(id=str(uuid4()), owner_id=None, title=payload.title.strip(),
        description=payload.description.strip(), item_type=payload.item_type, price=payload.price,
        currency=payload.currency, category=payload.category, payment_methods=json.dumps(payload.payment_methods),
        image_url=payload.image_url, status=payload.status or "active", created_by_admin=True)
    db.add(item)
    audit(db, actor, "marketplace_item_created", "marketplace_product", item.id, "Created from administration")
    db.commit()
    db.refresh(item)
    return product_out(item)


@admin_router.patch("/products/{product_id}/status")
def admin_product_status(product_id: str, payload: ProductStatus, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    actor = require_admin(claims, db)
    item = db.get(MarketplaceProduct, product_id)
    if item is not None:
        item.status = payload.status
        audit(db, actor, "marketplace_item_status_changed", "marketplace_product", item.id, payload.reason)
        db.commit()
        return product_out(item)
    legacy = db.get(models.MarketListing, product_id)
    if legacy is None or legacy.group_id is not None:
        raise HTTPException(status_code=404, detail="Item not found")
    legacy.status = payload.status
    audit(db, actor, "marketplace_listing_status_changed", "market_listing", legacy.id, payload.reason)
    db.commit()
    return {"id": legacy.id, "status": legacy.status, "legacy_listing": True}
