"""
Integration tests for the global health check and root endpoints.
"""

import pytest
from fastapi import status


class TestHealthCheck:
    def test_health_endpoint(self, client):
        """GET /health returns healthy status."""
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "dynacule-backend"

    def test_health_is_json(self, client):
        """Health endpoint always returns JSON."""
        response = client.get("/health")
        assert response.headers["content-type"].startswith("application/json")


class TestRootEndpoint:
    def test_root_message(self, client):
        """GET / returns the welcome message with links."""
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert data["docs"] == "/docs"
        assert data["health"] == "/health"

    def test_root_is_json(self, client):
        """Root endpoint always returns JSON."""
        response = client.get("/")
        assert response.headers["content-type"].startswith("application/json")


class TestOpenAPI:
    def test_openapi_schema(self, client):
        """The OpenAPI schema is accessible at /openapi.json."""
        response = client.get("/openapi.json")
        assert response.status_code == status.HTTP_200_OK
        schema = response.json()
        assert "paths" in schema
        assert "/health" in schema["paths"]

    def test_docs_page(self, client):
        """The Swagger docs page loads successfully."""
        response = client.get("/docs")
        assert response.status_code == status.HTTP_200_OK
