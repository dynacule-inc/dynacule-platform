"""
Integration tests for the Quantum Mechanics (QM) API router.
"""

import pytest
from fastapi import status


class TestCreateQMJob:
    def test_create_success(self, client, sample_qm_request):
        """POST /api/v1/qm/ creates a QM job."""
        response = client.post("/api/v1/qm/", json=sample_qm_request)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "job_id" in data
        assert data["status"] == "pending"
        assert "quantum" in data["message"].lower()

    def test_create_empty_payload(self, client):
        """POST with empty body returns 422."""
        response = client.post("/api/v1/qm/", json={})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_orca_software(self, client, sample_qm_request):
        """POST with software='orca' still creates successfully."""
        payload = dict(sample_qm_request)
        payload["software"] = "orca"
        response = client.post("/api/v1/qm/", json=payload)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "pending"

    def test_create_minimal_payload(self, client):
        """POST with only required fields."""
        payload = {
            "molecule_data": {
                "symbols": ["O", "H", "H"],
                "coordinates": [[0, 0, 0], [0, 0, 1], [0, 0, -1]],
            },
        }
        response = client.post("/api/v1/qm/", json=payload)
        assert response.status_code == status.HTTP_200_OK


class TestGetQMJob:
    def test_get_nonexistent(self, client):
        """GET /api/v1/qm/{id} for non-existent job returns 404."""
        response = client.get("/api/v1/qm/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_after_create(self, client, sample_qm_request):
        """GET returns the created job."""
        create_resp = client.post("/api/v1/qm/", json=sample_qm_request)
        assert create_resp.status_code == status.HTTP_200_OK
        job_id = create_resp.json()["job_id"]

        get_resp = client.get(f"/api/v1/qm/{job_id}")
        assert get_resp.status_code == status.HTTP_200_OK
        assert get_resp.json()["job_id"] == job_id


class TestListQMJobs:
    def test_list_empty(self, client):
        """GET /api/v1/qm/ returns empty list when no jobs exist."""
        response = client.get("/api/v1/qm/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "jobs" in data
        assert isinstance(data["jobs"], list)

    def test_list_with_jobs(self, client, sample_qm_request):
        """After creating a job, it appears in the list."""
        client.post("/api/v1/qm/", json=sample_qm_request)
        response = client.get("/api/v1/qm/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()["jobs"]) > 0


class TestQMValidation:
    def test_invalid_task_type(self, client):
        """Edge case: invalid task_type is accepted at API level."""
        payload = {
            "molecule_data": {
                "symbols": ["O", "H", "H"],
                "coordinates": [[0, 0, 0], [0, 0, 1], [0, 0, -1]],
            },
            "task_type": "invalid_task_xyz",
        }
        response = client.post("/api/v1/qm/", json=payload)
        assert response.status_code == status.HTTP_200_OK
