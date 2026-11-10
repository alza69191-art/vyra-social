# VYRA Security Baseline

## Implemented in the API
- Passwords are hashed with Argon2 (pwdlib).
- JWT access tokens are signed with HS256, require a 32-character-or-longer JWT_SECRET, and expire after 12 hours.
- Authenticated API routes require a bearer token.
- Uploads are restricted to explicit image/video MIME types and size ceilings (15 MB images, 100 MB videos); post uploads must belong to the authenticated author.
- Private-profile posts are excluded from the public feed and public post detail routes return not-found.
- Basic security response headers are applied by backend/security_controls.py and Next.js.
- Best-effort per-process request throttling is applied to registration, login, AI and upload endpoints.

## Important limitations before public production
- The in-memory rate limiter is not shared between workers, instances, or deployments. Replace it with Redis-backed throttling before scaling.
- Email verification and password-reset flows are not implemented; token tables are schema foundations only.
- Tokens are stored in browser sessionStorage, so an XSS vulnerability could expose the current session. Prefer secure, HttpOnly, SameSite cookies and CSRF protection.
- There is no server-side logout/revocation endpoint yet. A browser-side logout only clears local state and does not revoke an issued JWT.
- No automated malware scanning, image re-encoding, video transcoding, or content moderation is currently wired into uploads.
- Review privacy and authorization rules for every new route. Never trust client-supplied user IDs, file names, MIME types, or ownership claims.
- Configure a strong unique JWT_SECRET, private DATABASE_URL, Cloudinary credentials, exact CORS_ORIGINS, backups, and monitoring in Render. Never commit secrets.
- Add dependency scanning, automated tests, database migrations (Alembic), backup-restore drills, and an external security review before handling sensitive user data at scale.

## Incident response
1. Rotate JWT_SECRET and provider credentials if exposure is suspected.
2. Restrict or disable affected endpoints while investigating.
3. Review Render logs and Cloudinary access, without copying secrets into tickets or chat.
4. Restore from a verified database backup if data integrity is affected.
