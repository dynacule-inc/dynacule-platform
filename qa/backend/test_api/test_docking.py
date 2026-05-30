"""
Integration tests for the Docking API router.
"""

import pytest
from fastapi import status


class TestCreateDockingJob:
    def test_create_success(self, client, sample_docking_request):
        """POST /api/v1/docking/ creates a docking job."""
        response = client.post("/api/v1/docking/", json=sample_docking_request)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "job_id" in data
        assert data["status"] == "pending"
        assert "message" in data

    def test_create_invalid_payload(self, client):
        """POST with missing required fields returns 422."""
        response = client.post("/api/v1/docking/", json={})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_partial_payload(self, client):
        """POST with missing coordinate fields."""
        payload = {
            "ligand_smiles": "CCO",
            "receptor_pdb_path": "/tmp/receptor.pdb",
        }
        response = client.post("/api/v1/docking/", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestGetDockingJob:
    def test_get_nonexistent_job(self, client):
        """GET /api/v1/docking/{id} for non-existent job returns 404."""
        response = client.get("/api/v1/docking/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_after_create(self, client, sample_docking_request):
        """GET returns the created job's status."""
        create_resp = client.post("/api/v1/docking/", json=sample_docking_request)
        assert create_resp.status_code == status.HTTP_200_OK
        job_id = create_resp.json()["job_id"]

        get_resp = client.get(f"/api/v1/docking/{job_id}")
        assert get_resp.status_code == status.HTTP_200_OK
        assert get_resp.json()["job_id"] == job_id


class TestListDockingJobs:
    def test_list_empty(self, client):
        """GET /api/v1/docking/ returns empty list when no jobs exist."""
        response = client.get("/api/v1/docking/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "jobs" in data
        assert isinstance(data["jobs"], list)

    def test_list_with_jobs(self, client, sample_docking_request):
        """After creating a job, it appears in the list."""
        client.post("/api/v1/docking/", json=sample_docking_request)
        response = client.get("/api/v1/docking/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()["jobs"]) > 0


class TestDockingValidation:
    def test_negative_exhaustiveness(self, client):
        """Exhaustiveness must be positive."""
        payload = {
            "ligand_smiles": "CCO",
            "receptor_pdb_path": "/tmp/receptor.pdb",
            "center_x": 0.0,
            "center_y": 0.0,
            "center_z": 0.0,
            "size_x": 20.0,
            "size_y": 20.0,
            "size_z": 20.0,
            "exhaustiveness": -1,
        }
        response = client.post("/api/v1/docking/", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY