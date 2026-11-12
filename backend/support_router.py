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

router = APIRouter(prefix="/api", tags=["support-notifications"])

def get_db():
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def is_support_admin(claims: dict, db: Session) -> bool:
    configured_id = os.getenv("SUPPORT_ADMIN_USER_ID", "").strip()
    configured_email = os.getenv("SUPPORT_ADMIN_EMAIL", "").strip().lower()
    user = db.get(models.User, claims["sub"])
    return bool(user and ((configured_id and user.id == configured_id) or (configured_email and user.email.lower() == configured_email)))

def ticket_view(ticket, db):
    profile = db.get(models.Profile, ticket.user_id)
    last = db.scalar(select(models.SupportMessage).where(models.SupportMessage.ticket_id == ticket.id).order_by(desc(models.SupportMessage.created_at)).limit(1))
    return {"id":ticket.id,"subject":ticket.subject,"status":ticket.status,"created_at":ticket.created_at,"updated_at":ticket.updated_at,"user_id":ticket.user_id,"user_name":profile.display_name if profile else "عضو","last_message":last.body if last else ""}

class TicketCreate(BaseModel):
    subject: str = Field(min_length=3,max_length=160)
    message: str = Field(min_length=1,max_length=5000)

class MessageCreate(BaseModel):
    message: str = Field(min_length=1,max_length=5000)

@router.post("/support/tickets", status_code=201)
def create_ticket(payload: TicketCreate, claims: dict=Depends(current_user), db: Session=Depends(get_db)):
    uid=claims["sub"]
    if db.get(models.Profile,uid) is None: raise HTTPException(404,"Profile not found")
    ticket=models.SupportTicket(id=str(uuid4()),user_id=uid,subject=payload.subject.strip(),status="open")
    db.add(ticket)
    db.add(models.SupportMessage(id=str(uuid4()),ticket_id=ticket.id,sender_id=uid,sender_role="user",body=payload.message.strip()))
    db.commit(); db.refresh(ticket)
    return ticket_view(ticket,db)

@router.get("/support/tickets")
def list_tickets(claims: dict=Depends(current_user), db: Session=Depends(get_db)):
    admin=is_support_admin(claims,db)
    q=select(models.SupportTicket)
    if not admin: q=q.where(models.SupportTicket.user_id==claims["sub"])
    rows=db.scalars(q.order_by(desc(models.SupportTicket.updated_at)).limit(100)).all()
    return [ticket_view(t,db) for t in rows]

@router.get("/support/tickets/{ticket_id}/messages")
def list_ticket_messages(ticket_id: str, claims: dict=Depends(current_user), db: Session=Depends(get_db)):
    ticket=db.get(models.SupportTicket,ticket_id)
    if not ticket: raise HTTPException(404,"Ticket not found")
    admin=is_support_admin(claims,db)
    if not admin and ticket.user_id!=claims["sub"]: raise HTTPException(404,"Ticket not found")
    rows=db.scalars(select(models.SupportMessage).where(models.SupportMessage.ticket_id==ticket_id).order_by(models.SupportMessage.created_at)).all()
    return [{"id":m.id,"sender_id":m.sender_id,"sender_role":m.sender_role,"message":m.body,"created_at":m.created_at} for m in rows]

@router.post("/support/tickets/{ticket_id}/messages", status_code=201)
def send_ticket_message(ticket_id: str, payload: MessageCreate, claims: dict=Depends(current_user), db: Session=Depends(get_db)):
    ticket=db.get(models.SupportTicket,ticket_id)
    if not ticket: raise HTTPException(404,"Ticket not found")
    admin=is_support_admin(claims,db)
    if not admin and ticket.user_id!=claims["sub"]: raise HTTPException(404,"Ticket not found")
    if ticket.status=="closed" and not admin: raise HTTPException(409,"Ticket is closed")
    role="support" if admin else "user"
    db.add(models.SupportMessage(id=str(uuid4()),ticket_id=ticket_id,sender_id=claims["sub"],sender_role=role,body=payload.message.strip()))
    ticket.updated_at=datetime.now(timezone.utc)
    if admin:
        db.add(models.Notification(id=str(uuid4()),user_id=ticket.user_id,actor_id=claims["sub"],kind="support_reply",target_id=ticket.id))
    db.commit()
    return {"sent":True}

@router.patch("/support/tickets/{ticket_id}/status")
def update_ticket_status(ticket_id: str, status: str=Query(pattern="^(open|closed)$"), claims: dict=Depends(current_user), db: Session=Depends(get_db)):
    if not is_support_admin(claims,db): raise HTTPException(403,"Support admin only")
    ticket=db.get(models.SupportTicket,ticket_id)
    if not ticket: raise HTTPException(404,"Ticket not found")
    ticket.status=status; ticket.updated_at=datetime.now(timezone.utc); db.commit()
    return {"id":ticket.id,"status":ticket.status}

@router.get("/notifications")
def list_notifications(claims: dict=Depends(current_user), db: Session=Depends(get_db)):
    rows=db.scalars(select(models.Notification).where(models.Notification.user_id==claims["sub"]).order_by(desc(models.Notification.created_at)).limit(100)).all()
    return [{"id":n.id,"kind":n.kind,"target_id":n.target_id,"actor_id":n.actor_id,"read":n.read_at is not None,"created_at":n.created_at} for n in rows]

@router.put("/notifications/read-all")
def read_all_notifications(claims: dict=Depends(current_user), db: Session=Depends(get_db)):
    rows=db.scalars(select(models.Notification).where(models.Notification.user_id==claims["sub"],models.Notification.read_at.is_(None))).all()
    now=datetime.now(timezone.utc)
    for row in rows: row.read_at=now
    db.commit()
    return {"updated":len(rows)}

@router.put("/notifications/{notification_id}/read")
def read_notification(notification_id: str, claims: dict=Depends(current_user), db: Session=Depends(get_db)):
    row=db.get(models.Notification,notification_id)
    if not row or row.user_id!=claims["sub"]: raise HTTPException(404,"Notification not found")
    row.read_at=datetime.now(timezone.utc); db.commit()
    return {"read":True}
