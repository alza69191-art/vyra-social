import os
from datetime import datetime, timezone
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import PyJWTError

bearer = HTTPBearer(auto_error=False)
JWT_ALGORITHM = "HS256"
JWT_ISSUER = "vyra-api"


def _secret() -> str:
    secret = os.getenv("JWT_SECRET", "")
    if len(secret) < 32:
        raise RuntimeError("JWT_SECRET must be configured with at least 32 characters")
    return secret


def create_access_token(user_id: str) -> str:
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iss": JWT_ISSUER,
        "iat": now,
        "exp": now + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        claims = jwt.decode(
            credentials.credentials,
            _secret(),
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            options={"require": ["exp", "sub", "iss", "iat"]},
        )
        if claims.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid access token")
        # Enforce account suspension on every authenticated API request,
        # including access tokens issued before an administrator action.
        from backend.database import SessionLocal
        from backend import models
        if SessionLocal is None:
            raise HTTPException(status_code=503, detail="Database is not configured")
        db = SessionLocal()
        try:
            user = db.get(models.User, claims["sub"])
            if user is None or not user.is_active:
                raise HTTPException(status_code=403, detail="This account is suspended or unavailable")
        finally:
            db.close()
        return claims
    except HTTPException:
        raise
    except (PyJWTError, RuntimeError):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
