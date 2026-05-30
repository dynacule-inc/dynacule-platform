from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.job import JobStatus

class JobCreate(BaseModel):
    job_type: str

class JobUpdate(BaseModel):
    status: Optional[JobStatus] = None
    progress: Optional[int] = None
    result: Optional[str] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None