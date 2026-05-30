"""
SQLAlchemy models for Dynacule backend.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from app.core.database import Base


class JobStatus:
    """String constants for job lifecycle states."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Molecule(Base):
    __tablename__ = "molecules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    smiles = Column(String(1024), nullable=True)
    formula = Column(String(255), nullable=True)
    pdb_content = Column(Text, nullable=True)
    mol_content = Column(Text, nullable=True)
    source = Column(String(50), default="smiles")  # smiles, pdb, mol, sdf
    project_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(50), unique=True, index=True)
    type = Column(String(50))
    status = Column(String(50), default=JobStatus.PENDING)
    progress = Column(Integer, default=0)
    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
