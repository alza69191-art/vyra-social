import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def _database_url():
    # VYRA uses TiDB Cloud (MySQL protocol) as its only database.
    return os.getenv("DATABASE_URL1", "").strip()


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

    if not url.startswith("mysql+pymysql://"):
        raise RuntimeError("DATABASE_URL1 must use the mysql+pymysql:// driver")

    # TiDB Cloud public endpoints require TLS.
    import certifi

    common["connect_args"] = {
        "ssl": {
            "ca": certifi.where(),
            "check_hostname": True,
        }
    }
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
