import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, desc, func
from sqlalchemy.orm import Session

from backend import models
from backend.database import SessionLocal
from backend.security import current_user

router = APIRouter(prefix="/api", tags=["stories-channel-ads"])


def get_db():
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def valid_http_url(value: str) -> str:
    parsed = urlparse(value.strip())
    if parsed.scheme not in {"https", "http"} or not parsed.netloc or parsed.username or parsed.password:
        raise HTTPException(status_code=422, detail="رابط الوجهة يجب أن يكون HTTP أو HTTPS صالحاً")
    return value.strip()


class StoryCreate(BaseModel):
    media_url: str = Field(min_length=8, max_length=2000)
    media_type: str = Field(pattern="^(image|video)$")
    caption: str | None = Field(default=None, max_length=500)


class AdCreate(BaseModel):
    brand_name: str = Field(min_length=2, max_length=120)
    title: str = Field(min_length=3, max_length=140)
    body: str | None = Field(default=None, max_length=2000)
    destination_url: str = Field(min_length=8, max_length=2000)
    media_url: str | None = Field(default=None, max_length=2000)


@router.post("/stories", status_code=201)
def create_story(payload: StoryCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    uid = claims["sub"]
    if db.get(models.Profile, uid) is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    if not payload.media_url.startswith("https://"):
        raise HTTPException(status_code=422, detail="يجب أن يكون رابط الوسائط آمناً HTTPS")
    story = models.Story(
        id=str(uuid4()), author_id=uid, media_url=payload.media_url,
        media_type=payload.media_type, caption=(payload.caption or "").strip() or None,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return {"id": story.id, "media_url": story.media_url, "media_type": story.media_type,
            "caption": story.caption, "expires_at": story.expires_at, "views_count": 0}


@router.get("/stories")
def list_stories(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    rows = db.scalars(select(models.Story).where(models.Story.expires_at > now)
                      .order_by(desc(models.Story.created_at)).limit(200)).all()
    result = []
    for story in rows:
        profile = db.get(models.Profile, story.author_id)
        views = db.scalar(select(func.count(models.StoryView.id)).where(models.StoryView.story_id == story.id)) or 0
        result.append({"id": story.id, "author_id": story.author_id,
                       "author_name": profile.display_name if profile else "عضو VYRA",
                       "username": profile.username if profile else "",
                       "avatar_url": profile.avatar_url if profile else None,
                       "media_url": story.media_url, "media_type": story.media_type,
                       "caption": story.caption, "created_at": story.created_at,
                       "expires_at": story.expires_at, "views_count": views,
                       "viewed": bool(db.scalar(select(models.StoryView.id).where(
                           models.StoryView.story_id == story.id,
                           models.StoryView.viewer_id == claims["sub"]).limit(1)))})
    return result


@router.post("/stories/{story_id}/view")
def view_story(story_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    story = db.get(models.Story, story_id)
    if not story or story.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=404, detail="Story not found or expired")
    if story.author_id != claims["sub"]:
        exists = db.scalar(select(models.StoryView.id).where(
            models.StoryView.story_id == story_id, models.StoryView.viewer_id == claims["sub"]).limit(1))
        if not exists:
            db.add(models.StoryView(id=str(uuid4()), story_id=story_id, viewer_id=claims["sub"]))
            db.commit()
    count = db.scalar(select(func.count(models.StoryView.id)).where(models.StoryView.story_id == story_id)) or 0
    return {"views_count": count}


@router.get("/channel/analytics")
def channel_analytics(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    uid = claims["sub"]
    post_ids = select(models.Post.id).where(models.Post.author_id == uid)
    story_ids = select(models.Story.id).where(models.Story.author_id == uid)
    return {
        "posts_count": db.scalar(select(func.count(models.Post.id)).where(models.Post.author_id == uid)) or 0,
        "stories_count": db.scalar(select(func.count(models.Story.id)).where(models.Story.author_id == uid)) or 0,
        "active_stories_count": db.scalar(select(func.count(models.Story.id)).where(
            models.Story.author_id == uid, models.Story.expires_at > datetime.now(timezone.utc))) or 0,
        "story_views": db.scalar(select(func.count(models.StoryView.id)).where(models.StoryView.story_id.in_(story_ids))) or 0,
        "post_views": db.scalar(select(func.count(models.PostView.id)).where(models.PostView.post_id.in_(post_ids))) or 0,
        "likes": db.scalar(select(func.count(models.Reaction.id)).where(models.Reaction.post_id.in_(post_ids))) or 0,
        "comments": db.scalar(select(func.count(models.Comment.id)).where(models.Comment.post_id.in_(post_ids))) or 0,
        "followers": db.scalar(select(func.count(models.Follow.id)).where(
            models.Follow.followed_id == uid, models.Follow.status == "accepted")) or 0,
        "friends": db.scalar(select(func.count(models.Friendship.id)).where(
            ((models.Friendship.requester_id == uid) | (models.Friendship.addressee_id == uid)),
            models.Friendship.status == "accepted")) or 0,
        "ads_total": db.scalar(select(func.count(models.SponsoredAd.id)).where(models.SponsoredAd.owner_id == uid)) or 0,
    }


@router.post("/posts/{post_id}/view")
def view_post(post_id: str, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    post = db.get(models.Post, post_id)
    if not post or post.visibility == "private" and post.author_id != claims["sub"]:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != claims["sub"]:
        exists = db.scalar(select(models.PostView.id).where(
            models.PostView.post_id == post_id, models.PostView.viewer_id == claims["sub"]).limit(1))
        if not exists:
            db.add(models.PostView(id=str(uuid4()), post_id=post_id, viewer_id=claims["sub"]))
            db.commit()
    count = db.scalar(select(func.count(models.PostView.id)).where(models.PostView.post_id == post_id)) or 0
    return {"views_count": count}


@router.post("/ads", status_code=201)
def create_ad(payload: AdCreate, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    uid = claims["sub"]
    if db.get(models.Profile, uid) is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    destination = valid_http_url(payload.destination_url)
    if payload.media_url and not payload.media_url.startswith("https://"):
        raise HTTPException(status_code=422, detail="رابط الوسائط يجب أن يكون HTTPS")
    ad = models.SponsoredAd(id=str(uuid4()), owner_id=uid, brand_name=payload.brand_name.strip(),
                            title=payload.title.strip(), body=(payload.body or "").strip() or None,
                            destination_url=destination, media_url=payload.media_url, status="pending")
    db.add(ad)
    db.commit()
    db.refresh(ad)
    return {"id": ad.id, "status": ad.status, "message": "تم إرسال الإعلان للمراجعة قبل عرضه"}


@router.get("/ads/mine")
def list_my_ads(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(models.SponsoredAd).where(models.SponsoredAd.owner_id == claims["sub"])
                      .order_by(desc(models.SponsoredAd.created_at)).limit(100)).all()
    return [{"id": a.id, "brand_name": a.brand_name, "title": a.title, "body": a.body,
             "destination_url": a.destination_url, "media_url": a.media_url,
             "status": a.status, "created_at": a.created_at} for a in rows]


@router.get("/ads")
def list_active_ads(db: Session = Depends(get_db), limit: int = Query(default=10, ge=1, le=30)):
    rows = db.scalars(select(models.SponsoredAd).where(models.SponsoredAd.status == "active")
                      .order_by(desc(models.SponsoredAd.created_at)).limit(limit)).all()
    return [{"id": a.id, "brand_name": a.brand_name, "title": a.title, "body": a.body,
             "destination_url": a.destination_url, "media_url": a.media_url, "is_sponsored": True}
            for a in rows]
