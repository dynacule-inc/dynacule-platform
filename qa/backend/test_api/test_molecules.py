"""
Integration tests for the Molecules API router.
"""

import pytest
from fastapi import status


class TestGetMolecules:
    def test_list_molecules(self, client):
        """GET /api/v1/molecules/ returns the placeholder response."""
        response = client.get("/api/v1/molecules/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert data["count"] == 0


class TestCreateMolecule:
    def test_create_molecule(self, client):
        """POST /api/v1/molecules/ returns the placeholder response."""
        response = client.post("/api/v1/molecules/")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["message"] == "Create molecule endpoint — ready"


class TestGetMoleculeById:
    def test_get_existing(self, client):
        """GET /api/v1/molecules/{id} returns molecule info."""
        response = client.get("/api/v1/molecules/test123")
        assert response.status_code == status.HTTP_200_OK
        assert "test123" in response.json()["message"]


class TestDescriptors:
    def test_valid_smiles_returns_descriptors(self, client, sample_smiles):
        """GET /api/v1/molecules/descriptors?smiles=CCO returns descriptor dict."""
        response = client.get(
            "/api/v1/molecules/descriptors",
            params={"smiles": sample_smiles},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["smiles"] == sample_smiles
        assert "descriptors" in data
        # Without RDKit, it should return the graceful degradation
        if not data["descriptors"]:
            assert "note" in data

    def test_invalid_smiles(self, client, sample_invalid_smiles):
        """GET with invalid SMILES returns 400."""
        response = client.get(
            "/api/v1/molecules/descriptors",
            params={"smiles": sample_invalid_smiles},
        )
        # Either 400 (RDKit available) or 200 with empty descriptors (graceful)
        assert response.status_code in (
            status.HTTP_200_OK,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_missing_smiles_param(self, client):
        """GET without required SMILES param returns 422."""
        response = client.get("/api/v1/molecules/descriptors")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestConformers:
    def test_valid_smiles(self, client):
        """GET /api/v1/molecules/conformers with valid SMILES."""
        response = client.get(
            "/api/v1/molecules/conformers",
            params={"smiles": "CCO", "num_conformers": 5},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["smiles"] == "CCO"

    def test_conformer_range_validation(self, client):
        """num_conformers must be between 1 and 100."""
        response = client.get(
            "/api/v1/molecules/conformers",
            params={"smiles": "CCO", "num_conformers": 200},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY