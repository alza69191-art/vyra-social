import os
from urllib.parse import quote, quote_plus

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def _database_url():
    # DATABASE_URL1 is reserved for the new TiDB/MySQL connection during migration.
    # Keep DATABASE_URL as the existing PostgreSQL fallback until migration is verified.
    url = os.getenv("DATABASE_URL1", "").strip() or os.getenv("DATABASE_URL", "").strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif url.startswith("mysql://"):
        url = url.replace("mysql://", "mysql+pymysql://", 1)
    return url


DATABASE_URL = _database_url()


def _build_engine(url: str):
    if not url:
        return None

    common = {
        "pool_pre_ping": True,
        "pool_recycle": 1800,
        "pool_size": 3,
        "max_overflow": 0,
    }

    if url.startswith("mysql+") or url.startswith("mysql://"):
        # TiDB Cloud requires TLS for public endpoints. PyMySQL validates
        # certificates against the CA bundle installed with certifi.
        import certifi

        common["connect_args"] = {
            "ssl": {
                "ca": certifi.where(),
                "check_hostname": True,
            }
        }
    elif url.startswith("postgresql+"):
        common["connect_args"] = {"sslmode": "require"}

    return create_engine(url, **common)


engine = _build_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False) if engine else None


class Base(DeclarativeBase):
    pass


def database_status():
    if engine is None:
        return {"configured": False, "connected": False}
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"configured": True, "connected": True, "dialect": engine.dialect.name}
    except Exception:
        return {"configured": True, "connected": False, "dialect": engine.dialect.name}
