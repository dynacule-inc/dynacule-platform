from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.job import Project

router = APIRouter()


class ProjectCreate(BaseModel):
    name: str
    description: str = ""


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/")
async def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()


@router.post("/")
async def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(name=data.name, description=data.description)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project
