"""
Docker Compose fixtures for integration smoke tests.

Checks if the Dynacule stack is already running on the expected ports.
If not, spins up a fresh stack and tears it down after the session.
"""

import json
import logging
import os
import subprocess
import time
from pathlib import Path
from typing import Iterator

import pytest
import requests

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────
PROJECT_DIR = Path(__file__).resolve().parent.parent.parent  # Dynacule Sprint 2
COMPOSE_FILE = PROJECT_DIR / "docker-compose.yml"
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
WS_URL = os.getenv("WS_URL", "ws://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def _compose_cmd(*args: str) -> list[str]:
    return [
        "docker", "compose",
        "-f", str(COMPOSE_FILE),
        "-p", "dynacule-smoke",
        *args,
    ]


def _run_capture(cmd: list[str], timeout: int = 60) -> str:
    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=timeout, cwd=PROJECT_DIR,
    )
    if result.returncode != 0:
        logger.warning("Command failed (rc=%d): %s\nstderr: %s",
                       result.returncode, " ".join(cmd), result.stderr[:500])
        return ""
    return result.stdout


def _existing_stack_running() -> bool:
    """Return True if the Dynacule stack appears to be already running."""
    try:
        resp = requests.get(f"{BACKEND_URL}/health", timeout=3)
        return resp.status_code == 200
    except requests.RequestException:
        return False


def _wait_for_service(
    url: str, label: str, timeout: int = 90, interval: int = 3
) -> None:
    """Poll a URL repeatedly until it responds successfully."""
    deadline = time.monotonic() + timeout
    last_err = ""
    while time.monotonic() < deadline:
        try:
            resp = requests.get(url.rstrip("/") + "/health", timeout=5)
            if resp.status_code == 200:
                logger.info("%s healthy at %s", label, url)
                return
            last_err = f"status={resp.status_code}"
        except requests.RequestException as e:
            last_err = str(e)
        time.sleep(interval)
    pytest.fail(f"{label} not healthy within {timeout}s: {last_err}")


# ── Session-scoped fixtures ──────────────────────────────────────────────


@pytest.fixture(scope="session")
def compose_stack():
    """Ensure the Dynacule stack is running — spin up if not.

    Yields after the /health endpoint responds. Only tears down if
    this fixture started the stack.
    """
    already_running = _existing_stack_running()

    if already_running:
        logger.info("Dynacule stack already running — reusing.")
        yield
        return  # don't tear down what we didn't start

    # ── Startup ───────────────────────────────────────────────────────
    logger.info("Building and starting Dynacule stack via docker compose...")
    _run_capture(_compose_cmd("up", "-d", "--build", "--wait"), timeout=300)
    _wait_for_service(BACKEND_URL, "backend")
    # Allow a moment for WebSocket handler initialization
    time.sleep(2)

    yield  # tests run here

    # ── Teardown ──────────────────────────────────────────────────────
    logger.info("Tearing down Dynacule stack...")
    _run_capture(_compose_cmd("down", "-v", "--remove-orphans"), timeout=180)


@pytest.fixture(scope="session")
def api_url() -> str:
    return BACKEND_URL.rstrip("/") + "/api/v1"


@pytest.fixture(scope="session")
def ws_url() -> str:
    return WS_URL.rstrip("/") + "/ws"


@pytest.fixture(scope="session")
def frontend_url() -> str:
    return FRONTEND_URL.rstrip("/")
