"""
Database configuration for Dynacule backend.

Development: SQLite with aiosqlite (zero setup).
Production: Override DATABASE_URL with PostgreSQL for SaaS.

Provides both synchronous and asynchronous database sessions.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# ── Synchronous engine (for fast API endpoints) ──────────────────────
# Strip +aiosqlite for sync usage
_sync_url = settings.DATABASE_URL.replace("+aiosqlite", "")
engine = create_engine(
    _sync_url,
    connect_args=(
        {"check_same_thread": False}
        if _sync_url.startswith("sqlite")
        else {}
    ),
    pool_pre_ping=True,
    pool_recycle=300,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a sync DB session, auto-closes on finish."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Async engine (for WebSocket streaming, optional) ─────────────────
import sqlalchemy.ext.asyncio as _asyncio

_async_url = settings.DATABASE_URL
if _async_url.startswith("sqlite"):
    # aiosqlite requires sqlite+aiosqlite://
    if "+aiosqlite" not in _async_url:
        _async_url = _async_url.replace("sqlite://", "sqlite+aiosqlite://")
    async_engine = _asyncio.create_async_engine(
        _async_url,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
else:
    async_engine = _asyncio.create_async_engine(
        _async_url,
        pool_pre_ping=True,
        pool_recycle=300,
    )

AsyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=async_engine,
    class_=_asyncio.AsyncSession,
)


async def get_async_db():
    """FastAPI dependency — yields an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()