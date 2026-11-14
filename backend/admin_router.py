import os
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, desc, func
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend import models
from backend.security import current_user

router = APIRouter(prefix="/api/admin", tags=["administration"])

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
    if not configured:
        raise HTTPException(status_code=503, detail="Admin identity is not configured")
    actor = db.get(models.User, claims.get("sub"))
    if actor is None or not actor.is_active or actor.email.lower() != configured:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return actor

class UserStatusUpdate(BaseModel):
    is_active: bool
    reason: str = Field(min_length=5, max_length=500)

class ModerationAction(BaseModel):
    reason: str = Field(min_length=5, max_length=500)

def audit(db: Session, actor: models.User, action: str, target_type: str, target_id: str, reason: str):
    db.add(models.AdminAuditLog(
        id=str(uuid4()), actor_id=actor.id, action=action,
        target_type=target_type, target_id=target_id, reason=reason.strip()
    ))

@router.get("/overview")
def overview(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    require_admin(claims, db)
    return {
        "users": db.scalar(select(func.count(models.User.id))) or 0,
        "active_users": db.scalar(select(func.count(models.User.id)).where(models.User.is_active.is_(True))) or 0,
        "posts": db.scalar(select(func.count(models.Post.id))) or 0,
        "open_tickets": db.scalar(select(func.count(models.SupportTicket.id)).where(models.SupportTicket.status == "open")) or 0,
        "audit_events": db.scalar(select(func.count(models.AdminAuditLog.id))) or 0,
    }

@router.get("/users")
def users(claims: dict = Depends(current_user), db: Session = Depends(get_db),
          limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0)):
    require_admin(claims, db)
    rows = db.execute(select(models.User, models.Profile)
        .outerjoin(models.Profile, models.Profile.id == models.User.id)
        .order_by(desc(models.User.created_at)).limit(limit).offset(offset)).all()
    return [{
        "id": user.id, "email": user.email, "is_active": user.is_active,
        "created_at": user.created_at,
        "display_name": profile.display_name if profile else None,
        "username": profile.username if profile else None,
    } for user, profile in rows]

@router.patch("/users/{user_id}/status")
def set_user_status(user_id: str, payload: UserStatusUpdate,
                    claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    actor = require_admin(claims, db)
    target = db.get(models.User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == actor.id:
        raise HTTPException(status_code=400, detail="You cannot suspend your own administrator account")
    configured = (os.getenv("ADMIN_EMAIL") or os.getenv("SUPPORT_ADMIN_EMAIL") or "").strip().lower()
    if target.email.lower() == configured:
        raise HTTPException(status_code=403, detail="The administrator account is protected")
    target.is_active = payload.is_active
    audit(db, actor, "user_activated" if payload.is_active else "user_suspended",
          "user", target.id, payload.reason)
    db.commit()
    return {"id": target.id, "is_active": target.is_active}

@router.get("/posts")
def posts(claims: dict = Depends(current_user), db: Session = Depends(get_db),
          limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0)):
    require_admin(claims, db)
    rows = db.execute(select(models.Post, models.Profile)
        .join(models.Profile, models.Profile.id == models.Post.author_id)
        .order_by(desc(models.Post.created_at)).limit(limit).offset(offset)).all()
    return [{
        "id": post.id, "author_id": post.author_id,
        "author_name": profile.display_name, "author_username": profile.username,
        "body": post.body, "visibility": post.visibility, "created_at": post.created_at,
    } for post, profile in rows]

@router.delete("/posts/{post_id}")
def remove_post(post_id: str, payload: ModerationAction,
                claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    actor = require_admin(claims, db)
    post = db.get(models.Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    audit(db, actor, "post_removed", "post", post.id, payload.reason)
    db.delete(post)
    db.commit()
    return {"deleted": True, "id": post_id}

@router.get("/messages")
def messages(claims: dict = Depends(current_user), db: Session = Depends(get_db),
             limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0)):
    require_admin(claims, db)
    rows = db.scalars(select(models.DirectMessage).order_by(desc(models.DirectMessage.created_at))
                      .limit(limit).offset(offset)).all()
    return [{
        "id": row.id, "sender_id": row.sender_id, "recipient_id": row.recipient_id,
        "conversation_id": row.conversation_id, "body": row.body,
        "media_type": row.media_type, "created_at": row.created_at,
    } for row in rows]

@router.delete("/messages/{message_id}")
def remove_message(message_id: str, payload: ModerationAction,
                   claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    actor = require_admin(claims, db)
    message = db.get(models.DirectMessage, message_id)
    if message is None:
        raise HTTPException(status_code=404, detail="Message not found")
    audit(db, actor, "message_removed", "message", message.id, payload.reason)
    db.delete(message)
    db.commit()
    return {"deleted": True, "id": message_id}

@router.get("/audit")
def audit_events(claims: dict = Depends(current_user), db: Session = Depends(get_db),
                 limit: int = Query(default=100, ge=1, le=200)):
    require_admin(claims, db)
    rows = db.scalars(select(models.AdminAuditLog).order_by(desc(models.AdminAuditLog.created_at)).limit(limit)).all()
    return [{
        "id": row.id, "actor_id": row.actor_id, "action": row.action,
        "target_type": row.target_type, "target_id": row.target_id,
        "reason": row.reason, "created_at": row.created_at,
    } for row in rows]
