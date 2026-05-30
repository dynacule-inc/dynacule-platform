"""
Unified jobs router — single endpoint to list, inspect, and subscribe
to all job types (docking, MD, QM) across the system.
"""

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, Depends
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.job import Job, JobStatus
from app.core.redis import get_redis

router = APIRouter()


# ── REST endpoints ───────────────────────────────────────────────────────

@router.get("/")
async def list_jobs(
    status: Optional[str] = Query(None, description="Filter by status"),
    job_type: Optional[str] = Query(None, description="Filter by type: docking, md, qm"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List all jobs across types, with optional filters and pagination."""
    query = db.query(Job)

    if status:
        query = query.filter(Job.status == status)
    if job_type:
        query = query.filter(Job.type == job_type)

    total = query.count()
    jobs = (
        query
        .order_by(Job.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "jobs": [
            {
                "id": j.id,
                "type": j.type,
                "status": j.status,
                "progress": j.progress,
                "error": j.error,
                "created_at": str(j.created_at) if j.created_at else None,
                "completed_at": str(j.completed_at) if j.completed_at else None,
            }
            for j in jobs
        ],
    }


@router.get("/stats")
async def job_stats(db: Session = Depends(get_db)):
    """Get aggregated job statistics."""
    query = db.query(Job)
    total = query.count()
    by_status = {}
    by_type = {}

    for s in ["pending", "processing", "completed", "failed"]:
        cnt = query.filter(Job.status == s).count()
        if cnt > 0:
            by_status[s] = cnt

    for t in ["docking", "md", "qm"]:
        cnt = query.filter(Job.type == t).count()
        if cnt > 0:
            by_type[t] = cnt

    return {
        "total": total,
        "by_status": by_status,
        "by_type": by_type,
    }


@router.get("/{job_id}")
async def get_job(job_id: int, db: Session = Depends(get_db)):
    """Get full details of a specific job, including result data."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "id": job.id,
        "job_id": job.job_id,
        "type": job.type,
        "status": job.status,
        "progress": job.progress,
        "result": job.result,
        "error": job.error,
        "created_at": str(job.created_at) if job.created_at else None,
        "completed_at": str(job.completed_at) if job.completed_at else None,
    }


# ── WebSocket for global job events ──────────────────────────────────────
# Clients connect here to receive real-time job status updates.
# The backend publishes job lifecycle events to Redis channel "job:events"
# and this WebSocket fans them out to connected dashboards.

active_dashboards: list[WebSocket] = []


@router.websocket("/ws")
async def job_events_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time job events across all types."""
    await websocket.accept()
    active_dashboards.append(websocket)

    try:
        # Subscribe to global job events from Redis
        redis_client = await get_redis()
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("job:events")

        # Send current stats on connect
        try:
            from app.core.database import SessionLocal
            db = SessionLocal()
            query = db.query(Job)
            total = query.count()
            by_status = {}
            for s in ["pending", "processing", "completed", "failed"]:
                cnt = query.filter(Job.status == s).count()
                by_status[s] = cnt
            db.close()
            await websocket.send_json({"type": "init", "total": total, "by_status": by_status})
        except Exception:
            pass

        # Fan out Redis messages to this client
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    await websocket.send_text(message["data"])
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if websocket in active_dashboards:
            active_dashboards.remove(websocket)
            try:
                await websocket.close()
            except Exception:
                pass