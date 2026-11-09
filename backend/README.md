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
