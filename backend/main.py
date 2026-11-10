import os
from uuid import uuid4
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, desc, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from backend.database import Base, SessionLocal, engine, database_status
from backend import models
from backend.schemas import ProfileUpdate, ProfileOut, PostCreate, PostOut, PostFeedOut, CommentCreate, CommentOut
from backend.security import current_user
from backend.auth import router as auth_router
from backend.ai_router import generate_reply, generate_agent_reply
from backend.cloudinary_uploads import router as uploads_router

app = FastAPI(
    title="VYRA API",
    version="0.3.0",
    description="Backend API for the VYRA social platform.",
    docs_url="/api/docs",
    redoc_url=None,
)

default_origins = {
    "http://localhost:3000",
    "https://alza69191-art.github.io",
    "https://vyra-web.onrender.com",
    "https://vyra-web-rs1b.onrender.com",
    "https://vyra-social-web.onrender.com",
}
configured_origins = {
    item.strip() for item in os.getenv("CORS_ORIGINS", "").split(",") if item.strip()
}
origins = sorted(default_origins | configured_origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(uploads_router)


def get_db():
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
def initialize_schema():
    if engine is not None:
        # Create missing tables first so migrations also work on a brand-new database.
        Base.metadata.create_all(bind=engine)
        # Idempotent migrations preserve existing user and profile data.
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ"
            )
            connection.exec_driver_sql(
                "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url TEXT"
            )


