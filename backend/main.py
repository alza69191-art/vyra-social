import os
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy import select, desc, func, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from backend.database import Base, SessionLocal, engine, database_status
from backend import models
from backend.schemas import ProfileUpdate, ProfileOut, PostCreate, PostOut, PostFeedOut, CommentCreate, CommentOut
from backend.security import current_user
from backend.auth import router as auth_router
from backend.oauth import router as oauth_router
from backend.ai_router import generate_reply
from backend.cloudinary_uploads import router as uploads_router
from backend.security_controls import SecurityControlsMiddleware
from backend.support_router import router as support_router
from backend.admin_router import router as admin_router
from backend.stories_channel_ads import router as stories_channel_ads_router

app = FastAPI(
    title="VYRA API",
    version="0.3.0",
    description="Backend API for the VYRA social platform.",
    docs_url="/api/docs",
    redoc_url=None,
)

# Allow only the active VYRA frontend and the local development origin.
# Obsolete deployment domains are intentionally excluded.
origins = [
    "http://localhost:3000",
    "https://vyra-web-rs1b.onrender.com",
    "https://vyra-nexus-preview.onrender.com",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.add_middleware(SecurityControlsMiddleware)
app.add_middleware(SessionMiddleware, secret_key=os.getenv("JWT_SECRET") or os.urandom(32).hex(), same_site="lax", https_only=True, session_cookie="vyra_oauth_session")

app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(uploads_router)
app.include_router(support_router)
app.include_router(admin_router)
app.include_router(stories_channel_ads_router)


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
        # Create new tables and safely add optional fields to existing spaces.
        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)
        migrations = {
            "social_groups": {"category": "VARCHAR(60) NULL", "avatar_url": "TEXT NULL", "cover_url": "TEXT NULL"},
            "social_pages": {"privacy": "VARCHAR(16) NOT NULL DEFAULT 'public'", "avatar_url": "TEXT NULL", "cover_url": "TEXT NULL"},
            "direct_messages": {"media_type": "VARCHAR(16) NULL", "edited_at": "DATETIME NULL"},
            "market_listings": {"media_url": "VARCHAR(2000) NULL", "media_type": "VARCHAR(16) NULL"},
            "conversations": {"context_type": "VARCHAR(16) NULL", "context_id": "VARCHAR(36) NULL"},
            "users": {"email_verified_at": "DATETIME NULL"},
        }
        with engine.begin() as connection:
            for table_name, columns in migrations.items():
                existing = {column["name"] for column in inspector.get_columns(table_name)}
                for column_name, column_type in columns.items():
                    if column_name not in existing:
                        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))


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
    rows = db.execute(
        select(models.Post, models.Profile)
        .join(models.Profile, models.Profile.id == models.Post.author_id)
        .where(models.Post.visibility == "public", models.Profile.is_private.is_(False))
        .order_by(desc(models.Post.created_at)).limit(limit).offset(offset)
    ).all()
    post_ids = [post.id for post, _profile in rows]
    if not post_ids:
        return []
    likes = dict(db.execute(
        select(models.Reaction.post_id, func.count(models.Reaction.id))
        .where(models.Reaction.post_id.in_(post_ids))
        .group_by(models.Reaction.post_id)
    ).all())
    comments = dict(db.execute(
        select(models.Comment.post_id, func.count(models.Comment.id))
        .where(models.Comment.post_id.in_(post_ids))
        .group_by(models.Comment.post_id)
    ).all())
    media_rows = db.scalars(
        select(models.PostMedia)
        .where(models.PostMedia.post_id.in_(post_ids))
        .order_by(models.PostMedia.created_at)
    ).all()
    media_by_post: dict[str, list[dict]] = {}
    for media in media_rows:
        media_by_post.setdefault(media.post_id, []).append({
            "url": media.media_url,
            "media_type": media.media_type,
        })
    return [{
        "id": post.id,
        "author_id": post.author_id,
        "author_name": profile.display_name,
        "author_username": profile.username,
        "avatar_url": profile.avatar_url,
        "body": post.body,
        "visibility": post.visibility,
        "created_at": post.created_at,
        "likes_count": likes.get(post.id, 0),
        "comments_count": comments.get(post.id, 0),
        "media": media_by_post.get(post.id, []),
    } for post, profile in rows]

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


