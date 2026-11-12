import logging
import re
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pwdlib import PasswordHash
from backend.database import SessionLocal
from backend import models
from backend.security import create_access_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["authentication"])
password_hasher = PasswordHash.recommended()


class Credentials(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=10, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^\\s@]+@[^\\s@]+\\.[^\\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value


def get_db():
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def auth_result(user: models.User, profile: models.Profile):
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "expires_in": 43200,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": profile.username,
            "display_name": profile.display_name,
        },
    }


@router.post("/register", status_code=201)
def register(payload: Credentials, db: Session = Depends(get_db)):
    if db.scalar(select(models.User).where(models.User.email == payload.email)):
        raise HTTPException(status_code=409, detail="هذا البريد مسجل بالفعل.")
    user_id = str(uuid4())
    user = models.User(
        id=user_id,
        email=payload.email,
        password_hash=password_hasher.hash(payload.password),
        is_active=True,
    )
    profile = models.Profile(
        id=user_id,
        username=f"user_{uuid4().hex[:12]}",
        display_name=payload.email.split("@", 1)[0][:80],
        is_private=False,
    )
    db.add(user)
    db.add(profile)
    try:
        db.commit()
        db.refresh(user)
        db.refresh(profile)
    except IntegrityError:
        db.rollback()
        logger.exception("Registration failed: database integrity constraint rejected user/profile insert")
        raise HTTPException(status_code=409, detail="تعذر إنشاء الحساب بهذه البيانات. راجع سجلات الخادم لمعرفة سبب قاعدة البيانات.")
    return auth_result(user, profile)


@router.post("/login")
def login(payload: Credentials, db: Session = Depends(get_db)):
    user = db.scalar(select(models.User).where(models.User.email == payload.email))
    if user is None or not password_hasher.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="البريد الإلكتروني أو كلمة المرور غير صحيحة.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="هذا الحساب موقوف.")
    profile = db.get(models.Profile, user.id)
    if profile is None:
        raise HTTPException(status_code=409, detail="ملف الحساب غير مكتمل.")
    return auth_result(user, profile)
