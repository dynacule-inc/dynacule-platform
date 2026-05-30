"""
Tests for Dynacule Celery worker tasks.

Covers task dispatch, result handling, Modal stub interaction,
and error propagation for docking_task, md_task, and qm_task.
"""

import json
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.job import Job, JobStatus, Base
from app.worker.tasks import docking_task, md_task, qm_task


# ── Shared in-memory engine for both test session and task SessionLocal ───────
# We create this at module level so the same engine is available to both the
# test's db_session (via a fixture) and the task's _update_job (via a patch).
# This avoids cross-connection visibility issues with file-based SQLite.

SHARED_ENGINE = create_engine("sqlite://", connect_args={"check_same_thread": False})
SHARED_SESSION_FACTORY = sessionmaker(autocommit=False, autoflush=False, bind=SHARED_ENGINE)
Base.metadata.create_all(bind=SHARED_ENGINE)


def _get_job(session, job_id: int) -> Job | None:
    """Fetch a job by its primary key."""
    return session.query(Job).filter(Job.id == job_id).first()


def _create_job(session, job_type: str = "docking") -> Job:
    """Insert a Job fixture directly into the test DB and return it."""
    job = Job(
        job_id=f"test-{job_type}-{datetime.utcnow().timestamp()}",
        type=job_type,
        status=JobStatus.PENDING,
        progress=0,
    )
    session.add(job)
    session.commit()
    return job


# ── Global fixtures (autouse = always on) ─────────────────────────────────────

@pytest.fixture(autouse=True)
def _mock_heavy_imports():
    """Mock the compute modules imported lazily inside each Celery task."""
    patches = [
        patch("app.utils.vina_docking.run_vina_docking", return_value={
            "success": True, "energies": [-6.5, -6.2, -6.0],
            "output_pdbqt": "/tmp/output.pdbqt", "log": "/tmp/vina.log",
        }),
        patch("app.utils.openmm_workflows.generate_system_from_pdb",
              return_value=("mock_system", "mock_topology", [0.0, 0.0, 0.0])),
        patch("app.utils.openmm_workflows.energy_minimization",
              return_value=[0.0, 0.0, 0.0]),
        patch("app.utils.openmm_workflows.production_md",
              return_value={"final_energy": -1000.5, "rmsd": [0.0]}),
        patch("app.utils.qm_workflows.run_psi4_calculation",
              return_value={"success": True, "energy": -76.0}),
        patch("app.utils.qm_workflows.run_orca_calculation",
              return_value={"success": True, "energy": -75.8}),
    ]
    for p in patches:
        p.start()
    yield
    for p in patches:
        p.stop()


@pytest.fixture(autouse=True)
def _mock_publish_progress():
    """Silence Redis Pub/Sub inside worker tasks."""
    with patch("app.worker.tasks.publish_progress_sync") as mock:
        yield mock


@pytest.fixture(autouse=True)
def _patch_task_session_local():
    """Redirect the task's SessionLocal to our shared in-memory engine.

    This ensures _update_job inside the Celery task writes to the same
    in-memory SQLite database that the test fixture reads from, solving
    the cross-connection visibility issue with file-based SQLite.
    """
    with patch("app.worker.tasks.SessionLocal", SHARED_SESSION_FACTORY):
        yield


@pytest.fixture
def session():
    """Yield a fresh DB session backed by the shared in-memory engine.

    Because SessionLocal used inside the tasks is patched to also use this
    same engine, writes from the task are immediately visible from this
    session (and vice versa).
    """
    s = SHARED_SESSION_FACTORY()
    yield s
    s.close()


# ═══════════════════════════════════════════════════════════════════════════════
# Docking Task
# ═══════════════════════════════════════════════════════════════════════════════

