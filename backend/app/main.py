"""
Dynacule Backend — FastAPI Application Entry Point.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from app.api import molecules, docking, md, qm, websocket, projects, jobs
from app.core.config import settings
from app.core.redis import close_redis
from app.models.job import Base

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Database Tables (Synchronously for setup)
    logger.info("Initializing database tables...")
    sync_url = settings.DATABASE_URL.replace("+aiosqlite", "")
    sync_engine = create_engine(sync_url)
    Base.metadata.create_all(bind=sync_engine)
    sync_engine.dispose()
    
    logger.info("Dynacule API starting — %s mode", settings.ENVIRONMENT)
    yield
    logger.info("Dynacule API shutting down...")
    await close_redis()

app = FastAPI(
    title="Dynacule API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(molecules.router, prefix="/api/v1/molecules", tags=["molecules"])
app.include_router(jobs.router, prefix="/api/v1/jobs", tags=["jobs"])
app.include_router(docking.router, prefix="/api/v1/docking", tags=["docking"])
app.include_router(md.router, prefix="/api/v1/md", tags=["molecular dynamics"])
app.include_router(qm.router, prefix="/api/v1/qm", tags=["quantum mechanics"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "dynacule-backend"}

@app.get("/")
async def root():
    return {"message": "Welcome to Dynacule API", "docs": "/docs", "health": "/health"}
