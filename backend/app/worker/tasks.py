"""
Celery tasks for Dynacule backend.

IMPORTANT: Heavy compute imports (openmm_workflows, vina_docking, qm_workflows)
are done INSIDE each task function, not at module level. This allows the API
container to import this module without needing numpy/openmm/rdkit installed.
The actual compute runs on Modal.com GPU containers where those packages exist.
"""

import json
import os
import tempfile
from datetime import datetime
from pathlib import Path

from celery import current_task
from app.core.celery import celery_app
from app.models.job import Job, JobStatus
from app.core.database import SessionLocal
from app.core.redis import publish_progress_sync, publish_job_event


# ── Helper: update job progress ──────────────────────────────────────────

def _update_job(job_id: int, **kwargs):
    """Update a job record in the database."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            db.commit()
            # Publish global event for status changes
            if "status" in kwargs:
                publish_job_event(job_id, "job_update", {
                    "job_type": job.type,
                    "status": kwargs["status"],
                    "progress": kwargs.get("progress", job.progress),
                })
    finally:
        db.close()


# ── Docking Task ─────────────────────────────────────────────────────────

@celery_app.task(bind=True)
def docking_task(self, job_id: int, ligand_smiles: str, receptor_pdb_path: str,
                 center_x: float, center_y: float, center_z: float,
                 size_x: float, size_y: float, size_z: float, exhaustiveness: int = 8):
    """Perform molecular docking using AutoDock Vina.

    Runs on Modal.com GPU if MODAL_API_TOKEN is set, otherwise falls back to
    a mock result for development.
    """
    try:
        _update_job(job_id, status=JobStatus.PROCESSING, progress=0)
        publish_progress_sync(job_id, {"type": "log", "message": "Dispatching docking to Modal GPU..."})

        # Lazy import — only needed when the task actually runs
        from app.utils.vina_docking import run_vina_docking

        result = run_vina_docking(
            receptor_pdb_path=receptor_pdb_path,
            center_x=center_x, center_y=center_y, center_z=center_z,
            size_x=size_x, size_y=size_y, size_z=size_z,
            exhaustiveness=exhaustiveness,
        )

        _update_job(job_id, status=JobStatus.COMPLETED, progress=100,
                    result=json.dumps(result), completed_at=datetime.utcnow())
        publish_progress_sync(job_id, {"type": "done", "message": "Docking complete"})
        return result

    except Exception as e:
        _update_job(job_id, status=JobStatus.FAILED, error=str(e))
        publish_progress_sync(job_id, {"type": "log", "message": f"Docking failed: {e}"})
        raise


# ── Molecular Dynamics Task ─────────────────────────────────────────────

@celery_app.task(bind=True)
def md_task(self, job_id: int, pdb_content: str, forcefield: str = 'amber14-all.xml',
            solvent: str = 'tip3p', minimization_steps: int = 500,
            production_steps: int = 50000, temperature: float = 300.0):
    """Run molecular dynamics simulation using OpenMM.

    Runs on Modal.com GPU. The API container only dispatches and waits.
    """
    try:
        _update_job(job_id, status=JobStatus.PROCESSING, progress=0)
        publish_progress_sync(job_id, {"type": "log", "message": "Dispatching MD to Modal GPU..."})

        # Lazy import — openmm_workflows depends on numpy/openmm
        from app.utils.openmm_workflows import (
            generate_system_from_pdb,
            energy_minimization,
            production_md,
        )

        # Run on Modal GPU
        system, topology, positions = generate_system_from_pdb(
            pdb_file, forcefield=forcefield, solvent=solvent
        )

        # Minimize
        publish_progress_sync(job_id, {"type": "progress", "message": "Minimizing",
                                   "current": 0, "total": minimization_steps})
        minimized_positions = energy_minimization(system, positions, minimization_steps)

        # Production MD
        publish_progress_sync(job_id, {"type": "progress", "message": "MD Production",
                                   "current": 0, "total": production_steps})
        result = production_md(system, topology, minimized_positions, production_steps, temperature)

        _update_job(job_id, status=JobStatus.COMPLETED, progress=100,
                    result=json.dumps(result), completed_at=datetime.utcnow())
        publish_progress_sync(job_id, {"type": "done", "message": "MD complete"})
        return result

    except Exception as e:
        _update_job(job_id, status=JobStatus.FAILED, error=str(e))
        publish_progress_sync(job_id, {"type": "log", "message": f"MD failed: {e}"})
        raise


# ── Quantum Mechanics Task ──────────────────────────────────────────────

@celery_app.task(bind=True)
def qm_task(self, job_id: int, molecule_data: dict, task_type: str = 'single_point',
            theory: str = 'b3lyp', basis_set: str = '6-31g*',
            charge: int = 0, multiplicity: int = 1,
            software: str = 'psi4', **kwargs):
    """Run quantum mechanics calculation using Psi4 or ORCA.

    Runs on Modal.com GPU. The API container only dispatches and waits.
    """
    try:
        _update_job(job_id, status=JobStatus.PROCESSING, progress=0)
        publish_progress_sync(job_id, {"type": "log", "message": f"Dispatching QM ({software}) to Modal GPU..."})

        # Lazy import — qm_workflows depends on psi4/numpy
        from app.utils.qm_workflows import run_psi4_calculation, run_orca_calculation

        if software == 'psi4':
            result = run_psi4_calculation(
                molecule_data, task_type=task_type, theory=theory,
                basis_set=basis_set, charge=charge, multiplicity=multiplicity,
            )
        else:
            result = run_orca_calculation(
                molecule_data, task_type=task_type, theory=theory,
                basis_set=basis_set, charge=charge, multiplicity=multiplicity,
            )

        _update_job(job_id, status=JobStatus.COMPLETED, progress=100,
                    result=json.dumps(result), completed_at=datetime.utcnow())
        publish_progress_sync(job_id, {"type": "done", "message": "QM complete"})
        return result

    except Exception as e:
        _update_job(job_id, status=JobStatus.FAILED, error=str(e))
        publish_progress_sync(job_id, {"type": "log", "message": f"QM failed: {e}"})
        raise