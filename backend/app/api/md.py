"""Router for molecular dynamics-related endpoints."""

import os
import tempfile
import uuid
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.core.celery import celery_app
from app.worker.tasks import md_task
from app.core.database import SessionLocal
from app.models.job import Job, JobStatus
from datetime import datetime

router = APIRouter()


class MDJobRequest(BaseModel):
    pdb_content: str = Field(..., min_length=1)  # Base64 encoded or plain text PDB content
    forcefield: str = 'amber14-all.xml'
    solvent: str = 'tip3p'
    box_padding: float = 1.0
    ionic_strength: float = 0.15
    minimization_steps: int = 500
    equilibration_steps: int = 1000
    production_steps: int = 50000
    temperature: float = 300.0


class MDJobResponse(BaseModel):
    job_id: int
    status: str
    message: str


@router.post("/", response_model=MDJobResponse)
async def create_md_job(request: MDJobRequest):
    """Create a new molecular dynamics job."""
    db = SessionLocal()
    try:
        # Save PDB content to temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.pdb', delete=False) as f:
            f.write(request.pdb_content)
            pdb_file = f.name
        
        try:
            # Create job record
            job = Job(
                type="md",
                status=JobStatus.PENDING,
                progress=0,
                created_at=datetime.utcnow()
            )
            db.add(job)
            db.commit()
            db.refresh(job)
            
            # Send task to Celery
            md_task.delay(
                job_id=job.id,
                pdb_file_path=pdb_file,
                forcefield=request.forcefield,
                solvent=request.solvent,
                box_padding=request.box_padding,
                ionic_strength=request.ionic_strength,
                minimization_steps=request.minimization_steps,
                equilibration_steps=request.equilibration_steps,
                production_steps=request.production_steps,
                temperature=request.temperature
            )
            
            return MDJobResponse(
                job_id=job.id,
                status="pending",
                message="Molecular dynamics job created successfully"
            )
        finally:
            # Clean up temporary PDB file (the task will copy it if needed)
            if os.path.exists(pdb_file):
                os.unlink(pdb_file)
    finally:
        db.close()


@router.get("/{job_id}", response_model=MDJobResponse)
async def get_md_job(job_id: int):
    """Get status of a molecular dynamics job."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return MDJobResponse(
            job_id=job.id,
            status=job.status,
            message=f"Job is {job.status}"
        )
    finally:
        db.close()


@router.get("/")
async def list_md_jobs():
    """List all molecular dynamics jobs."""
    db = SessionLocal()
    try:
        jobs = db.query(Job).filter(Job.type == "md").all()
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