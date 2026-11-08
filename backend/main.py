import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import database_status

app = FastAPI(
    title="VYRA API",
    version="0.1.0",
    description="Backend API for the VYRA social platform.",
    docs_url="/api/docs",
    redoc_url=None,
)

origins = [item.strip() for item in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/")
def root():
    return {"name": "VYRA API", "status": "running", "docs": "/api/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "vyra-api"}


@app.get("/api/health/database")
def health_database():
    result = database_status()
    status = "connected" if result["connected"] else ("not_configured" if not result["configured"] else "unavailable")
    return {"status": status, "database": result}
