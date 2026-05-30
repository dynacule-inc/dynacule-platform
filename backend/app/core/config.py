"""
Dynacule Backend Configuration.

Development: uses SQLite (no external database needed).
Production: override DATABASE_URL with PostgreSQL for multi-tenant SaaS.
"""

import os
from typing import List, Union
from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment / .env file."""

    # ── Project ──────────────────────────────────────────────────────
    PROJECT_NAME: str = "Dynacule"
    API_V1_STR: str = "/api/v1"

    # ── CORS ─────────────────────────────────────────────────────────
    BACKEND_CORS_ORIGINS: List[Union[str, AnyHttpUrl]] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # ── Database ─────────────────────────────────────────────────────
    # SQLite for dev — zero setup. For SaaS, set DATABASE_URL to PostgreSQL.
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./dynacule.db",
    )

    # ── Redis ────────────────────────────────────────────────────────
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: Union[str, None] = os.getenv("REDIS_PASSWORD", None)

    @property
    def REDIS_URL(self) -> str:
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    # ── Celery ───────────────────────────────────────────────────────
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

    # ── Security ─────────────────────────────────────────────────────
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dynacule-dev-secret-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # ── Environment ──────────────────────────────────────────────────
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # ── Modal.com GPU Offloading ─────────────────────────────────────
    MODAL_API_TOKEN: str = os.getenv("MODAL_API_TOKEN", "")
    MODAL_APP_NAME: str = os.getenv("MODAL_APP_NAME", "dynacule-compute")

    # ── OpenRouter AI ────────────────────────────────────────────────
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings()