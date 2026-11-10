# VYRA Social

Arabic RTL social-platform foundation built with Next.js 15, TypeScript, FastAPI and Render PostgreSQL.

## Render deployment

The repository's `render.yaml` describes:
- `vyra-api`: FastAPI backend.
- `vyra-web`: Next.js frontend.

If the API service and PostgreSQL database already exist, do not create a second API or database. Keep the existing `vyra-api` service and deploy only the frontend service from this repository, or use the Blueprint after checking the resources it proposes.

### API environment

Set these variables on the existing `vyra-api` service:
- `DATABASE_URL`: Render **Internal Database URL** from `vyra-db`; keep it private.
- `JWT_SECRET`: a randomly generated secret with at least 32 characters. Generate it in Render and never put it in GitHub.
- `CORS_ORIGINS`: include the frontend's exact origin, for example `https://vyra-web.onrender.com`.

The API converts Render's PostgreSQL URL to the psycopg SQLAlchemy driver. On startup it creates any missing tables in the configured database.

### Frontend environment

Set:
- `NEXT_PUBLIC_API_URL=https://vyra-api-9pxl.onrender.com`

This value is a public API address, not a secret. The database URL and JWT secret must never use a `NEXT_PUBLIC_` prefix.

## Local development

API:
```bash
pip install -r backend/requirements.txt
set DATABASE_URL=postgresql://...
set JWT_SECRET=replace-with-a-long-random-secret
uvicorn backend.main:app --reload
```

Frontend:
```bash
npm install
npm run dev
```

API docs: `/api/docs`.

## Authentication and data

- Email/password registration and login: `POST /api/auth/register`, `POST /api/auth/login`.
- Passwords are hashed with Argon2 via pwdlib.
- API access tokens are signed JWTs and expire after 12 hours.
- Authenticated profile and social API routes require `Authorization: Bearer <token>`.
- The browser stores the short-lived token in sessionStorage. This is a basic deployment foundation; harden session storage and add rate limiting before a production public launch.

The SQLAlchemy schema includes users, profiles, sessions, email-verification and password-reset token records, posts, media metadata, comments, reactions, follows, friendships, blocks, stories, conversations, conversation members, direct messages, notifications, groups, group members, pages, page followers and post bookmarks. A schema table is not proof that its product workflow is implemented.

## Implemented API routes

- `GET /api/health`, `GET /api/health/database`
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET/PUT /api/me`
- `GET/POST /api/posts`
- `GET /api/posts/{post_id}/media`, `GET/POST /api/posts/{post_id}/comments`
- `PUT /api/posts/{post_id}/reaction`, `DELETE /api/posts/{post_id}`
- `GET /api/bookmarks`, `PUT /api/posts/{post_id}/bookmark`
- `GET/POST /api/groups`, `POST /api/groups/{group_id}/join`
- `GET/POST /api/pages`, `POST /api/pages/{page_id}/follow`
- `POST /api/uploads` (Cloudinary; authenticated)
- `POST /api/ai/chat`, `POST /api/ai/agent`

## Not yet implemented

Email verification, password reset, server-side session revocation/logout, stories, direct messaging, notifications, WebSocket updates, full private-account follow authorization, moderation, and admin workflows are not implemented. Email delivery, media malware scanning/signature validation, image re-encoding, video transcoding, background jobs, Redis-backed rate limiting, Alembic migrations, automated tests, backups and production security review remain necessary before a public production launch.

See `SECURITY.md`, `PERFORMANCE.md`, and `PROCESSING.md` for current controls, limitations and the next implementation steps.

Render Free PostgreSQL expires after its stated trial period. Back up and migrate the database before expiry; do not rely on the free database as permanent storage.
