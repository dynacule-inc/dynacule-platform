"""
Integration tests for the Molecular Dynamics (MD) API router.
"""

import pytest
from fastapi import status


class TestCreateMDJob:
    def test_create_success(self, client, sample_md_request):
        """POST /api/v1/md/ creates an MD job."""
        response = client.post("/api/v1/md/", json=sample_md_request)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "job_id" in data
        assert data["status"] == "pending"
        assert "molecular dynamics" in data["message"].lower()

    def test_create_invalid_payload(self, client):
        """POST with missing fields returns 422."""
        response = client.post("/api/v1/md/", json={})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_empty_pdb(self, client):
        """POST with empty pdb_content."""
        payload = {"pdb_content": ""}
        response = client.post("/api/v1/md/", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestGetMDJob:
    def test_get_nonexistent(self, client):
        """GET /api/v1/md/{id} for non-existent job returns 404."""
        response = client.get("/api/v1/md/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_after_create(self, client, sample_md_request):
        """GET returns the created job."""
        create_resp = client.post("/api/v1/md/", json=sample_md_request)
        assert create_resp.status_code == status.HTTP_200_OK
        job_id = create_resp.json()["job_id"]

        get_resp = client.get(f"/api/v1/md/{job_id}")
        assert get_resp.status_code == status.HTTP_200_OK
        assert get_resp.json()["job_id"] == job_id

    def test_get_string_id(self, client):
        """GET with non-integer ID returns 404 or 422."""
        response = client.get("/api/v1/md/abc")
        # FastAPI path param validation for int
        assert response.status_code in (
            status.HTTP_404_NOT_FOUND,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


class TestListMDJobs:
    def test_list_empty(self, client):
        """GET /api/v1/md/ returns empty list when no jobs exist."""
        response = client.get("/api/v1/md/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "jobs" in data
        assert isinstance(data["jobs"], list)

    def test_list_with_jobs(self, client, sample_md_request):
        """After creating a job, it appears in the list."""
        client.post("/api/v1/md/", json=sample_md_request)
        response = client.get("/api/v1/md/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()["jobs"]) > 0


class TestMDValidation:
    def test_invalid_forcefield(self, client):
        """Non-standard forcefield values."""
        payload = {
            "pdb_content": "ATOM      1  N   ALA A   1       0.0   0.0   0.0  1.00  0.00           N\n",
            "forcefield": "nonexistent.xml",
            "solvent": "tip3p",
            "production_steps": 100,
        }
        # Should still be accepted at the API layer (validation happens in the task)
        response = client.post("/api/v1/md/", json=payload)
        assert response.status_code == status.HTTP_200_OK