class TestDockingTask:
    """docking_task: dispatch, result handling, error propagation."""

    def test_returns_result_dict(self, session):
        """docking_task returns the docking result dict."""
        result = docking_task(
            _create_job(session).id,
            ligand_smiles="CCO", receptor_pdb_path="/tmp/receptor.pdb",
            center_x=0.0, center_y=0.0, center_z=0.0,
            size_x=20.0, size_y=20.0, size_z=20.0, exhaustiveness=8,
        )
        assert isinstance(result, dict)
        assert result["success"] is True
        assert "energies" in result

    def test_publishes_progress_messages(self, session, _mock_publish_progress):
        """docking_task publishes a 'log' message on start and 'done' on success."""
        docking_task(
            _create_job(session).id,
            ligand_smiles="CCO", receptor_pdb_path="/tmp/receptor.pdb",
            center_x=0.0, center_y=0.0, center_z=0.0,
            size_x=20.0, size_y=20.0, size_z=20.0, exhaustiveness=8,
        )
        calls = _mock_publish_progress.call_args_list
        types = [call[0][1]["type"] for call in calls]
        assert "log" in types
        assert "done" in types

    def test_error_publishes_log_message(self, session, _mock_publish_progress):
        """Failure publishes a log message with the error."""
        with patch("app.utils.vina_docking.run_vina_docking",
                   side_effect=ValueError("bad ligand")):
            with pytest.raises(ValueError):
                docking_task(
                    _create_job(session).id,
                    ligand_smiles="INVALID", receptor_pdb_path="/tmp/receptor.pdb",
                    center_x=0.0, center_y=0.0, center_z=0.0,
                    size_x=20.0, size_y=20.0, size_z=20.0, exhaustiveness=8,
                )
        last_call = _mock_publish_progress.call_args_list[-1]
        last_msg = last_call[0][1]
        assert last_msg["type"] == "log"
        assert "bad ligand" in last_msg["message"]

    def test_forwards_exhaustiveness(self, session):
        """Exhaustiveness parameter reaches the compute function."""
        with patch("app.utils.vina_docking.run_vina_docking") as mock_dock:
            mock_dock.return_value = {"success": True, "energies": []}
            docking_task(
                _create_job(session).id,
                ligand_smiles="CCO", receptor_pdb_path="/tmp/receptor.pdb",
                center_x=0.0, center_y=0.0, center_z=0.0,
                size_x=20.0, size_y=20.0, size_z=20.0, exhaustiveness=16,
            )
        mock_dock.assert_called_once()
        _, kwargs = mock_dock.call_args
        assert kwargs["exhaustiveness"] == 16

    def test_updates_db_on_success(self, session):
        """docking_task writes COMPLETED + JSON result to DB."""
        job = _create_job(session)
        docking_task(
            job.id,
            ligand_smiles="CCO", receptor_pdb_path="/tmp/receptor.pdb",
            center_x=0.0, center_y=0.0, center_z=0.0,
            size_x=20.0, size_y=20.0, size_z=20.0, exhaustiveness=8,
        )
        session.expire_all()
        updated = _get_job(session, job.id)
        assert updated.status == JobStatus.COMPLETED
        assert updated.progress == 100
        assert updated.completed_at is not None
        stored = json.loads(updated.result)
        assert stored["success"] is True

    def test_updates_db_on_failure(self, session):
        """docking_task writes FAILED + error to DB when compute raises."""
        job = _create_job(session)
        with patch("app.utils.vina_docking.run_vina_docking",
                   side_effect=RuntimeError("Vina crashed")):
            with pytest.raises(RuntimeError, match="Vina crashed"):
                docking_task(
                    job.id,
                    ligand_smiles="CCO", receptor_pdb_path="/tmp/receptor.pdb",
                    center_x=0.0, center_y=0.0, center_z=0.0,
                    size_x=20.0, size_y=20.0, size_z=20.0, exhaustiveness=8,
                )
        session.expire_all()
        updated = _get_job(session, job.id)
        assert updated.status == JobStatus.FAILED
        assert "Vina crashed" in updated.error


# ═══════════════════════════════════════════════════════════════════════════════
# Molecular Dynamics Task
# ═══════════════════════════════════════════════════════════════════════════════

class TestMDTask:
    """md_task: dispatch, progress publishing, error handling."""

    def test_returns_result_dict(self, session):
        """md_task returns the simulation result dict."""
        result = md_task(
            _create_job(session, "md").id,
            pdb_file="/tmp/test.pdb",
            forcefield="amber14-all.xml", solvent="tip3p",
            minimization_steps=500, production_steps=50000, temperature=300.0,
        )
        assert isinstance(result, dict)
        assert "final_energy" in result

    def test_publishes_md_lifecycle_progress(self, session, _mock_publish_progress):
        """md_task publishes log + progress + done messages."""
        md_task(
            _create_job(session, "md").id,
            pdb_file="/tmp/test.pdb",
            minimization_steps=500, production_steps=50000,
        )
        types = [call[0][1]["type"] for call in _mock_publish_progress.call_args_list]
        assert "log" in types
        assert "progress" in types
        assert "done" in types

    def test_forwards_minimization_steps(self, session):
        """The minimization_steps parameter reaches energy_minimization."""
        with patch("app.utils.openmm_workflows.energy_minimization") as mock_em:
            mock_em.return_value = [0.0, 0.0, 0.0]
            md_task(
                _create_job(session, "md").id,
                pdb_file="/tmp/test.pdb",
                minimization_steps=200, production_steps=10000,
            )
        mock_em.assert_called_once()
        args, _ = mock_em.call_args
        assert args[2] == 200  # minimization_steps is 3rd positional arg

    def test_updates_db_on_success(self, session):
        """md_task writes COMPLETED + JSON result to DB."""
        job = _create_job(session, "md")
        md_task(
            job.id, pdb_file="/tmp/test.pdb",
            minimization_steps=500, production_steps=50000,
        )
        session.expire_all()
        updated = _get_job(session, job.id)
        assert updated.status == JobStatus.COMPLETED
        assert updated.progress == 100
        stored = json.loads(updated.result)
        assert "final_energy" in stored

    def test_updates_db_on_failure(self, session):
        """md_task writes FAILED + error to DB when compute raises."""
        job = _create_job(session, "md")
        with patch("app.utils.openmm_workflows.generate_system_from_pdb",
                   side_effect=RuntimeError("PDB parse error")):
            with pytest.raises(RuntimeError, match="PDB parse error"):
                md_task(job.id, pdb_file="/tmp/bad.pdb")
        session.expire_all()
        updated = _get_job(session, job.id)
        assert updated.status == JobStatus.FAILED
        assert "PDB parse error" in updated.error


