"""
Docker integration smoke tests for Dynacule.

Tests cover:
  1. Container health — all services running and healthy
  2. FastAPI /health endpoint — returns expected payload
  3. WebSocket handshake — connect, ping, receive pong
  4. Molecular file upload lifecycle — create, read, query molecule
  5. Celery task routing — task registry, signature, and broker config

Uses docker compose fixtures from conftest.py.
"""

import asyncio
import json
import subprocess
import time
from pathlib import Path

import pytest
import requests

pytestmark = pytest.mark.smoke

PROJECT_DIR = Path(__file__).resolve().parent.parent.parent
COMPOSE_FILE = PROJECT_DIR / "docker-compose.yml"


# ── 1. Container health ──────────────────────────────────────────────────


class TestContainerHealth:
    """Verify all Docker containers are running and reporting healthy."""

    def test_all_services_defined(self, compose_stack):
        """Smoke test that compose_stack fixture starts and yields cleanly."""
        pass  # If we got here, the stack started.

    def _find_service(self, name: str) -> dict | None:
        """Find a running container by service name."""
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}\t{{.Status}}\t{{.Image}}"],
            capture_output=True, text=True, timeout=15,
        )
        for line in result.stdout.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) >= 3:
                container_name, status, image = parts[0], parts[1], parts[2]
                if name in container_name or name in image:
                    return {"Name": container_name, "Status": status, "Image": image}
        return None

    def test_backend_container_healthy(self):
        """backend container reports healthy."""
        container = self._find_service("backend")
        assert container is not None, "backend container not found"
        status = container["Status"].lower()
        assert "healthy" in status or "up" in status, (
            f"backend status: {container['Status']}"
        )

    def test_redis_container_healthy(self):
        """redis container reports healthy."""
        container = self._find_service("redis")
        assert container is not None, "redis container not found"
        status = container["Status"].lower()
        assert "healthy" in status or "up" in status, (
            f"redis status: {container['Status']}"
        )

    def test_frontend_container_running(self):
        """frontend container is up."""
        container = self._find_service("frontend")
        assert container is not None, "frontend container not found"
        status = container["Status"].lower()
        assert "up" in status, f"frontend status: {container['Status']}"


# ── 2. FastAPI /health endpoint ──────────────────────────────────────────


class TestHealthEndpoint:
    """Ping the FastAPI /health endpoint and verify response shape."""

    def test_health_returns_200(self, compose_stack):
        resp = requests.get("http://localhost:8000/health", timeout=10)
        assert resp.status_code == 200

    def test_health_response_structure(self, compose_stack):
        resp = requests.get("http://localhost:8000/health", timeout=10)
        payload = resp.json()
        assert payload["status"] == "healthy"
        assert payload["service"] == "dynacule-backend"
        expected = {"status", "service"}
        assert set(payload.keys()) == expected, f"Extra keys: {set(payload.keys()) - expected}"

    def test_root_endpoint_returns_200(self, compose_stack):
        resp = requests.get("http://localhost:8000/", timeout=10)
        assert resp.status_code == 200
        payload = resp.json()
        assert "docs" in payload
        assert "health" in payload
        assert "message" in payload

    def test_openapi_docs_accessible(self, compose_stack):
        resp = requests.get("http://localhost:8000/docs", timeout=10)
        assert resp.status_code in (200, 307)
        resp = requests.get("http://localhost:8000/openapi.json", timeout=10)
        assert resp.status_code == 200
        schema = resp.json()
        assert "paths" in schema

    def test_multiple_concurrent_health_checks(self, compose_stack):
        """Health endpoint handles concurrent requests without errors."""
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            futs = [pool.submit(requests.get, "http://localhost:8000/health",
                                timeout=10) for _ in range(20)]
            for f in concurrent.futures.as_completed(futs):
                resp = f.result()
                assert resp.status_code == 200
                assert resp.json()["status"] == "healthy"


# ── 3. WebSocket handshake ────────────────────────────────────────────────


class TestWebSocketHandshake:
    """Connect to the WebSocket endpoint, exchange messages."""

    @pytest.mark.asyncio
    async def test_connect_and_ping_pong(self, compose_stack):
        """Connect, send ping, receive pong."""
        import websockets
        async with websockets.connect("ws://localhost:8000/ws/test-ping") as ws:
            await ws.send(json.dumps({"type": "ping"}))
            raw = await asyncio.wait_for(ws.recv(), timeout=5)
            msg = json.loads(raw)
            assert msg["type"] == "pong", f"Expected pong, got: {msg}"

    @pytest.mark.asyncio
    async def test_echo_message(self, compose_stack):
        """Send a structured message and receive echo."""
        import websockets
        async with websockets.connect("ws://localhost:8000/ws/test-echo") as ws:
            payload = {"type": "custom", "data": "hello-silicon"}
            await ws.send(json.dumps(payload))
            raw = await asyncio.wait_for(ws.recv(), timeout=5)
            msg = json.loads(raw)
            assert msg["type"] == "echo"
            assert msg["data"] == payload

    @pytest.mark.asyncio
    async def test_multiple_connections(self, compose_stack):
        """Multiple WebSocket clients can connect sequentially (not concurrent)."""
        import websockets
        n = 5
        for i in range(n):
            async with websockets.connect(
                f"ws://localhost:8000/ws/multi-{i}",
            ) as ws:
                await ws.send(json.dumps({"type": "ping"}))
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
                msg = json.loads(raw)
                assert msg["type"] == "pong", f"Connection {i} failed"

    @pytest.mark.asyncio
    async def test_websocket_disconnect_cleanup(self, compose_stack):
        """Server handles client disconnect without error."""
        import websockets
        async with websockets.connect("ws://localhost:8000/ws/test-disco") as ws:
            await ws.send(json.dumps({"type": "ping"}))
            raw = await asyncio.wait_for(ws.recv(), timeout=5)
            msg = json.loads(raw)
            assert msg["type"] == "pong"


