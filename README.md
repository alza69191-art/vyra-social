# VYRA Social

Arabic RTL social platform starter built with Next.js 15, TypeScript, FastAPI and Supabase PostgreSQL.

## Deploy on Render

1. Open the Render Dashboard and choose **New → Blueprint**.
2. Connect GitHub repository `alza69191-art/vyra-social`, branch `main`.
3. Render reads `render.yaml` and prepares two free web services:
   - `vyra-api`: FastAPI backend.
   - `vyra-web`: Next.js website.
4. When prompted, provide the Supabase project URL and public anon/publishable key for the web service, plus the same project URL and PostgreSQL connection string for the API service.
5. For `DATABASE_URL`, copy the **Session pooler** connection string from Supabase → Connect → Session pooler. Replace the password placeholder. Render's outbound network should use the IPv4-compatible shared pooler; do not use Supabase's direct IPv6 URL on this free setup.
6. Deploy both services. The web service proxies `/api/*` to the API over Render's private network, so the browser does not need a separate API URL or cross-origin CORS access.
7. After deployment, open the `vyra-web` service URL. Verify `/` loads and `/api/health` returns the API health JSON through the proxy.

## Environment variables

API service:
- `SUPABASE_URL`: Supabase project URL.
- `DATABASE_URL`: Supabase PostgreSQL **Session pooler** connection string. Keep private.
- `CORS_ORIGINS`: local development origin only; production browser requests use the same-origin Next.js proxy.

Web service:
- `API_INTERNAL_HOSTPORT`: supplied automatically from the API service by the Render Blueprint.
- `NEXT_PUBLIC_SUPABASE_URL`: same Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public anon/publishable key.

Never expose `DATABASE_URL`, Supabase service-role keys, or other server secrets in client-side code or `NEXT_PUBLIC_*` variables.

## Local development

Web: `npm install && npm run dev` (Next.js proxies `/api/*` to `http://localhost:8000`).

API:
```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

API docs: `http://localhost:8000/api/docs`

## Implemented API foundation

- Health checks: `/api/health`, `/api/health/database`
- Public feed: `GET /api/posts`
- Authenticated profile: `GET/PUT /api/me`
- Authenticated posts: `POST /api/posts`
- Comments: `GET/POST /api/posts/{post_id}/comments`
- Reactions: `PUT /api/posts/{post_id}/reaction`

Supabase Auth issues access tokens. Protected API calls must send `Authorization: Bearer <access_token>`.

## Current limitations

The project is a deployment-ready foundation, not a completed social network. The current UI still has demo interactions. UI registration/login, authenticated post publishing, media uploads, private-follow authorization, messaging and realtime notifications still need implementation and testing. SQLAlchemy currently creates initial tables at API startup; add Alembic migrations before complex production schema changes. Free Render services may sleep when idle, and Supabase free quotas/pausing rules apply.
