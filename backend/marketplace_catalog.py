import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, select, desc, or_
from sqlalchemy.orm import Mapped, mapped_column, Session

from backend.database import Base, SessionLocal
from backend import models
from backend.marketplace_admin import MarketplaceProduct, read_settings
from backend.security import current_user

router = APIRouter(tags=["marketplace-catalog"])
admin_router = APIRouter(prefix="/api/admin/catalog", tags=["marketplace-catalog-admin"])


class MarketplaceBrand(Base):
    __tablename__ = "marketplace_brands"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MarketplaceProductMeta(Base):
    __tablename__ = "marketplace_product_meta"
    product_id: Mapped[str] = mapped_column(ForeignKey("marketplace_products.id", ondelete="CASCADE"), primary_key=True)
    sku: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True, index=True)
    barcode: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True, index=True)
    brand_id: Mapped[str | None] = mapped_column(ForeignKey("marketplace_brands.id", ondelete="SET NULL"), nullable=True, index=True)
    attributes: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    tags: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    weight_grams: Mapped[int | None] = mapped_column(Integer, nullable=True)
    min_order_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    max_order_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stock_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    track_inventory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class MarketplaceVariant(Base):
    __tablename__ = "marketplace_product_variants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("marketplace_products.id", ondelete="CASCADE"), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    barcode: Mapped[str | None] = mapped_column(String(80), nullable=True, unique=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    attributes: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    stock_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MarketplaceStockMovement(Base):
    __tablename__ = "marketplace_stock_movements"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("marketplace_products.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id: Mapped[str | None] = mapped_column(ForeignKey("marketplace_product_variants.id", ondelete="SET NULL"), nullable=True)
    actor_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(300), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


def get_db():
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _actor(claims: dict, db: Session):
    user = db.get(models.User, claims.get("sub"))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid account")
    admin_email = (os.getenv("ADMIN_EMAIL") or os.getenv("SUPPORT_ADMIN_EMAIL") or "").strip().lower()
    return user, bool(admin_email and user.email.lower() == admin_email)


def _can_manage(product: MarketplaceProduct, claims: dict, db: Session):
    user, is_admin = _actor(claims, db)
    profile = db.get(models.Profile, user.id)
    if not is_admin and (profile is None or product.owner_id != profile.id):
        raise HTTPException(status_code=403, detail="You cannot manage this product")
    return user, is_admin


def _meta_out(meta: MarketplaceProductMeta | None):
    if meta is None:
        return {"sku": None, "barcode": None, "brand_id": None, "attributes": {}, "tags": [],
                "weight_grams": None, "min_order_qty": 1, "max_order_qty": None,
                "stock_qty": 0, "low_stock_threshold": 5, "track_inventory": True}
    return {"sku": meta.sku, "barcode": meta.barcode, "brand_id": meta.brand_id,
            "attributes": json.loads(meta.attributes or "{}"), "tags": json.loads(meta.tags or "[]"),
            "weight_grams": meta.weight_grams, "min_order_qty": meta.min_order_qty,
            "max_order_qty": meta.max_order_qty, "stock_qty": meta.stock_qty,
            "low_stock_threshold": meta.low_stock_threshold, "track_inventory": meta.track_inventory}


def _product_out(db: Session, item: MarketplaceProduct):
    meta = db.get(MarketplaceProductMeta, item.id)
    brand = db.get(MarketplaceBrand, meta.brand_id) if meta and meta.brand_id else None
    variants = db.scalars(select(MarketplaceVariant).where(
        MarketplaceVariant.product_id == item.id, MarketplaceVariant.active.is_(True)
    ).order_by(MarketplaceVariant.created_at)).all()
    return {"id": item.id, "owner_id": item.owner_id, "title": item.title, "description": item.description,
            "item_type": item.item_type, "price": float(item.price), "currency": item.currency,
            "category": item.category, "payment_methods": json.loads(item.payment_methods or "[]"),
            "image_url": item.image_url, "status": item.status, "created_at": item.created_at,
            "sku": _meta_out(meta)["sku"], "barcode": _meta_out(meta)["barcode"],
            "brand": ({"id": brand.id, "name": brand.name, "slug": brand.slug, "logo_url": brand.logo_url} if brand else None),
            "attributes": _meta_out(meta)["attributes"], "tags": _meta_out(meta)["tags"],
            "weight_grams": _meta_out(meta)["weight_grams"], "min_order_qty": _meta_out(meta)["min_order_qty"],
            "max_order_qty": _meta_out(meta)["max_order_qty"], "stock_qty": _meta_out(meta)["stock_qty"],
            "track_inventory": _meta_out(meta)["track_inventory"],
            "variants": [{"id": v.id, "sku": v.sku, "barcode": v.barcode, "title": v.title,
                          "attributes": json.loads(v.attributes or "{}"),
                          "price": float(v.price) if v.price is not None else None, "stock_qty": v.stock_qty}
                         for v in variants]}


class BrandInput(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    slug: str = Field(min_length=2, max_length=120, pattern="^[a-z0-9-]+$")
    description: str | None = Field(default=None, max_length=2000)
    logo_url: str | None = Field(default=None, max_length=2000)


class ProductMetaInput(BaseModel):
    sku: str | None = Field(default=None, max_length=80)
    barcode: str | None = Field(default=None, max_length=80)
    brand_id: str | None = None
    attributes: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list, max_length=30)
    weight_grams: int | None = Field(default=None, ge=0, le=100000000)
    min_order_qty: int = Field(default=1, ge=1, le=100000)
    max_order_qty: int | None = Field(default=None, ge=1, le=100000)
    low_stock_threshold: int = Field(default=5, ge=0, le=100000)
    track_inventory: bool = True


class VariantInput(BaseModel):
    sku: str = Field(min_length=2, max_length=80)
    barcode: str | None = Field(default=None, max_length=80)
    title: str = Field(min_length=1, max_length=120)
    attributes: dict = Field(default_factory=dict)
    price: Decimal | None = Field(default=None, gt=0, le=Decimal("99999999"))
    stock_qty: int = Field(default=0, ge=0, le=100000000)


class StockInput(BaseModel):
    delta: int = Field(ge=-100000000, le=100000000)
    reason: str = Field(min_length=3, max_length=300)
    variant_id: str | None = None


@router.get("/api/marketplace/brands")
def public_brands(db: Session = Depends(get_db)):
    settings = read_settings(db)
    if not settings["marketplace_enabled"]:
        return []
    rows = db.scalars(select(MarketplaceBrand).where(MarketplaceBrand.active.is_(True)).order_by(MarketplaceBrand.name)).all()
    return [{"id": x.id, "name": x.name, "slug": x.slug, "logo_url": x.logo_url} for x in rows]


@router.get("/api/marketplace/search")
def search_catalog(q: str | None = Query(default=None, max_length=120),
                   category: str | None = Query(default=None, max_length=80),
                   brand: str | None = Query(default=None, max_length=120),
                   sort: str = Query(default="newest", pattern="^(newest|price_asc|price_desc|title)$"),
                   limit: int = Query(default=24, ge=1, le=100),
                   offset: int = Query(default=0, ge=0),
                   db: Session = Depends(get_db)):
    settings = read_settings(db)
    if not settings["marketplace_enabled"]:
        return {"items": [], "total": 0, "limit": limit, "offset": offset}
    query = select(MarketplaceProduct).where(MarketplaceProduct.status == "active", MarketplaceProduct.item_type == "product")
    if q and q.strip():
        term = "%" + q.strip().replace("%", "") + "%"
        query = query.where(or_(MarketplaceProduct.title.ilike(term), MarketplaceProduct.description.ilike(term),
                                MarketplaceProduct.category.ilike(term)))
    if category:
        query = query.where(MarketplaceProduct.category == category)
    if brand:
        query = query.join(MarketplaceProductMeta, MarketplaceProductMeta.product_id == MarketplaceProduct.id).join(
            MarketplaceBrand, MarketplaceBrand.id == MarketplaceProductMeta.brand_id
        ).where(or_(MarketplaceBrand.slug == brand, MarketplaceBrand.name == brand))
    total = db.scalar(select(__import__("sqlalchemy").func.count()).select_from(query.subquery())) or 0
    order = {"newest": desc(MarketplaceProduct.created_at), "price_asc": MarketplaceProduct.price.asc(),
             "price_desc": MarketplaceProduct.price.desc(), "title": MarketplaceProduct.title.asc()}[sort]
    rows = db.scalars(query.order_by(order).limit(limit).offset(offset)).unique().all()
    return {"items": [_product_out(db, row) for row in rows], "total": total, "limit": limit, "offset": offset}


@admin_router.get("/brands")
def admin_brands(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    _user, is_admin = _actor(claims, db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Administrator access required")
    rows = db.scalars(select(MarketplaceBrand).order_by(MarketplaceBrand.name)).all()
    return [{"id": x.id, "name": x.name, "slug": x.slug, "description": x.description,
             "logo_url": x.logo_url, "active": x.active} for x in rows]


@admin_router.post("/brands", status_code=201)
def create_brand(payload: BrandInput, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    _user, is_admin = _actor(claims, db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Administrator access required")
    row = MarketplaceBrand(id=str(uuid4()), name=payload.name.strip(), slug=payload.slug,
                           description=payload.description, logo_url=payload.logo_url, active=True)
    db.add(row)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail="Brand name or slug already exists")
    return {"id": row.id, "name": row.name, "slug": row.slug, "active": row.active}


@admin_router.patch("/products/{product_id}/meta")
def update_product_meta(product_id: str, payload: ProductMetaInput,
                        claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    product = db.get(MarketplaceProduct, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    _user, is_admin = _can_manage(product, claims, db)
    if payload.max_order_qty is not None and payload.max_order_qty < payload.min_order_qty:
        raise HTTPException(status_code=422, detail="Maximum quantity must be greater than or equal to minimum")
    if payload.brand_id and db.get(MarketplaceBrand, payload.brand_id) is None:
        raise HTTPException(status_code=422, detail="Brand not found")
    meta = db.get(MarketplaceProductMeta, product_id)
    if meta is None:
        meta = MarketplaceProductMeta(product_id=product_id)
        db.add(meta)
    meta.sku = payload.sku.strip() if payload.sku else None
    meta.barcode = payload.barcode.strip() if payload.barcode else None
    meta.brand_id = payload.brand_id
    meta.attributes = json.dumps(payload.attributes, ensure_ascii=False)
    meta.tags = json.dumps(list(dict.fromkeys(str(x).strip()[:60] for x in payload.tags if str(x).strip())), ensure_ascii=False)
    meta.weight_grams = payload.weight_grams
    meta.min_order_qty = payload.min_order_qty
    meta.max_order_qty = payload.max_order_qty
    meta.low_stock_threshold = payload.low_stock_threshold
    meta.track_inventory = payload.track_inventory
    db.commit()
    return {"product_id": product_id, **_meta_out(meta)}


@admin_router.post("/products/{product_id}/variants", status_code=201)
def add_variant(product_id: str, payload: VariantInput,
                claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    product = db.get(MarketplaceProduct, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    _user, _admin = _can_manage(product, claims, db)
    variant = MarketplaceVariant(id=str(uuid4()), product_id=product_id, sku=payload.sku.strip(),
        barcode=payload.barcode.strip() if payload.barcode else None, title=payload.title.strip(),
        attributes=json.dumps(payload.attributes, ensure_ascii=False), price=payload.price, stock_qty=payload.stock_qty)
    db.add(variant)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail="Variant SKU or barcode already exists")
    return {"id": variant.id, "product_id": product_id, "sku": variant.sku, "title": variant.title,
            "attributes": json.loads(variant.attributes), "price": float(variant.price) if variant.price else None,
            "stock_qty": variant.stock_qty}


@admin_router.post("/products/{product_id}/stock")
def adjust_stock(product_id: str, payload: StockInput,
                 claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    product = db.get(MarketplaceProduct, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    user, _admin = _can_manage(product, claims, db)
    meta = db.get(MarketplaceProductMeta, product_id)
    if meta is None:
        meta = MarketplaceProductMeta(product_id=product_id)
        db.add(meta)
        db.flush()
    if payload.variant_id:
        variant = db.get(MarketplaceVariant, payload.variant_id)
        if variant is None or variant.product_id != product_id:
            raise HTTPException(status_code=404, detail="Variant not found")
        if variant.stock_qty + payload.delta < 0:
            raise HTTPException(status_code=409, detail="Stock cannot become negative")
        variant.stock_qty += payload.delta
    else:
        if meta.stock_qty + payload.delta < 0:
            raise HTTPException(status_code=409, detail="Stock cannot become negative")
        meta.stock_qty += payload.delta
    db.add(MarketplaceStockMovement(id=str(uuid4()), product_id=product_id, variant_id=payload.variant_id,
        actor_id=user.id, delta=payload.delta, reason=payload.reason.strip()))
    db.commit()
    return {"product_id": product_id, "stock_qty": meta.stock_qty, "updated": True}


@admin_router.get("/low-stock")
def low_stock(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    _user, is_admin = _actor(claims, db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Administrator access required")
    rows = db.execute(select(MarketplaceProduct, MarketplaceProductMeta)
        .join(MarketplaceProductMeta, MarketplaceProductMeta.product_id == MarketplaceProduct.id)
        .where(MarketplaceProduct.status == "active", MarketplaceProductMeta.track_inventory.is_(True),
               MarketplaceProductMeta.stock_qty <= MarketplaceProductMeta.low_stock_threshold)
        .order_by(MarketplaceProductMeta.stock_qty.asc()).limit(200)).all()
    return [{"product_id": p.id, "title": p.title, "sku": m.sku, "stock_qty": m.stock_qty,
             "threshold": m.low_stock_threshold, "category": p.category} for p, m in rows]
