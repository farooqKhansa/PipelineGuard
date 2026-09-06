from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import Investigation, PipelineRun, RunTraceEvent

router = APIRouter(prefix="/api/v1", tags=["trace"])


@router.get("/runs/{run_id}/trace")
def get_run_trace(run_id: str, db: Session = Depends(get_db)):
    run = db.get(PipelineRun, run_id)
    if not run:
        raise HTTPException(404, "not_found")

    events = db.execute(
        select(RunTraceEvent).where(RunTraceEvent.run_id == run_id).order_by(RunTraceEvent.at)
    ).scalars().all()

    investigation = db.execute(
        select(Investigation).where(Investigation.run_id == run_id)
    ).scalars().first()

    return {
        "runId": run.id,
        "repo": run.pipeline.repository.full_name if run.pipeline and run.pipeline.repository else "",
        "workflowRunId": run.workflow_run_id,
        "status": run.status,
        "riskScore": run.risk_score,
        "decisions": run.decisions or [],
        "startedAt": run.started_at.isoformat() if run.started_at else None,
        "durationMs": run.duration_ms,
        "investigationId": investigation.id if investigation else None,
        "fixId": investigation.fix_id if investigation else None,
        "events": [
            {
                "stage": e.stage,
                "status": e.status,
                "at": e.at.isoformat() if e.at else None,
                "durationMs": e.duration_ms,
                "detail": e.detail,
            }
            for e in events
        ],
    }