@app.get("/")
def root():
    return {"name": "VYRA API", "status": "running", "docs": "/api/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "vyra-api"}


@app.get("/api/health/database")
def health_database():
    result = database_status()
    status = "connected" if result["connected"] else ("not_configured" if not result["configured"] else "unavailable")
    return {"status": status, "database": result}


def require_public_post(db: Session, post_id: str):
    post = db.get(models.Post, post_id)
    if post is None or post.visibility != "public":
        raise HTTPException(status_code=404, detail="Post not found")
    author = db.get(models.Profile, post.author_id)
    if author is None or author.is_private:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@app.get("/api/me", response_model=ProfileOut)
def get_my_profile(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    profile = db.get(models.Profile, claims["sub"])
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.put("/api/me", response_model=ProfileOut)
def update_my_profile(payload: ProfileUpdate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    profile = db.get(models.Profile, claims["sub"])
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile.username = payload.username
    profile.display_name = payload.display_name
    profile.bio = payload.bio
    profile.is_private = payload.is_private
    try:
        db.commit()
        db.refresh(profile)
        return profile
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username is already taken")


@app.get("/api/posts", response_model=list[PostFeedOut])
def list_posts(limit: int = Query(default=20, ge=1, le=100), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)):
    posts = db.scalars(
        select(models.Post)
        .join(models.Profile, models.Profile.id == models.Post.author_id)
        .where(models.Post.visibility == "public", models.Profile.is_private.is_(False))
        .order_by(desc(models.Post.created_at)).limit(limit).offset(offset)
    ).all()
    result = []
    for post in posts:
        profile = db.get(models.Profile, post.author_id)
        result.append({
            "id": post.id,
            "author_id": post.author_id,
            "author_name": profile.display_name if profile else "عضو VYRA",
            "author_username": profile.username if profile else "member",
            "avatar_url": profile.avatar_url if profile else None,
            "body": post.body,
            "visibility": post.visibility,
            "created_at": post.created_at,
            "likes_count": db.scalar(select(func.count(models.Reaction.id)).where(models.Reaction.post_id == post.id)) or 0,
            "comments_count": db.scalar(select(func.count(models.Comment.id)).where(models.Comment.post_id == post.id)) or 0,
        })
    return result

@app.post("/api/posts", response_model=PostOut, status_code=201)
def create_post(payload: PostCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    if db.get(models.Profile, claims["sub"]) is None:
        raise HTTPException(status_code=409, detail="Create your profile before posting")
    post = models.Post(id=str(uuid4()), author_id=claims["sub"], body=payload.body, visibility=payload.visibility)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@app.delete("/api/posts/{post_id}")
def delete_post(post_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    post = db.get(models.Post, post_id)
    if post is None or post.author_id != claims["sub"]:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
    return {"deleted": True}


@app.get("/api/posts/{post_id}/media")
def list_post_media(post_id: str, db: Session = Depends(get_db)):
    if db.get(models.Post, post_id) is None:
        raise HTTPException(status_code=404, detail="Post not found")
    rows = db.scalars(
        select(models.PostMedia).where(models.PostMedia.post_id == post_id)
        .order_by(models.PostMedia.created_at)
    ).all()
    return [{"url": row.media_url, "media_type": row.media_type} for row in rows]


@app.get("/api/posts/{post_id}/comments", response_model=list[CommentOut])
def list_comments(post_id: str, limit: int = Query(default=50, ge=1, le=100), db: Session = Depends(get_db)):
    require_public_post(db, post_id)
    return db.scalars(
        select(models.Comment).where(models.Comment.post_id == post_id)
        .order_by(models.Comment.created_at).limit(limit)
    ).all()


@app.post("/api/posts/{post_id}/comments", response_model=CommentOut, status_code=201)
def create_comment(post_id: str, payload: CommentCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    require_public_post(db, post_id)
    if db.get(models.Profile, claims["sub"]) is None:
        raise HTTPException(status_code=409, detail="Profile not found")
    comment = models.Comment(id=str(uuid4()), post_id=post_id, author_id=claims["sub"], body=payload.body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@app.put("/api/posts/{post_id}/reaction")
def set_reaction(post_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    if db.get(models.Post, post_id) is None:
        raise HTTPException(status_code=404, detail="Post not found")
    if db.get(models.Profile, claims["sub"]) is None:
        raise HTTPException(status_code=409, detail="Profile not found")
    existing = db.scalar(select(models.Reaction).where(
        models.Reaction.post_id == post_id, models.Reaction.user_id == claims["sub"]
    ))
    if existing:
        db.delete(existing)
        db.commit()
        return {"reacted": False}
    db.add(models.Reaction(
        id=str(uuid4()), post_id=post_id, user_id=claims["sub"], reaction_type="like"
    ))
    db.commit()
    return {"reacted": True}


class SocialSpaceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    privacy: str = Field(default="public", pattern="^(public|private)$")
    category: str | None = Field(default=None, max_length=60)


@app.get("/api/groups")
def list_groups(db: Session = Depends(get_db)):
    groups = db.scalars(select(models.SocialGroup).where(models.SocialGroup.privacy == "public").order_by(desc(models.SocialGroup.created_at)).limit(100)).all()
    return [{"id": g.id, "name": g.name, "description": g.description, "privacy": g.privacy,
             "owner_id": g.owner_id,
             "members": db.scalar(select(func.count(models.GroupMember.id)).where(models.GroupMember.group_id == g.id)) or 0}
            for g in groups]


@app.post("/api/groups", status_code=201)
def create_group(payload: SocialSpaceCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    if db.get(models.Profile, claims["sub"]) is None:
        raise HTTPException(status_code=409, detail="Profile not found")
    group = models.SocialGroup(id=str(uuid4()), owner_id=claims["sub"], name=payload.name.strip(),
                               description=payload.description, privacy=payload.privacy)
    db.add(group)
    db.flush()
    db.add(models.GroupMember(id=str(uuid4()), group_id=group.id, user_id=claims["sub"], role="owner", status="active"))
    db.commit()
    db.refresh(group)
    return {"id": group.id, "name": group.name, "description": group.description, "privacy": group.privacy, "owner_id": group.owner_id, "members": 1}


@app.post("/api/groups/{group_id}/join")
def join_group(group_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    group = db.get(models.SocialGroup, group_id)
    if group is None or group.privacy != "public":
        raise HTTPException(status_code=404, detail="Public group not found")
    existing = db.scalar(select(models.GroupMember).where(models.GroupMember.group_id == group_id, models.GroupMember.user_id == claims["sub"]))
    if existing:
        return {"joined": existing.status == "active"}
    db.add(models.GroupMember(id=str(uuid4()), group_id=group_id, user_id=claims["sub"], role="member", status="active"))
    db.commit()
    return {"joined": True}


@app.get("/api/pages")
def list_pages(db: Session = Depends(get_db)):
    pages = db.scalars(select(models.SocialPage).order_by(desc(models.SocialPage.created_at)).limit(100)).all()
    return [{"id": p.id, "name": p.name, "description": p.description, "category": p.category,
             "owner_id": p.owner_id,
             "followers": db.scalar(select(func.count(models.PageFollower.id)).where(models.PageFollower.page_id == p.id)) or 0}
            for p in pages]


@app.post("/api/pages", status_code=201)
def create_page(payload: SocialSpaceCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    if db.get(models.Profile, claims["sub"]) is None:
        raise HTTPException(status_code=409, detail="Profile not found")
    page = models.SocialPage(id=str(uuid4()), owner_id=claims["sub"], name=payload.name.strip(),
                             description=payload.description, category=payload.category)
    db.add(page)
    db.commit()
    db.refresh(page)
    return {"id": page.id, "name": page.name, "description": page.description, "category": page.category, "owner_id": page.owner_id, "followers": 0}


@app.post("/api/pages/{page_id}/follow")
def follow_page(page_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    if db.get(models.SocialPage, page_id) is None:
        raise HTTPException(status_code=404, detail="Page not found")
    existing = db.scalar(select(models.PageFollower).where(models.PageFollower.page_id == page_id, models.PageFollower.user_id == claims["sub"]))
    if existing:
        db.delete(existing)
        db.commit()
        return {"following": False}
    db.add(models.PageFollower(id=str(uuid4()), page_id=page_id, user_id=claims["sub"]))
    db.commit()
    return {"following": True}


@app.get("/api/bookmarks", response_model=list[PostOut])
def list_bookmarks(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Post)
        .join(models.PostBookmark, models.PostBookmark.post_id == models.Post.id)
        .where(models.PostBookmark.user_id == claims["sub"])
        .order_by(desc(models.PostBookmark.created_at))
        .limit(100)
    ).all()


@app.put("/api/posts/{post_id}/bookmark")
def toggle_bookmark(post_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    if db.get(models.Post, post_id) is None:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = db.scalar(select(models.PostBookmark).where(
        models.PostBookmark.post_id == post_id,
        models.PostBookmark.user_id == claims["sub"]
    ))
    if existing:
        db.delete(existing)
        db.commit()
        return {"saved": False}
    db.add(models.PostBookmark(id=str(uuid4()), post_id=post_id, user_id=claims["sub"]))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"saved": True}
    return {"saved": True}


class AIMessage(BaseModel):
    prompt: str = Field(min_length=1, max_length=12000)
    history: list[dict] = Field(default_factory=list, max_length=12)


@app.post("/api/ai/chat")
def ai_chat(payload: AIMessage, claims: dict = Depends(current_user)):
    try:
        return generate_reply(payload.prompt.strip(), payload.history)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@app.post("/api/ai/agent")
def ai_agent(payload: AIMessage, claims: dict = Depends(current_user)):
    try:
        return generate_agent_reply(payload.prompt.strip(), payload.history)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
