"""Celery configuration for Dynacule backend."""

from celery import Celery
from app.core.config import settings

# Create Celery instance
celery_app = Celery(
    "dynacule",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.worker.tasks",
    ]
)

# Optional configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)