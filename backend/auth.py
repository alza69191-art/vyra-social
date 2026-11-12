import hashlib
import logging
import os
import re
import secrets
import smtplib
import json
import urllib.request
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, desc
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
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value


class EmailOnly(BaseModel):
    email: str = Field(min_length=5, max_length=254)


class VerifyEmail(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    code: str = Field(pattern=r"^\d{6}$")


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
        "user": {"id": user.id, "email": user.email, "username": profile.username, "display_name": profile.display_name},
    }


def _send_verification_email(email: str, code: str):
    subject = "رمز التحقق من بريدك - VYRA"
    body = f"مرحباً بك في VYRA. رمز التحقق الخاص بك هو: {code}\nصلاحية الرمز 10 دقائق. إذا لم تطلب إنشاء الحساب فتجاهل هذه الرسالة."
    resend_key = os.getenv("RESEND_API_KEY", "").strip()
    sender = (os.getenv("RESEND_FROM") or os.getenv("SMTP_FROM") or "").strip()
    if resend_key:
        if not sender:
            raise RuntimeError("أضف RESEND_FROM بعنوان بريد موثّق لدى Resend.")
        payload = json.dumps({"from": sender, "to": [email], "subject": subject, "text": body}).encode("utf-8")
        request = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                if response.status not in (200, 201, 202):
                    raise RuntimeError("تعذر إرسال البريد عبر Resend.")
        except Exception as exc:
            raise RuntimeError("تعذر إرسال البريد عبر Resend.") from exc
        return
    host = os.getenv("SMTP_HOST", "").strip()
    username = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    sender = os.getenv("SMTP_FROM", username).strip()
    if not all((host, username, password, sender)):
        raise RuntimeError("أضف RESEND_API_KEY وRESEND_FROM، أو بيانات SMTP في Render.")
    port = int(os.getenv("SMTP_PORT", "587"))
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = email
    message.set_content(body)
    with smtplib.SMTP(host, port, timeout=20) as server:
        server.starttls()
        server.login(username, password)
        server.send_message(message)

def _issue_verification(db: Session, user: models.User):
    code = f"{secrets.randbelow(1_000_000):06d}"
    token = models.EmailVerificationToken(
        id=str(uuid4()),
        user_id=user.id,
        token_hash=hashlib.sha256(code.encode()).hexdigest(),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(token)
    db.commit()
    try:
        _send_verification_email(user.email, code)
    except Exception:
        logger.exception("Could not send VYRA email verification")
        raise HTTPException(status_code=503, detail="تعذر إرسال رمز التحقق. تحقق من إعداد البريد في الخادم ثم أعد طلب الرمز.")


@router.post("/register", status_code=202)
def register(payload: Credentials, db: Session = Depends(get_db)):
    if db.scalar(select(models.User).where(models.User.email == payload.email)):
        raise HTTPException(status_code=409, detail="هذا البريد مسجل بالفعل.")
    user_id = str(uuid4())
    user = models.User(id=user_id, email=payload.email, password_hash=password_hasher.hash(payload.password), is_active=True)
    profile = models.Profile(id=user_id, username=f"user_{uuid4().hex[:12]}", display_name=payload.email.split("@", 1)[0][:80], is_private=False)
    try:
        db.add(user)
        db.flush()
        db.add(profile)
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        logger.exception("Registration failed: database integrity constraint rejected user/profile insert")
        raise HTTPException(status_code=409, detail="تعذر إنشاء الحساب بهذه البيانات.")
    # Email verification is temporarily disabled by product decision.
    # Return a session immediately after successful account creation.
    return auth_result(user, profile)


@router.post("/verify-email")
def verify_email(payload: VerifyEmail, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.scalar(select(models.User).where(models.User.email == email))
    if user is None or not user.is_active:
        raise HTTPException(status_code=400, detail="بيانات التحقق غير صحيحة.")
    if user.email_verified_at is None:
        token = db.scalar(select(models.EmailVerificationToken).where(
            models.EmailVerificationToken.user_id == user.id,
            models.EmailVerificationToken.used_at.is_(None),
        ).order_by(desc(models.EmailVerificationToken.expires_at)))
        digest = hashlib.sha256(payload.code.encode()).hexdigest()
        now = datetime.now(timezone.utc)
        if token is None or token.token_hash != digest or token.expires_at.replace(tzinfo=timezone.utc) < now:
            raise HTTPException(status_code=400, detail="رمز التحقق غير صحيح أو انتهت صلاحيته.")
        token.used_at = now
        user.email_verified_at = now
        db.commit()
    profile = db.get(models.Profile, user.id)
    if profile is None:
        raise HTTPException(status_code=409, detail="ملف الحساب غير مكتمل.")
    return auth_result(user, profile)


@router.post("/resend-verification")
def resend_verification(payload: EmailOnly, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if not email:
        raise HTTPException(status_code=422, detail="أدخل البريد الإلكتروني.")
    user = db.scalar(select(models.User).where(models.User.email == email))
    if user is None or user.email_verified_at is not None:
        return {"sent": True, "message": "إذا كان الحساب بحاجة إلى التحقق فسيتم إرسال رمز جديد."}
    _issue_verification(db, user)
    return {"sent": True, "message": "تم إرسال رمز تحقق جديد."}


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
