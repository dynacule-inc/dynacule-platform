"""
Tests for Dynacule backend API endpoints.

Run with: pytest backend/test_api.py -v
Or via Docker: docker compose exec backend pytest app/test_api.py -v
"""

import os
import sys
import tempfile

# Ensure the backend app is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "app"))

from fastapi.testclient import TestClient
from app.main import app
from app.models.job import Base
from app.core.database import engine

# Initialize database tables for testing
Base.metadata.create_all(bind=engine)

client = TestClient(app)


# ── Health ───────────────────────────────────────────────────────────────

def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "dynacule-backend"


def test_root():
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert "docs" in data


# ── Projects ─────────────────────────────────────────────────────────────

def test_list_projects():
    resp = client.get("/api/v1/projects/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_project():
    resp = client.post(
        "/api/v1/projects/",
        json={"name": "Test Project", "description": "A test project"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Project"
    assert "id" in data


# ── Molecules ────────────────────────────────────────────────────────────

def test_create_molecule_from_smiles():
    resp = client.post(
        "/api/v1/molecules/smiles",
        data={"smiles": "CCO", "name": "Ethanol"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Ethanol"
    assert data["smiles"] == "CCO"
    assert data["source"] == "smiles"
    assert "id" in data
    return data["id"]


def test_list_molecules():
    resp = client.get("/api/v1/molecules/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_molecule_pdb():
    # First create one
    create_resp = client.post(
        "/api/v1/molecules/smiles",
        data={"smiles": "CCO", "name": "PDB Test"},
    )
    mol_id = create_resp.json()["id"]

    resp = client.get(f"/api/v1/molecules/{mol_id}/pdb")
    assert resp.status_code == 200
    data = resp.json()
    assert "pdb" in data
    assert data["name"] == "PDB Test"
    assert data["pdb"].startswith("HEADER") or data["pdb"].startswith("ATOM")


def test_get_molecule_descriptors():
    create_resp = client.post(
        "/api/v1/molecules/smiles",
        data={"smiles": "CCO"},
    )
    mol_id = create_resp.json()["id"]

    resp = client.get(f"/api/v1/molecules/{mol_id}/descriptors")
    assert resp.status_code == 200
    data = resp.json()
    assert "descriptors" in data
    assert "MolWt" in data["descriptors"]
    assert "LogP" in data["descriptors"]


def test_upload_molecule_pdb():
    pdb_content = (
        "ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00  0.00           N\n"
        "ATOM      2  CA  ALA A   1       1.458   0.000   0.000  1.00  0.00           C\n"
        "END\n"
    )
    resp = client.post(
        "/api/v1/molecules/upload",
        files={"file": ("test.pdb", pdb_content, "text/plain")},
        data={"name": "Uploaded Test"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Uploaded Test"
    assert data["source"] == "pdb"


def test_molecule_descriptors_endpoint():
    resp = client.get("/api/v1/molecules/descriptors?smiles=CCO")
    assert resp.status_code == 200
    data = resp.json()
    assert data["smiles"] == "CCO"
    # RDKit may or may not be available, but the endpoint should still respond
    assert "descriptors" in data or "note" in data


def test_molecule_conformers_endpoint():
    resp = client.get("/api/v1/molecules/conformers?smiles=CCO&num_conformers=5")
    assert resp.status_code == 200


# ── Jobs ─────────────────────────────────────────────────────────────────

def test_list_jobs():
    resp = client.get("/api/v1/jobs/")
    assert resp.status_code == 200
    data = resp.json()
    assert "jobs" in data
    assert "total" in data


def test_job_stats():
    resp = client.get("/api/v1/jobs/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "by_status" in data
    assert "by_type" in data


# ── Docking ──────────────────────────────────────────────────────────────

def test_create_docking_job():
    resp = client.post(
        "/api/v1/docking/",
        json={
            "ligand_smiles": "CCO",
            "receptor_pdb_path": "/tmp/receptor.pdb",
            "center_x": 0.0,
            "center_y": 0.0,
            "center_z": 0.0,
            "size_x": 20.0,
            "size_y": 20.0,
            "size_z": 20.0,
            "exhaustiveness": 8,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "pending"
    assert "job_id" in data


# ── MD ───────────────────────────────────────────────────────────────────

def test_create_md_job():
    resp = client.post(
        "/api/v1/md/",
        json={
            "pdb_content": (
                "ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00  0.00           N\n"
                "ATOM      2  CA  ALA A   1       1.458   0.000   0.000  1.00  0.00           C\n"
                "END\n"
            ),
            "forcefield": "amber14-all.xml",
            "production_steps": 100,
            "temperature": 300.0,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "pending"


# ── QM ──────────────────────────────────────────────────────────────────

def test_create_qm_job():
    resp = client.post(
        "/api/v1/qm/",
        json={
            "molecule_data": {
                "symbols": ["H", "H", "O"],
                "coordinates": [[0, 0, 0], [0, 0.757, 0.586], [0, 0, 0.586]],
            },
            "task_type": "single_point",
            "theory": "b3lyp",
            "basis_set": "6-31g*",
            "charge": 0,
            "multiplicity": 1,
            "software": "psi4",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "pending"