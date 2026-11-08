import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def _database_url():
    url = os.getenv("DATABASE_URL", "").strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL = _database_url()
# Render's outbound network is IPv4; use Supabase's shared SESSION pooler
# (port 5432) and require TLS. Do not use transaction pooler for this ORM.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=0,
    connect_args={"sslmode": "require"},
) if DATABASE_URL else None
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False) if engine else None


class Base(DeclarativeBase):
    pass


def database_status():
    if engine is None:
        return {"configured": False, "connected": False}
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"configured": True, "connected": True}
    except Exception:
        return {"configured": True, "connected": False}