# ═══════════════════════════════════════════════════════════════════════════════
# Quantum Mechanics Task
# ═══════════════════════════════════════════════════════════════════════════════

class TestQMTask:
    """qm_task: software routing, result handling, error handling."""

    MOLECULE_DATA = {
        "symbols": ["O", "H", "H"],
        "coordinates": [[0.0, 0.0, 0.117], [0.0, 0.757, -0.469], [0.0, -0.757, -0.469]],
    }

    def test_routes_to_psi4(self, session):
        """qm_task with software='psi4' calls run_psi4_calculation."""
        with patch("app.utils.qm_workflows.run_psi4_calculation") as mock_psi4:
            mock_psi4.return_value = {"success": True, "energy": -76.0}
            result = qm_task(
                _create_job(session, "qm").id,
                molecule_data=self.MOLECULE_DATA,
                task_type="single_point", theory="b3lyp",
                basis_set="6-31g*", charge=0, multiplicity=1,
                software="psi4",
            )
        mock_psi4.assert_called_once()
        assert result["energy"] == -76.0

    def test_routes_to_orca(self, session):
        """qm_task with software='orca' calls run_orca_calculation."""
        with patch("app.utils.qm_workflows.run_orca_calculation") as mock_orca:
            mock_orca.return_value = {"success": True, "energy": -75.8}
            result = qm_task(
                _create_job(session, "qm").id,
                molecule_data=self.MOLECULE_DATA,
                task_type="single_point", theory="b3lyp",
                basis_set="6-31g*", charge=0, multiplicity=1,
                software="orca",
            )
        mock_orca.assert_called_once()
        assert result["energy"] == -75.8

    def test_returns_result_dict(self, session):
        """qm_task returns the QM calculation result."""
        result = qm_task(
            _create_job(session, "qm").id,
            molecule_data=self.MOLECULE_DATA,
            software="psi4",
        )
        assert isinstance(result, dict)
        assert "energy" in result

    def test_publishes_progress_messages(self, session, _mock_publish_progress):
        """qm_task publishes log and done messages."""
        qm_task(
            _create_job(session, "qm").id,
            molecule_data=self.MOLECULE_DATA,
            software="psi4",
        )
        types = [call[0][1]["type"] for call in _mock_publish_progress.call_args_list]
        assert "log" in types
        assert "done" in types

    def test_updates_db_on_success(self, session):
        """qm_task writes COMPLETED + JSON result to DB."""
        job = _create_job(session, "qm")
        qm_task(
            job.id,
            molecule_data=self.MOLECULE_DATA,
            software="psi4",
        )
        session.expire_all()
        updated = _get_job(session, job.id)
        assert updated.status == JobStatus.COMPLETED
        assert updated.progress == 100
        stored = json.loads(updated.result)
        assert stored["energy"] == -76.0

    def test_updates_db_on_failure(self, session):
        """qm_task writes FAILED + error to DB when compute raises."""
        job = _create_job(session, "qm")
        with patch("app.utils.qm_workflows.run_psi4_calculation",
                   side_effect=RuntimeError("SCF did not converge")):
            with pytest.raises(RuntimeError, match="SCF did not converge"):
                qm_task(
                    job.id,
                    molecule_data=self.MOLECULE_DATA,
                    software="psi4",
                )
        session.expire_all()
        updated = _get_job(session, job.id)
        assert updated.status == JobStatus.FAILED
        assert "SCF did not converge" in updated.error


# ═══════════════════════════════════════════════════════════════════════════════
# Cross-cutting Concerns
# ═══════════════════════════════════════════════════════════════════════════════

class TestErrorHandling:
    """Edge cases common to all worker tasks."""

    def test_nonexistent_job_does_not_crash(self, session):
        """When job_id does not exist, _update_job no-ops and compute still runs."""
        result = docking_task(
            job_id=99999,
            ligand_smiles="CCO", receptor_pdb_path="/tmp/receptor.pdb",
            center_x=0.0, center_y=0.0, center_z=0.0,
            size_x=20.0, size_y=20.0, size_z=20.0,
        )
        assert isinstance(result, dict)

    def test_high_exhaustiveness_accepted(self, session):
        """Exhaustiveness=64 is forwarded without error."""
        with patch("app.utils.vina_docking.run_vina_docking") as mock_dock:
            mock_dock.return_value = {"success": True}
            docking_task(
                _create_job(session).id,
                ligand_smiles="CCO", receptor_pdb_path="/tmp/receptor.pdb",
                center_x=0.0, center_y=0.0, center_z=0.0,
                size_x=20.0, size_y=20.0, size_z=20.0, exhaustiveness=64,
            )
        assert mock_dock.call_args[1]["exhaustiveness"] == 64