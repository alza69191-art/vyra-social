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
AUDIO_TYPES = {"audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/aac", "audio/x-m4a", "audio/3gpp"}
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

    content_type = (file.content_type or "").lower().split(";", 1)[0].strip()
    if content_type in IMAGE_TYPES:
        resource_type, max_size = "image", IMAGE_LIMIT
    elif content_type in VIDEO_TYPES:
        resource_type, max_size = "video", VIDEO_LIMIT
    elif content_type in AUDIO_TYPES:
        resource_type, max_size = "video", 25 * 1024 * 1024
    else:
        raise HTTPException(status_code=415, detail="Only JPG, PNG, WEBP, GIF, MP4, WEBM, MOV and supported audio files are allowed")

    if purpose not in {"post", "avatar", "cover", "space", "message", "market", "story", "ad"}:
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
    folder = "vyra/messages" if purpose == "message" else ("vyra/market" if purpose == "market" else ("vyra/stories" if purpose == "story" else ("vyra/ads" if purpose == "ad" else ("vyra/spaces" if purpose == "space" else ("vyra/profiles" if purpose in {"avatar", "cover"} else "vyra/posts")))))
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
    elif purpose in {"space", "message", "market", "story", "ad"}:
        # Story and ad assets are linked by their dedicated API endpoints.
        # Never attach them to a post or require a post_id for these uploads.
        pass
    elif purpose == "post":
        db.add(models.PostMedia(
            id=str(uuid4()),
            post_id=post.id,
            media_url=url,
            media_type=resource_type,
        ))
    db.commit()

    return {
        "url": url,
        "media_type": "audio" if content_type in AUDIO_TYPES else resource_type,
        "purpose": purpose,
        "post_id": post.id if post else None,
    }


# Direct-to-Cloudinary uploads keep large media bodies off the API worker.
# The API secret remains server-side; only short-lived upload signatures reach the browser.
from pydantic import BaseModel, Field
from urllib.parse import urlparse
import time


class DirectUploadSignature(BaseModel):
    post_id: str = Field(min_length=1, max_length=36)
    resource_type: str = Field(default="video", pattern="^(image|video)$")


class DirectUploadComplete(BaseModel):
    post_id: str = Field(min_length=1, max_length=36)
    public_id: str = Field(min_length=1, max_length=255)
    secure_url: str = Field(min_length=12, max_length=2048)
    version: int = Field(gt=0)
    signature: str = Field(min_length=32, max_length=128)
    resource_type: str = Field(pattern="^(image|video)$")


@router.post("/uploads/signature")
def sign_direct_upload(
    payload: DirectUploadSignature,
    claims: dict = Depends(current_user),
    db: Session = Depends(get_db),
):
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()
    if not all((cloud_name, api_key, api_secret)):
        raise HTTPException(status_code=503, detail="Cloudinary is not configured")

    post = db.get(models.Post, payload.post_id)
    if post is None or post.author_id != claims["sub"]:
        raise HTTPException(status_code=404, detail="Post not found")

    cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)
    public_id = f"vyra/posts/{claims['sub']}/{post.id}/{uuid4().hex}"
    timestamp = int(time.time())
    signed_params = {"public_id": public_id, "timestamp": timestamp}
    signature = cloudinary.utils.api_sign_request(signed_params, api_secret)
    return {
        "cloud_name": cloud_name,
        "api_key": api_key,
        "timestamp": timestamp,
        "signature": signature,
        "public_id": public_id,
        "resource_type": payload.resource_type,
    }


@router.post("/uploads/complete", status_code=201)
def complete_direct_upload(
    payload: DirectUploadComplete,
    claims: dict = Depends(current_user),
    db: Session = Depends(get_db),
):
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()
    if not all((cloud_name, api_key, api_secret)):
        raise HTTPException(status_code=503, detail="Cloudinary is not configured")

    post = db.get(models.Post, payload.post_id)
    if post is None or post.author_id != claims["sub"]:
        raise HTTPException(status_code=404, detail="Post not found")

    expected_prefix = f"vyra/posts/{claims['sub']}/{post.id}/"
    if not payload.public_id.startswith(expected_prefix):
        raise HTTPException(status_code=403, detail="Uploaded asset does not belong to this post")

    parsed = urlparse(payload.secure_url)
    expected_path = f"/{cloud_name}/{payload.resource_type}/upload/"
    if parsed.scheme != "https" or parsed.hostname != "res.cloudinary.com" or expected_path not in parsed.path:
        raise HTTPException(status_code=422, detail="Invalid Cloudinary media URL")

    cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)
    try:
        verified = cloudinary.utils.verify_api_response_signature(
            payload.public_id, payload.version, payload.signature
        )
    except Exception:
        verified = False
    if not verified:
        raise HTTPException(status_code=403, detail="Cloudinary upload signature verification failed")

    existing = db.query(models.PostMedia).filter(
        models.PostMedia.post_id == post.id,
        models.PostMedia.media_url == payload.secure_url,
    ).first()
    if existing is None:
        db.add(models.PostMedia(
            id=str(uuid4()),
            post_id=post.id,
            media_url=payload.secure_url,
            media_type=payload.resource_type,
        ))
        db.commit()

    return {"url": payload.secure_url, "media_type": payload.resource_type, "post_id": post.id}
