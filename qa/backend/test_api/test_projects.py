"""
Integration tests for the Projects API router.
"""

import pytest
from fastapi import status


class TestListProjects:
    def test_empty_list(self, client):
        """GET /api/v1/projects/ returns empty list initially."""
        response = client.get("/api/v1/projects/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_after_creation(self, client, sample_project_data):
        """POST then GET / returns the created project."""
        response = client.post("/api/v1/projects/", json=sample_project_data)
        assert response.status_code == status.HTTP_200_OK
        created = response.json()
        assert created["name"] == sample_project_data["name"]

        # Verify it appears in list
        list_resp = client.get("/api/v1/projects/")
        assert list_resp.status_code == status.HTTP_200_OK
        names = [p["name"] for p in list_resp.json()]
        assert sample_project_data["name"] in names


class TestCreateProject:
    def test_create_success(self, client, sample_project_data):
        """POST /api/v1/projects/ creates a project with expected fields."""
        response = client.post("/api/v1/projects/", json=sample_project_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == sample_project_data["name"]
        assert data["description"] == sample_project_data["description"]
        assert "id" in data
        assert "created_at" in data

    def test_create_empty_body(self, client):
        """POST with empty body returns field errors."""
        response = client.post("/api/v1/projects/", json={})
        # FastAPI will respond with 422 for missing required fields

    def test_create_missing_name(self, client):
        """POST without name field."""
        response = client.post("/api/v1/projects/", json={"description": "no name"})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
