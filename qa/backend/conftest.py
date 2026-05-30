"""
Dynacule Backend Test Fixtures.

Provides the FastAPI TestClient, isolated in-memory SQLite database,
and mock fixtures for all API router test suites.
"""

from __future__ import annotations

import json
import os
import tempfile
import pytest
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

# ── Bootstrap: override settings BEFORE any app imports ───────────────────
_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_db_path}")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("REDIS_HOST", "localhost")
os.environ.setdefault("REDIS_PORT", "6379")
os.environ.setdefault("CELERY_BROKER_URL", "memory://")
os.environ.setdefault("CELERY_RESULT_BACKEND", "cache+memory://")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.main import app
from app.models.job import Base, Job, JobStatus


# ── Test Database ─────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def db_engine():
    """Create a fresh SQLite database for the test session."""
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()
    # Cleanup the temp db file
    if os.path.exists(_db_path):
        os.unlink(_db_path)


@pytest.fixture(scope="function")
def db_session(db_engine):
    """Yield a fresh DB session per test, rolling back on teardown."""
    connection = db_engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


# ── FastAPI TestClient ────────────────────────────────────────────────────

@pytest.fixture(scope="function")
def client() -> Generator[TestClient, None, None]:
    """Yield a FastAPI TestClient with fresh app state."""
    with TestClient(app) as c:
        yield c


# ── Mock Redis ────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def mock_redis():
    """Mock Redis client so tests don't need a running Redis.

    Patches get_redis (async) and get_redis_sync (sync) at the module level,
    plus the Redis ConnectionPool used in the module body.
    """
    # Create a mock pubsub with async listen
    mock_pubsub = AsyncMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.close = AsyncMock()
    # listen() returns an async generator — simulate empty stream
    async def _empty_listen():
        return
        yield  # pragma: no cover
    mock_pubsub.listen = _empty_listen

    # Mock async Redis client
    mock_async_client = AsyncMock()
    mock_async_client.pubsub.return_value = mock_pubsub
    mock_async_client.publish = AsyncMock()
    mock_async_client.ping.return_value = True
    mock_async_client.close = AsyncMock()

    # Mock sync Redis client
    mock_sync_client = MagicMock()
    mock_sync_client.publish = MagicMock()
    mock_sync_client.ping.return_value = True
    mock_sync_client.close = MagicMock()

    patches = [
        patch("app.core.redis.get_redis", return_value=mock_async_client),
        patch("app.core.redis.get_redis_sync", return_value=mock_sync_client),
        patch("app.core.redis._async_redis_client", mock_async_client),
        patch("app.core.redis._sync_redis_client", mock_sync_client),
    ]
    for p in patches:
        p.start()
    yield
    for p in patches:
        p.stop()


# ── Mock Celery ───────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def mock_celery():
    """Mock Celery task .delay() calls to avoid needing a real broker."""
    with patch("celery.app.task.Task.delay") as mock_delay:
        mock_delay.return_value = MagicMock(id="mock-task-id")
        yield mock_delay


# ── Sample Test Data ──────────────────────────────────────────────────────

@pytest.fixture
def sample_smiles() -> str:
    """A valid SMILES string for testing: ethanol."""
    return "CCO"


@pytest.fixture
def sample_invalid_smiles() -> str:
    """An intentionally invalid SMILES string."""
    return "ZZZZ"


@pytest.fixture
def sample_docking_request() -> dict:
    """Realistic docking job request payload."""
    return {
        "ligand_smiles": "CCO",
        "receptor_pdb_path": "/tmp/receptor.pdb",
        "center_x": 0.0,
        "center_y": 0.0,
        "center_z": 0.0,
        "size_x": 20.0,
        "size_y": 20.0,
        "size_z": 20.0,
        "exhaustiveness": 8,
    }


@pytest.fixture
def sample_md_request() -> dict:
    """Realistic molecular dynamics job request payload."""
    return {
        "pdb_content": "ATOM      1  N   ALA A   1      27.340  24.430   2.614  1.00  0.00           N\nEND\n",
        "forcefield": "amber14-all.xml",
        "solvent": "tip3p",
        "box_padding": 1.0,
        "ionic_strength": 0.15,
        "minimization_steps": 500,
        "equilibration_steps": 1000,
        "production_steps": 50000,
        "temperature": 300.0,
    }


@pytest.fixture
def sample_qm_request() -> dict:
    """Realistic quantum mechanics job request payload (water molecule)."""
    return {
        "molecule_data": {
            "symbols": ["O", "H", "H"],
            "coordinates": [
                [0.0, 0.0, 0.117],
                [0.0, 0.757, -0.469],
                [0.0, -0.757, -0.469],
            ],
        },
        "task_type": "single_point",
        "theory": "b3lyp",
        "basis_set": "6-31g*",
        "charge": 0,
        "multiplicity": 1,
        "software": "psi4",
    }


@pytest.fixture
def sample_project_data() -> dict:
    """Payload for creating a new project."""
    return {
        "name": "Test Project",
        "description": "A test project for QC/QA purposes",
    }


@pytest.fixture
def sample_molecule_data() -> dict:
    """Payload for molecule endpoints."""
    return {
        "smiles": "CCO",
        "num_conformers": 5,
    }