class PostUpdate(BaseModel):
    body: str | None = Field(default=None, max_length=10000)
    visibility: str = Field(default="public", pattern="^(public|followers|private)$")


@app.patch("/api/posts/{post_id}")
def update_post(post_id: str, payload: PostUpdate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    post = db.get(models.Post, post_id)
    if post is None or post.author_id != claims["sub"]:
        raise HTTPException(status_code=404, detail="Post not found")
    post.body = payload.body.strip() if payload.body else None
    post.visibility = payload.visibility
    db.commit()
    db.refresh(post)
    return {"id": post.id, "body": post.body, "visibility": post.visibility, "updated": True}


@app.get("/api/posts/{post_id}/media")
def list_post_media(post_id: str, db: Session = Depends(get_db)):
    require_public_post(db, post_id)
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
    post = db.get(models.Post, post_id)
    if post and post.author_id != claims["sub"]:
        db.add(models.Notification(id=str(uuid4()), user_id=post.author_id, actor_id=claims["sub"], kind="comment", target_id=post_id))
    db.commit()
    db.refresh(comment)
    return comment


class ReactionPayload(BaseModel):
    reaction_type: str = Field(default="like", pattern="^(like|love|care|haha|wow|sad|angry|dislike)$")

@app.put("/api/posts/{post_id}/reaction")
def set_reaction(post_id: str, payload: ReactionPayload = ReactionPayload(), claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    require_public_post(db, post_id)
    if db.get(models.Profile, claims["sub"]) is None:
        raise HTTPException(status_code=409, detail="Profile not found")
    existing = db.scalar(select(models.Reaction).where(
        models.Reaction.post_id == post_id, models.Reaction.user_id == claims["sub"]
    ))
    if existing and existing.reaction_type == payload.reaction_type:
        db.delete(existing)
        db.commit()
        return {"reacted": False, "reaction_type": None}
    if existing:
        existing.reaction_type = payload.reaction_type
    else:
        db.add(models.Reaction(id=str(uuid4()), post_id=post_id, user_id=claims["sub"], reaction_type=payload.reaction_type))
        post = db.get(models.Post, post_id)
        if post and post.author_id != claims["sub"]:
            db.add(models.Notification(id=str(uuid4()), user_id=post.author_id, actor_id=claims["sub"], kind="reaction", target_id=post_id))
    db.commit()
    return {"reacted": True, "reaction_type": payload.reaction_type}


class SocialSpaceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    privacy: str = Field(default="public", pattern="^(public|private)$")
    category: str | None = Field(default=None, max_length=60)
    avatar_url: str | None = Field(default=None, max_length=2000)
    cover_url: str | None = Field(default=None, max_length=2000)


@app.get("/api/groups")
def list_groups(db: Session = Depends(get_db)):
    groups = db.scalars(select(models.SocialGroup).where(models.SocialGroup.privacy == "public").order_by(desc(models.SocialGroup.created_at)).limit(100)).all()
    ids = [group.id for group in groups]
    counts = dict(db.execute(
        select(models.GroupMember.group_id, func.count(models.GroupMember.id))
        .where(models.GroupMember.group_id.in_(ids))
        .group_by(models.GroupMember.group_id)
    ).all()) if ids else {}
    return [{"id": g.id, "name": g.name, "description": g.description, "privacy": g.privacy,
             "owner_id": g.owner_id, "members": counts.get(g.id, 0), "category": g.category,
             "avatar_url": g.avatar_url, "cover_url": g.cover_url}
            for g in groups]


@app.post("/api/groups", status_code=201)
def create_group(payload: SocialSpaceCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    if db.get(models.Profile, claims["sub"]) is None:
        raise HTTPException(status_code=409, detail="Profile not found")
    group = models.SocialGroup(id=str(uuid4()), owner_id=claims["sub"], name=payload.name.strip(),
                               description=payload.description, category=payload.category, privacy=payload.privacy, avatar_url=payload.avatar_url, cover_url=payload.cover_url)
    db.add(group)
    db.flush()
    db.add(models.GroupMember(id=str(uuid4()), group_id=group.id, user_id=claims["sub"], role="owner", status="active"))
    db.commit()
    db.refresh(group)
    return {"id": group.id, "name": group.name, "description": group.description, "privacy": group.privacy, "owner_id": group.owner_id, "members": 1, "category": group.category, "avatar_url": group.avatar_url, "cover_url": group.cover_url}


@app.post("/api/groups/{group_id}/join")
def join_group(group_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    group = db.get(models.SocialGroup, group_id)
    if group is None or group.privacy != "public":
        raise HTTPException(status_code=404, detail="Public group not found")
    existing = db.scalar(select(models.GroupMember).where(models.GroupMember.group_id == group_id, models.GroupMember.user_id == claims["sub"]))
    if existing:
        if existing.status != "active":
            existing.status = "active"
            db.flush()
        else:
            return {"joined": True}
    else:
        db.add(models.GroupMember(id=str(uuid4()), group_id=group_id, user_id=claims["sub"], role="member", status="active"))
    room = db.scalar(select(models.Conversation).where(models.Conversation.context_type == "group", models.Conversation.context_id == group_id))
    if room and db.scalar(select(models.ConversationMember).where(models.ConversationMember.conversation_id == room.id, models.ConversationMember.user_id == claims["sub"])) is None:
        db.add(models.ConversationMember(id=str(uuid4()), conversation_id=room.id, user_id=claims["sub"]))
    db.commit()
    return {"joined": True}


@app.get("/api/pages")
def list_pages(db: Session = Depends(get_db)):
    pages = db.scalars(select(models.SocialPage).where(models.SocialPage.privacy == "public").order_by(desc(models.SocialPage.created_at)).limit(100)).all()
    ids = [page.id for page in pages]
    counts = dict(db.execute(
        select(models.PageFollower.page_id, func.count(models.PageFollower.id))
        .where(models.PageFollower.page_id.in_(ids))
        .group_by(models.PageFollower.page_id)
    ).all()) if ids else {}
    return [{"id": p.id, "name": p.name, "description": p.description, "category": p.category,
             "owner_id": p.owner_id, "followers": counts.get(p.id, 0),
             "privacy": p.privacy, "avatar_url": p.avatar_url, "cover_url": p.cover_url}
            for p in pages]


@app.post("/api/pages", status_code=201)
def create_page(payload: SocialSpaceCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    if db.get(models.Profile, claims["sub"]) is None:
        raise HTTPException(status_code=409, detail="Profile not found")
    page = models.SocialPage(id=str(uuid4()), owner_id=claims["sub"], name=payload.name.strip(),
                             description=payload.description, category=payload.category, privacy=payload.privacy, avatar_url=payload.avatar_url, cover_url=payload.cover_url)
    db.add(page)
    db.commit()
    db.refresh(page)
    return {"id": page.id, "name": page.name, "description": page.description, "category": page.category, "owner_id": page.owner_id, "followers": 0, "privacy": page.privacy,
            "avatar_url": page.avatar_url, "cover_url": page.cover_url}


@app.post("/api/pages/{page_id}/follow")
def follow_page(page_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    page = db.get(models.SocialPage, page_id)
    if page is None or page.privacy != "public":
        raise HTTPException(status_code=404, detail="Page not found")
    existing = db.scalar(select(models.PageFollower).where(models.PageFollower.page_id == page_id, models.PageFollower.user_id == claims["sub"]))
    room = db.scalar(select(models.Conversation).where(models.Conversation.context_type == "page", models.Conversation.context_id == page_id))
    if existing:
        db.delete(existing)
        if room:
            room_member = db.scalar(select(models.ConversationMember).where(models.ConversationMember.conversation_id == room.id, models.ConversationMember.user_id == claims["sub"]))
            if room_member:
                db.delete(room_member)
        db.commit()
        return {"following": False}
    db.add(models.PageFollower(id=str(uuid4()), page_id=page_id, user_id=claims["sub"]))
    if page.owner_id != claims["sub"]:
        db.add(models.Notification(id=str(uuid4()), user_id=page.owner_id, actor_id=claims["sub"], kind="page_follow", target_id=page_id))
    if room and db.scalar(select(models.ConversationMember).where(models.ConversationMember.conversation_id == room.id, models.ConversationMember.user_id == claims["sub"])) is None:
        db.add(models.ConversationMember(id=str(uuid4()), conversation_id=room.id, user_id=claims["sub"]))
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
    require_public_post(db, post_id)
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


class MarketStoreCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    category: str = Field(min_length=2, max_length=60)
    audience: str = Field(default="public", pattern="^(public|private)$")
    avatar_url: str | None = Field(default=None, max_length=2000)
    cover_url: str | None = Field(default=None, max_length=2000)


@app.get("/api/market/stores")
def list_market_stores(db: Session = Depends(get_db)):
    rows = db.scalars(select(models.MarketStore).where(models.MarketStore.audience == "public").order_by(desc(models.MarketStore.created_at)).limit(100)).all()
    return [{"id": row.id, "name": row.name, "description": row.description, "category": row.category,
             "audience": row.audience, "owner_id": row.owner_id, "avatar_url": row.avatar_url,
             "cover_url": row.cover_url, "created_at": row.created_at} for row in rows]


@app.post("/api/market/stores", status_code=201)
def create_market_store(payload: MarketStoreCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    if db.get(models.Profile, claims["sub"]) is None:
        raise HTTPException(status_code=409, detail="Profile not found")
    store = models.MarketStore(id=str(uuid4()), owner_id=claims["sub"], name=payload.name.strip(),
        description=payload.description, category=payload.category.strip(), audience=payload.audience,
        avatar_url=payload.avatar_url, cover_url=payload.cover_url)
    db.add(store)
    db.commit()
    db.refresh(store)
    return {"id": store.id, "name": store.name, "description": store.description, "category": store.category,
            "audience": store.audience, "owner_id": store.owner_id, "avatar_url": store.avatar_url,
            "cover_url": store.cover_url, "created_at": store.created_at}


class MarketListingCreate(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=5, max_length=4000)
    price: float = Field(ge=0, le=999999999)
    currency: str = Field(default="USD", pattern="^(USD|ILS|EUR)$")
    category: str = Field(min_length=2, max_length=60)
    condition: str = Field(default="new", pattern="^(new|used|refurbished)$")
    location: str | None = Field(default=None, max_length=120)
    media_url: str | None = Field(default=None, max_length=2000)
    media_type: str | None = Field(default=None, pattern="^(image|video)$")

class MarketListingStatus(BaseModel):
    status: str = Field(pattern="^(active|sold)$")

@app.get("/api/market/listings")
def list_market_listings(limit: int = Query(default=40, ge=1, le=100), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)):
    rows = db.execute(
        select(models.MarketListing, models.Profile)
        .join(models.Profile, models.Profile.id == models.MarketListing.owner_id)
        .where(models.MarketListing.status == "active")
        .order_by(desc(models.MarketListing.created_at))
        .limit(limit).offset(offset)
    ).all()
    return [{
        "id": listing.id, "title": listing.title, "description": listing.description,
        "price": float(listing.price), "currency": listing.currency,
        "category": listing.category, "condition": listing.condition,
        "location": listing.location, "status": listing.status,
        "media_url": listing.media_url, "media_type": listing.media_type,
        "created_at": listing.created_at, "owner_id": listing.owner_id,
        "seller_name": profile.display_name, "seller_username": profile.username,
    } for listing, profile in rows]

@app.post("/api/market/listings", status_code=201)
def create_market_listing(payload: MarketListingCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    if db.get(models.Profile, claims["sub"]) is None:
        raise HTTPException(status_code=409, detail="Profile not found")
    listing = models.MarketListing(
        id=str(uuid4()), owner_id=claims["sub"], title=payload.title.strip(),
        description=payload.description.strip(), price=payload.price,
        currency=payload.currency, category=payload.category.strip(),
        condition=payload.condition, location=payload.location.strip() if payload.location else None,
        media_url=payload.media_url, media_type=payload.media_type,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    profile = db.get(models.Profile, claims["sub"])
    return {
        "id": listing.id, "title": listing.title, "description": listing.description,
        "price": float(listing.price), "currency": listing.currency,
        "category": listing.category, "condition": listing.condition,
        "location": listing.location, "status": listing.status,
        "created_at": listing.created_at, "owner_id": listing.owner_id,
        "seller_name": profile.display_name, "seller_username": profile.username,
    }

@app.patch("/api/market/listings/{listing_id}/status")
def update_market_listing_status(listing_id: str, payload: MarketListingStatus, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    listing = db.get(models.MarketListing, listing_id)
    if listing is None or listing.owner_id != claims["sub"]:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.status = payload.status
    db.commit()
    return {"id": listing.id, "status": listing.status}



class DirectConversationCreate(BaseModel):
    recipient_id: str = Field(min_length=1, max_length=36)


class DirectMessageCreate(BaseModel):
    body: str = Field(default="", max_length=5000)
    media_url: str | None = Field(default=None, max_length=2000)
    media_type: str | None = Field(default=None, pattern="^(image|video|audio)$")


class DirectMessageUpdate(BaseModel):
    body: str | None = Field(default=None, max_length=5000)
    media_url: str | None = Field(default=None, max_length=2000)
    media_type: str | None = Field(default=None, pattern="^(image|video|audio)$")


@app.get("/api/people")
def search_people(q: str = Query(default="", max_length=80), claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    query = select(models.Profile).where(models.Profile.id != claims["sub"])
    if q.strip():
        term = "%" + q.strip() + "%"
        query = query.where((models.Profile.username.ilike(term)) | (models.Profile.display_name.ilike(term)))
    rows = db.scalars(query.order_by(models.Profile.display_name).limit(25)).all()
    return [{"id": p.id, "username": p.username, "display_name": p.display_name, "avatar_url": p.avatar_url} for p in rows]



class SpaceConversationCreate(BaseModel):
    space_type: str = Field(pattern="^(group|page|market)$")
    space_id: str = Field(min_length=1, max_length=36)


@app.post("/api/conversations/space", status_code=201)
def create_space_conversation(payload: SpaceConversationCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    user_id = claims["sub"]
    member_ids: list[str] = []
    title = "محادثة المساحة"
    if payload.space_type == "group":
        space = db.get(models.SocialGroup, payload.space_id)
        membership = db.scalar(select(models.GroupMember).where(
            models.GroupMember.group_id == payload.space_id,
            models.GroupMember.user_id == user_id,
            models.GroupMember.status == "active",
        ))
        if space is None or membership is None:
            raise HTTPException(status_code=403, detail="انضم إلى المجتمع أولاً")
        title = space.name
        member_ids = db.scalars(select(models.GroupMember.user_id).where(
            models.GroupMember.group_id == payload.space_id,
            models.GroupMember.status == "active",
        )).all()
    elif payload.space_type == "page":
        space = db.get(models.SocialPage, payload.space_id)
        if space is None:
            raise HTTPException(status_code=404, detail="الصفحة غير موجودة")
        follower = db.scalar(select(models.PageFollower).where(
            models.PageFollower.page_id == payload.space_id,
            models.PageFollower.user_id == user_id,
        ))
        if space.owner_id != user_id and follower is None:
            raise HTTPException(status_code=403, detail="تابع الصفحة أولاً للوصول إلى محادثتها")
        title = space.name
        member_ids = [space.owner_id] + db.scalars(select(models.PageFollower.user_id).where(
            models.PageFollower.page_id == payload.space_id,
        )).all()
    else:
        space = db.get(models.MarketStore, payload.space_id)
        if space is None:
            raise HTTPException(status_code=404, detail="السوق غير موجود")
        if space.owner_id != user_id:
            raise HTTPException(status_code=403, detail="محادثة السوق متاحة لمالك السوق حالياً")
        title = space.name + " · دعم السوق"
        member_ids = [space.owner_id]
    member_ids = list(dict.fromkeys(member_ids))
    conversation = db.scalar(select(models.Conversation).where(
        models.Conversation.context_type == payload.space_type,
        models.Conversation.context_id == payload.space_id,
    ))
    if conversation is None:
        conversation = models.Conversation(
            id=str(uuid4()), is_group=True, title=title, created_by=user_id,
            context_type=payload.space_type, context_id=payload.space_id,
        )
        db.add(conversation)
        db.flush()
        for member_id in member_ids:
            db.add(models.ConversationMember(id=str(uuid4()), conversation_id=conversation.id, user_id=member_id))
        db.commit()
    else:
        existing = set(db.scalars(select(models.ConversationMember.user_id).where(
            models.ConversationMember.conversation_id == conversation.id,
        )).all())
        for member_id in member_ids:
            if member_id not in existing:
                db.add(models.ConversationMember(id=str(uuid4()), conversation_id=conversation.id, user_id=member_id))
        db.commit()
    return {"id": conversation.id, "is_group": True, "title": conversation.title, "context_type": payload.space_type, "context_id": payload.space_id}


@app.post("/api/conversations/direct", status_code=201)
def create_direct_conversation(payload: DirectConversationCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    if payload.recipient_id == claims["sub"] or db.get(models.Profile, payload.recipient_id) is None:
        raise HTTPException(status_code=404, detail="User not found")
    my_conversations = select(models.ConversationMember.conversation_id).where(models.ConversationMember.user_id == claims["sub"])
    existing = db.scalar(
        select(models.Conversation).join(models.ConversationMember, models.ConversationMember.conversation_id == models.Conversation.id)
        .where(models.Conversation.is_group.is_(False), models.Conversation.id.in_(my_conversations),
               models.ConversationMember.user_id == payload.recipient_id).limit(1)
    )
    if existing:
        return {"id": existing.id, "is_group": False, "title": None}
    conversation = models.Conversation(id=str(uuid4()), is_group=False, created_by=claims["sub"])
    db.add(conversation)
    db.flush()
    db.add_all([
        models.ConversationMember(id=str(uuid4()), conversation_id=conversation.id, user_id=claims["sub"]),
        models.ConversationMember(id=str(uuid4()), conversation_id=conversation.id, user_id=payload.recipient_id),
    ])
    db.commit()
    return {"id": conversation.id, "is_group": False, "title": None}


@app.get("/api/conversations")
def list_conversations(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(models.Conversation, models.ConversationMember)
        .join(models.ConversationMember, models.ConversationMember.conversation_id == models.Conversation.id)
        .where(models.ConversationMember.user_id == claims["sub"])
        .order_by(desc(models.Conversation.created_at)).limit(100)
    ).all()
    output = []
    for conversation, _member in rows:
        members = db.scalars(select(models.ConversationMember).where(models.ConversationMember.conversation_id == conversation.id)).all()
        other_ids = [m.user_id for m in members if m.user_id != claims["sub"]]
        other = db.get(models.Profile, other_ids[0]) if other_ids else None
        last = db.scalar(select(models.DirectMessage).where(models.DirectMessage.conversation_id == conversation.id).order_by(desc(models.DirectMessage.created_at)).limit(1))
        output.append({"id": conversation.id, "is_group": conversation.is_group,
            "context_type": conversation.context_type, "context_id": conversation.context_id,
            "title": conversation.title or (other.display_name if other else "محادثة"),
            "other_user_id": other.id if other else None, "avatar_url": other.avatar_url if other else None,
            "last_message": last.body if last else "", "last_media_type": last.media_type if last else None,
            "created_at": conversation.created_at})
    return output


@app.get("/api/conversations/{conversation_id}/messages")
def list_conversation_messages(conversation_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    member = db.scalar(select(models.ConversationMember).where(models.ConversationMember.conversation_id == conversation_id, models.ConversationMember.user_id == claims["sub"]))
    if member is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    rows = db.scalars(select(models.DirectMessage).where(models.DirectMessage.conversation_id == conversation_id).order_by(models.DirectMessage.created_at).limit(200)).all()
    return [{"id": m.id, "sender_id": m.sender_id, "body": m.body, "media_url": m.media_url, "media_type": m.media_type, "created_at": m.created_at, "read_at": m.read_at, "edited_at": m.edited_at} for m in rows]


@app.put("/api/conversations/{conversation_id}/read")
def mark_conversation_read(conversation_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    member = db.scalar(select(models.ConversationMember).where(
        models.ConversationMember.conversation_id == conversation_id,
        models.ConversationMember.user_id == claims["sub"],
    ))
    if member is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    rows = db.scalars(select(models.DirectMessage).where(
        models.DirectMessage.conversation_id == conversation_id,
        models.DirectMessage.sender_id != claims["sub"],
        models.DirectMessage.read_at.is_(None),
    )).all()
    now = datetime.now(timezone.utc)
    for message in rows:
        message.read_at = now
    db.commit()
    return {"marked_read": len(rows)}


@app.post("/api/conversations/{conversation_id}/messages", status_code=201)
def send_conversation_message(conversation_id: str, payload: DirectMessageCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    member = db.scalar(select(models.ConversationMember).where(models.ConversationMember.conversation_id == conversation_id, models.ConversationMember.user_id == claims["sub"]))
    if member is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not payload.body.strip() and not payload.media_url:
        raise HTTPException(status_code=422, detail="Message cannot be empty")
    message = models.DirectMessage(id=str(uuid4()), sender_id=claims["sub"], recipient_id=claims["sub"],
        conversation_id=conversation_id, body=payload.body.strip(), media_url=payload.media_url, media_type=payload.media_type)
    db.add(message)
    recipients = db.scalars(select(models.ConversationMember.user_id).where(
        models.ConversationMember.conversation_id == conversation_id,
        models.ConversationMember.user_id != claims["sub"],
    )).all()
    for recipient_id in recipients:
        db.add(models.Notification(id=str(uuid4()), user_id=recipient_id, actor_id=claims["sub"],
                                   kind="message", target_id=conversation_id))
    db.commit()
    db.refresh(message)
    return {"id": message.id, "sender_id": message.sender_id, "body": message.body, "media_url": message.media_url,
        "media_type": message.media_type, "created_at": message.created_at, "read_at": message.read_at, "edited_at": message.edited_at}


@app.patch("/api/conversations/{conversation_id}/messages/{message_id}")
def edit_conversation_message(conversation_id: str, message_id: str, payload: DirectMessageUpdate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    member = db.scalar(select(models.ConversationMember).where(
        models.ConversationMember.conversation_id == conversation_id,
        models.ConversationMember.user_id == claims["sub"],
    ))
    if member is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    message = db.scalar(select(models.DirectMessage).where(
        models.DirectMessage.id == message_id,
        models.DirectMessage.conversation_id == conversation_id,
    ))
    if message is None or message.sender_id != claims["sub"]:
        raise HTTPException(status_code=404, detail="Message not found")
    fields = payload.model_fields_set
    if "body" in fields:
        message.body = (payload.body or "").strip()
    if "media_url" in fields:
        message.media_url = payload.media_url
        message.media_type = payload.media_type if payload.media_url else None
    elif "media_type" in fields:
        message.media_type = payload.media_type
    if not message.body and not message.media_url:
        raise HTTPException(status_code=422, detail="Message cannot be empty")
    message.edited_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(message)
    return {"id": message.id, "sender_id": message.sender_id, "body": message.body,
        "media_url": message.media_url, "media_type": message.media_type,
        "created_at": message.created_at, "read_at": message.read_at, "edited_at": message.edited_at}


@app.delete("/api/conversations/{conversation_id}/messages/{message_id}")
def delete_conversation_message(conversation_id: str, message_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    member = db.scalar(select(models.ConversationMember).where(
        models.ConversationMember.conversation_id == conversation_id,
        models.ConversationMember.user_id == claims["sub"],
    ))
    if member is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    message = db.scalar(select(models.DirectMessage).where(
        models.DirectMessage.id == message_id,
        models.DirectMessage.conversation_id == conversation_id,
    ))
    if message is None or message.sender_id != claims["sub"]:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(message)
    db.commit()
    return {"deleted": True}


class AIMessage(BaseModel):
    prompt: str = Field(min_length=1, max_length=12000)
    history: list[dict] = Field(default_factory=list, max_length=12)
    image_data: str | None = Field(default=None, max_length=11000000)


@app.post("/api/ai/chat")
def ai_chat(payload: AIMessage, claims: dict = Depends(current_user)):
    try:
        return generate_reply(payload.prompt.strip(), payload.history, payload.image_data)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
