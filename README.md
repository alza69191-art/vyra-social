# VYRA Social

Arabic RTL social platform starter built with Next.js 15, TypeScript, FastAPI and PostgreSQL (Supabase-hosted).

## Repository structure
- `app/`: Next.js web interface.
- `backend/`: FastAPI service, SQLAlchemy models, Supabase JWT verification and social API endpoints.
- `render.yaml`: Render Blueprint for separate web and API services.
- `index.html`: standalone HTML prototype; the production Next.js app is served from the web service.

## Local development

### Web
```bash
npm install
npm run dev
```

### API
```bash
python -m venv .venv
# Activate the environment, then:
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

API docs: `http://localhost:8000/api/docs`

## Environment variables

Web service:
- `NEXT_PUBLIC_API_URL`: deployed FastAPI base URL.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase publishable/anon key.

API service (server only):
- `SUPABASE_URL`: same Supabase project URL; used to verify Supabase access tokens.
- `DATABASE_URL`: Supabase PostgreSQL connection string. Keep it private.
- `CORS_ORIGINS`: comma-separated exact frontend origins, e.g. the Render web URL.

Never put `DATABASE_URL`, service-role keys, or other secrets in `NEXT_PUBLIC_*` variables or client-side code.

## API currently implemented
- `GET /api/health` and `GET /api/health/database`
- `GET /api/posts` (public posts)
- Authenticated `GET/PUT /api/me`
- Authenticated `POST /api/posts`
- `GET/POST /api/posts/{post_id}/comments`
- Authenticated `PUT /api/posts/{post_id}/reaction`

Supabase Auth issues the access token. Protected API calls must send it as `Authorization: Bearer <access_token>`.

## Important deployment notes
- Create a Supabase project first and use its PostgreSQL connection string as `DATABASE_URL`.
- Set the exact deployed web origin in the API service's `CORS_ORIGINS`.
- Render free services may sleep when idle. Free database/storage quotas and retention limits apply.
- SQLAlchemy creates the initial tables on API startup. For production schema changes, introduce Alembic migrations before making destructive or complex schema changes.
- The existing UI still contains demo/local-state interactions. The API foundation is implemented, but full UI authentication, live feed loading, uploads, messaging and realtime notifications remain separate integration milestones.
