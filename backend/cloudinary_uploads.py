import os
from io import BytesIO
from uuid import uuid4

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend import models
from backend.database import SessionLocal
from backend.security import current_user

router = APIRouter(prefix="/api", tags=["media"])

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
IMAGE_LIMIT = 15 * 1024 * 1024
VIDEO_LIMIT = 100 * 1024 * 1024


def get_db():
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/uploads")
async def upload_media(
    file: UploadFile = File(...),
    purpose: str = Form(default="post"),
    post_id: str | None = Form(default=None),
    claims: dict = Depends(current_user),
    db: Session = Depends(get_db),
):
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")
    if not all((cloud_name, api_key, api_secret)):
        raise HTTPException(status_code=503, detail="Cloudinary is not configured")

    profile = db.get(models.Profile, claims["sub"])
    if profile is None:
        raise HTTPException(status_code=409, detail="Profile not found")

    content_type = (file.content_type or "").lower()
    if content_type in IMAGE_TYPES:
        resource_type, max_size = "image", IMAGE_LIMIT
    elif content_type in VIDEO_TYPES:
        resource_type, max_size = "video", VIDEO_LIMIT
    else:
        raise HTTPException(status_code=415, detail="Only JPG, PNG, WEBP, GIF, MP4, WEBM and MOV files are allowed")

    if purpose not in {"post", "avatar", "cover", "space"}:
        raise HTTPException(status_code=400, detail="Invalid upload purpose")
    if purpose == "avatar" and resource_type != "image":
        raise HTTPException(status_code=415, detail="Profile photo must be an image")
    if purpose in {"cover", "space"} and resource_type != "image":
        raise HTTPException(status_code=415, detail="Cover photo must be an image")

    post = None
    if purpose == "post":
        if not post_id:
            raise HTTPException(status_code=400, detail="Create a post before uploading its media")
        post = db.get(models.Post, post_id)
        if post is None or post.author_id != claims["sub"]:
            raise HTTPException(status_code=404, detail="Post not found")

    data = await file.read(max_size + 1)
    await file.close()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > max_size:
        raise HTTPException(status_code=413, detail=f"File exceeds the {max_size // (1024 * 1024)} MB limit")

    cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)
    folder = "vyra/spaces" if purpose == "space" else ("vyra/profiles" if purpose in {"avatar", "cover"} else "vyra/posts")
    try:
        result = cloudinary.uploader.upload(
            BytesIO(data),
            resource_type=resource_type,
            folder=folder,
            public_id=str(uuid4()),
            overwrite=False,
            timeout=90,
        )
    except Exception:
        raise HTTPException(status_code=502, detail="Cloudinary upload failed. Check the Cloudinary settings and try again.")

    url = result.get("secure_url")
    if not url:
        raise HTTPException(status_code=502, detail="Cloudinary did not return a secure media URL")

    if purpose == "avatar":
        profile.avatar_url = url
    elif purpose == "cover":
        profile.cover_url = url
    elif purpose == "space":
        pass
    else:
        db.add(models.PostMedia(
            id=str(uuid4()),
            post_id=post.id,
            media_url=url,
            media_type=resource_type,
        ))
    db.commit()

    return {
        "url": url,
        "media_type": resource_type,
        "purpose": purpose,
        "post_id": post.id if post else None,
    }
