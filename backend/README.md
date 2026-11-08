# VYRA API

FastAPI service scaffold for the VYRA platform.

## Local run

```bash
python -m pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

API health: `/api/health`  
Database health: `/api/health/database`  
API documentation: `/api/docs`

Set `DATABASE_URL` only after provisioning PostgreSQL. The API deliberately does not create a local SQLite database in production, because ephemeral application storage is not a safe place for social-network data.

The SQLAlchemy models in `models.py` define the first data domains: profiles, posts, media metadata, comments, reactions, follows, direct messages, and notifications. Authentication and media files will be connected to dedicated services in the next implementation stage.
