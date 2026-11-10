# VYRA API

FastAPI backend for VYRA, using Render PostgreSQL through SQLAlchemy and psycopg.

## Run locally

```bash
pip install -r backend/requirements.txt
set DATABASE_URL=postgresql://...
set JWT_SECRET=use-a-random-secret-at-least-32-characters
uvicorn backend.main:app --reload
```

## Health and documentation

- `/api/health`
- `/api/health/database`
- `/api/docs`

## Authentication

- `POST /api/auth/register`: creates a user and profile.
- `POST /api/auth/login`: verifies the Argon2 password hash and returns a 12-hour JWT.
- Protected routes require `Authorization: Bearer <token>`.

Never commit `DATABASE_URL` or `JWT_SECRET`. Configure them in Render's private environment settings.

The ORM models define the initial social data schema. The API startup creates missing tables; use Alembic migrations before changing deployed schemas. Email verification, password reset, session revocation, messaging and media workflows still need their endpoint and delivery implementations.


## Production environment variables

Set these in the Render `vyra-api` service. Never commit secret values to GitHub.

Required for media uploads:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

AI providers (automatic fallback order):
1. `CODIV_API_KEY` — primary text-generation provider; uses `https://api.codiv.ai/v1/chat/completions` and model `diffusiongemma-26b`.
2. `GROQ_API_KEY` — fallback; optional role-specific overrides: `GROQ_ASSISTANT_API_KEY`, `GROQ_AGENT_API_KEY`.
3. `OPENROUTER_API_KEY` — fallback; optional role-specific overrides: `OPENROUTER_ASSISTANT_API_KEY`, `OPENROUTER_AGENT_API_KEY`.
4. Existing `HF_ASSISTANT_TOKEN` and `HF_AGENT_TOKEN` — final fallback.

Optional model overrides:
- `CODIV_MODEL` (default: `diffusiongemma-26b`)
- `GROQ_MODEL` (default: `openai/gpt-oss-120b`)
- `OPENROUTER_MODEL` (default: `openrouter/free`)
- `HF_ASSISTANT_MODEL`
- `HF_AGENT_MODEL`

The provider keys must be configured in Render before the corresponding provider can answer. Free tiers are rate-limited and are not unlimited.

## Media and social-space endpoints
- `POST /api/uploads` — authenticated image/video upload to Cloudinary. Use `purpose=avatar`, `cover`, or `post`; post uploads require `post_id`.
- `GET /api/posts/{post_id}/media` — list post attachments.
- `GET/POST /api/groups`, `POST /api/groups/{group_id}/join`.
- `GET/POST /api/pages`, `POST /api/pages/{page_id}/follow`.
