import os
import secrets
from datetime import datetime, timezone
from uuid import uuid4
from urllib.parse import urlencode

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_db, password_hasher, auth_result

router = APIRouter(prefix="/api/auth/oauth", tags=["OAuth"])
oauth = OAuth()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "").strip()
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "").strip()
API_BASE_URL = os.getenv("OAUTH_API_BASE_URL", "https://vyra-api-9pxl.onrender.com").rstrip("/")
FRONTEND_URL = os.getenv("OAUTH_FRONTEND_URL", "https://vyra-web-rs1b.onrender.com").rstrip("/")

if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
    oauth.register(
        name="google",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

if GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET:
    oauth.register(
        name="github",
        client_id=GITHUB_CLIENT_ID,
        client_secret=GITHUB_CLIENT_SECRET,
        access_token_url="https://github.com/login/oauth/access_token",
        authorize_url="https://github.com/login/oauth/authorize",
        api_base_url="https://api.github.com/",
        client_kwargs={"scope": "read:user user:email"},
    )


def _redirect_uri(provider: str) -> str:
    return f"{API_BASE_URL}/api/auth/oauth/{provider}/callback"


def _finish_url(token: str | None = None, error: str | None = None) -> str:
    if error:
        return f"{FRONTEND_URL}/login?{urlencode({'oauth_error': error})}"
    return f"{FRONTEND_URL}/auth/callback#access_token={token}"


@router.get("/{provider}")
async def oauth_start(provider: str, request: Request):
    if provider not in ("google", "github"):
        raise HTTPException(status_code=404, detail="Unsupported identity provider")
    client = oauth.create_client(provider)
    if client is None:
        raise HTTPException(status_code=503, detail=f"{provider.title()} sign-in is not configured yet")
    return await client.authorize_redirect(request, _redirect_uri(provider))


async def _provider_identity(provider: str, request: Request):
    client = oauth.create_client(provider)
    token = await client.authorize_access_token(request)
    if provider == "google":
        info = token.get("userinfo")
        if not info:
            response = await client.get("https://openidconnect.googleapis.com/v1/userinfo", token=token)
            info = response.json()
        if not info or not info.get("sub") or not info.get("email") or info.get("email_verified") is not True:
            raise ValueError("Google did not return a verified email address")
        return str(info["sub"]), info["email"].strip().lower(), (info.get("name") or info["email"].split("@")[0])[:80], info.get("picture")

    response = await client.get("user", token=token)
    profile = response.json()
    if not profile or not profile.get("id"):
        raise ValueError("GitHub profile could not be verified")
    emails_response = await client.get("user/emails", token=token)
    emails = emails_response.json()
    verified = [item for item in emails if item.get("verified") and item.get("primary") and item.get("email")]
    if not verified:
        verified = [item for item in emails if item.get("verified") and item.get("email")]
    if not verified:
        raise ValueError("GitHub account has no verified email address")
    email = verified[0]["email"].strip().lower()
    display_name = (profile.get("name") or profile.get("login") or email.split("@")[0])[:80]
    return str(profile["id"]), email, display_name, profile.get("avatar_url")


def _get_or_create_user(db: Session, provider: str, subject: str, email: str, display_name: str, avatar_url: str | None):
    identity = db.scalar(select(models.OAuthIdentity).where(
        models.OAuthIdentity.provider == provider,
        models.OAuthIdentity.provider_user_id == subject,
    ))
    if identity:
        user = db.get(models.User, identity.user_id)
        if user is None or not user.is_active:
            raise ValueError("This VYRA account is unavailable")
        profile = db.get(models.Profile, user.id)
        if profile is None:
            raise ValueError("VYRA profile is incomplete")
        if avatar_url and not profile.avatar_url:
            profile.avatar_url = avatar_url
            db.commit()
        return user, profile

    # Only link an existing VYRA account when the provider has verified this email.
    user = db.scalar(select(models.User).where(models.User.email == email))
    if user is not None and not user.is_active:
        raise ValueError("This VYRA account is unavailable")
    if user is None:
        user_id = str(uuid4())
        user = models.User(
            id=user_id,
            email=email,
            password_hash=password_hasher.hash(secrets.token_urlsafe(48)),
            is_active=True,
            email_verified_at=datetime.now(timezone.utc),
        )
        db.add(user)
        db.flush()
        profile = models.Profile(
            id=user_id,
            username=f"v_{uuid4().hex[:20]}",
            display_name=display_name,
            avatar_url=avatar_url,
            is_private=False,
        )
        db.add(profile)
        db.flush()
    else:
        if user.email_verified_at is None:
            user.email_verified_at = datetime.now(timezone.utc)
        profile = db.get(models.Profile, user.id)
        if profile is None:
            raise ValueError("VYRA profile is incomplete")

    db.add(models.OAuthIdentity(
        id=str(uuid4()),
        user_id=user.id,
        provider=provider,
        provider_user_id=subject,
        email=email,
    ))
    db.commit()
    db.refresh(user)
    db.refresh(profile)
    return user, profile


@router.get("/{provider}/callback")
async def oauth_callback(provider: str, request: Request, db: Session = Depends(get_db)):
    if provider not in ("google", "github") or oauth.create_client(provider) is None:
        return RedirectResponse(_finish_url(error="provider_not_configured"), status_code=303)
    try:
        subject, email, display_name, avatar_url = await _provider_identity(provider, request)
        user, profile = _get_or_create_user(db, provider, subject, email, display_name, avatar_url)
        result = auth_result(user, profile)
        return RedirectResponse(_finish_url(token=result["access_token"]), status_code=303)
    except IntegrityError:
        db.rollback()
        return RedirectResponse(_finish_url(error="account_link_conflict"), status_code=303)
    except Exception:
        db.rollback()
        return RedirectResponse(_finish_url(error="oauth_failed"), status_code=303)
