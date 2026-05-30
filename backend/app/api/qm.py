"""Router for quantum mechanics-related endpoints."""

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uuid
import os
import tempfile
import json
from app.core.celery import celery_app
from app.worker.tasks import qm_task
from app.core.database import SessionLocal
from app.models.job import Job, JobStatus
from datetime import datetime

router = APIRouter()


class QMJobRequest(BaseModel):
    molecule_data: dict  # Dictionary with 'symbols' and 'coordinates' (in Angstroms)
    task_type: str = 'single_point'
    theory: str = 'b3lyp'
    basis_set: str = '6-31g*'
    charge: int = 0
    multiplicity: int = 1
    software: str = 'psi4'  # 'psi4' or 'orca'
    extra_keywords: Optional[List[str]] = None
    pal: int = 1  # Number of processors for ORCA


class QMJobResponse(BaseModel):
    job_id: int
    status: str
    message: str


@router.post("/", response_model=QMJobResponse)
async def create_qm_job(request: QMJobRequest):
    """Create a new quantum mechanics job."""
    db = SessionLocal()
    try:
        # Create job record
        job = Job(
            type="qm",
            status=JobStatus.PENDING,
            progress=0,
            created_at=datetime.utcnow()
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        
        # Send task to Celery
        qm_task.delay(
            job_id=job.id,
            molecule_data=request.molecule_data,
            task_type=request.task_type,
            theory=request.theory,
            basis_set=request.basis_set,
            charge=request.charge,
            multiplicity=request.multiplicity,
            software=request.software,
            extra_keywords=request.extra_keywords,
            pal=request.pal
        )
        
        return QMJobResponse(
            job_id=job.id,
            status="pending",
            message="Quantum mechanics job created successfully"
        )
    finally:
        db.close()


@router.get("/{job_id}", response_model=QMJobResponse)
async def get_qm_job(job_id: int):
    """Get status of a quantum mechanics job."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return QMJobResponse(
            job_id=job.id,
            status=job.status,
            message=f"Job is {job.status}"
        )
    finally:
        db.close()


@router.get("/")
async def list_qm_jobs():
    """List all quantum mechanics jobs."""
    db = SessionLocal()
    try:
        jobs = db.query(Job).filter(Job.type == "qm").all()
        return {
            "jobs": [
                {
                    "job_id": job.id,
                    "status": job.status,
                    "progress": job.progress,
                    "created_at": job.created_at,
                    
                    "completed_at": job.completed_at
                }
                for job in jobs
            ]
        }
    finally:
        db.close()