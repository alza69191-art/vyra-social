"""Baseline HTTP hardening for the VYRA API.

The in-process limiter is a best-effort abuse guard for a single worker only.
Use a shared Redis-backed limiter before running multiple workers/instances.
"""
from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

WINDOW_SECONDS = 60
LIMITS = {
    "/api/auth/register": 5,
    "/api/auth/login": 8,
    "/api/ai/chat": 12,
    "/api/ai/agent": 8,
    "/api/uploads": 12,
    "/api/market/listings": 8,
}


class SecurityControlsMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._events = defaultdict(deque)
        self._lock = Lock()

    async def dispatch(self, request, call_next):
        path = request.url.path
        limit = LIMITS.get(path)
        if limit is not None and request.method == "POST":
            host = request.client.host if request.client else "unknown"
            key = (host, path)
            now = monotonic()
            with self._lock:
                events = self._events[key]
                while events and now - events[0] >= WINDOW_SECONDS:
                    events.popleft()
                if len(events) >= limit:
                    return JSONResponse(
                        {"detail": "طلبات كثيرة. انتظر دقيقة ثم حاول مجدداً."},
                        status_code=429,
                        headers={"Retry-After": str(WINDOW_SECONDS)},
                    )
                events.append(now)

        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        if request.url.scheme == "https":
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response
