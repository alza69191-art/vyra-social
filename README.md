# VYRA Social

Arabic RTL social-platform foundation built with Next.js 15, TypeScript, FastAPI and TiDB Cloud (MySQL protocol).

## Render deployment

The repository's `render.yaml` describes:
- `vyra-api`: FastAPI backend.
- `vyra-web`: Next.js frontend.

If the API service and TiDB database already exist, do not create duplicates. Keep the existing services and deploy from this repository.

### API environment

Set these variables on the existing `vyra-api` service:
- `DATABASE_URL1`: TiDB Cloud connection URL using `mysql+pymysql://`; keep it private.
- `JWT_SECRET`: a randomly generated secret with at least 32 characters. Generate it in Render and never put it in GitHub.
- `CORS_ORIGINS`: include the frontend's exact origin, for example `https://vyra-web-rs1b.onrender.com`.

VYRA uses TiDB Cloud as its only database. The API requires TLS for the TiDB public endpoint and creates missing tables from the SQLAlchemy models at startup.

### Frontend environment

Set:
- `NEXT_PUBLIC_API_URL=https://vyra-api-9pxl.onrender.com`

This value is a public API address, not a secret. The database URL and JWT secret must never use a `NEXT_PUBLIC_` prefix.

## Local development

API:
```bash
pip install -r backend/requirements.txt
set DATABASE_URL1=mysql+pymysql://USER:PASSWORD@HOST:4000/vyra_social
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
- The browser stores the short-lived token in sessionStorage. This is a basic deployment foundation; harden session storage before a production public launch.

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

## Marketplace

The authenticated `/market` page supports creating and browsing text-based listings, filtering by category, and marking the owner's listing as sold. Payments, checkout, product image galleries, orders, and dispute workflows are not included yet.
