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


@router.get("/friends")
def list_friends(claims: dict=Depends(current_user), db: Session=Depends(get_db)):
    uid=claims["sub"]
    rows=db.scalars(select(models.Friendship).where((models.Friendship.requester_id==uid)|(models.Friendship.addressee_id==uid)).order_by(desc(models.Friendship.created_at))).all()
    result=[]
    for f in rows:
        other=f.addressee_id if f.requester_id==uid else f.requester_id
        profile=db.get(models.Profile,other)
        result.append({"id":f.id,"user_id":other,"username":profile.username if profile else "","display_name":profile.display_name if profile else "عضو","avatar_url":profile.avatar_url if profile else None,"status":f.status,"direction":"sent" if f.requester_id==uid else "received"})
    return result

@router.post("/friends/request/{recipient_id}",status_code=201)
def request_friend(recipient_id: str, claims: dict=Depends(current_user), db: Session=Depends(get_db)):
    uid=claims["sub"]
    if recipient_id==uid: raise HTTPException(400,"Cannot add yourself")
    if db.get(models.Profile,recipient_id) is None: raise HTTPException(404,"User not found")
    blocked=db.scalar(select(models.Block).where(((models.Block.blocker_id==uid)&(models.Block.blocked_id==recipient_id))|((models.Block.blocker_id==recipient_id)&(models.Block.blocked_id==uid))))
    if blocked: raise HTTPException(403,"Friend request unavailable")
    existing=db.scalar(select(models.Friendship).where(((models.Friendship.requester_id==uid)&(models.Friendship.addressee_id==recipient_id))|((models.Friendship.requester_id==recipient_id)&(models.Friendship.addressee_id==uid))))
    if existing:
        if existing.status=="accepted": return {"status":"accepted","id":existing.id}
        if existing.requester_id==recipient_id: raise HTTPException(409,"This user already sent you a request")
        raise HTTPException(409,"Friend request already sent")
    row=models.Friendship(id=str(uuid4()),requester_id=uid,addressee_id=recipient_id,status="pending")
    db.add(row); db.add(models.Notification(id=str(uuid4()),user_id=recipient_id,actor_id=uid,kind="friend_request",target_id=row.id)); db.commit()
    return {"id":row.id,"status":row.status}

@router.post("/friends/{friendship_id}/respond")
def respond_friend(friendship_id: str, action: str=Query(pattern="^(accept|reject)$"), claims: dict=Depends(current_user), db: Session=Depends(get_db)):
    row=db.get(models.Friendship,friendship_id)
    if not row or row.addressee_id!=claims["sub"] or row.status!="pending": raise HTTPException(404,"Friend request not found")
    if action=="accept":
        row.status="accepted"
        db.add(models.Notification(id=str(uuid4()),user_id=row.requester_id,actor_id=claims["sub"],kind="friend_accepted",target_id=row.id))
    else:
        db.delete(row)
    db.commit()
    return {"status":"accepted" if action=="accept" else "rejected"}