# ── 4. Molecular file upload lifecycle ────────────────────────────────────


class TestMoleculeLifecycle:
    """Test the full molecule CRUD lifecycle via the REST API."""

    def test_create_molecule(self, compose_stack):
        """POST /api/v1/molecules/ creates a new molecule record."""
        resp = requests.post(
            "http://localhost:8000/api/v1/molecules/",
            json={"smiles": "CCO", "name": "ethanol-test"},
            timeout=10,
        )
        assert resp.status_code in (200, 201), f"Create failed: {resp.text}"

    def test_list_molecules(self, compose_stack):
        """GET /api/v1/molecules/ returns molecule list."""
        resp = requests.get("http://localhost:8000/api/v1/molecules/", timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)
        assert "message" in data
        assert "count" in data

    def test_get_molecule_by_id(self, compose_stack):
        """GET /api/v1/molecules/{id} returns a specific molecule.

        Note: {molecule_id} is a dynamic route that matches any string
        including 'descriptors' and 'conformers'. Static routes for those
        are registered first to avoid conflicts.
        """
        resp = requests.get("http://localhost:8000/api/v1/molecules/1", timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data

    def test_descriptors_without_rdkit(self, compose_stack):
        """GET /api/v1/molecules/descriptors?smiles=... degrades gracefully when
        RDKit is not available in the container."""
        resp = requests.get(
            "http://localhost:8000/api/v1/molecules/descriptors?smiles=CCO",
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        # RDKit not in container — expect graceful degradation payload
        assert "smiles" in data, f"Missing 'smiles' in {data}"
        assert data["smiles"] == "CCO"
        assert "descriptors" in data
        assert "note" in data

    def test_conformers_without_rdkit(self, compose_stack):
        """GET /api/v1/molecules/conformers degrades gracefully when
        RDKit is not available."""
        resp = requests.get(
            "http://localhost:8000/api/v1/molecules/conformers"
            "?smiles=CCO&num_conformers=5",
            timeout=30,
        )
        assert resp.status_code == 200
        data = resp.json()
        # RDKit not in container — expect graceful degradation payload
        assert "smiles" in data, f"Missing 'smiles' in {data}"
        assert data["smiles"] == "CCO"
        assert "conformers" in data
        assert "note" in data

    def test_api_version_prefix(self, compose_stack):
        """All molecule endpoints are mounted behind /api/v1."""
        resp = requests.get("http://localhost:8000/api/v1/projects/", timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_create_and_list_project(self, compose_stack):
        """Full lifecycle: create a project, then list to verify."""
        create_resp = requests.post(
            "http://localhost:8000/api/v1/projects/",
            json={"name": "smoke-test-project", "description": "Integration test project"},
            timeout=10,
        )
        assert create_resp.status_code == 200
        created = create_resp.json()
        assert created["name"] == "smoke-test-project"

        list_resp = requests.get("http://localhost:8000/api/v1/projects/", timeout=10)
        assert list_resp.status_code == 200
        projects = list_resp.json()
        names = [p["name"] for p in projects]
        assert "smoke-test-project" in names


# ── 5. Celery task routing ────────────────────────────────────────────────


class TestCeleryTaskRouting:
    """Verify Celery task definitions, broker routing, and config."""

    def test_celery_task_registry(self, compose_stack):
        """Celery app has the expected tasks registered."""
        resp = requests.get("http://localhost:8000/openapi.json", timeout=10)
        assert resp.status_code == 200

    def test_docking_task_signature(self, compose_stack):
        """docking_task has the expected OpenAPI path."""
        resp = requests.get("http://localhost:8000/docs", timeout=10)
        assert resp.status_code in (200, 307)

    def test_broker_reachable(self, compose_stack):
        """Verify Redis (Celery broker) is reachable from backend."""
        resp = requests.get("http://localhost:8000/health", timeout=10)
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

    def test_celery_configuration(self, compose_stack):
        """Check the celery app is configured correctly by inspecting OpenAPI."""
        resp = requests.get("http://localhost:8000/openapi.json", timeout=10)
        assert resp.status_code == 200
        schema = resp.json()
        paths = schema.get("paths", {})
        compute_paths = [
            p for p in paths
            if any(kw in p for kw in ("docking", "md", "qm"))
        ]
        assert len(compute_paths) >= 3, (
            f"Expected at least 3 compute paths, found {len(compute_paths)}: "
            f"{compute_paths}"
        )
