import os
from functools import lru_cache
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, decode
from jwt.exceptions import PyJWTError

bearer = HTTPBearer(auto_error=False)

@lru_cache(maxsize=1)
def _jwks_client():
    project_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    if not project_url:
        raise RuntimeError("SUPABASE_URL is not configured")
    return PyJWKClient(f"{project_url}/auth/v1/.well-known/jwks.json", cache_keys=True)

def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    project_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    if not project_url:
        raise HTTPException(status_code=503, detail="Authentication provider is not configured")
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(credentials.credentials)
        claims = decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=f"{project_url}/auth/v1",
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
        return claims
    except (PyJWTError, RuntimeError, Exception):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
