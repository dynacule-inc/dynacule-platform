"""Router for docking-related endpoints."""

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import uuid
from app.core.celery import celery_app
from app.worker.tasks import docking_task
from app.core.database import SessionLocal
from app.models.job import Job, JobStatus
from datetime import datetime

router = APIRouter()


class DockingJobRequest(BaseModel):
    ligand_smiles: str
    receptor_pdb_path: str  # Path to the receptor PDB file
    center_x: float
    center_y: float
    center_z: float
    size_x: float
    size_y: float
    size_z: float
    exhaustiveness: int = Field(default=8, ge=1)


class DockingJobResponse(BaseModel):
    job_id: int
    status: str
    message: str


@router.post("/", response_model=DockingJobResponse)
async def create_docking_job(request: DockingJobRequest):
    """Create a new docking job."""
    db = SessionLocal()
    try:
        # Create job record
        job = Job(
            type="docking",
            status=JobStatus.PENDING,
            progress=0,
            created_at=datetime.utcnow()
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        
        # Send task to Celery
        docking_task.delay(
            job_id=job.id,
            ligand_smiles=request.ligand_smiles,
            receptor_pdb_path=request.receptor_pdb_path,
            center_x=request.center_x,
            center_y=request.center_y,
            center_z=request.center_z,
            size_x=request.size_x,
            size_y=request.size_y,
            size_z=request.size_z,
            exhaustiveness=request.exhaustiveness
        )
        
        return DockingJobResponse(
            job_id=job.id,
            status="pending",
            message="Docking job created successfully"
        )
    finally:
        db.close()


@router.get("/{job_id}", response_model=DockingJobResponse)
async def get_docking_job(job_id: int):
    """Get status of a docking job."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return DockingJobResponse(
            job_id=job.id,
            status=job.status,
            message=f"Job is {job.status}"
        )
    finally:
        db.close()


@router.get("/")
async def list_docking_jobs():
    """List all docking jobs."""
    db = SessionLocal()
    try:
        jobs = db.query(Job).filter(Job.type == "docking").all()
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