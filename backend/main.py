import os
from uuid import uuid4
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from backend.database import Base, SessionLocal, engine, database_status
from backend import models
from backend.schemas import ProfileUpdate, ProfileOut, PostCreate, PostOut, CommentCreate, CommentOut
from backend.security import current_user
from backend.auth import router as auth_router
from backend.ai_router import generate_reply

app = FastAPI(
    title="VYRA API",
    version="0.3.0",
    description="Backend API for the VYRA social platform.",
    docs_url="/api/docs",
    redoc_url=None,
)

origins = [item.strip() for item in os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,https://alza69191-art.github.io,https://vyra-web.onrender.com,https://vyra-social-web.onrender.com"
).split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)


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
        # Safe, idempotent migration for databases created before email verification.
        # ALTER TABLE ... IF NOT EXISTS preserves all existing users and data.
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ"
            )
            connection.exec_driver_sql(
                "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url TEXT"
            )
        Base.metadata.create_all(bind=engine)


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


@app.get("/api/posts", response_model=list[PostOut])
def list_posts(limit: int = Query(default=20, ge=1, le=100), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Post)
        .join(models.Profile, models.Profile.id == models.Post.author_id)
        .where(models.Post.visibility == "public", models.Profile.is_private.is_(False))
        .order_by(desc(models.Post.created_at)).limit(limit).offset(offset)
    ).all()


@app.post("/api/posts", response_model=PostOut, status_code=201)
def create_post(payload: PostCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    if db.get(models.Profile, claims["sub"]) is None:
        raise HTTPException(status_code=409, detail="Create your profile before posting")
    post = models.Post(id=str(uuid4()), author_id=claims["sub"], body=payload.body, visibility=payload.visibility)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@app.get("/api/posts/{post_id}/comments", response_model=list[CommentOut])
def list_comments(post_id: str, limit: int = Query(default=50, ge=1, le=100), db: Session = Depends(get_db)):
    if db.get(models.Post, post_id) is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return db.scalars(
        select(models.Comment).where(models.Comment.post_id == post_id)
        .order_by(models.Comment.created_at).limit(limit)
    ).all()


@app.post("/api/posts/{post_id}/comments", response_model=CommentOut, status_code=201)
def create_comment(post_id: str, payload: CommentCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    if db.get(models.Post, post_id) is None:
        raise HTTPException(status_code=404, detail="Post not found")
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


class AIMessage(BaseModel):
    prompt: str = Field(min_length=1, max_length=12000)
    history: list[dict] = Field(default_factory=list, max_length=12)


@app.post("/api/ai/chat")
def ai_chat(payload: AIMessage, claims: dict = Depends(current_user)):
    try:
        return generate_reply(payload.prompt.strip(), payload.history)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
